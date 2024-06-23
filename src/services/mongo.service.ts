import { handleError, handleInfo } from "../utils/logs.handler";
import { config, ProgressConfig } from "../config";
import { IOrder, MongoOrder, Status } from "../models/order.schema";
import { IToken, MongoToken } from "../models/token.schema";
import { IAddOrder, IProgress } from "./types/mongo.types";
import { MongoProgress } from "../models/progress.scema";

const WHERE = "MongoService";

class MongoService {
  progressBlockId = config.get<ProgressConfig>("progress").block;

  //// Progress

  async setBlockProgress(lastBlock: number, chainType: string) {
    try {
      const findUpdateRes = await MongoProgress.findByIdAndUpdate(
        this.progressBlockId,
        { [chainType]: lastBlock },
        { upsert: true },
      );
      //handleInfo(WHERE, "updated", "setBlockProgress", arguments);
    } catch (e) {
      handleError(WHERE, "setBlockProgress", arguments, e);
    }
  }

  async getBlockProgress() {
    const progress: IProgress = {
      source: 0,
      destination: 0,
    };
    try {
      const doc = await MongoProgress.findById(this.progressBlockId);
      if (doc) {
        progress.source = doc.source;
        progress.destination = doc.destination;
      }
    } catch (e) {
      handleError(WHERE, "getBlockProgress", {}, e);
    }
    return progress;
  }

  //// Orders

  async addOrder(addOrder: IAddOrder) {
    try {
      const order = Object.assign(addOrder, {
        _id: addOrder.nonce,
        createdAt: new Date(),
        createdTimestamp: Date.now(),
        status: Status.Sent.toString(),
        nonce: addOrder.nonce.split("POLYGON")[1],
      }) as IOrder;
      await MongoOrder.create(order);
      handleInfo(WHERE, "saved order -> " + addOrder.nonce, "addOrder");
    } catch (e) {
      handleError(WHERE, "addOrder", arguments, e);
    }
  }

  async orderBlocked(nonce: string) {
    try {
      const updatedTimestamp = Date.now();
      const status = Status.Blocked.toString();
      await MongoOrder.findByIdAndUpdate(nonce, {
        updatedTimestamp,
        status,
      });
      handleInfo(WHERE, "order blocked -> " + nonce, "orderBlocked");
    } catch (e) {
      handleError(WHERE, "orderBlocked", arguments, e);
    }
  }

  async orderComplete(
    fromChainNonce: number | string,
    withdrawBlock: number,
    withdrawTxHash: string,
  ) {
    try {
      const updatedTimestamp = Date.now();
      const status = Status.Complete.toString();
      await MongoOrder.findByIdAndUpdate(fromChainNonce, {
        withdrawBlock,
        withdrawTxHash,
        updatedTimestamp,
        status,
      });
      handleInfo(WHERE, "order complete -> " + fromChainNonce, "orderComplete");
    } catch (e) {
      handleError(WHERE, "orderComplete", arguments, e);
    }
  }

  async orderUsed(fromChainNonce: number | string) {
    try {
      const status = Status.Complete.toString();
      await MongoOrder.findByIdAndUpdate(fromChainNonce, {
        status,
        updatedTimestamp: Date.now(),
      });
      handleInfo(WHERE, "order complete -> " + fromChainNonce, "orderUsed");
    } catch (e) {
      handleError(WHERE, "orderUsed", arguments, e);
    }
  }

  async orderRefunded(fromChainNonce: number | string) {
    try {
      const updatedTimestamp = Date.now();
      const status = Status.Refunded.toString();
      await MongoOrder.findByIdAndUpdate(fromChainNonce, {
        updatedTimestamp,
        status,
      });
      handleInfo(WHERE, "order refunded -> " + fromChainNonce, "orderRefunded");
    } catch (e) {
      handleError(WHERE, "orderRefunded", arguments, e);
    }
  }

  async getOrder(fromChainNonce: number | string): Promise<IOrder | null> {
    return MongoOrder.findById(fromChainNonce).lean().exec();
  }

  async getOrderByNonce(fromChainNonce: number): Promise<IOrder | null> {
    return MongoOrder.findOne({ nonce: fromChainNonce }).lean().exec();
  }

  async getBlockedOrders() {
    let orders: IOrder[] = [];
    try {
      orders = (await MongoOrder.find({
        status: Status.Blocked.toString(),
      }).lean()) as IOrder[];
    } catch (e) {
      handleError(WHERE, "getBlockedErrors", {}, e);
    }
    return orders;
  }

