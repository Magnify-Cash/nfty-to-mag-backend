import express, { Router } from "express";
import { getUserLastOrders } from "../controllers/controller";

const router = express.Router();

export default (app: Router) => {
  app.use("/", router);
  router.get("/user/order", getUserLastOrders);
};
