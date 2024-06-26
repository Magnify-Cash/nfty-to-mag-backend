import express, { Router } from "express";
import { getUserLastOrders, health } from "../controllers/controller";

const router = express.Router();

export default (app: Router) => {
  app.use("/", router);
  router.get("/user/order", getUserLastOrders);
  router.get("/api/health", health);
};
