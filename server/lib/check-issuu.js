const dotenv = require("dotenv");
dotenv.config();

async function checkIssuu(req, res) {
  const { slug } = req.query;

  try {
    const response = await fetch(
      `https://api.issuu.com/v2/publications/${slug}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.ISSUU_TOKEN}`,
        },
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error("Unable to find publication");
    }

    console.log(result.publicLocation);

    res
      .status(200)
      .json({ success: true, data: { url: result.publicLocation } });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, error: error });
  }
}

module.exports = checkIssuu;
