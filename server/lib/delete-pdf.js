const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const s3 = require("./s3-client");

dotenv.config();

async function deletePDF(req, res) {
  const { filename } = req.query;

  if (!filename) {
    return res
      .status(400)
      .json({ success: false, error: "Filename is required." });
  }

  const command = new DeleteObjectCommand({
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: filename,
  });

  try {
    await s3.send(command);
    console.log(`✅ Deleted ${filename} from ${process.env.AWS_BUCKET_NAME}`);
    return res.status(200).json({
      success: true,
      data: {
        message: `✅ Deleted ${filename} from ${process.env.AWS_BUCKET_NAME}`,
      },
    });
  } catch (error) {
    console.error("❌ S3 delete error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = deletePDF;
