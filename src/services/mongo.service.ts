import { handleError, handleInfo } from "../utils/logs.handler";
import { config, ProgressConfig } from "../config";
import { IOrder, MongoOrder, Status } from "../models/order.schema";
import { MongoToken } from "../models/token.schema";
import { IAddOrder, IProgress } from "./types/mongo.types";
import { MongoProgress } from "../models/progress.scema";

const WHERE = "MongoService";

class MongoService {
  progressBlockId = config.get<ProgressConfig>("progress").block;

  //// Progress

  async setBlockProgress(lastBlock: number, chainType: string) {
    try {
      await MongoProgress.findByIdAndUpdate(
        this.progressBlockId,
        { [chainType]: lastBlock },
        { upsert: true },
      );
      handleInfo(WHERE, "updated", "setBlockProgress", {
        chainType,
        lastBlock,
      });
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

  async addOrder(addOrder: IAddOrder): Promise<IOrder> {
    try {
      const order = Object.assign(addOrder, {
        _id: addOrder.nonce,
        createdAt: new Date(),
        createdTimestamp: Date.now(),
        nonce: addOrder.nonce.split("-")[1],
      }) as IOrder;
      const createdOrder = await MongoOrder.create(order);
      handleInfo(WHERE, "saved order -> " + addOrder.nonce, "addOrder");
      return createdOrder as IOrder;
    } catch (e) {
      handleError(WHERE, "addOrder", arguments, e);
      throw e;
    }
  }

  async orderBlocked(nonce: string, txHash: string) {
    const updatedTimestamp = Date.now();
    const status = Status.Blocked.toString();
    await MongoOrder.findByIdAndUpdate(nonce, {
      updatedTimestamp,
      status,
      blockHash: txHash,
    });
    handleInfo(WHERE, "order blocked -> " + nonce, "orderBlocked");
  }

  async orderComplete(
    fromChainNonce: string,
    withdrawTxHash: string,
    noncePrefix: string,
  ) {
    if (!fromChainNonce.includes(noncePrefix)) {
      handleInfo(
        WHERE,
        "Wrong chain to update withdraw, skip",
        "orderComplete",
      );
      return;
    }
    const updatedTimestamp = Date.now();
    const status = Status.Complete.toString();
    const order = await MongoOrder.findById(fromChainNonce);
    if (!order)
      throw new Error(`Order ${fromChainNonce} not found, skip for now`);
    await MongoOrder.findByIdAndUpdate(fromChainNonce, {
      withdrawTxHash,
      updatedTimestamp,
      status,
    });
    handleInfo(WHERE, "order complete -> " + fromChainNonce, "orderComplete");
  }

  async orderUsed(fromChainNonce: number | string) {
    const status = Status.Complete.toString();
    await MongoOrder.findByIdAndUpdate(fromChainNonce, {
      status,
      updatedTimestamp: Date.now(),
    });
    handleInfo(WHERE, "order complete -> " + fromChainNonce, "orderUsed");
  }

  async orderRefunded(fromChainNonce: string) {
    const updatedTimestamp = Date.now();
    const status = Status.Refunded.toString();
    await MongoOrder.findOneAndUpdate(
      { nonce: fromChainNonce },
      {
        updatedTimestamp,
        status,
      },
    );
    handleInfo(WHERE, "order refunded -> " + fromChainNonce, "orderRefunded");
  }

  async getOrder(fromChainNonce: number | string): Promise<IOrder | null> {
    return MongoOrder.findById(fromChainNonce).lean().exec();
  }

  async getOrderByNonce(fromChainNonce: string): Promise<IOrder | null> {
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

  async getStuckOrders(lteTimestamp: number) {
    let orders: IOrder[] = [];
    try {
      orders = (await MongoOrder.find({
        status: { $in: [Status.Blocked.toString(), Status.Sent.toString()] },
        blockTimestamp: { $lte: lteTimestamp },
      }).lean()) as IOrder[];
    } catch (e) {
      handleError(WHERE, "getStuckOrdersErrors", {}, e);
    }
    return orders;
  }

  async getLastOrderFrom(userAddr: string) {
    try {
      const order = (await MongoOrder.findOne({
        fromUser: userAddr,
      })
        .sort({ createdAt: -1 })
        .lean()) as IOrder;
      return order;
    } catch (e) {
      handleError(WHERE, "getOrdersFrom", arguments, e);
      throw new Error("Getting user order failed.");
    }
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

  async removeChainToken(symbol: string) {
    try {
      await MongoToken.deleteOne({ _id: symbol }).exec();
    } catch (e) {
      handleError(WHERE, "removeChainToken", arguments, e);
    }
  }
}

export default new MongoService();
