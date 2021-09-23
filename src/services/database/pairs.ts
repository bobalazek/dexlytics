import { Pool } from 'pg';

import ExchangeInterface from '../../database/interfaces/exchange';
import PairInterface from '../../database/interfaces/pair';
import PairSwapRangeInterface from '../../database/interfaces/pairSwapRange';
import RangeType from '../../types/range';
import { convertRowToPair, convertRowToPairSwapRange } from '../../database/converter';
import { getAvailableSubRanges } from '../../utils/helpers';


export default class DatabasePairs {
  private _database: Pool;

  constructor(database: Pool) {
    this._database = database;
  }

  async insertPair(
    exchangeId: number,
    address: string,
    token0Id: number,
    token1Id: number,
    blockNumber: number,
    timestamp: Date
  ): Promise<boolean> {
    await this._database.query(`
      INSERT INTO pairs (
        exchange_id,
        address,
        token0_id,
        token1_id,
        block_number,
        timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT DO NOTHING
    `, [
      exchangeId,
      address,
      token0Id,
      token1Id,
      blockNumber,
      timestamp,
    ]);

    return true;
  }

  async insertPairsBatch(pairs: PairInterface[], batchSize: number = 250): Promise<boolean> {
    const batches = [
      ...Array(Math.ceil(pairs.length / batchSize)),
    ].map(_ => pairs.splice(0, batchSize));
    for (const pairsBatch of batches) {
      const queryInserts: string[] = [];
      const values: any[] = [];
      let i = 0;
      for (const pair of pairsBatch) {
        const {
          exchangeId,
          address,
          blockNumber,
          token0Id,
          token1Id,
          timestamp,
        } = pair;

        queryInserts.push(
          `($${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i})`
        );
        values.push(
          exchangeId,
          address,
          blockNumber,
          token0Id,
          token1Id,
          timestamp,
        );
      }

      await this._database.query(`
        INSERT INTO pairs (
          exchange_id,
          address,
          block_number,
          token0_id,
          token1_id,
          timestamp
        )
        VALUES ${queryInserts.join(', ')}
        ON CONFLICT DO NOTHING
      `, values);
    }

    return true;
  }

  async getPairsByExchange(exchange: ExchangeInterface): Promise<PairInterface[]> {
    const result = await this._database.query(`
      SELECT * FROM pairs
      WHERE exchange_id = $1
    `, [
      exchange.id,
    ]);

    return result.rows.length > 0
      ? result.rows.map((row) => {
        return convertRowToPair(row);
      })
      : [];
  }

  async getPairByIdAndExchange(id: number, exchange: ExchangeInterface): Promise<PairInterface | null> {
    const result = await this._database.query(`
      SELECT * FROM pairs
      WHERE id = $1 AND exchange_id = $2
      LIMIT 1
    `, [
      id,
      exchange.id,
    ]);

    return result.rows.length > 0
      ? convertRowToPair(result.rows[0])
      : null;
  }

  async getPairById(id: number): Promise<PairInterface | null> {
    const result = await this._database.query(`
      SELECT * FROM pairs
      WHERE id = $1
      LIMIT 1
    `, [
      id,
    ]);

    return result.rows.length > 0
      ? convertRowToPair(result.rows[0])
      : null;
  }

  async getPairByAddress(address: string): Promise<PairInterface | null> {
    const result = await this._database.query(`
      SELECT * FROM pairs
      WHERE address = $1
      LIMIT 1
    `, [
      address,
    ]);

    return result.rows.length > 0
      ? convertRowToPair(result.rows[0])
      : null;
  }

  async addPairSwapRange(
    pair: PairInterface,
    fromBlockNumber: number,
    toBlockNumber: number
  ): Promise<PairSwapRangeInterface | null> {
    const pairRow = await this.getPairById(pair.id);
    if (!pairRow) {
      return null;
    }

    // Delete if we already have one ot those ranges set
    await this._database.query(`
      DELETE FROM pair_swap_ranges
      WHERE
        pair_id = $1 AND
        from_block_number = $2 AND
        to_block_number = $3
    `, [
      pair.id,
      fromBlockNumber,
      toBlockNumber,
    ]);

    const result = await this._database.query(`
      INSERT INTO pair_swap_ranges (pair_id, from_block_number, to_block_number, started_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      pair.id,
      fromBlockNumber,
      toBlockNumber,
      new Date(),
    ]);

    return result.rows.length > 0
      ? convertRowToPairSwapRange(result.rows[0])
      : null;
  }

  async updatePairSwapRange(
    pairSwapRange: PairSwapRangeInterface,
    isFailed: boolean = false
  ): Promise<PairSwapRangeInterface | null> {
    const result = await this._database.query(`
      UPDATE pair_swap_ranges
      SET ${isFailed ? 'failed_at' : 'processed_at'} = $2, updated_at = $2
      WHERE id = $1
      RETURNING *
    `, [
      pairSwapRange.id,
      new Date(),
    ]);

    return result.rows.length > 0
      ? convertRowToPairSwapRange(result.rows[0])
      : null;
  }

  async getAvailablePairSwapRanges(
    pair: PairInterface,
    fromBlockNumber: number,
    toBlockNumber: number,
    limit: number,
    toleranceMilliseconds: number = 1000 * 60 * 60 * 4 // 4 hours
  ): Promise<RangeType[]> {
    const now = new Date();
    const timeSince = new Date(now.getTime() - toleranceMilliseconds);

    await this._database.query(`
      DELETE FROM pair_swap_ranges
      WHERE
        pair_id = $1 AND
        created_at < $2 AND
        started_at IS NOT NULL AND
        processed_at IS NULL AND
        failed_at IS NULL
    `, [
      pair.id,
      timeSince
    ]);

    const result = await this._database.query(`
      SELECT
        pair_swap_ranges.*,
        COUNT(pair_swap_ranges.id) AS count
      FROM pair_swap_ranges
      WHERE
        pair_swap_ranges.pair_id = $1 AND
        pair_swap_ranges.from_block_number >= $2 AND
        pair_swap_ranges.to_block_number <= $3
      GROUP BY
        pair_swap_ranges.id,
        pair_swap_ranges.from_block_number,
        pair_swap_ranges.to_block_number
      ORDER BY
        pair_swap_ranges.from_block_number ASC,
        pair_swap_ranges.to_block_number ASC
    `, [
      pair.id,
      fromBlockNumber,
      toBlockNumber,
    ]);

    const existingRanges: RangeType[] = [];
    for (const row of result.rows) {
      const exchangePairRange = convertRowToPairSwapRange(row);
      existingRanges.push([
        exchangePairRange.fromBlockNumber,
        exchangePairRange.toBlockNumber,
      ]);
    }

    return getAvailableSubRanges(
      fromBlockNumber,
      toBlockNumber,
      limit,
      existingRanges
    );
  }
}
