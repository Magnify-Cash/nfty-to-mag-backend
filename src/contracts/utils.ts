import { ChainsConfig, config } from "../config";

export const validateChain = (chain: string) => {
  const chains: string[] = Object.values(
    config.get<ChainsConfig>("chains"),
  ).reduce((memory, item) => {
    memory.push(item.name);
    return memory;
  }, [] as string[]);
  return !!chains.find((ch) => {
    return ch === chain;
  });
};

export const oppositeChain = (chain: string) => {
  const chains = config.get<ChainsConfig>("chains");
  return chain === chains.binance.name ? chains.loop.name : chains.binance.name;
};
