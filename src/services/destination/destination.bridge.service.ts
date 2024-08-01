import { handleError, handleInfo } from "../../utils/logs.handler";
import DestinationBridgeContract from "../../contracts/destination.bridge.contract";
import { TopicFilter, Wallet } from "ethers";
import mongoService from "../mongo.service";
import { config } from "../../config";

const WHERE = "DestinationBridgeService";

export default class DestinationBridgeService {
  readonly contract: DestinationBridgeContract;
  noncePrefix = config.get<string>("noncePrefix");

  constructor(address: string, wallet: Wallet) {
    this.contract = new DestinationBridgeContract(address, wallet);
  }

  async withdrawOrder(
    tokenOnSecondChain: string,
    to: string,
    amount: string,
    nonce: string,
  ) {
    try {
      const isNonceUsed = await this.contract.isNonceUsed(nonce);
      if (isNonceUsed) {
        handleInfo(
          WHERE,
          `withdrawOrder: order already withdrawn or nonceConflict ${nonce}`,
        );
        return true;
      }

      const tx = await this.contract.withdraw(
        tokenOnSecondChain,
        to,
        amount,
        nonce,
      );

      await mongoService.orderComplete(nonce, tx.hash, this.noncePrefix);
      handleInfo(
        WHERE,
        `withdrawOrder: order completed ${nonce}  tx: ${tx.hash}`,
      );

      return true;
    } catch (e) {
      handleError(WHERE, "withdrawOrder", arguments, e);
      return false;
    }
  }

  async getTopicFilters(names: string[]) {
    const filters = await Promise.all(
      names.map(async (name) => this.contract.getTopicFilter(name)),
    );
    return filters.reduce((memory, item) => {
      memory = memory.concat(item);
      return memory;
    }, [] as TopicFilter);
  }
}
