import mongoService from "../mongo.service";
import {
  handleEmergency,
  handleError,
  handleInfo,
} from "../../utils/logs.handler";
import TaskQueue from "../../utils/tasks.queue";
import { Status } from "../../models/order.schema";
import SourceBridgeService from "./source.bridge.service";
import DestinationBridgeService from "../destination/destination.bridge.service";
import Erc20Contract from "../../contracts/erc20.contract";
import coingeckoService from "../coingecko.service";

const WHERE = "ProcessorService";

export default class SourceProcessorService {
  queues = {
    write: new TaskQueue("Write"), // that calls both or any of contracts (send calls both contracts)
    read: new TaskQueue("Read"), // that doesn't write contracts or doesn't interact with it at all
  };
  bridgeService: SourceBridgeService;
  destBridgeService: DestinationBridgeService;

  constructor(
    service: SourceBridgeService,
    destService: DestinationBridgeService,
  ) {
    this.bridgeService = service;

    this.destBridgeService = destService;
  }

  async processQueues() {
    const arr: Promise<void>[] = [];
    Object.values(this.queues).forEach((q) => {
      arr.push(q.processQueue());
    });
    await Promise.all(arr);
  }

  wrapSendInQueue(
    eventChain: string,
    toChain: string,
    blockNumber: number,
    transactionHash: string,
    token: string,
    tokenOnSecondChain: string,
    to: string,
    amount: string,
    nonce: string,
    amountToSend: string,
  ) {
    return this.queues.write
      .enqueue(() => {
        return this.processSendEvent(
          eventChain,
          toChain,
          blockNumber,
          transactionHash,
          token,
          tokenOnSecondChain,
          to,
          amount,
          nonce,
          amountToSend,
        );
      })
      .catch((e) => {
        handleEmergency(WHERE, "wrapSendInQueue", arguments, e);
      });
  }

  // wrapWithdrawInQueue(
  //   queue: TaskQueue,
  //   fromChain: string,
  //   eventChain: string,
  //   blockNumber: number,
  //   transactionHash: string,
  //   nonce: string,
  // ) {
  //   return queue
  //     .enqueue(() => {
  //       return this.processWithdrawEvent(
  //         fromChain,
  //         eventChain,
  //         blockNumber,
  //         transactionHash,
  //         nonce,
  //       );
  //     })
  //     .catch((e) => {
  //       handleEmergency(WHERE, "wrapWithdrawInQueue", arguments, e);
  //     });
  // }

  wrapRefundInQueue(nonce: string) {
    return this.queues.read
      .enqueue(() => {
        return this.processRefundEvent(nonce);
      })
      .catch((e) => {
        handleEmergency(WHERE, "wrapWithdrawInQueue", arguments, e);
      });
  }

  wrapAddTokenInQueue(token: string, tokenOnSecondChain: string) {
    return this.queues.read
      .enqueue(() => {
        return this.processAddTokenEvent(token, tokenOnSecondChain);
      })
      .catch((e) => {
        handleEmergency(WHERE, "wrapAddTokenInQueue", arguments, e);
      });
  }

  // wrapRemoveTokenInQueue(queue: TaskQueue, fromChain: string, token: string) {
  //   return queue
  //     .enqueue(() => {
  //       return this.processRemoveTokenEvent(fromChain, token);
  //     })
  //     .catch((e) => {
  //       handleEmergency(WHERE, "wrapRemoveTokenInQueue", arguments, e);
  //     });
  // }

  // wrapNewWrappedNativeInQueue(
  //   queue: TaskQueue,
  //   fromChain: string,
  //   oldWrappedNative: string,
  //   newWrappedNative: string,
  // ) {
  //   return queue
  //     .enqueue(() => {
  //       return this.processNewWrappedNativeEvent(
  //         fromChain,
  //         oldWrappedNative,
  //         newWrappedNative,
  //       );
  //     })
  //     .catch((e) => {
  //       handleEmergency(WHERE, "wrapNewWrappedNativeInQueue", arguments, e);
  //     });
  // }

