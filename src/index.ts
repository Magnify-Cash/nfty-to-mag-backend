import express, { Express } from "express";
import { applicationService } from "./app";
import { Config, config } from "./config";
import { instantiateLogger, logger } from "./logger";
import cors from "../api/cors";
import executionRouter from "../api/routes/router";
import { mongoConnect } from "./mongo";

const app: Express = express();

const { port, env } = config.get<Config>();

cors(app);
executionRouter(app);

app.listen(port, async () => {
  const metadata = { env };
  try {
    config.setMetadata(metadata);
    instantiateLogger(config.get("metadata"));
    await mongoConnect();
    await applicationService.start();
    logger().info(`⚡App server is running at ${port}`);
  } catch (err) {
    throw err;
  }
});
