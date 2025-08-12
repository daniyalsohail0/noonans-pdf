const fs = require("fs");
const { PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const dotenv = require("dotenv");
const s3 = require("./s3-client");

dotenv.config();

async function generateSignedURL(filename, downloadFilename) {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: filename,
    ContentType: "application/pdf",
    ContentDisposition: `attachment; filename="${downloadFilename}.pdf"`,
  });

  return await getSignedUrl(s3, command, { expiresIn: 300 });
}

async function checkFileExists(filename) {
  try {
    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filename,
    });
    await s3.send(command);
    return true;
  } catch (error) {
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

async function uploadToS3(file, filename, downloadFilename) {
  const signedUrl = await generateSignedURL(filename, downloadFilename);
  const fileBuffer = fs.readFileSync(file.path);

  const response = await fetch(signedUrl, {
    method: "PUT",
    body: fileBuffer,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${downloadFilename}.pdf"`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `S3 upload failed with status ${response.status} ${response.statusText}. Response: ${errorText}`
    );
  }

  return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;
}

async function uploadToIssuu(title, description, s3Url, fileSize) {
  // Create draft on Issuu
  const draftResponse = await fetch("https://api.issuu.com/v2/drafts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.ISSUU_TOKEN}`,
    },
    body: JSON.stringify({
      confirmCopyright: true,
      fileUrl: s3Url,
      info: {
        file: 0,
        access: "PUBLIC",
        title: title,
        description: description,
        preview: false,
        type: "editorial",
        showDetectedLinks: false,
        downloadable: true,
      },
    }),
  });

  if (!draftResponse.ok) {
    const errorBody = await draftResponse.text();
    throw new Error(`Issuu draft creation failed: ${errorBody}`);
  }

  const draftResult = await draftResponse.json();
  const slug = draftResult.slug;

  if (!slug) {
    throw new Error("Draft slug not returned from Issuu");
  }

  // Poll for conversion completion
  let attempts = 0;
  const maxAttempts = 60; // 10 minutes max (10 seconds * 60)
  
  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 seconds
    attempts++;

    const validateConversion = await fetch(
      `https://api.issuu.com/v2/drafts/${slug}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${process.env.ISSUU_TOKEN}` },
      }
    );

    if (!validateConversion.ok) {
      const errorData = await validateConversion.json();
      throw new Error(errorData.message || "Failed to check draft status");
    }

    const resultValidate = await validateConversion.json();
    console.log(`Conversion status (attempt ${attempts}/${maxAttempts}):`, resultValidate.fileInfo?.conversionStatus);

    if (resultValidate.fileInfo?.conversionStatus === "DONE") {
      break;
    }

    if (attempts >= maxAttempts) {
      throw new Error("Issuu conversion timeout - took longer than 10 minutes");
    }
  }

  // Publish draft
  const publishResponse = await fetch(
    `https://api.issuu.com/v2/drafts/${slug}/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.ISSUU_TOKEN}`,
      },
    }
  );

  if (!publishResponse.ok) {
    const errorBody = await publishResponse.text();
    throw new Error(`Issuu draft publish failed: ${errorBody}`);
  }

  const publishResult = await publishResponse.json();
  
  return {
    slug,
    publishResult,
  };
}

async function upload(req, res) {
  let tempFilePath = null;
  
  try {
    const file = req.file;
    
    // Extract parameters from query string
    const {
      auction_id,
      's3.download_filename': s3DownloadFilename,
      'issuu.title': issuuTitle,
      'issuu.description': issuuDescription
    } = req.query;

    // Validate required parameters
    if (!auction_id) {
      return res.status(400).json({
        success: false,
        error: "auction_id parameter is required"
      });
    }

    if (!s3DownloadFilename) {
      return res.status(400).json({
        success: false,
        error: "s3.download_filename parameter is required"
      });
    }

    if (!issuuTitle) {
      return res.status(400).json({
        success: false,
        error: "issuu.title parameter is required"
      });
    }

    if (!issuuDescription) {
      return res.status(400).json({
        success: false,
        error: "issuu.description parameter is required"
      });
    }

    // Validate file upload
    if (!file) {
      return res.status(400).json({ 
        success: false, 
        error: "No file uploaded" 
      });
    }

    tempFilePath = file.path;
    
    // Validate file type
    if (file.mimetype !== "application/pdf") {
      fs.unlinkSync(tempFilePath);
      return res.status(400).json({
        success: false,
        error: "Only PDF files are allowed",
      });
    }
    
    // Use auction_id as the S3 filename (add .pdf extension)
    const s3Filename = `${auction_id}.pdf`;

    // Check if file already exists in S3
    console.log("Checking if file exists in S3...");
    const fileExists = await checkFileExists(s3Filename);
    
    if (fileExists) {
      fs.unlinkSync(tempFilePath);
      return res.status(409).json({
        success: false,
        error: `A file with auction_id "${auction_id}" already exists in S3.`,
      });
    }

    // Upload to S3 with Content-Disposition header
    console.log("Uploading to S3...");
    const s3Url = await uploadToS3(file, s3Filename, s3DownloadFilename);
    console.log("S3 upload complete:", s3Url);

    // Then upload to Issuu using the S3 URL
    console.log("Uploading to Issuu...");
    const issuuResult = await uploadToIssuu(issuuTitle, issuuDescription, s3Url, file.size);
    console.log("Issuu upload complete:", issuuResult.slug);

    // Clean up temp file after successful uploads
    if (tempFilePath) {
      fs.unlinkSync(tempFilePath);
      tempFilePath = null;
    }

    // Return success with both results
    res.status(200).json({
      success: true,
      data: {
        s3: {
          url: s3Url,
          filename: s3Filename,
          auction_id: auction_id,
        },
        issuu: {
          slug: issuuResult.slug,
          url: issuuResult.publishResult.publicLocation,
        },
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

module.exports = upload;