  async processSendEvent(
    eventChain: string,
    toChain: string,
    blockNumber: number,
    transactionHash: string,
    token: string,
    tokenOnSecondChain: string,
    to: string, // user
    amount: string,
    nonceWithPrefix: string,
    amountToSend: string,
  ) {
    try {
      handleInfo(
        WHERE,
        "started processing send event",
        "processSendEvent",
        arguments,
      );
      const nonce = nonceWithPrefix.split("POLYGON")[1];
      const order = await mongoService.getOrder(nonceWithPrefix);

      let status;
      if (!order) {
        const tx = await this.bridgeService.getTx(transactionHash);
        const fromUser = tx ? tx.from : "TxLost";
        await mongoService.addOrder({
          fromChain: eventChain,
          toChain,
          nonce: nonceWithPrefix,
          fromUser: fromUser,
          toUser: to,
          tokenFromChain: token,
          tokenOtherChain: tokenOnSecondChain,
          amount,
          sendTxHash: transactionHash,
          createdOnBlock: blockNumber,
        });
        status = Status.Sent.toString();
      } else {
        status = order.status;
      }

      if (status !== Status.Sent.toString()) {
        handleInfo(WHERE, "skipped by status", "processSendEvent", arguments);
        return;
      }

      const isOrderBlocked = await this.bridgeService.blockOrder(
        nonceWithPrefix.split("POLYGON")[1],
      );
      if (isOrderBlocked) {
        const isOrderWithdrawn = await this.destBridgeService.withdrawOrder(
          tokenOnSecondChain,
          to,
          amountToSend,
          nonceWithPrefix,
        );
        if (isOrderWithdrawn) {
          handleInfo(WHERE, "send event processed => withdrawn");
          return;
        }
      }

      const isRefunded = await this.bridgeService.refundOrder(nonce);

      if (!isRefunded) {
        handleError(WHERE, "processSendEvent", arguments, "order stuck!");
      }
    } catch (e) {
      handleEmergency(WHERE, "processSendEvent", arguments, e);
    }
  }

  // async processWithdrawEvent(
  //   fromChain: string,
  //   eventChain: string,
  //   blockNumber: number,
  //   transactionHash: string,
  //   nonce: string,
  // ) {
  //   try {
  //     handleInfo(
  //       WHERE,
  //       "started processing withdraw event",
  //       "processWithdrawEvent",
  //       arguments,
  //     );
  //     await mongoService.orderComplete(
  //       fromChain,
  //       nonce,
  //       blockNumber,
  //       transactionHash,
  //     );
  //   } catch (e) {
  //     handleEmergency(WHERE, "processWithdrawEvent", arguments, e);
  //   }
  // }

  async processRefundEvent(nonce: string) {
    try {
      handleInfo(
        WHERE,
        "started processing refund event",
        "processRefundEvent",
        arguments,
      );

      const order = await mongoService.getOrder(nonce);
      if (!order) {
        handleError(
          WHERE,
          "processRefundEvent => " + nonce,
          arguments,
          "Order Not Found",
        );
        return;
      }
      if (order.status !== Status.Sent) {
        handleInfo(
          WHERE,
          "processRefundEvent => order has not a Sent status -> " +
            order.status,
        );
        return;
      }
      await mongoService.orderRefunded(nonce);

      handleInfo(WHERE, "refund event processed!");
    } catch (e) {
      handleEmergency(WHERE, "processRefundEvent", arguments, e);
    }
  }

  async processAddTokenEvent(token: string, tokenOnSecondChain: string) {
    try {
      handleInfo(
        WHERE,
        "started processing add token event",
        "processAddTokenEvent",
        arguments,
      );

      const erc20Source = new Erc20Contract(
        token,
        this.bridgeService.contract.wallet,
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const erc20Dest = new Erc20Contract(
        tokenOnSecondChain,
        this.destBridgeService.contract.wallet,
      );

      const decimalsSource = await erc20Source.decimals();
      const symbolSource = await erc20Source.symbol();

      const iconUrl = await coingeckoService.getLogoBySymbol(symbolSource);
      await mongoService.saveToken(
        symbolSource,
        tokenOnSecondChain,
        token,
        decimalsSource,
        iconUrl,
      );

      handleInfo(WHERE, "add token event processed!");
    } catch (e) {
      handleEmergency(WHERE, "processAddTokenEvent", arguments, e);
    }
  }

  // async processRemoveTokenEvent(fromChain: string, token: string) {
  //   try {
  //     handleInfo(
  //       WHERE,
  //       "started processing remove token event",
  //       "processRemoveTokenEvent",
  //       arguments,
  //     );
  //
  //     await mongoService.removeChainToken(fromChain, token);
  //
  //     handleInfo(WHERE, "remove token event processed!");
  //   } catch (e) {
  //     handleEmergency(WHERE, "processRemoveTokenEvent", arguments, e);
  //   }
  // }

  // async processNewWrappedNativeEvent(
  //   fromChain: string,
  //   oldWrappedNative: string,
  //   newWrappedNative: string,
  // ) {
  //   try {
  //     handleInfo(
  //       WHERE,
  //       "started processing new wrapped native event",
  //       "processNewWrappedNativeEvent",
  //       arguments,
  //     );
  //
  //     await mongoService.changeTokenAddress(
  //       fromChain,
  //       oldWrappedNative,
  //       newWrappedNative,
  //     );
  //
  //     handleInfo(WHERE, "new wrapped native event processed!");
  //   } catch (e) {
  //     handleEmergency(WHERE, "processNewWrappedNativeEvent", arguments, e);
  //   }
  // }
}
