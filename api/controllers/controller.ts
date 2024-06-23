import { Request, Response } from "express";
import { logger } from "../../src/logger";
import infoService from "../../src/services/info.service";
import { HistoryType } from "../../src/services/types/info.types";

type ReqQuery = { user?: string };
type HandlerRequest = Request<ReqQuery>; // u pass generic type to params, query arg on 4 position

export async function info(req: Request, res: Response) {
  try {
    return res.status(200).send("OK");
  } catch (err) {
    logger().error(`controller: ${err}`);
    return res.status(500).send(err);
  }
}

// export async function ordersByUserFrom(req: HandlerRequest, res: Response) {
//   try {
//     const user = req.query.user;
//     if (!user) {
//       return res.status(400).send(`Wrong params! (user: ${user})`);
//     } else {
//       const history = await infoService.getHistoryOrders(
//         `${user}`,
//         HistoryType.from
//       );
//       return res.status(200).send(history);
//     }
//   } catch (err) {
//     logger().error(`controller: ${err}`);
//     return res.status(500).send(err);
//   }
// }

// export async function ordersByUserTo(req: HandlerRequest, res: Response) {
//   try {
//     const user = req.query.user;
//     if (!user) {
//       return res.status(400).send(`Wrong params! (user: ${user})`);
//     } else {
//       const history = await infoService.getHistoryOrders(
//         `${user}`,
//         HistoryType.to,
//       );
//       return res.status(200).send(history);
//     }
//   } catch (err) {
//     logger().error(`controller: ${err}`);
//     return res.status(500).send(err);
//   }
// }

export async function tokensIcons(req: Request, res: Response) {
  try {
    const icons = await infoService.getTokensIcons();
    return res.status(200).send(icons);
  } catch (err) {
    logger().error(`controller: ${err}`);
    return res.status(500).send(err);
  }
}
