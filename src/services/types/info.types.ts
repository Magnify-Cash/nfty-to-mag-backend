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
