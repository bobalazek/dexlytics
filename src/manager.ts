import { Pool } from 'pg';
import { cpus } from 'os';
import { spawn } from 'child_process';
import process, { argv } from 'process';
import pt from 'prepend-transform';

import PlatformEnum from './enums/platform';
import RangeType from './types/range';
import ExchangeInterface from './database/interfaces/exchange';
import PairInterface from './database/interfaces/pair';
import DatabaseService from './services/database';
import PlatformService from './services/platform';
import TokensSyncService from './services/tokensSync';
import PairsSyncService from './services/pairsSync';
import SwapsSyncService from './services/swapsSync';
import CoinGeckoService from './services/coinGecko';
import { DEFAULT_PLATFORM_SERVICE_PROVIDER, MULTITHREADING_MAX_BLOCK_RANGE } from './config';
import { mergeRanges, splitRangeIntoSubRanges } from './utils/helpers';
import logger from './utils/logger';

export enum ManagerServicesEnum {
  Database,
  Platform,
  TokensSync,
  PairsSync,
  SwapsSync,
  CoinGecko,
}

export type ManagerServicesType = {
  [ManagerServicesEnum.Database]: DatabaseService,
  [ManagerServicesEnum.Platform]: PlatformService,
  [ManagerServicesEnum.TokensSync]: TokensSyncService,
  [ManagerServicesEnum.PairsSync]: PairsSyncService,
  [ManagerServicesEnum.SwapsSync]: SwapsSyncService,
  [ManagerServicesEnum.CoinGecko]: CoinGeckoService,
}

export default class Manager {
  private static _services: Map<ManagerServicesEnum, any>;

  static async databaseRebuild(): Promise<boolean> {
    logger.notice('===== Database - Rebuild =====');

    const databaseService = await this.getService(ManagerServicesEnum.Database);

    await databaseService.rebuild();

    logger.notice('===== Database - Rebuild - DONE =====');

    return true;
  }

  /***** Tokens *****/
  static async tokensSync(
    source: string,
    batchInserts: boolean
  ): Promise<boolean> {
    logger.notice('===== Tokens - Sync =====');

    logger.info(`source: ${source}`);
    logger.info(`batchInserts: ${batchInserts}`);

    const tokensSyncService = await this.getService(ManagerServicesEnum.TokensSync);
    await tokensSyncService.sync(source, batchInserts);

    logger.notice('===== Tokens - Sync - DONE =====');

    return true;
  }

  /***** Pairs *****/
  static async pairsSync(
    exchangeKey: string,
    fromBlockNumber: number,
    toBlockNumber: number | 'latest',
    batchInserts: boolean,
    unprocessedPairsOnly: boolean
  ): Promise<boolean> {
    logger.notice('===== Pairs - sync =====');

    logger.info(`exchangeKey: ${exchangeKey}`);
    logger.info(`fromBlockNumber: ${fromBlockNumber}`);
    logger.info(`toBlockNumber: ${toBlockNumber}`);
    logger.info(`batchInserts: ${batchInserts}`);
    logger.info(`unprocessedPairsOnly: ${unprocessedPairsOnly}`);

    const databaseService = await this.getService(ManagerServicesEnum.Database);
    const pairsSyncService = await this.getService(ManagerServicesEnum.PairsSync);
    const exchange = await databaseService.exchanges.getExchangeByKey(exchangeKey);

    [
      fromBlockNumber,
      toBlockNumber,
    ] = await this.adjustSyncBlockNumbers(
      exchangeKey,
      null,
      fromBlockNumber,
      toBlockNumber
    );

    if (unprocessedPairsOnly) {
      [
        fromBlockNumber,
        toBlockNumber,
      ] = await this.adjustExchangePairRangeBlockNumbers(
        exchangeKey,
        fromBlockNumber,
        toBlockNumber
      );
    }

    await pairsSyncService.sync(
      <ExchangeInterface>exchange,
      fromBlockNumber,
      toBlockNumber,
      batchInserts
    );

    logger.notice('===== Pairs - sync - DONE =====');

    return true;
  }

