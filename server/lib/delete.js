const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const s3 = require("./s3-client");

dotenv.config();

async function deleteFromS3(filename) {
  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: filename,
  });

  await s3.send(command);
  console.log(`Deleted ${filename} from S3 bucket ${process.env.AWS_BUCKET_NAME}`);
}

async function deleteFromIssuu(issuuSlug) {
  const deleteResponse = await fetch(
    `https://api.issuu.com/v2/publications/${issuuSlug}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${process.env.ISSUU_TOKEN}`,
      },
    }
  );

  if (!deleteResponse.ok) {
    const errorText = await deleteResponse.text();
    throw new Error(`Failed to delete from Issuu: ${errorText}`);
  }

  console.log(`Deleted publication ${issuuSlug} from Issuu`);
}

async function deletePDF(req, res) {
  try {
    const { auction_id, 'issuu.slug': issuuSlug } = req.query;

    if (!auction_id || !issuuSlug) {
      return res.status(400).json({
        success: false,
        error: "Both auction_id and issuu.slug are required",
      });
    }
    
    const filename = `${auction_id}.pdf`;

    const results = {
      s3: { deleted: false },
      issuu: { deleted: false },
    };

    // Delete from S3
    try {
      await deleteFromS3(filename);
      results.s3.deleted = true;
    } catch (s3Error) {
      console.error("S3 deletion error:", s3Error);
      results.s3.error = s3Error.message;
    }

    // Delete from Issuu
    try {
      await deleteFromIssuu(issuuSlug);
      results.issuu.deleted = true;
    } catch (issuuError) {
      console.error("Issuu deletion error:", issuuError);
      results.issuu.error = issuuError.message;
    }

    // Check if both deletions were successful
    const success = results.s3.deleted && results.issuu.deleted;

    if (success) {
      res.status(200).json({
        success: true,
        message: `Successfully deleted ${filename} from both S3 and Issuu`,
        data: results,
      });
    } else {
      // Partial success or failure
      res.status(207).json({
        success: false,
        message: "Partial deletion - check individual results",
        data: results,
      });
    }
  } catch (error) {
    console.error("Delete error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

module.exports = deletePDF;