  async getOrdersFrom(userAddr: string) {
    let orders: IOrder[] = [];
    try {
      orders = (await MongoOrder.find({
        fromUser: userAddr,
      })
        .sort({ createdAt: -1 })
        .lean()) as IOrder[];
    } catch (e) {
      handleError(WHERE, "getOrdersFrom", arguments, e);
    }
    return orders;
  }

  async getOrdersTo(userAddr: string) {
    let orders: IOrder[] = [];
    try {
      orders = (await MongoOrder.find({
        toUser: userAddr,
      })
        .sort({ createdAt: -1 })
        .lean()) as IOrder[];
    } catch (e) {
      handleError(WHERE, "getOrdersTo", arguments, e);
    }
    return orders;
  }

  /// Tokens

  async saveToken(
    symbol: string,
    destinationAddress: string,
    sourceAddress: string,
    decimals: number,
    logoUrl: string,
  ) {
    try {
      // It possible case, when only one address was removed and then wrote again on contracts
      await MongoToken.findByIdAndUpdate(
        symbol,
        {
          destinationAddress,
          sourceAddress,
          decimals,
          logoUrl,
        },
        { upsert: true },
      );
      handleInfo(WHERE, "saved!", "saveToken", arguments);
    } catch (e) {
      handleError(WHERE, "saveToken", arguments, e);
    }
  }

  async getAllTokens() {
    let tokens: IToken[] = [];
    try {
      tokens = (await MongoToken.find({}).lean()) as IToken[];
    } catch (e) {
      handleError(WHERE, "getAllTokens", {}, e);
    }
    return tokens;
  }

  // async removeChainToken(chain: string, address: string) {
  //   try {
  //     const isBinance =
  //       chain === config.get<ChainsConfig>("chains").binance.name;
  //
  //     let token;
  //     if (isBinance) {
  //       // if binance
  //       token = await MongoToken.findOne({
  //         binanceAddress: address,
  //       });
  //     } else {
  //       // if loop
  //       token = await MongoToken.findOne({
  //         loopAddress: address,
  //       });
  //     }
  //
  //     if (!token) {
  //       handleError(
  //         WHERE,
  //         "removeChainToken",
  //         arguments,
  //         "token to remove not found!",
  //       );
  //       return;
  //     }
  //
  //     if (isBinance) {
  //       token.binanceAddress = "";
  //     } else {
  //       token.loopAddress = "";
  //     }
  //
  //     if (!token.binanceAddress && !token.loopAddress) {
  //       await token.deleteOne();
  //       handleInfo(
  //         WHERE,
  //         `token removed for ${token._id}!`,
  //         "removeChainToken",
  //         arguments,
  //       );
  //     } else {
  //       await token.save();
  //       handleInfo(
  //         WHERE,
  //         `address removed for ${token._id}!`,
  //         "removeChainToken",
  //         arguments,
  //       );
  //     }
  //   } catch (e) {
  //     handleError(WHERE, "removeChainToken", arguments, e);
  //   }
  // }

  // async changeTokenAddress(
  //   chain: string,
  //   oldAddress: string,
  //   newAddress: string,
  // ) {
  //   try {
  //     const isBinance =
  //       chain === config.get<ChainsConfig>("chains").binance.name;
  //
  //     let token;
  //     if (isBinance) {
  //       // if binance
  //       token = await MongoToken.findOne({
  //         binanceAddress: oldAddress,
  //       });
  //     } else {
  //       // if loop
  //       token = await MongoToken.findOne({
  //         loopAddress: oldAddress,
  //       });
  //     }
  //
  //     if (!token) {
  //       handleError(
  //         WHERE,
  //         "changeTokenAddress",
  //         arguments,
  //         "token to change not found!",
  //       );
  //       return;
  //     }
  //
  //     if (isBinance) {
  //       token.binanceAddress = newAddress;
  //     } else {
  //       token.loopAddress = newAddress;
  //     }
  //
  //     await token.save();
  //
  //     handleInfo(
  //       WHERE,
  //       `address was changed for ${token._id}!`,
  //       "changeTokenAddress",
  //       arguments,
  //     );
  //   } catch (e) {
  //     handleError(WHERE, "changeTokenAddress", arguments, e);
  //   }
  // }
}

export default new MongoService();
