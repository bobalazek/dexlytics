import Manager, { ManagerServicesEnum } from '../manager';
import DatabaseService from './database';
import TokenInterface from '../database/interfaces/token';
import ExchangeInterface from '../database/interfaces/exchange';
import PairInterface from '../database/interfaces/pair';
import PlatformPairInterface from '../interfaces/platformPair';
import PlatformEnum from '../enums/platform';
import TokensSyncService from './tokensSync';
import { DEFAULT_DATE, DEFAULT_PLATFORM_SERVICE_PROVIDER, MAX_BLOCK_RANGE } from '../config';
import logger from '../utils/logger';

interface SyncTokenInterface {
  name: string,
  symbol: string,
  decimals: number,
  blockNumber: number | null,
  timestamp: Date,
}

export default class PairsSyncService {
  private _databaseService: DatabaseService;
  private _tokensSyncService: TokensSyncService;

  constructor(databaseService: DatabaseService, tokensSyncService: TokensSyncService) {
    this._databaseService = databaseService;
    this._tokensSyncService = tokensSyncService;
  }

  async sync(
    exchange: ExchangeInterface,
    fromBlockNumber: number,
    toBlockNumber: number,
    batchInserts: boolean
  ): Promise<boolean> {
    logger.notice('Syncing pairs ...');

    const platformService = await Manager.getService(ManagerServicesEnum.Platform);
    platformService.setProvider(DEFAULT_PLATFORM_SERVICE_PROVIDER);

    const ranges = await this._databaseService.exchanges.getAvailableExchangePairRanges(
      exchange,
      fromBlockNumber,
      toBlockNumber,
      MAX_BLOCK_RANGE
    );
    for (const range of ranges) {
      const exchangePairRange = await this._databaseService.exchanges.addExchangePairRange(
        exchange,
        range[0],
        range[1]
      );
      if (!exchangePairRange) {
        logger.critical('Could not create exchange pair range.');
        process.exit(1);
      }

      const pairs = await platformService.getPairs(
        exchange,
        range[0],
        range[1]
      );

      if (pairs === null) {
        await this._databaseService.exchanges.updateExchangePairRange(
          exchangePairRange,
          true
        );

        continue;
      }

      await this._processPairs(exchange, pairs, batchInserts);

      await this._databaseService.exchanges.updateExchangePairRange(
        exchangePairRange,
        false
      );
    }

    logger.notice('Done syncing pairs.');

    return true;
  }

  /***** Helpers *****/
  private async _processPairs(
    exchange: ExchangeInterface,
    pairs: PlatformPairInterface[],
    batchInserts: boolean
  ): Promise<boolean> {
    logger.notice(`Starting to process ${pairs.length} pairs ${batchInserts ? '(in batch)' : ''} ...`);

    if (batchInserts) {
      await this._processPairsBatch(exchange, pairs);
    } else {
      await this._processPairsSingle(exchange, pairs);
    }

    return true;
  }

