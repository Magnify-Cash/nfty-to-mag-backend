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

  private isSourceEventsParsing = false;
  private isDestinationEventsParsing = false;

  constructor() {
    this.sourceConncetion = new Connection(this.chainsConfig.source);
    this.destinationConnection = new Connection(this.chainsConfig.destination);

    this.destinationBridgeService = new DestinationBridgeService(
      this.chainsConfig.destination.bridgeContractAddress,
      this.destinationConnection.getWallet(),
    );
    this.sourceBridgeService = new SourceBridgeService(
      this.chainsConfig.source.bridgeContractAddress,
      this.sourceConncetion.getWallet(),
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
    cron.schedule(this.cronConfig.updateCoins, () => {
      coingeckoService.updateCoins();
    });

    cron.schedule(this.cronConfig.searchEvents, () => {
      this.parseSourceEvents();
      this.parseDestinationEvents();
    });

    // cron.schedule(this.cronConfig.processQueue, () => {
    //   this.sourceListener.processor.processQueues();
    //   this.destinationListener.processor.processQueues();
    // });
    // cron.schedule(this.cronConfig.refundStuckOrders, () => {
    //   this.refundStuckOrders();
    // });

    logger().info("Jobs started!");
  }

  // EVENTS

  async parseSourceEvents() {
    const delayBlock = 1;

    if (!this.isSourceEventsParsing) {
      this.isSourceEventsParsing = true;
      handleInfo(WHERE, "SourceEventsParsing started!", "searchEvents");
    } else {
      handleInfo(
        WHERE,
        `SourceEventsParsing skip already in search`,
        "searchEvents",
      );
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

      handleInfo(
        WHERE,
        `SourceEventsParsing chain:source done!`,
        "searchEvents",
      );
    } catch (e) {
      handleError(
        WHERE,
        `SourceEventsParsing chain:source searchEvents`,
        {},
        e,
      );
      //BSC rate limit
      //throw e;
    }
    this.isSourceEventsParsing = false;
  }

  async parseDestinationEvents() {
    const delayBlock = 1;

    if (!this.isDestinationEventsParsing) {
      this.isDestinationEventsParsing = true;
      handleInfo(WHERE, "DestinationEvents started!", "searchEvents");
    } else {
      handleInfo(
        WHERE,
        `DestinationEvents skip already in search`,
        "searchEvents",
      );
      return;
    }
    try {
      const toBlock = await this.destinationConnection.getBlockNumber();
      const progress = await mongoService.getBlockProgress();
      const progressChain = progress.destination;

      const fromBlock = progressChain
        ? progressChain - delayBlock
        : this.chainsConfig.destination.bridgeContractCreationBlock;
      await this.destinationListener.searchEvents(fromBlock, toBlock);

      handleInfo(
        WHERE,
        `DestinationEvents chain: destination done!`,
        "searchEvents",
      );
    } catch (e) {
      handleError(
        WHERE,
        `DestinationEvents chain: destination searchEvents`,
        {},
        e,
      );
    }
    this.isDestinationEventsParsing = false;
  }

  //ORDERS

  async refundStuckOrders() {
    try {
      handleInfo(WHERE, "refundBlockedOrders started!");
      const lastBlockTimestamp = (
        await this.sourceConncetion.getBlock("latest")
      )?.timestamp;
      if (!lastBlockTimestamp) throw new Error("Unable to get block timestamp");
      const minTimeToRefund =
        await this.sourceBridgeService.contract.beforeRefundTime();
      const orders = await mongoService.getStuckOrders(
        lastBlockTimestamp - minTimeToRefund,
      );
      for (const order of orders) {
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
          const isRefunded = await this.sourceBridgeService.refundOrder(
            order.nonce,
          );
          handleInfo(WHERE, `[${order._id}] isRefunded -> ${isRefunded}`);
        } catch (e) {
          handleError(WHERE, "refundBlockedOrder", Object.values(order), e);
        }
      }
      handleInfo(WHERE, "refundBlockedOrders ended!");
    } catch (e) {
      handleError(WHERE, "refundBlockedOrders", arguments, e);
    }
  }

  public get getSourceBridgeService() {
    return this.sourceBridgeService;
  }
}

export default new JobsService();
