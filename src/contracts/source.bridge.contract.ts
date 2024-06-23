import { Contract, getBigInt, Wallet } from "ethers";

import BridgeAbi from "./abi/sourceBridge.json";

export default class SourceBridgeContract {
  public baseContract;
  public readonly wallet: Wallet;
  network: string | undefined;
  readonly minimalGasPrice: bigint = getBigInt("10000000000");

  constructor(address: string, wallet: Wallet) {
    this.baseContract = new Contract(address, BridgeAbi, wallet.provider);
    this.wallet = wallet;
    this.baseContract.chain().then((res) => {
      console.log(res);
    });
    this.wallet.provider
      ?.getNetwork()
      .then((v) => (this.network = v.name))
      .catch((e) => {
        throw e;
      });
  }

  async getBlockExpiredWithdraw() {
    const secondsPerBlock = 3;
    // @ts-ignore
    const lastBlock = await this.wallet.provider.getBlockNumber();
    if (!lastBlock)
      throw new Error(
        `unable to get lastBlock(getBlockNumber) in ${SourceBridgeContract.name}`,
      );
    return (
      lastBlock - Math.ceil((await this.beforeRefundTime()) / secondsPerBlock)
    );
  }

  async blockRefund(nonce: string) {
    const parsedNonce = nonce.split("POLYGON")[1];
    const txResponse = await this.baseContract.blockRefund(parsedNonce);
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

  // Util
  // chooseGasPrice(actualGasPrice: bigint | null) {
  //   console.log(
  //     `NetworkEstimated GasPrice: ${actualGasPrice}, back-end minimal gas price: ${this.minimalGasPrice}`,
  //   );
  //   return actualGasPrice !== null && this.minimalGasPrice < actualGasPrice
  //     ? actualGasPrice
  //     : this.minimalGasPrice;
  // }

  // View

  async isNonceUsed(nonce: string) {
    // after withdraw == true, on second chain
    return this.baseContract.nonceIsUsed(BigInt(nonce));
  }

  async isNonceBlockedForRefund(nonce: string) {
    return this.baseContract.nonceIsBlockedForRefund(BigInt(nonce));
  }

  async isNonceRefunded(nonce: string) {
    return this.baseContract.nonceIsRefunded(BigInt(nonce));
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

  async getLastNonce(): Promise<bigint> {
    return this.baseContract.nonce();
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
    try {
      // in seconds
      // console.log(this.baseContract.interface.fragments);
      const res = await this.baseContract.DEFAULT_ADMIN_ROLE();
      console.log(res);
      return Number(res);
    } catch (e) {
      throw e;
    }
  }

  async getTopicFilter(name: string) {
    return this.baseContract.filters[name]().getTopicFilter();
  }

  async getTransaction(txHash: string) {
    // @ts-ignore
    return this.wallet.provider.getTransaction(txHash);
  }
}
