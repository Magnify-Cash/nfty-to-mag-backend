import { handleError } from "../utils/logs.handler";
import mongoService from "./mongo.service";
import { ChainsConfig, config } from "../config";
import {
  HistoryType,
  OrderHistory,
  OrderToken,
  TokensIcons,
} from "./types/info.types";
import { IToken } from "../models/token.schema";
import { IOrder } from "../models/order.schema";

const WHERE = "InfoService";

class InfoService {
  private tokens: IToken[] = [];

  private async updateTokens() {
    this.tokens = await mongoService.getAllTokens();
  }

  // private toOrderHistory(order: IOrder): OrderHistory {
  //   const token = {
  //     symbol: null,
  //     decimals: null,
  //   } as OrderToken;
  //
  //   const ordersToken = this.tokens.find((t) => {
  //     return order.fromChain === config.get<ChainsConfig>("chains").source.name
  //       ? t.binanceAddress.toLowerCase() === order.tokenFromChain.toLowerCase() // if binance
  //       : t.loopAddress.toLowerCase() === order.tokenFromChain.toLowerCase(); // if loop
  //   });
  //   if (ordersToken) {
  //     token.symbol = ordersToken._id;
  //     token.decimals = ordersToken.decimals;
  //   }
  //
  //   const direction = {
  //     // ?: perhaps will be necessary to change on chainId
  //     from: order.fromChain,
  //     to: order.toChain,
  //   };
  //   return {
  //     id: order._id,
  //     nonce: order.nonce,
  //     status: order.status,
  //     date: order.createdAt,
  //     amount: order.amount,
  //     origin: order.fromUser,
  //     destination: order.toUser,
  //     direction,
  //     token,
  //   };
  // }

  // async getHistoryOrders(userAddr: string, type: HistoryType) {
  //   try {
  //     let orders: IOrder[] = [];
  //     if (type === HistoryType.from) {
  //       orders = await mongoService.getOrdersFrom(userAddr);
  //     }
  //     if (type === HistoryType.to) {
  //       orders = await mongoService.getOrdersTo(userAddr);
  //     }
  //     await this.updateTokens();
  //     return orders.reduce<OrderHistory[]>((memory, item) => {
  //       memory.push(this.toOrderHistory(item));
  //       return memory;
  //     }, []);
  //   } catch (e) {
  //     handleError(WHERE, "getHistoryOrders", arguments, e);
  //   }
  // }

  async getTokensIcons(): Promise<TokensIcons> {
    let tokensIcons = {} as TokensIcons;
    try {
      await this.updateTokens();
      let binance = {};
      let loop = {};

      this.tokens.forEach((t) => {
        if (t.binanceAddress) {
          binance = Object.assign(binance, {
            [t.binanceAddress]: t.logoUrl,
          });
        }
        if (t.loopAddress) {
          loop = Object.assign(loop, {
            [t.loopAddress]: t.logoUrl,
          });
        }
      });

      tokensIcons = Object.assign(tokensIcons, {
        binance: binance,
        loop: loop,
      });
    } catch (e) {
      handleError(WHERE, "getTokensIcons", {}, e);
    }
    return tokensIcons;
  }
}

export default new InfoService();
