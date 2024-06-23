import { handleError } from "../../utils/logs.handler";
import DestinationBridgeContract from "../../contracts/destination.bridge.contract";
import { TopicFilter, Wallet } from "ethers";

const WHERE = "DestinationBridgeService";

export default class DestinationBridgeService {
  readonly contract: DestinationBridgeContract;

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
      const tx = await this.contract.withdraw(
        tokenOnSecondChain,
        to,
        amount,
        nonce,
      );

      console.log(`withdraw to destination chain Transaction Receipt`, tx);

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
