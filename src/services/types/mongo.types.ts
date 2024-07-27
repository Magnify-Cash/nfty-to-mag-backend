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
  blockTimestamp: number;
  status?: string;
}

export type IProgress = Record<"source" | "destination", number>;
