import mongoService from "../mongo.service";
import { handleEmergency, handleInfo } from "../../utils/logs.handler";
import TaskQueue from "../../utils/tasks.queue";
import SourceBridgeContract from "../../contracts/source.bridge.contract";
import DestinationBridgeContract from "../../contracts/destination.bridge.contract";

const WHERE = "DestinationProcessorService";

export default class DestinationProcessorService {
  queues = {
    write: new TaskQueue("Write"), // that calls both or any of contracts (send calls both contracts)
    read: new TaskQueue("Read"), // that doesn't write contracts or doesn't interact with it at all
  };

  constructor() {}

  async processQueues() {
    const arr: Promise<void>[] = [];
    Object.values(this.queues).forEach((q) => {
      arr.push(q.processQueue());
    });
    await Promise.all(arr);
  }

  wrapWithdrawInQueue(
    blockNumber: number,
    transactionHash: string,
    nonce: string,
  ) {
    return this.queues.read
      .enqueue(() => {
        return this.processWithdrawEvent(blockNumber, transactionHash, nonce);
      })
      .catch((e) => {
        handleEmergency(WHERE, "wrapWithdrawInQueue", arguments, e);
      });
  }

  async processWithdrawEvent(
    blockNumber: number,
    transactionHash: string,
    nonce: string,
  ) {
    try {
      handleInfo(
        WHERE,
        "started processing withdraw event",
        "processWithdrawEvent",
        arguments,
      );
      await mongoService.orderComplete(nonce, blockNumber, transactionHash);
    } catch (e) {
      handleEmergency(WHERE, "processWithdrawEvent", arguments, e);
    }
  }
}
