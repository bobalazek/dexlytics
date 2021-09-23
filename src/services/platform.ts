import DatabaseService from './database';
import PlatformEnum from '../enums/platform';
import PlatformServiceProviderEnum from '../enums/platformProvider';
import ExchangeInterface from '../database/interfaces/exchange';
import PairInterface from '../database/interfaces/pair';
import PlatformPairInterface from '../interfaces/platformPair';
import PlatformBlockInterface from '../interfaces/platformBlock';
import PlatformTokenDataInterface from '../interfaces/platformTokenData';
import PlatformAdapterInterface from './platform/adapter';
import PlatformEthersAdapter from './platform/ethersAdapter';
import PlatformWeb3Adapter from './platform/web3Adapter';
import PlatformSwapInterface from '../interfaces/platformSwap';
import { sleep, splitRangeIntoSubRanges } from '../utils/helpers';
import logger from '../utils/logger';

export default class PlatformService {
  private _databaseService: DatabaseService;
  private _provider!: PlatformServiceProviderEnum;
  private _adapter!: PlatformAdapterInterface;
  private _maxPastEventAttempts: number;
  private _maxDataAttempts: number;
  private _maxRequestsBeforeProviderRotation: number;
  private _currentRequests: number;

  constructor(
    databaseService: DatabaseService,
    maxPastEventAttempts: number = 8,
    maxDataAttempts: number = 3,
    maxRequestsBeforeProviderRotation: number = 2000
  ) {
    this._databaseService = databaseService;
    this._maxPastEventAttempts = maxPastEventAttempts;
    this._maxDataAttempts = maxDataAttempts;
    this._maxRequestsBeforeProviderRotation = maxRequestsBeforeProviderRotation;
    this._currentRequests = 0;
  }

  setProvider(provider: PlatformServiceProviderEnum) {
    let adapter: PlatformAdapterInterface;
    switch (provider) {
      case PlatformServiceProviderEnum.WEB3:
        adapter = new PlatformWeb3Adapter(this._databaseService);
        break;
      case PlatformServiceProviderEnum.ETHERS:
        adapter = new PlatformEthersAdapter(this._databaseService);
        break;
      default:
        logger.critical(`Provider ${provider} not found!`);
        process.exit(1);
    }

    this._adapter = adapter;
    this._provider = provider;

    return adapter;
  }

  async rotateProvider(platform: PlatformEnum): Promise<boolean> {
    await this._doChecks(platform, true);

    logger.info(`Rotating the provider ...`);

    await this._adapter.rotateProvider(platform);

    await sleep(1000); // Let's make sure the provider is really ready!

    this._currentRequests = 0;

    return true;
  }

  async getPairs(
    exchange: ExchangeInterface,
    fromBlockNumber: number,
    toBlockNumber: number,
    attempt: number = 0,
    attemptData: any = null
  ): Promise<PlatformPairInterface[] | null> {
    await this._doChecks(<PlatformEnum>exchange.platform);

    if (!exchange.factoryContract) {
      logger.critical(`Factory contract not found for "${exchange.key}"!`);
      process.exit(1);
    }

    if (toBlockNumber < exchange.factoryContract.startBlockNumber) {
      return [];
    }

    this._currentRequests++;

    attempt++;

    logger.info(`Getting ${exchange.key} pairs data from block ${fromBlockNumber} to ${toBlockNumber} ...`);

    try {
      return await this._adapter.getPairs(exchange, fromBlockNumber, toBlockNumber);
    } catch (err) {
      if (attempt >= this._maxPastEventAttempts) {
        logger.error(
          `There was an error getting created pairs after ${attempt} attempts. Skipping ...`
        );

        await this._databaseService.errors.insertError(
          {
            _source: 'PlatformService.getPairs',
            _provider: this._provider,
            exchangeKey: exchange.key,
            fromBlockNumber,
            toBlockNumber,
            attempt,
            attemptData,
          },
          err
        );

        return null;
      }

      const range = Math.floor((toBlockNumber - fromBlockNumber) / 2);
      if (range < 1) {
        logger.critical(`Range can not be less than 1!`);
        process.exit(1);
      }

      logger.error(`There was an error getting created pairs. Trying a smaller range (${range}) ...`);

      await this._databaseService.errors.insertError(
        {
          _source: 'PlatformService.getPairs',
          _provider: this._provider,
          exchangeKey: exchange.key,
          fromBlockNumber,
          toBlockNumber,
          attempt,
          attemptData,
        },
        err
      );

      let pairs: PlatformPairInterface[] = [];
      const subRanges = splitRangeIntoSubRanges(fromBlockNumber, toBlockNumber, range);
      for (const subRange of subRanges) {
        const subRangePairs = await this.getPairs(
          exchange,
          subRange[0],
          subRange[1],
          attempt,
          {
            fromBlockNumberInitial: attemptData?.fromBlockNumberInitial ?? fromBlockNumber,
            toBlockNumberInitial: attemptData?.toBlockNumberInitial ?? toBlockNumber,
          }
        );

        if (subRangePairs === null) {
          return null;
        }

        pairs = pairs.concat(subRangePairs);
      }

      return pairs;
    }
  }