  static async pairsSyncMultithreaded(
    exchangeKey: string,
    fromBlockNumber: number = 0,
    toBlockNumber: number | 'latest',
    batchInserts: boolean,
    unprocessedPairsOnly: boolean
  ): Promise<boolean> {
    logger.notice('===== Pairs - sync (threaded) =====');

    logger.info(`exchangeKey: ${exchangeKey}`);
    logger.info(`fromBlockNumber: ${fromBlockNumber}`);
    logger.info(`toBlockNumber: ${toBlockNumber}`);
    logger.info(`batchInserts: ${batchInserts}`);
    logger.info(`unprocessedPairsOnly: ${unprocessedPairsOnly}`);

    [
      fromBlockNumber,
      toBlockNumber,
    ] = await this.adjustSyncBlockNumbers(
      exchangeKey,
      null,
      fromBlockNumber,
      toBlockNumber
    );

    if (unprocessedPairsOnly) {
      [
        fromBlockNumber,
        toBlockNumber,
      ] = await this.adjustExchangePairRangeBlockNumbers(
        exchangeKey,
        fromBlockNumber,
        toBlockNumber
      );
    }

    const ranges = splitRangeIntoSubRanges(
      fromBlockNumber,
      toBlockNumber,
      MULTITHREADING_MAX_BLOCK_RANGE
    );

    await this.doMultithreading(
      'pairs:sync',
      exchangeKey,
      ranges,
      batchInserts
    );

    logger.notice('===== Pairs - sync (threaded) - DONE =====');

    return true;
  }

  /***** Swaps *****/
  static async swapsSync(
    exchangeKey: string,
    pairIds: number[],
    fromBlockNumber: number,
    toBlockNumber: number | 'latest',
    batchInserts: boolean,
    unprocessedPairsOnly: boolean
  ): Promise<boolean> {
    logger.notice('===== Swaps - sync =====');

    if (!pairIds.length) {
      logger.critical(`Please specify at least one pair id!`);
      process.exit(1);
    }

    logger.info(`exchangeKey: ${exchangeKey}`);
    logger.info(`pairIds: ${pairIds.join(',')}`);
    logger.info(`fromBlockNumber: ${fromBlockNumber}`);
    logger.info(`toBlockNumber: ${toBlockNumber}`);
    logger.info(`batchInserts: ${batchInserts}`);

    const databaseService = await this.getService(ManagerServicesEnum.Database);
    const swapsSyncService = await this.getService(ManagerServicesEnum.SwapsSync);
    const exchange = await databaseService.exchanges.getExchangeByKey(exchangeKey);

    [
      fromBlockNumber,
      toBlockNumber,
    ] = await this.adjustSyncBlockNumbers(
      exchangeKey,
      pairIds,
      fromBlockNumber,
      toBlockNumber
    );

    if (unprocessedPairsOnly) {
      [
        fromBlockNumber,
        toBlockNumber,
      ] = await this.adjustPairSwapRangeBlockNumbers(
        pairIds,
        fromBlockNumber,
        toBlockNumber
      );
    }

    await swapsSyncService.sync(
      <ExchangeInterface>exchange,
      pairIds,
      fromBlockNumber,
      toBlockNumber,
      batchInserts
    );

    logger.notice('===== Swaps - sync - DONE =====');

    return true;
  }

