import express, { Router } from "express";
import {
  info,
  // ordersByUserFrom,
  // ordersByUserTo,
  tokensIcons,
} from "../controllers/controller";

const router = express.Router();

export default (app: Router) => {
  app.use("/", router);
  // router.get("/info", info);
  //
  // // router.get("/info/orders-by-from-user", ordersByUserFrom);
  // router.get("/info/orders-by-to-user", ordersByUserTo);
  //
  // router.get("/tokens/icons", tokensIcons);
};