  async getSwaps(
    exchange: ExchangeInterface,
    pairOrPairs: PairInterface | PairInterface[],
    fromBlockNumber: number,
    toBlockNumber: number,
    attempt: number = 0,
    attemptData: any = null
  ): Promise<PlatformSwapInterface[]> {
    await this._doChecks(<PlatformEnum>exchange.platform);

    if (Array.isArray(pairOrPairs)) {
      let lowestBlockNumber: number | null = null;
      for (const pair of pairOrPairs) {
        if (
          lowestBlockNumber === null ||
          pair.blockNumber < lowestBlockNumber
        ) {
          lowestBlockNumber = pair.blockNumber;
        }
      }

      if (toBlockNumber < (<number>lowestBlockNumber)) {
        return [];
      }
    } else {
      if (toBlockNumber < pairOrPairs.blockNumber) {
        return [];
      }
    }

    this._currentRequests++;

    attempt++;

    logger.info(`Getting ${exchange.key} swaps data from block ${fromBlockNumber} to ${toBlockNumber} ...`);

    try {
      return await this._adapter.getSwaps(
        exchange,
        Array.isArray(pairOrPairs)
          ? pairOrPairs.map((pair) => {
            return pair.address;
          })
          : pairOrPairs,
        fromBlockNumber,
        toBlockNumber
      );
    } catch (err) {
      if (attempt >= this._maxPastEventAttempts) {
        logger.error(
          `There was an error getting swaps after ${attempt} attempts. Skipping ...`
        );

        await this._databaseService.errors.insertError(
          {
            _source: 'PlatformService.getSwaps',
            _provider: this._provider,
            exchangeKey: exchange.key,
            pairIds: Array.isArray(pairOrPairs)
              ? pairOrPairs.map((pair) => {
                return pair.id;
              })
              : pairOrPairs.id,
            fromBlockNumber,
            toBlockNumber,
            attempt,
            attemptData,
          },
          err
        );

        return [];
      }

      const range = Math.floor((toBlockNumber - fromBlockNumber) / 2);
      if (range < 1) {
        logger.critical(`Range can not be less than 1!`);
        process.exit(1);
      }

      logger.error(`There was an error getting swaps. Trying a smaller range (${range}) ...`);

      await this._databaseService.errors.insertError(
        {
          _source: 'PlatformService.getSwaps',
          _provider: this._provider,
          exchangeKey: exchange.key,
          fromBlockNumber,
          toBlockNumber,
          attempt,
          attemptData,
        },
        err
      );

      let swaps: PlatformSwapInterface[] = [];
      const subRanges = splitRangeIntoSubRanges(fromBlockNumber, toBlockNumber, range);
      for (const subRange of subRanges) {
        const subRangeSwaps = await this.getSwaps(
          exchange,
          pairOrPairs,
          subRange[0],
          subRange[1],
          attempt,
          {
            fromBlockNumberInitial: attemptData?.fromBlockNumberInitial ?? fromBlockNumber,
            toBlockNumberInitial: attemptData?.toBlockNumberInitial ?? toBlockNumber,
          }
        );

        swaps = swaps.concat(subRangeSwaps);
      }

      return swaps;
    }
  }

  async getTokenData(
    platform: PlatformEnum,
    address: string,
    attempt: number = 0
  ): Promise<PlatformTokenDataInterface | null> {
    await this._doChecks(platform);

    this._currentRequests += 3; // name, symbol & decimals are all separate calls

    attempt++;

    logger.info(`Getting token data for ${address} ...`);

    try {
      const tokenData = await this._adapter.getTokenData(platform, address);
      if (tokenData) {
        // Sometimes haxors try to inject stupid null characters that postgres can't handle
        tokenData.name = tokenData.name.replaceAll("\u0000", '');
        tokenData.symbol = tokenData.symbol.replaceAll("\u0000", '');
      }

      return tokenData;
    } catch (err) {
      logger.error(
        `There was an error getting token data after #${attempt} attempt ...`
      );

      await this._databaseService.errors.insertError(
        {
          _source: 'PlatformService.getTokenData',
          _provider: this._provider,
          platform,
          address,
          attempt,
        },
        err
      );

      if (attempt <= this._maxDataAttempts) {
        await this.rotateProvider(platform);

        return this.getTokenData(platform, address, attempt);
      }

      return null;
    }
  }

  async getBlockData(
    platform: PlatformEnum,
    blockNumberOrHash: number | string,
    attempt: number = 0
  ): Promise<PlatformBlockInterface | null> {
    await this._doChecks(platform);

    this._currentRequests++;

    attempt++;

    try {
      return await this._adapter.getBlockData(platform, blockNumberOrHash);
    } catch (err) {
      logger.error(
        `There was an error getting block data after #${attempt} attempt ...`
      );

      await this._databaseService.errors.insertError(
        {
          _source: 'PlatformService.getBlockData',
          _provider: this._provider,
          platform,
          blockNumberOrHash,
          attempt,
        },
        err
      );

      if (attempt < this._maxDataAttempts) {
        await this.rotateProvider(platform);

        return this.getBlockData(platform, blockNumberOrHash, attempt);
      }

      return null;
    }
  }

  async getLastBlockNumber(
    platform: PlatformEnum,
    attempt: number = 0
  ): Promise<number | null> {
    await this._doChecks(platform);

    this._currentRequests++;

    attempt++;

    try {
      return await this._adapter.getLastBlockNumber(platform);
    } catch (err) {
      logger.error(
        `There was an error getting last block number after #${attempt} attempt ...`
      );

      await this._databaseService.errors.insertError(
        {
          _source: 'PlatformService.getLastBlockNumber',
          _provider: this._provider,
          platform,
          attempt,
        },
        err
      );

      if (attempt < this._maxDataAttempts) {
        await this.rotateProvider(platform);

        return this.getLastBlockNumber(platform, attempt);
      }

      return null;
    }
  }

  /***** Helpers *****/
  private async _doChecks(
    platform: PlatformEnum,
    ignoreRequestsCheck: boolean = false
  ): Promise<void> {
    if (!this._adapter) {
      logger.critical('You need to call platformService.setProvider() first to set the adapter!');
      process.exit(1);
    }

    if (
      !ignoreRequestsCheck &&
      this._currentRequests > this._maxRequestsBeforeProviderRotation
    ) {
      await this.rotateProvider(platform);
    }
  }
}