  static async swapsSyncMultithreaded(
    exchangeKey: string,
    pairIds: number[],
    fromBlockNumber: number,
    toBlockNumber: number | 'latest',
    batchInserts: boolean,
    unprocessedPairsOnly: boolean
  ): Promise<boolean> {
    logger.notice('===== Swaps - sync (threaded) =====');

    if (!pairIds.length) {
      logger.critical(`Please specify at least one pair id!`);
      process.exit(1);
    }

    logger.info(`exchangeKey: ${exchangeKey}`);
    logger.info(`pairIds: ${pairIds.join(',')}`);
    logger.info(`fromBlockNumber: ${fromBlockNumber}`);
    logger.info(`toBlockNumber: ${toBlockNumber}`);
    logger.info(`batchInserts: ${batchInserts}`);

    [
      fromBlockNumber,
      toBlockNumber,
    ] = await this.adjustSyncBlockNumbers(
      exchangeKey,
      pairIds,
      fromBlockNumber,
      toBlockNumber
    );

    if (unprocessedPairsOnly) {
      [
        fromBlockNumber,
        toBlockNumber,
      ] = await this.adjustPairSwapRangeBlockNumbers(
        pairIds,
        fromBlockNumber,
        toBlockNumber
      );
    }

    const ranges = splitRangeIntoSubRanges(
      fromBlockNumber,
      toBlockNumber,
      MULTITHREADING_MAX_BLOCK_RANGE
    );
    const additionalOptions = [
      '--pair-ids',
      pairIds.join(','),
    ];
    await this.doMultithreading(
      'swaps:sync',
      exchangeKey,
      ranges,
      batchInserts,
      additionalOptions
    );

    logger.notice('===== Swaps - sync (threaded) - DONE =====');

    return true;
  }

  /***** Helpers *****/
  static async getService<T extends ManagerServicesEnum>(serviceType: T): Promise<ManagerServicesType[T]> {
    if (!this._services) {
      this._services = new Map();
    }

    if (this._services.has(serviceType)) {
      return <ManagerServicesType[T]>this._services.get(serviceType);
    }

    if (!Object.values(ManagerServicesEnum).includes(<ManagerServicesEnum>serviceType)) {
      logger.critical(`Service ${serviceType} does not exist!`);
      process.exit(1);
    }

    let service: any;

    if (serviceType === ManagerServicesEnum.Database) {
      const database = new Pool({
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        host: 'timescaledb',
        port: 5432,
      });

      await database.connect();

      const databaseService = new DatabaseService(database);

      process.on('uncaughtException', async (err: any, origin: string) => {
        logger.critical(`An uncaught exception triggered at ${origin}: `, err);

        await databaseService.errors.insertError(
          {
            _source: 'process.uncaughtException',
            origin,
          },
          err
        );

        logger.critical(err);

        process.exit(1);
      });

      service = databaseService;
    } else if (serviceType === ManagerServicesEnum.Platform) {
      service = new PlatformService(
        await this.getService(ManagerServicesEnum.Database)
      );
    } else if (serviceType === ManagerServicesEnum.CoinGecko) {
      service = new CoinGeckoService();
    } else if (serviceType === ManagerServicesEnum.TokensSync) {
      service = new TokensSyncService(
        await this.getService(ManagerServicesEnum.Database)
      );
    } else if (serviceType === ManagerServicesEnum.PairsSync) {
      service = new PairsSyncService(
        await this.getService(ManagerServicesEnum.Database),
        await this.getService(ManagerServicesEnum.TokensSync)
      );
    } else if (serviceType === ManagerServicesEnum.SwapsSync) {
      service = new SwapsSyncService(
        await this.getService(ManagerServicesEnum.Database)
      );
    }

    this._services.set(serviceType, service);

    return <ManagerServicesType[T]>service;
  }

