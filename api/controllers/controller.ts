import { Request, Response } from "express";
import { logger } from "../../src/logger";
import MongoService from "../../src/services/mongo.service";
import { isAddress } from "ethers";

export async function getUserLastOrders(
  req: Request<{ userAddress: string }>,
  res: Response,
) {
  try {
    const userAddress = req.query.userAddress;
    if (!userAddress)
      return res.status(400).json({ error: "userAddress required!" });
    if (!isAddress(userAddress))
      return res
        .status(400)
        .json({ error: "userAddress is not a valid address!" });
    const orderRes = await MongoService.getLastOrderFrom(`${userAddress}`);
    return res.status(200).send(orderRes);
  } catch (err) {
    logger().error(`controller: ${err}`);
    return res.status(500).send(err);
  }
}

export async function health(_req: Request, res: Response) {
  return res.status(200).json({
    status: "ok",
    details: {
      application: "healthy",
      database: "connected",
    },
  });
}
