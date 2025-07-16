const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const dotenv = require("dotenv");
const { router } = require("./routes");

dotenv.config();

async function server() {
  const app = express();
  const port = process.env.PORT ?? 8000;

  app.use(cors());
  app.use(morgan("dev"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use("/api", router);

  app.listen(port, () => {
    console.log(`Server started at: ${port}`);
  });
}

server();
