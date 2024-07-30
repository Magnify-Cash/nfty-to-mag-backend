import { config, SourceEventsConfig } from "../../config";
import { handleInfo } from "../../utils/logs.handler";
import { TopicFilter } from "ethers";
import mongoService from "../mongo.service";
import { SplitBlocks } from "../types/listener.types";
import SourceBridgeService from "./source.bridge.service";
import SourceProcessorService from "./source.processor.service";
import DestinationBridgeService from "../destination/destination.bridge.service";

const WHERE = "SourceListenerService";

function waitForPromiseWithTimeout<T>(
  promise: Promise<T>,
  timeoutInSeconds: number,
  context: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new Error(`${context} Timeout exceeded (${timeoutInSeconds} seconds)`),
      );
    }, timeoutInSeconds * 1000);
    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export default class SourceListenerService {
  bridgeService;
  processor;

  private readonly events = config.get<SourceEventsConfig>("sourceEvents");
  private topicFilter: TopicFilter | undefined = undefined;

  constructor(
    bridgeService: SourceBridgeService,
    destinationBridgeService: DestinationBridgeService,
  ) {
    this.bridgeService = bridgeService;
    this.processor = new SourceProcessorService(
      this.bridgeService,
      destinationBridgeService,
    );
  }

  private splitBlocks(fromBlock: number, toBlock: number): SplitBlocks[] {
    const step = config.get<number>("blocksStep");
    const splitBlocks: SplitBlocks[] = [];

    for (let i = fromBlock; i < toBlock; i += step) {
      const to = i + step <= toBlock ? i + step : toBlock;
      splitBlocks.push({
        from: i,
        to,
      });
    }
    return splitBlocks;
  }

  private async getTopicFilter(): Promise<TopicFilter> {
    if (this.topicFilter) {
      return this.topicFilter as TopicFilter;
    }
    this.topicFilter = await this.bridgeService.getTopicFilters(
      Object.values(this.events),
    );
    return this.topicFilter;
  }

  async searchEvents(fromBlock: number, toBlock: number) {
    const topicFilter = await this.getTopicFilter();
    const splitBlocks = this.splitBlocks(fromBlock, toBlock);
    for (const range of splitBlocks) {
      handleInfo(WHERE, ` range: [${range.from},${range.to}]`, "searchEvents");
      const logsPromise = this.bridgeService.contract.baseContract.queryFilter(
        topicFilter,
        range.from,
        range.to,
      );

      const logs = await waitForPromiseWithTimeout(
        logsPromise,
        20,
        `call of contract.queryFilter`,
      );
      for (const log of logs) {
        const event =
          this.bridgeService.contract.baseContract.interface.parseLog({
            topics: log.topics.slice(),
            data: log.data,
          });
        if (!event) {
          continue;
        }

        switch (event.name) {
          case this.events.send: {
            await this.processor.processSendEvent(
              "source",
              "destination",
              log.blockNumber,
              log.transactionHash,
              event.args.token,
              event.args.tokenOnSecondChain,
              event.args.to,
              event.args.amount,
              event.args.nonce,
              event.args.amountToReceive,
            );
            break;
          }

          case this.events.refund: {
            await this.processor.processRefundEvent(event.args.nonce);
            break;
          }

          case this.events.addToken: {
            await this.processor.processAddTokenEvent(
              event.args.token,
              event.args.tokenOnSecondChain,
            );
            break;
          }

          case this.events.removeToken: {
            await this.processor.processRemoveTokenEvent(event.args.token);
            break;
          }

          default:
            // Just skip other events
            break;
        }
      }
      await mongoService.setBlockProgress(range.to - 1, "source");
    }
    handleInfo(WHERE, "ended!", "searchEvents", arguments);
  }
}
