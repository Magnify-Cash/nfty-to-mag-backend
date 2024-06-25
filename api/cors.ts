import { Router } from "express";
import cors from "cors";
import { config } from "../src/config";

export default (app: Router) => {
  const whitelist = config.get<string[]>("corsWhitelist");
  if (!whitelist || !whitelist.length) return app.use(cors());
  const options = {
    origin: whitelist,
  };
  app.use(cors(options));
};
