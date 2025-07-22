const dotenv = require("dotenv");

dotenv.config();

async function uploadIssuu(req, res) {
  const { title, description, s3Url, fileSize } = req.body;

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

    let validation = true;

    while (validation) {
      await new Promise((resolve) => setTimeout(resolve, 10000));
     
      const validateConversion = await fetch(
        `https://api.issuu.com/v2/drafts/${slug}`,
        {
          method: "GET",
          headers: { Authorization: `Bearer ${process.env.ISSUU_TOKEN}` },
        }
      );

      const resultValidate = await validateConversion.json();

      if (!validateConversion.ok) {
        throw new Error(resultValidate.message);
      }

      console.log(resultValidate);

      if (resultValidate.fileInfo.conversionStatus === "DONE") {
        validation = false;
        break;
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
