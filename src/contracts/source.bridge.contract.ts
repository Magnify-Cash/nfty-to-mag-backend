import { Contract, Wallet } from "ethers";

import BridgeAbi from "./abi/sourceBridge.json";

export default class SourceBridgeContract {
  public baseContract;
  public readonly wallet: Wallet;
  network: string | undefined;

  constructor(address: string, wallet: Wallet) {
    this.baseContract = new Contract(address, BridgeAbi, wallet);
    this.wallet = wallet;
    this.wallet.provider
      ?.getNetwork()
      .then((v) => (this.network = v.name))
      .catch((e) => {
        throw e;
      });
  }

  async getBlockExpiredWithdraw() {
    //TODO: Update seconds per block
    const secondsPerBlock = 30;
    const lastBlock = await this.wallet.provider?.getBlockNumber();
    if (!lastBlock)
      throw new Error(
        `unable to get lastBlock(getBlockNumber) in ${SourceBridgeContract.name}`,
      );
    return (
      lastBlock - Math.ceil((await this.beforeRefundTime()) / secondsPerBlock)
    );
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
    return this.baseContract.nonceIsUsed(BigInt(nonce));
  }

  async isNonceBlockedForRefund(nonce: string) {
    return this.baseContract.nonceIsBlockedForRefund(BigInt(nonce));
  }

  async isNonceRefunded(nonce: string) {
    return this.baseContract.nonceIsRefunded(BigInt(nonce));
  }

  async beforeRefundTime(): Promise<number> {
    try {
      const res = await this.baseContract.minTimeToWaitBeforeRefund();
      return Number(res);
    } catch (e) {
      throw e;
    }
  }

  async getTopicFilter(name: string) {
    return this.baseContract.filters[name]().getTopicFilter();
  }

  async getTransaction(txHash: string) {
    return this.wallet.provider?.getTransaction(txHash);
  }
}
