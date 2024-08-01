import { config, DestinationEventsConfig } from "../../config";
import { handleInfo } from "../../utils/logs.handler";
import { TopicFilter } from "ethers";
import mongoService from "../mongo.service";
import { SplitBlocks } from "../types/listener.types";
import DestinationBridgeService from "./destination.bridge.service";
import DestinationProcessorService from "./destination.processor.service";

const WHERE = "DestinationListenerService";

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

export default class DestinationListenerService {
  destinationBridgeService: DestinationBridgeService;

  private readonly events =
    config.get<DestinationEventsConfig>("destinationEvents");
  processor: DestinationProcessorService;
  private topicFilter: TopicFilter | undefined = undefined;

  constructor(service: DestinationBridgeService) {
    this.destinationBridgeService = service;
    this.processor = new DestinationProcessorService();
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

  private async getTopicFilter() {
    if (this.topicFilter) {
      return this.topicFilter;
    }

    const withdrawEvent = "Withdraw";
    this.topicFilter = await this.destinationBridgeService.getTopicFilters([
      withdrawEvent,
    ]);
    return this.topicFilter;
  }

  async searchEvents(fromBlock: number, toBlock: number) {
    const topicFilter = await this.getTopicFilter();
    const splitBlocks = this.splitBlocks(fromBlock, toBlock);

    for (const range of splitBlocks) {
      handleInfo(WHERE, `range: [${range.from},${range.to}]`, "searchEvents");
      const logsPromise =
        this.destinationBridgeService.contract.baseContract.queryFilter(
          topicFilter,
          range.from,
          range.to,
        );

      const logs = await waitForPromiseWithTimeout(
        logsPromise,
        20,
        ` call of contract.queryFilter`,
      );

      for (const log of logs) {
        const event =
          this.destinationBridgeService.contract.baseContract.interface.parseLog(
            {
              topics: log.topics.slice(),
              data: log.data,
            },
          );
        if (!event) {
          continue;
        }
        await this.processor.processWithdrawEvent(
          log.blockNumber,
          log.transactionHash,
          event.args.nonce,
        );
      }
      await mongoService.setBlockProgress(range.to - 1, "destination");
    }
    handleInfo(WHERE, "ended!", "searchEvents", arguments);
  }
}
