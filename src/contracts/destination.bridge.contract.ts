import { Contract, getBigInt, Wallet } from "ethers";

import DestinationBridgeABI from "./abi/destinationBridge.json";

export default class DestinationBridgeContract {
  readonly baseContract: Contract;
  public readonly wallet: Wallet;
  network: string | undefined;
  readonly minimalGasPrice: bigint = getBigInt("10000000000");

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

  async getWhitelistedTokensOneByOne(): Promise<string[]> {
    const addresses: string[] = [];

    let counter = 0;
    let flag = true;

    while (flag) {
      try {
        addresses.push(await this.baseContract.allWhitelistedTokens(counter));
        ++counter;
      } catch (e) {
        flag = false;
      }
    }

    return addresses;
  }

  async getWhitelistedTokens(): Promise<string[]> {
    return this.baseContract.getAllWhitelistedTokens();
  }

  async getOtherChainToken(address: string): Promise<string> {
    return this.baseContract.otherChainToken(address);
  }

  async getNonceInfo(nonce: string) {
    return this.baseContract.nonceInfo(nonce);
  }

  async getSecondChainId() {
    return this.baseContract.secondChainId();
  }

  async isTokenSupported(address: string) {
    return this.baseContract.tokenIsSupported(address);
  }

  async beforeRefundTime(): Promise<number> {
    // in seconds
    const res = await this.baseContract.minTimeToWaitBeforeRefund();
    return Number(res);
  }

  async getTopicFilter(name: string) {
    return this.baseContract.filters[name]().getTopicFilter();
  }
}
