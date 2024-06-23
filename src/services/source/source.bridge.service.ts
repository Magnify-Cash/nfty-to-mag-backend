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

  async blockOrder(nonceEventChain: string) {
    try {
      const tx = await this.contract.blockRefund(nonceEventChain);
      console.log(`blockRefund Transaction`, tx);

      await mongoService.orderBlocked(nonceEventChain);
      handleInfo(WHERE, `blockOrder result -> ${tx}`, "blockOrder");

      return true;
    } catch (e) {
      handleError(WHERE, "blockOrder", arguments, e);
      return false;
    }
  }

  async refundOrder(nonceEventChain: string) {
    try {
      const tx = await this.contract.refundNonce(nonceEventChain);
      console.log(`refundNonce source chain Transaction Receipt`, tx);

      await mongoService.orderRefunded(nonceEventChain);
      handleInfo(
        WHERE,
        `refundNonce -> ` + nonceEventChain,
        "processSendEvent",
      );

      return true;
    } catch (e) {
      handleError(WHERE, "refundOrder", arguments, e);
      return false;
    }
  }

  async getTopicFilters(names: string[]) {
    const filters = await Promise.all(
      names.map(async (name) => this.contract.getTopicFilter(name)),
    );
    const res = filters.reduce((memory, item) => {
      memory = memory.concat(item);
      return memory;
    }, []);
    return res;
  }

  async getTx(txHash: string) {
    return this.contract.getTransaction(txHash);
  }
}