  static async adjustExchangePairRangeBlockNumbers(
    exchangeKey: string,
    fromBlockNumber: number,
    toBlockNumber: number
  ): Promise<RangeType> {
    // Get all the available pair ranges and select the lowest, so we won't need to do through all
    // if they have already been processed.
    const databaseService = await this.getService(ManagerServicesEnum.Database);
    const exchange = await databaseService.exchanges.getExchangeByKey(exchangeKey);
    const availableExchangePairRange = await databaseService.exchanges.getAvailableExchangePairRanges(
      <ExchangeInterface>exchange,
      fromBlockNumber,
      toBlockNumber,
      toBlockNumber - fromBlockNumber // we want as few ranges as possible, so cover the whole range
    );

    const subRangesString = availableExchangePairRange.map((range) => {
      return range.join('-');
    }).join(', ');
    logger.info(
      `Available sub ranges for ${fromBlockNumber} to ${toBlockNumber}: ${subRangesString}`
    );

    if (
      availableExchangePairRange.length > 0 &&
      (
        availableExchangePairRange[0][0] !== fromBlockNumber ||
        availableExchangePairRange[0][1] !== toBlockNumber
      )
    ) {
      logger.info(
        `Changing fromBlockNumber from ${fromBlockNumber} to ${availableExchangePairRange[0][0]} and toBlockNumber from ${toBlockNumber} to ${availableExchangePairRange[0][1]} ...`
      );

      // The reason we set it to that range is, that we first want to go through this bit.
      // If, for example there would be a big space between, we don't want to wait for that.
      // We call this range, it's processed and then we call the command once again,
      // so it will discover the new range
      fromBlockNumber = availableExchangePairRange[0][0];
      toBlockNumber = availableExchangePairRange[0][1];
    }

    return [fromBlockNumber, toBlockNumber];
  }

  static async adjustPairSwapRangeBlockNumbers(
    pairIds: number[],
    fromBlockNumber: number,
    toBlockNumber: number
  ): Promise<RangeType> {
    // Get all the available pair ranges and select the lowest, so we won't need to do through all
    // if they have already been processed.
    const databaseService = await this.getService(ManagerServicesEnum.Database);
    const limit = toBlockNumber - fromBlockNumber; // we want as few ranges as possible, so cover the whole range

    let allPairSwapRanges: RangeType[] = [];
    for (const pairId of pairIds) {
      const pair = await databaseService.pairs.getPairById(pairId);
      const availablePairSwapRange = await databaseService.pairs.getAvailablePairSwapRanges(
        <PairInterface>pair,
        fromBlockNumber,
        toBlockNumber,
        limit
      );

      for (const range of availablePairSwapRange) {
        allPairSwapRanges.push(range);
      }
    }

    const availablePairSwapRange: RangeType[] = mergeRanges(allPairSwapRanges);
    const subRangesString = availablePairSwapRange.map((range) => {
      return range.join('-');
    }).join(', ');
    logger.info(
      `Available sub ranges for ${fromBlockNumber} to ${toBlockNumber}: ${subRangesString}`
    );

    if (
      availablePairSwapRange.length > 0 &&
      (
        availablePairSwapRange[0][0] !== fromBlockNumber ||
        availablePairSwapRange[0][1] !== toBlockNumber
      )
    ) {
      logger.info(
        `Changing fromBlockNumber from ${fromBlockNumber} to ${availablePairSwapRange[0][0]} and toBlockNumber from ${toBlockNumber} to ${availablePairSwapRange[0][1]} ...`
      );

      // The reason we set it to that range is, that we first want to go through this bit.
      // If, for example there would be a big space between, we don't want to wait for that.
      // We call this range, it's processed and then we call the command once again,
      // so it will discover the new range
      fromBlockNumber = availablePairSwapRange[0][0];
      toBlockNumber = availablePairSwapRange[0][1];
    }

    return [fromBlockNumber, toBlockNumber];
  }

