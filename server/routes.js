const Router = require("express");
const multer = require("multer");
const validate = require("./lib/validate");
const upload = require("./lib/upload");
const deletePDF = require("./lib/delete");

const router = Router();
const multerUpload = multer({ dest: "uploads/" });

router.get("/", (req, res) => {
  res.status(200).json({
    service: "PDF Management API",
    endpoints: {
      "GET /validate": "Validate PDF exists in both S3 and Issuu",
      "POST /upload": "Upload PDF to both S3 and Issuu",
      "DELETE /delete": "Delete PDF from both S3 and Issuu",
    },
  });
});

router.get("/validate", validate);

router.post("/upload", multerUpload.single("file"), upload);

router.delete("/delete", deletePDF.deletePDF);

router.delete("/delete-s3", deletePDF.deleteOnlyS3);

module.exports = { router };
