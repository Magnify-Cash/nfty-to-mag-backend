import cron from "node-cron";
import { logger } from "../logger";
import { ChainsConfig, config, CronConfig } from "../config";
import mongoService from "./mongo.service";
import { handleError, handleInfo } from "../utils/logs.handler";
import coingeckoService from "./coingecko.service";
import Connection from "../connection";
import DestinationBridgeService from "./destination/destination.bridge.service";
import SourceBridgeService from "./source/source.bridge.service";
import SourceListenerService from "./source/source.listener.service";
import DestinationListenerService from "./destination/destination.listener.service";

const WHERE = "JobsService";

class JobsService {
  private readonly cronConfig = config.get<CronConfig>("cron");
  private readonly chainsConfig = config.get<ChainsConfig>("chains");

  private readonly sourceConncetion;
  private readonly destinationConnection;

  private readonly sourceBridgeService;
  private readonly destinationBridgeService;

  private readonly sourceListener;
  private readonly destinationListener;

  // TODO: refactor
  private readonly oppositeChain: { [x: string]: string } = {
    loop: "binance",
    binance: "loop",
  };

  private isSourceEventsParsing = false;
  private isDestinationEventsParsing = false;
  private isSearchingEvents = false;

  constructor() {
    console.log(this.chainsConfig.source);
    this.sourceConncetion = new Connection(this.chainsConfig.source);
    console.log(this.sourceConncetion);
    this.destinationConnection = new Connection(this.chainsConfig.destination);

    this.destinationBridgeService = new DestinationBridgeService(
      this.chainsConfig.destination.bridgeContractAddress,
      this.sourceConncetion.getWallet(),
    );
    this.sourceBridgeService = new SourceBridgeService(
      this.chainsConfig.source.bridgeContractAddress,
      this.destinationConnection.getWallet(),
    );

    this.sourceListener = new SourceListenerService(
      this.sourceBridgeService,
      this.destinationBridgeService,
    );

    this.destinationListener = new DestinationListenerService(
      this.destinationBridgeService,
    );
  }

  async start() {
    cron.schedule(this.cronConfig.updateCoins, async () => {
      await coingeckoService.updateCoins();
    });

    const sourceBlockExpired =
      await this.sourceBridgeService.contract.getBlockExpiredWithdraw();
    console.log(sourceBlockExpired);
    await this.refundBlockedOrders(sourceBlockExpired);

    cron.schedule(this.cronConfig.searchEvents, () => {
      this.parseSourceEvents();
      this.parseDestinationEvents();
    });

    cron.schedule(this.cronConfig.processQueue, async () => {
      await this.sourceListener.processor.processQueues();
      // await this.destinationListener.processor.processQueues();
    });

    logger().info("Jobs started!");
  }

  ///////////////////////////// EVENTS

  async parseSourceEvents() {
    const delayBlock = 5;

    if (!this.isSourceEventsParsing) {
      this.isSourceEventsParsing = true;
      handleInfo(WHERE, "started!", "searchEvents");
    } else {
      handleInfo(WHERE, `skip already in search`, "searchEvents");
      return;
    }
    try {
      const toBlock = await this.sourceConncetion.getBlockNumber();
      const progress = await mongoService.getBlockProgress();
      const progressChain = progress.source;

      const fromBlock = progressChain
        ? progressChain - delayBlock
        : this.chainsConfig.source.bridgeContractCreationBlock;
      await this.sourceListener.searchEvents(fromBlock, toBlock);

      handleInfo(WHERE, `chain:source done!`, "searchEvents");
    } catch (e) {
      handleError(WHERE, `chain:source searchEvents`, {}, e);
      throw e;
    }
    this.isSourceEventsParsing = false;
  }

  async parseDestinationEvents() {
    const delayBlock = 5;

    if (!this.isDestinationEventsParsing) {
      this.isDestinationEventsParsing = true;
      handleInfo(WHERE, "started!", "searchEvents");
    } else {
      handleInfo(WHERE, `skip already in search`, "searchEvents");
      return;
    }
    try {
      const toBlock = await this.sourceConncetion.getBlockNumber();
      const progress = await mongoService.getBlockProgress();
      const progressChain = progress.source;

      const fromBlock = progressChain
        ? progressChain - delayBlock
        : this.chainsConfig.source.bridgeContractCreationBlock;
      await this.destinationListener.searchEvents(fromBlock, toBlock);

      handleInfo(WHERE, `chain:destination done!`, "searchEvents");
    } catch (e) {
      handleError(WHERE, `chain:destination searchEvents`, {}, e);
    }
    this.isDestinationEventsParsing = false;
  }

