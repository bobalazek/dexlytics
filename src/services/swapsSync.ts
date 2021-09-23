import Manager, { ManagerServicesEnum } from '../manager';
import DatabaseService from './database';
import PairSwapRangeInterface from '../database/interfaces/pairSwapRange';
import ExchangeInterface from '../database/interfaces/exchange';
import PairInterface from '../database/interfaces/pair';
import SwapInterface from '../database/interfaces/swap';
import PlatformSwapInterface from '../interfaces/platformSwap';
import PlatformEnum from '../enums/platform';
import { DEFAULT_DATE, DEFAULT_PLATFORM_SERVICE_PROVIDER, MAX_BLOCK_RANGE } from '../config';
import logger from '../utils/logger';


export default class SwapsSyncService {
  private _databaseService: DatabaseService;

  constructor(databaseService: DatabaseService) {
    this._databaseService = databaseService;
  }

  async sync(
    exchange: ExchangeInterface,
    pairIds: number[],
    fromBlockNumber: number,
    toBlockNumber: number,
    batchInserts: boolean
  ): Promise<boolean> {
    logger.notice('Syncing swaps ...');

    const platformService = await Manager.getService(ManagerServicesEnum.Platform);
    platformService.setProvider(DEFAULT_PLATFORM_SERVICE_PROVIDER);

    if (pairIds.length === 0) {
      logger.critical(`Please specify at least one pair id!`);
      process.exit(1);
    }

    let pairs: PairInterface[] = [];
    for (const pairId of pairIds) {
      const pair = await this._databaseService.pairs.getPairByIdAndExchange(
        pairId,
        exchange
      );
      if (!pair) {
        logger.critical(`Pair with ID ${pairId} not found!`);
        process.exit(1);
      }

      pairs.push(pair);
    }

    let fromBlockNumberFinal = fromBlockNumber;
    for (const pair of pairs) {
      if (pair.blockNumber < fromBlockNumberFinal) {
        fromBlockNumberFinal = pair.blockNumber;
      }
    }

    const addresses = pairs.map((pair) => {
      return pair.address;
    });

    logger.info(
      `Starting to sync swaps for pair with addresses ${addresses.join(',')}, from ${fromBlockNumberFinal} to ${toBlockNumber}`
    );

    const ranges = await this._databaseService.exchanges.getAvailablePairSwapRanges(
      pairs,
      fromBlockNumberFinal,
      toBlockNumber,
      MAX_BLOCK_RANGE
    );
    for (const range of ranges) {
      let pairSwapRanges: PairSwapRangeInterface[] = [];
      for (const pair of pairs) {
        const pairSwapRange = await this._databaseService.pairs.addPairSwapRange(
          pair,
          range[0],
          range[1]
        );
        if (!pairSwapRange) {
          logger.critical('Could not create pair swap range.');
          process.exit(1);
        }

        pairSwapRanges.push(pairSwapRange);
      }

      const swaps = await platformService.getSwaps(
        exchange,
        pairs,
        range[0],
        range[1]
      );

      if (swaps === null) {
        for (const pairSwapRange of pairSwapRanges) {
          await this._databaseService.pairs.updatePairSwapRange(
            pairSwapRange,
            true
          );
        }

        continue;
      }

      await this._processSwaps(exchange, swaps, batchInserts);

      for (const pairSwapRange of pairSwapRanges) {
        await this._databaseService.pairs.updatePairSwapRange(
          pairSwapRange,
          false
        );
      }
    }

    logger.notice('Done syncing swaps.');

    return true;
  }

  /***** Helpers *****/
  private async _processSwaps(
    exchange: ExchangeInterface,
    swaps: PlatformSwapInterface[],
    batchInserts: boolean
  ): Promise<boolean> {
    logger.notice(`Starting to process ${swaps.length} swaps ${batchInserts ? '(in batch)' : ''} ...`);

    if (batchInserts) {
      await this._processSwapsBatch(exchange, swaps);
    } else {
      await this._processSwapsSingle(exchange, swaps);
    }

    return true;
  }

  private async _processSwapsBatch(
    exchange: ExchangeInterface,
    swaps: PlatformSwapInterface[]
  ): Promise<boolean> {
    const platform = <PlatformEnum>exchange.platform;
    const platformService = await Manager.getService(ManagerServicesEnum.Platform);
    platformService.setProvider(DEFAULT_PLATFORM_SERVICE_PROVIDER);

    const swapsTransactionHashSet = new Set<string>();
    for (const swap of swaps) {
      swapsTransactionHashSet.add(swap.transactionHash);
    }

    const databaseSwaps = await this._databaseService.swaps.getSwapsByTransactionHash(
      Array.from(swapsTransactionHashSet)
    );

    const databaseSwapsTransactionHashSet = new Set<string>();
    for (const swap of databaseSwaps) {
      databaseSwapsTransactionHashSet.add(swap.transactionHash);
    }

    const insertableSwaps: SwapInterface[] = [];
    for (const swap of swaps) {
      if (databaseSwapsTransactionHashSet.has(swap.transactionHash)) {
        continue;
      }

      logger.info(
        `Preparing ${swap.transactionHash} swap data for the database ...`
      );

      const now = new Date();
      let timestamp = new Date(DEFAULT_DATE);
      const block = await platformService.getBlockData(platform, swap.blockNumber);
      if (block) {
        timestamp = new Date(block.timestamp * 1000);
      }

      const pair = await this._databaseService.pairs.getPairByAddress(swap.pairAddress);
      if (!pair) {
        logger.critical(`Pair with address ${swap.pairAddress} not found!`);
        process.exit(1);
      }

      insertableSwaps.push({
        id: 0,
        transactionHash: swap.transactionHash,
        senderAddress: swap.senderAddress,
        recipientAddress: swap.recipientAddress,
        blockNumber: swap.blockNumber,
        amount0In: swap.amount0In,
        amount0Out: swap.amount0Out,
        amount1In: swap.amount1In,
        amount1Out: swap.amount1Out,
        exchangeId: exchange.id,
        pairId: pair.id,
        timestamp,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (insertableSwaps.length) {
      logger.info(`Inserting ${insertableSwaps.length} swaps into the database ...`);

      await this._databaseService.swaps.insertSwapsBatch(
        insertableSwaps
      );
    }

    return true;
  }

  private async _processSwapsSingle(
    exchange: ExchangeInterface,
    swaps: PlatformSwapInterface[]
  ): Promise<boolean> {
    const platform = <PlatformEnum>exchange.platform;

    const platformService = await Manager.getService(ManagerServicesEnum.Platform);
    platformService.setProvider(DEFAULT_PLATFORM_SERVICE_PROVIDER);

    for (const swap of swaps) {
      let timestamp = new Date(DEFAULT_DATE);
      const block = await platformService.getBlockData(platform, swap.blockNumber);
      if (block) {
        timestamp = new Date(block.timestamp * 1000);
      }

      const pair = await this._databaseService.pairs.getPairByAddress(swap.pairAddress);
      if (!pair) {
        logger.critical(`Pair with address ${swap.pairAddress} not found!`);
        process.exit(1);
      }

      logger.info(`Processing swap ${swap.transactionHash} for address ${pair.address} ...`);

      await this._databaseService.swaps.insertSwap(
        swap.transactionHash,
        swap.senderAddress,
        swap.recipientAddress,
        swap.blockNumber,
        swap.amount0In,
        swap.amount0Out,
        swap.amount1In,
        swap.amount1Out,
        exchange.id,
        pair.id,
        timestamp
      );
    }

    return true;
  }
}
