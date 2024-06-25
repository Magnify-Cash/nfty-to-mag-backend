import mongoService from "../mongo.service";
import { handleError, handleInfo } from "../../utils/logs.handler";
import SourceBridgeContract from "../../contracts/source.bridge.contract";
import { TopicFilter, Wallet } from "ethers";

const WHERE = "BridgeService";

export default class SourceBridgeService {
  readonly contract: SourceBridgeContract;

  constructor(address: string, wallet: Wallet) {
    this.contract = new SourceBridgeContract(address, wallet);
  }

  async blockOrder(nonceEventChain: string, nonceWithPrefix: string) {
    try {
      const tx = await this.contract.blockRefund(nonceEventChain);

      await mongoService.orderBlocked(nonceWithPrefix, tx.hash);
      handleInfo(WHERE, `blockOrder result -> ${tx.hash}`, "blockOrder");

      return true;
    } catch (e) {
      handleError(WHERE, "blockOrder", arguments, e);
      throw e;
    }
  }

  async refundOrder(nonceEventChain: string) {
    try {
      const tx = await this.contract.refundNonce(nonceEventChain);
      await mongoService.orderRefunded(nonceEventChain);
      handleInfo(
        WHERE,
        `refundNonce -> ` + nonceEventChain + `tx: ${tx.hash}`,
        "processSendEvent",
      );
      return true;
    } catch (e) {
      handleError(WHERE, "refundOrder", arguments, e);
      return false;
    }
  }

  async getTopicFilters(names: string[]) {
    const filters: TopicFilter[] = await Promise.all(
      names.map(async (eventName) => {
        return this.contract.getTopicFilter(eventName);
      }),
    );
    return [
      filters.reduce((memory, item) => {
        memory = memory.concat(item);
        return memory;
      }, [] as TopicFilter),
    ] as TopicFilter;
  }

  async getTx(txHash: string) {
    return this.contract.getTransaction(txHash);
  }
}
