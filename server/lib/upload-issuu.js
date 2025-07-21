const dotenv = require("dotenv");

dotenv.config();

async function uploadIssuu(req, res) {
  const { title, description, s3Url, fileSize } = req.body;

  console.log("Input:", title, description, s3Url, fileSize);

  // Validate required fields
  if (!title || !description || !s3Url || !fileSize) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });
  }

  if (typeof s3Url !== "string" || !s3Url.startsWith("http")) {
    return res.status(400).json({ success: false, error: "Invalid s3Url" });
  }

  if (isNaN(Number(fileSize))) {
    return res.status(400).json({ success: false, error: "Invalid fileSize" });
  }

  try {
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

    const slug = draftResult.slug;
    if (!slug) {
      throw new Error("Draft slug not returned from Issuu");
    }

    // Calculate wait time: min 50 seconds, max 8 minutes (480 seconds)
    const fileSizeMB = fileSize / (1024 * 1024); // Convert bytes to MB
    const calculatedWaitTime = Math.round(fileSizeMB * 30); // 60 seconds per MB
    const waitTimeSeconds = Math.max(30, Math.min(480, calculatedWaitTime)); // min 50s, max 8min

    console.log(
      `File size: ${fileSizeMB.toFixed(
        2
      )} MB, waiting ${waitTimeSeconds} seconds (${(
        waitTimeSeconds / 60
      ).toFixed(1)} minutes)`
    );

    await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));

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

    // Success
    res.status(201).json({
      success: true,
      draftSlug: slug,
      publishResult,
    });
  } catch (error) {
    console.error("❌ Upload to Issuu failed:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

module.exports = uploadIssuu;
