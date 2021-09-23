import CoinGeckoService from './coinGecko';
import DatabaseService from './database';
import PlatformEnum from '../enums/platform';
import TokenInterface from '../database/interfaces/token';
import Manager, { ManagerServicesEnum } from '../manager';
import { DEFAULT_DATE, DEFAULT_PLATFORM_SERVICE_PROVIDER } from '../config';
import logger from '../utils/logger';

export default class TokensSyncService {
  private _databaseService: DatabaseService;

  constructor(databaseService: DatabaseService) {
    this._databaseService = databaseService;
  }

  async sync(
    source: string,
    batchInserts: boolean
  ): Promise<boolean> {
    logger.notice('Syncing tokens ...');

    if (source !== 'coingecko') {
      logger.error(`Source ${source} not found!`);

      return false;
    }

    const databaseCoinGeckoIds = new Set<string>();
    const queryResult = await this._databaseService.query(`SELECT coingecko_id FROM tokens`);
    for (const token of queryResult.rows) {
      databaseCoinGeckoIds.add(token.coingecko_id);
    }

    const coinGeckoService = new CoinGeckoService();
    const tokens = await coinGeckoService.getTokens();
    const newTokens = tokens.filter((token) => {
      return !databaseCoinGeckoIds.has(<string>token.coingeckoId);
    });

    if (newTokens.length > 0) {
      logger.notice('Starting to insert tokens ...');

      if (batchInserts) {
        await this._databaseService.tokens.insertTokensBatch(tokens);
      } else {
        await this._databaseService.tokens.insertTokens(tokens);
      }
    }

    logger.notice('Done syncing tokens.');

    return true;
  }

  async getToken(
    platform: PlatformEnum,
    address: string,
    blockNumber: number
  ): Promise<TokenInterface | null> {
    const platformService = await Manager.getService(ManagerServicesEnum.Platform);
    platformService.setProvider(DEFAULT_PLATFORM_SERVICE_PROVIDER);

    const token = await this._databaseService.tokens.getTokenByPlatformAndAddress(
      platform,
      address
    );
    if (token) {
      return token;
    }

    const tokenData = await platformService.getTokenData(
      platform,
      address
    );
    if (!tokenData) {
      return null;
    }

    let timestamp = new Date(DEFAULT_DATE);
    const block = await platformService.getBlockData(
      platform,
      blockNumber
    );
    if (block) {
      timestamp = new Date(block.timestamp * 1000);
    }

    try {
      logger.info(`Inserting ${tokenData.name} (${tokenData.symbol}) token into the database ...`);

      return await this._databaseService.tokens.insertToken(
        tokenData.name,
        tokenData.symbol,
        tokenData.decimals,
        platform,
        address,
        blockNumber,
        timestamp
      );
    } catch (err) {
      await this._databaseService.errors.insertError(
        {
          _source: 'TokensSyncService.getToken',
          platform,
          address,
          blockNumber,
        },
        err
      );

      return null;
    }
  }
}