  static async adjustSyncBlockNumbers(
    exchangeKey: string,
    pairIds: number[] | null,
    fromBlockNumber: number,
    toBlockNumber: number | 'latest'
  ): Promise<RangeType> {
    const databaseService = await this.getService(ManagerServicesEnum.Database);
    const exchange = await databaseService.exchanges.getExchangeByKey(exchangeKey);
    if (!exchange) {
      logger.critical('Exchange does not exist!');
      process.exit(1);
    }

    const platformService = await this.getService(ManagerServicesEnum.Platform);
    platformService.setProvider(DEFAULT_PLATFORM_SERVICE_PROVIDER);

    if (
      exchange.factoryContract &&
      fromBlockNumber < exchange.factoryContract!.startBlockNumber
    ) {
      logger.info(
        `The exchange factory contract was created at ${exchange.factoryContract!.startBlockNumber}. Changing fromBlockNumber to that value ...`
      );

      fromBlockNumber = exchange.factoryContract!.startBlockNumber;
    }

    if (
      pairIds !== null &&
      pairIds.length > 0
    ) {
      let lowestBlockNumber: number | null = null;
      for (const pairId of pairIds) {
        const pair = await databaseService.pairs.getPairById(pairId);
        if (!pair) {
          logger.critical('Pair does not exist!');
          process.exit(1);
        }

        if (
          lowestBlockNumber === null ||
          pair.blockNumber < lowestBlockNumber
        ) {
          lowestBlockNumber = pair.blockNumber;
        }
      }

      if (fromBlockNumber < (<number>lowestBlockNumber)) {
        logger.info(
          `The earliest pair was created at ${lowestBlockNumber}. Changing fromBlockNumber to that value ...`
        );

        fromBlockNumber = <number>lowestBlockNumber;
      }
    }

    if (toBlockNumber === 'latest') {
      const lastBlockNumber = await platformService.getLastBlockNumber(
        <PlatformEnum>exchange.platform
      );
      if (!lastBlockNumber) {
        logger.critical('Could not get the last block number!');
        process.exit(1);
      }

      toBlockNumber = lastBlockNumber;
    }

    return [fromBlockNumber, toBlockNumber];
  }

  static async doMultithreading(
    command: string,
    exchangeKey: string,
    ranges: RangeType[],
    batchInserts: boolean,
    additionalOptions: string[] = []
  ): Promise<boolean> {
    const cpusCount = cpus().length;

    let openProcesses = 0;

    const spawnNextProcess = (index: number) => {
      const subRange = ranges.shift();
      if (!subRange) {
        return;
      }

      spawnProcess(
        index,
        subRange
      );
    };

    const spawnProcess = (
      index: number,
      subRange: RangeType
    ): Promise<boolean> => {
      return new Promise<boolean>((resolve) => {
        let args = [
          argv[1],
          command,
          exchangeKey,
          '--from-block-number',
          subRange[0].toString(),
          '--to-block-number',
          subRange[1].toString(),
          batchInserts ? '--batch-inserts' : ''
        ];
        if (additionalOptions.length) {
          args = args.concat(additionalOptions);
        }

        logger.info(
          `Spawning process for worker #${index}, from block ${subRange[0]} to ${subRange[1]} with the following command: "${args.join(' ')}" ...`
        );

        openProcesses++;

        const child = spawn(
          'node',
          args
        );

        child.stdout.pipe(pt(`[Worker ${index}] `)).pipe(process.stdout);
        child.stderr.pipe(pt(`[Worker ${index}] `)).pipe(process.stderr);

        child.on('error', (error) => {
          logger.critical(`[Worker ${index}]`, error);

          openProcesses--;

          spawnNextProcess(index);

          resolve(false);
        });
        child.on('exit', () => {
          logger.notice(`[Worker ${index}] Closing process ...`);

          openProcesses--;

          spawnNextProcess(index);

          resolve(true);
        });
      });
    };

    await new Promise<boolean>((resolve) => {
      for (let index = 0; index < cpusCount; index++) {
        const subRange = ranges.shift();
        if (!subRange) {
          continue;
        }

        spawnProcess(
          index,
          subRange
        );
      }

      setInterval(() => {
        if (openProcesses <= 0) {
          resolve(true);
        }
      }, 1000);
    });

    return true;
  }
}
