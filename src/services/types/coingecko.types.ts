export type CoinInfo = {
  id: string;
  symbol: string;
  name: string;
};

export interface CoinDetails {
  image: {
    thumb: string;
    small: string;
    large: string;
  };
  // ...
}
