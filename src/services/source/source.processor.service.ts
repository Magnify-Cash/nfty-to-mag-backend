import mongoService from "../mongo.service";
import { handleEmergency, handleInfo } from "../../utils/logs.handler";
import TaskQueue from "../../utils/tasks.queue";
import { Status } from "../../models/order.schema";
import SourceBridgeService from "./source.bridge.service";
import DestinationBridgeService from "../destination/destination.bridge.service";
import Erc20Contract from "../../contracts/erc20.contract";
import coingeckoService from "../coingecko.service";

const WHERE = "SourceProcessorService";

export default class SourceProcessorService {
  queues = {
    write: new TaskQueue("SourceWrite"), // that calls both or any of contracts (send calls both contracts)
    read: new TaskQueue("SourceRead"), // that doesn't write contracts or doesn't interact with it at all
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
        throw e;
      });
  }

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

  async wrapRemoveTokenInQueue(token: string) {
    try {
      return await this.queues.read.enqueue(() => {
        return this.processRemoveTokenEvent(token);
      });
    } catch (e) {
      handleEmergency(WHERE, "wrapRemoveTokenInQueue", arguments, e);
    }
  }

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
      const nonce = nonceWithPrefix.split("-")[1];

      let isNonceBlocked =
        await this.bridgeService.contract.isNonceBlockedForRefund(nonce);

      const isNonceRefunded =
        await this.bridgeService.contract.isNonceRefunded(nonce);

      let order = await mongoService.getOrder(nonceWithPrefix);

      let status = Status.Sent.toString();

      if (isNonceBlocked) status = Status.Blocked.toString();

      if (isNonceRefunded) status = Status.Refunded.toString();

      if (!order) {
        const blockTimestamp = (
          await this.bridgeService.contract.wallet.provider?.getBlock(
            blockNumber,
          )
        )?.timestamp;
        if (!blockTimestamp) throw new Error("Block timestamp getting failed");
        const tx = await this.bridgeService.getTx(transactionHash);
        const fromUser = tx ? tx.from : "TxLost";

        order = await mongoService.addOrder({
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
          status,
          blockTimestamp: blockTimestamp,
        });
      }

      if (status == Status.Sent.toString()) {
        await this.bridgeService.blockOrder(nonce, nonceWithPrefix);
        isNonceBlocked = true;
      }

      if (isNonceBlocked && !isNonceRefunded) {
        const isOrderWithdrawn = await this.destBridgeService.withdrawOrder(
          tokenOnSecondChain,
          to,
          amountToSend,
          nonceWithPrefix,
        );

        if (isOrderWithdrawn) {
          handleInfo(WHERE, `send event processed => withdrawn(nonce:${nonce}`);
          return;
        }
      }
    } catch (e) {
      handleEmergency(WHERE, "processSendEvent", arguments, e);
      throw e;
    }
  }

  async processRefundEvent(nonce: string) {
    try {
      handleInfo(
        WHERE,
        "started processing refund event",
        "processRefundEvent",
        arguments,
      );

      const order = await mongoService.getOrderByNonce(nonce);
      if (!order) {
        throw new Error("Process refund: Order not found");
      }
      await mongoService.orderRefunded(nonce);

      handleInfo(WHERE, "refund event processed!");
    } catch (e) {
      handleEmergency(WHERE, "processRefundEvent", arguments, e);
      throw e;
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

  async processRemoveTokenEvent(token: string) {
    try {
      handleInfo(
        WHERE,
        "started processing remove token event",
        "processRemoveTokenEvent",
        arguments,
      );

      const erc20 = new Erc20Contract(
        token,
        this.bridgeService.contract.wallet,
      );
      const symbol = await erc20.symbol();

      await mongoService.removeChainToken(symbol);

      handleInfo(WHERE, "remove token event processed!");
    } catch (e) {
      handleEmergency(WHERE, "processRemoveTokenEvent", arguments, e);
    }
  }
}
