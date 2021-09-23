import axios from 'axios';

import TokenInterface from '../database/interfaces/token';
import logger from '../utils/logger';

export default class CoinGeckoService {
  async getTokens(): Promise<TokenInterface[]> {
    logger.notice('Pulling tokens from CoinGecko ...');

    const timestamp = new Date();
    const response = await axios.get('https://api.coingecko.com/api/v3/coins/list?include_platform=true');

    const tokens: TokenInterface[] = [];
    for (const token of response.data) {
      const {
        id: coingeckoId,
        name,
        symbol,
        decimals,
        platforms,
      } = token;
      const now = new Date();

      if (Object.keys(platforms).length > 0) {
        for (const key in platforms) {
          if (!platforms[key]) {
            continue;
          }

          tokens.push({
            id: 0,
            coingeckoId,
            name,
            symbol,
            decimals,
            platform: key,
            address: platforms[key],
            blockNumber: null,
            timestamp,
            createdAt: now,
            updatedAt: now,
          });
        }
      } else {
        tokens.push({
          id: 0,
          coingeckoId,
          name,
          symbol,
          decimals,
          platform: null,
          address: null,
          blockNumber: null,
          timestamp,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return tokens;
  }
}
