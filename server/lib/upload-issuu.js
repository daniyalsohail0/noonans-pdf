const fs = require("fs");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

async function uploadIssuu(req, res) {
  const pdfPath = req.file?.path;
  const { title, description, s3Url } = req.body;

  console.log("Input:", title, description, s3Url);

  if (!pdfPath) {
    return res.status(400).json({ success: false, error: "Missing file" });
  }

  if (!s3Url || typeof s3Url !== "string" || !s3Url.startsWith("http")) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid or missing s3Url" });
  }

  let fileSizeInBytes;
  try {
    const stats = await fs.promises.stat(pdfPath);
    fileSizeInBytes = stats.size;
    console.log("File size in bytes:", fileSizeInBytes);
  } catch (err) {
    console.error("Failed to get file size", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to get file size" });
  }

  try {
    // Create draft
    const draftResponse = await fetch(`https://api.issuu.com/v2/drafts`, {
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
          access: "PRIVATE",
          title,
          description,
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
    console.log("Draft creation response:", draftResult);

    const slug = draftResult.slug;
    if (!slug) {
      throw new Error("Draft slug not returned from Issuu");
    }

    // Wait 5 seconds before publishing the draft
    await new Promise((resolve) => setTimeout(resolve, fileSizeInBytes));

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
    console.log("Publish response:", publishResult);

    // Clean up temp file on success
    if (pdfPath && fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    // Respond with success and useful info
    res.status(201).json({
      success: true,
      draftSlug: slug,
      publishResult,
    });
  } catch (error) {
    console.error("❌ Upload to Issuu failed:", error);

    // Clean up on error
    if (pdfPath && fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

module.exports = uploadIssuu;
