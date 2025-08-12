const { HeadObjectCommand } = require("@aws-sdk/client-s3");
const s3 = require("./s3-client");
const dotenv = require("dotenv");

dotenv.config();

async function validate(req, res) {
  try {
    const { auction_id, 'issuu.slug': issuuSlug } = req.query;

    if (!auction_id || !issuuSlug) {
      return res.status(400).json({
        success: false,
        error: "Both auction_id and issuu.slug are required",
      });
    }
    
    const filename = `${auction_id}.pdf`;

    const result = {
      s3: null,
      issuu: null,
    };

    // Check S3
    try {
      const command = new HeadObjectCommand({
        Bucket: process.env.AWS_BUCKET_NAME,
        Key: filename,
      });

      await s3.send(command);
      
      result.s3 = {
        exists: true,
        url: `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`,
      };
    } catch (s3Error) {
      console.log("S3 validation error:", s3Error.message);
      result.s3 = {
        exists: false,
        error: "File not found in S3",
      };
    }

    // Check Issuu
    try {
      const response = await fetch(
        `https://api.issuu.com/v2/publications/${issuuSlug}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.ISSUU_TOKEN}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Publication not found in Issuu");
      }

      const issuuData = await response.json();
      
      result.issuu = {
        exists: true,
        url: issuuData.publicLocation,
        title: issuuData.title,
        description: issuuData.description,
        createdAt: issuuData.created,
      };
    } catch (issuuError) {
      console.log("Issuu validation error:", issuuError.message);
      result.issuu = {
        exists: false,
        error: "Publication not found in Issuu",
      };
    }

    // Determine overall success
    const success = result.s3?.exists && result.issuu?.exists;

    res.status(200).json({
      success,
      data: result,
    });
  } catch (error) {
    console.error("Validation error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = validate;