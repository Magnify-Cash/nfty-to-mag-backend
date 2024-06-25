import { handleError, handleInfo } from "../utils/logs.handler";
import { ApiConfig, config } from "../config";
import axios from "axios";
import { CoinInfo, CoinDetails } from "./types/coingecko.types";

const WHERE = "CoingeckoService";

class CoingeckoService {
  private coins: CoinInfo[] = [];

  constructor() {
    this.updateCoins().then();
  }

  private async getCoinsList(): Promise<CoinInfo[]> {
    let coins: CoinInfo[] = [];
    try {
      const url = `${this.getApi()}coins/list`;
      const response = await axios.get(url);
      coins = response.data as CoinInfo[];
    } catch (e) {
      handleError(WHERE, "getCoinsList", {}, e);
    }
    return coins;
  }

  async updateCoins() {
    try {
      this.coins = await this.getCoinsList();
      handleInfo(WHERE, "coins updated!", "updateCoins");
    } catch (e) {
      handleError(WHERE, "updateCoins", {}, e);
    }
  }

  private async approveCoins() {
    if (!this.coins.length) {
      await this.updateCoins();
    }
  }

  ///
  private getApi(): string {
    return config.get<ApiConfig>("api").coingecko;
  }

  ///

  private async getCoinDetails(id: string): Promise<CoinDetails> {
    let coinDetails = {} as CoinDetails;
    try {
      const url = `${this.getApi()}coins/${id}`; // doesn't support multiple tokens
      const response = await axios.get(url, {
        params: {
          tickers: false,
          market_data: false,
          community_data: false,
          developer_data: false,
          sparkline: false,
        },
      });
      coinDetails = response.data as CoinDetails;
    } catch (e) {
      handleError(WHERE, "getCoinDetails", {}, e);
    }
    return coinDetails;
  }

  async getLogoBySymbol(symbol: string): Promise<string> {
    try {
      await this.approveCoins();
      const coin = this.coins.find((c) => c.symbol === symbol.toLowerCase());
      if (coin) {
        const details = await this.getCoinDetails(coin.id);
        return details.image.small;
      }
      if (symbol.charAt(0).toLowerCase() === "w") {
        //
        const coin = this.coins.find(
          (c) => c.symbol === symbol.substring(1).toLowerCase(),
        );
        if (coin) {
          const details = await this.getCoinDetails(coin.id);
          return details.image.small;
        }
      }
      handleError(
        WHERE,
        "getLogoBySymbol",
        { symbol },
        "coin with that symbol not found!",
      );
    } catch (e) {
      handleError(WHERE, "getLogoBySymbol", { symbol }, e);
    }
    return "";
  }
}

export default new CoingeckoService();
