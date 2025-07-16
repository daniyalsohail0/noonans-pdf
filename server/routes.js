const Router = require("express");
const multer = require("multer");
const uploadToS3 = require("./lib/upload-s3");
const checkS3 = require("./lib/check-s3");
const deletePDF = require("./lib/delete-pdf");

const router = Router();
const upload = multer({ dest: "uploads/" });

router.get("/", (req, res) => {
  res.status(200).json({ hello: "world" });
});

router.post("/upload-to-s3", upload.single("file"), uploadToS3);

router.get("/check-s3", checkS3);

router.delete("/delete-pdf", deletePDF);

module.exports = router;
