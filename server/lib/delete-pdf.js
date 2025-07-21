const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const dotenv = require("dotenv");
const s3 = require("./s3-client");

dotenv.config();

async function deletePDF(req, res) {
  const { filename, issuuSlug } = req.query;

  console.log(filename, issuuSlug);

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
    // Delete from S3
    await s3.send(command);
    console.log(`✅ Deleted ${filename} from ${process.env.AWS_BUCKET_NAME}`);

    // Delete from Issuu if slug is provided
    if (issuuSlug) {
      console.log(
        `Deleting from Issuu: https://api.issuu.com/v2/publications/${issuuSlug}`
      );

      const deleteResponse = await fetch(
        `https://api.issuu.com/v2/publications/${issuuSlug}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${process.env.ISSUU_TOKEN}`,
          },
        }
      );

      // Check if the delete was successful
      if (deleteResponse.ok) {
        console.log(
          `✅ Successfully deleted from Issuu (Status: ${deleteResponse.status})`
        );

        // Only try to parse JSON if there's content
        const contentType = deleteResponse.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          try {
            const responseData = await deleteResponse.json();
            console.log("Issuu delete response:", responseData);
          } catch (jsonError) {
            console.log(
              "No JSON response body from Issuu delete (this is normal)"
            );
          }
        } else {
          console.log("Issuu delete successful - no JSON response body");
        }
      } else {
        console.error(
          `❌ Failed to delete from Issuu (Status: ${deleteResponse.status})`
        );
        const errorText = await deleteResponse.text();
        console.error("Issuu error response:", errorText);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        message: `✅ Deleted ${filename} from S3${
          issuuSlug ? " and Issuu" : ""
        }`,
      },
    });
  } catch (error) {
    console.error("Delete error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = deletePDF;
