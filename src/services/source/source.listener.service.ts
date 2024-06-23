import { config, EventsConfig } from "../../config";
import { handleInfo } from "../../utils/logs.handler";
import { TopicFilter } from "ethers";
import mongoService from "../mongo.service";
import { SplitBlocks } from "../types/listener.types";
import SourceBridgeService from "./source.bridge.service";
import SourceProcessorService from "./source.processor.service";
import DestinationBridgeService from "../destination/destination.bridge.service";

const WHERE = "ListenerService";

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

  private readonly events = config.get<EventsConfig>("events");
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

    console.log(this.topicFilter, 123);
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

      const res = await logsPromise;
      console.log(res, 999999);

      const logs = await waitForPromiseWithTimeout(
        logsPromise,
        20,
        `call of contract.queryFilter`,
      );

      logs.forEach((log) => {
        console.log(log, "LOG");
        const event =
          this.bridgeService.contract.baseContract.interface.parseLog({
            topics: log.topics.slice(),
            data: log.data,
          });
        console.log(event, 123);
        if (!event) {
          return; // continue;
        }

        switch (event.name) {
          case this.events.send: {
            this.processor.wrapSendInQueue(
              "source",
              "destination",
              log.blockNumber,
              log.transactionHash,
              event.args.token,
              event.args.tokenOnSecondChain,
              event.args.to,
              event.args.amount,
              event.args.nonce,
              event.args.amountToSend,
            );
            break;
          }
          // case this.events.withdraw: {
          //   processorService.wrapWithdrawInQueue(
          //     processorService.queues.read,
          //     otherChain,
          //     contract.chain,
          //     log.blockNumber,
          //     log.transactionHash,
          //     event.args.nonce,
          //   );
          //   break;
          // }
          case this.events.refund: {
            this.processor.wrapRefundInQueue(event.args.nonce);
            break;
          }
          case this.events.addToken: {
            console.log(event);
            this.processor.wrapAddTokenInQueue(
              event.args.token,
              event.args.tokenOnSecondChain,
            );
            break;
          }
          // case this.events.removeToken: {
          //   processorService.wrapRemoveTokenInQueue(
          //     processorService.queues.read,
          //     contract.chain,
          //     event.args.token,
          //   );
          //   break;
          // }
          // case this.events.newWrappedNative: {
          //   processorService.wrapNewWrappedNativeInQueue(
          //     processorService.queues.read,
          //     contract.chain,
          //     event.args.oldWrappedNative,
          //     event.args.newWrappedNative,
          //   );
          //   break;
          // }

          default:
            // Just skip other events
            break;
        }
      });
      await mongoService.setBlockProgress(range.to - 1, "source");
    }
    handleInfo(WHERE, "ended!", "searchEvents", arguments);
  }
}
