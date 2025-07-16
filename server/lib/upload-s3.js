const fs = require("fs");
const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const dotenv = require("dotenv");
const s3 = require("./s3-client");

dotenv.config();


async function generateSignedURL(filename) {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: filename,
    ContentType: "application/pdf",
  });

  return await getSignedUrl(s3, command, { expiresIn: 300 });
}

const uploadToS3 = async (req, res) => {
  try {
    const file = req.file;
    const requestedFilename = req.body.filename; // ✅ Use sanitized name from client

    if (!file || !requestedFilename) {
      return res.status(400).json({ error: "Missing file or filename" });
    }

    const sanitizedFilename = requestedFilename.replace(/\s+/g, "-");

    const signedUrl = await generateSignedURL(sanitizedFilename);
    const fileBuffer = fs.readFileSync(file.path);

    const response = await fetch(signedUrl, {
      method: "PUT",
      body: fileBuffer,
      headers: {
        "Content-Type": "application/pdf",
      },
    });

    fs.unlinkSync(file.path); // cleanup temp file

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Upload failed with status ${response.status} ${response.statusText}. Response: ${errorText}`
      );
    }

    const publicUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${sanitizedFilename}`;

    res.status(200).json({
      success: true,
      data: { url: publicUrl, filename: sanitizedFilename },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = uploadToS3;
