import { Contract, Wallet } from "ethers";

import DestinationBridgeABI from "./abi/destinationBridge.json";

export default class DestinationBridgeContract {
  readonly baseContract: Contract;
  public readonly wallet: Wallet;
  network: string | undefined;

  constructor(address: string, wallet: Wallet) {
    this.baseContract = new Contract(address, DestinationBridgeABI, wallet);
    this.wallet = wallet;
    this.wallet.provider
      ?.getNetwork()
      .then((v) => (this.network = v.name))
      .catch((e) => {
        throw e;
      });
  }

  async blockRefund(nonce: string) {
    const txResponse = await this.baseContract.blockRefund(nonce);
    return txResponse.wait();
  }

  async refundNonce(nonce: string) {
    const txResponse = await this.baseContract.refund(nonce);
    return txResponse.wait();
  }

  async withdraw(
    token: string,
    to: string,
    amount: string,
    nonceOnOtherChain: string,
  ) {
    const txResponse = await this.baseContract.withdraw(
      token,
      to,
      amount,
      nonceOnOtherChain,
    );
    return txResponse.wait();
  }

  // View

  async isNonceUsed(nonce: string) {
    return this.baseContract.nonceIsUsed(nonce);
  }

  async getTopicFilter(name: string) {
    return this.baseContract.filters[name]().getTopicFilter();
  }
}