  private async _processPairsBatch(
    exchange: ExchangeInterface,
    pairs: PlatformPairInterface[]
  ): Promise<boolean> {
    const platform = <PlatformEnum>exchange.platform;

    const platformService = await Manager.getService(ManagerServicesEnum.Platform);
    platformService.setProvider(DEFAULT_PLATFORM_SERVICE_PROVIDER);

    // Let's get all the unique addresses for this batch
    const addressBlockNumbersMap = new Map<string, number>();
    for (const pair of pairs) {
      addressBlockNumbersMap.set(
        pair.token0Address,
        pair.blockNumber
      );
      addressBlockNumbersMap.set(
        pair.token1Address,
        pair.blockNumber
      );
    }

    // Check if there are any of them already in the DB
    const uniqueTokenAddresses = Array.from(addressBlockNumbersMap.keys());
    const databaseTokens = await this._databaseService.tokens.getTokensByAddresses(
      Array.from(uniqueTokenAddresses)
    );
    let databaseTokensMap = new Map<string, TokenInterface>(databaseTokens.map((token) => {
      return [<string>token.address, token];
    }));

    if (addressBlockNumbersMap.size > databaseTokensMap.size) {
      logger.info('We do not yet have all tokens added to the database. Starting to pull token data ...');

      const missingTokenAddressesMap = new Map<string, SyncTokenInterface>();

      for (const address of uniqueTokenAddresses) {
        if (databaseTokensMap.has(address)) {
          continue;
        }

        const tokenData = await platformService.getTokenData(
          platform,
          address
        );
        if (!tokenData) {
          continue;
        }

        let blockNumber: number | null = null;
        let timestamp = new Date(DEFAULT_DATE);
        if (addressBlockNumbersMap.has(address)) {
          blockNumber = <number>addressBlockNumbersMap.get(address);
          const block = await platformService.getBlockData(platform, blockNumber);
          if (block) {
            timestamp = new Date(block.timestamp * 1000);
          }
        }

        missingTokenAddressesMap.set(
          address,
          {
            name: tokenData.name,
            symbol: tokenData.symbol,
            decimals: tokenData.decimals,
            blockNumber,
            timestamp,
          }
        );
      }

      logger.info('Adding missing tokens into the database ...');

      const now = new Date();

      const insertableTokens: TokenInterface[] = [];
      missingTokenAddressesMap.forEach((rawToken, address) => {
        insertableTokens.push({
          id: 0,
          coingeckoId: null,
          name: rawToken.name,
          symbol: rawToken.symbol,
          decimals: rawToken.decimals,
          platform,
          address,
          blockNumber: rawToken.blockNumber,
          timestamp: rawToken.timestamp,
          createdAt: now,
          updatedAt: now,
        });
      });

      if (insertableTokens.length) {
        await this._databaseService.tokens.insertTokensBatch(
          insertableTokens
        );
      }

      const finalTokens = await this._databaseService.tokens.getTokensByAddresses(
        Array.from(uniqueTokenAddresses)
      );
      databaseTokensMap = new Map<string, TokenInterface>(finalTokens.map((token) => {
        return [<string>token.address, token];
      }));
    }

    const insertablePairs: PairInterface[] = [];
    for (const pair of pairs) {
      const token0 = databaseTokensMap.get(pair.token0Address) ?? null;
      const token1 = databaseTokensMap.get(pair.token1Address) ?? null;
      if (!token0 || !token1) {
        logger.info(`Could not get token0 or token1. Skipping ...`);

        await this._databaseService.errors.insertError(
          {
            _source: 'PairsSyncService._processPairsBatch',
            exchangeKey: exchange.key,
            token0Address: pair.token0Address,
            token1Address: pair.token1Address,
            pairAddress: pair.address,
            blockNumber: pair.blockNumber,
            token0,
            token1,
          },
          {
            _message: 'Could not get token0 or token1',
          }
        );

        continue;
      }

      let timestamp = new Date(DEFAULT_DATE);
      const block = await platformService.getBlockData(platform, pair.blockNumber);
      if (block) {
        timestamp = new Date(block.timestamp * 1000);
      }

      const now = new Date();

      insertablePairs.push({
        id: 0,
        exchangeId: exchange.id,
        address: pair.address,
        token0Id: token0.id,
        token1Id: token1.id,
        blockNumber: pair.blockNumber,
        timestamp,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (insertablePairs.length) {
      logger.info(`Inserting ${insertablePairs.length} pairs into the database ...`);

      await this._databaseService.pairs.insertPairsBatch(
        insertablePairs
      );
    }

    return true;
  }

  private async _processPairsSingle(
    exchange: ExchangeInterface,
    pairs: PlatformPairInterface[]
  ): Promise<boolean> {
    const platform = <PlatformEnum>exchange.platform;

    const platformService = await Manager.getService(ManagerServicesEnum.Platform);
    platformService.setProvider(DEFAULT_PLATFORM_SERVICE_PROVIDER);

    for (const pair of pairs) {
      let timestamp = new Date(DEFAULT_DATE);
      const block = await platformService.getBlockData(platform, pair.blockNumber);
      if (block) {
        timestamp = new Date(block.timestamp * 1000);
      }

      const token0 = await this._tokensSyncService.getToken(
        platform,
        pair.token0Address,
        pair.blockNumber
      );
      const token1 = await this._tokensSyncService.getToken(
        platform,
        pair.token1Address,
        pair.blockNumber
      );
      if (!token0 || !token1) {
        logger.info(`Could not get token0 or token1. Skipping ...`);

        await this._databaseService.errors.insertError(
          {
            _source: 'PairsSyncService._processPairsSingle',
            exchangeKey: exchange.key,
            token0Address: pair.token0Address,
            token1Address: pair.token1Address,
            pairAddress: pair.address,
            blockNumber: pair.blockNumber,
            token0,
            token1,
          },
          {
            _message: 'Could not get token0 or token1',
          }
        );

        continue;
      }

      logger.info(`Processing pair ${token0.symbol}-${token1.symbol} ...`);

      await this._databaseService.pairs.insertPair(
        exchange.id,
        pair.address,
        token0.id,
        token1.id,
        pair.blockNumber,
        timestamp
      );
    }

    return true;
  }
}
