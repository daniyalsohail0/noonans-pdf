const { HeadObjectCommand } = require("@aws-sdk/client-s3");
const s3 = require("./s3-client");

async function checkS3(req, res) {
  try {
    const params = req.query;

    const filename = params.filename;

    if (!filename) {
      res.status(400).json({ success: false, error: "Filename is required" });
      return;
    }

    const command = new HeadObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filename,
    });

    await s3.send(command);

    const fileUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${filename}`;

    res.status(200).json({ success: true, data: { fileUrl } });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: error });
  }
}

module.exports = checkS3;
