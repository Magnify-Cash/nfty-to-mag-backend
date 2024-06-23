export enum HistoryType {
  from = "from",
  to = "to",
}

export type Direction = {
  from: string;
  to: string;
};

export type OrderToken = {
  symbol: string | null;
  decimals: number | null;
};

export type OrderHistory = {
  // With changing this it needs to change selections in MongoService
  id: string;
  nonce: string;
  status: string;
  date: Date;
  amount: string;
  origin: string;
  destination: string;
  direction: Direction;
  token: OrderToken;
};

export type TokensIcons = {
  binance: Record<string, string>; // addr - iconLink
  loop: Record<string, string>;
};
