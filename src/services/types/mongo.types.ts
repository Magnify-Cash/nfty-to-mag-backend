export interface IAddOrder {
  fromChain: string;
  toChain: string;
  nonce: string;
  fromUser: string;
  toUser: string;
  tokenFromChain: string;
  tokenOtherChain: string;
  amount: string;
  sendTxHash: string;
  createdOnBlock: number;
}

export type IProgress = Record<"source" | "destination", number>;