  // async searchEvents() {
  //   const delayBlock = 5;

  //   if (!this.isSearchingEvents) {
  //     this.isSearchingEvents = true;
  //     handleInfo(WHERE, "started!", "searchEvents");
  //   } else {
  //     handleInfo(WHERE, "skip - already in search", "searchEvents");
  //     return;
  //   }
  //   try {
  //     const [toBlockLoop, toBlockBinance, progress] = await Promise.all([
  //       connection.getBlockNumber(bridgeService.bridges.loop.chain),
  //       connection.getBlockNumber(bridgeService.bridges.binance.chain),
  //       mongoService.getBlockProgress(),
  //     ]);

  //     let fromBlockLoop = 0;
  //     if (progress.loop) {
  //       fromBlockLoop = progress.loop - delayBlock;
  //     } else {
  //       handleError(
  //         WHERE,
  //         "searchEvents",
  //         {},
  //         "loop block progress not found! Taking contract creation block",
  //       );
  //       fromBlockLoop =
  //         config.get<ChainsConfig>("chains").loop.bridgeContractCreationBlock;
  //     }

  //     let fromBlockBinance = 0;
  //     if (progress.binance) {
  //       fromBlockBinance = progress.binance - delayBlock;
  //     } else {
  //       handleError(
  //         WHERE,
  //         "searchEvents",
  //         {},
  //         "binance block progress not found! Taking contract creation block",
  //       );
  //       fromBlockBinance =
  //         config.get<ChainsConfig>("chains").binance
  //           .bridgeContractCreationBlock;
  //     }

  //     await Promise.all([
  //       listenerService.searchEvents(
  //         bridgeService.bridges.loop,
  //         bridgeService.bridges.binance.chain,
  //         fromBlockLoop,
  //         toBlockLoop,
  //       ),
  //       listenerService.searchEvents(
  //         bridgeService.bridges.binance,
  //         bridgeService.bridges.loop.chain,
  //         fromBlockBinance,
  //         toBlockBinance,
  //       ),
  //     ]);
  //     handleInfo(WHERE, "done!", "searchEvents");
  //   } catch (e) {
  //     handleError(WHERE, "searchEvents", {}, e);
  //   }
  //   this.isSearchingEvents = false;
  // }

  //////////////////////////// ORDERS

  async refundBlockedOrders(toBlock: number) {
    try {
      handleInfo(WHERE, "refundBlockedOrders started!");
      const orders = await mongoService.getBlockedOrders();

      const oldOrders = orders.filter((o) => o.createdOnBlock < toBlock);
      for (const order of oldOrders) {
        try {
          const isNonceUsed =
            await this.destinationBridgeService.contract.isNonceUsed(order._id);
          if (isNonceUsed) {
            await mongoService.orderUsed(order._id);
            continue;
          }

          const isNonceRefunded =
            await this.sourceBridgeService.contract.isNonceRefunded(
              order.nonce,
            );
          if (isNonceRefunded) {
            await mongoService.orderRefunded(order._id);
            continue;
          }

          const isNonceBlockedForRefund =
            await this.sourceBridgeService.contract.isNonceBlockedForRefund(
              order.nonce,
            );
          if (isNonceBlockedForRefund) {
            const isRefunded = await this.sourceBridgeService.refundOrder(
              order.nonce,
            );
            handleInfo(WHERE, `[${order._id}] isRefunded -> ${isRefunded}`);
          }
        } catch (e) {
          handleError(WHERE, "refundBlockedOrder", Object.values(order), e);
        }
      }
      handleInfo(WHERE, "refundBlockedOrders ended!");
    } catch (e) {
      handleError(WHERE, "refundBlockedOrders", arguments, e);
    }
  }
}

export default new JobsService();
