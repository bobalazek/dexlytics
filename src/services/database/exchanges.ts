import { Pool } from 'pg';

import ExchangeInterface from '../../database/interfaces/exchange';
import ExchangePairRangeInterface from '../../database/interfaces/exchangePairRange';
import PairInterface from '../../database/interfaces/pair';
import RangeType from '../../types/range';
import { convertRowToExchange, convertRowToExchangePairRange, convertRowToPairSwapRange } from '../../database/converter';
import { getAvailableLowestDenominatorSubRanges, getAvailableSubRanges } from '../../utils/helpers';

export default class DatabaseExchanges {
  private _database: Pool;

  constructor(database: Pool) {
    this._database = database;
  }

  async getExchangeById(id: number): Promise<ExchangeInterface | null> {
    const result = await this._database.query(`
      SELECT * FROM exchanges
      WHERE id = $1
      LIMIT 1
    `, [
      id,
    ]);

    return result.rows.length > 0
      ? convertRowToExchange(result.rows[0])
      : null;
  }

  async getExchangeByKey(key: string): Promise<ExchangeInterface | null> {
    const result = await this._database.query(`
      SELECT * FROM exchanges
      WHERE key = $1
      LIMIT 1
    `, [
      key,
    ]);

    return result.rows.length > 0
      ? convertRowToExchange(result.rows[0])
      : null;
  }

  async addExchangePairRange(
    exchange: ExchangeInterface,
    fromBlockNumber: number,
    toBlockNumber: number
  ): Promise<ExchangePairRangeInterface | null> {
    const exchangRow = await this.getExchangeById(exchange.id);
    if (!exchangRow) {
      return null;
    }

    // Delete if we already have one ot those ranges set
    await this._database.query(`
      DELETE FROM exchange_pair_ranges
      WHERE
        exchange_id = $1 AND
        from_block_number = $2 AND
        to_block_number = $3
    `, [
      exchange.id,
      fromBlockNumber,
      toBlockNumber,
    ]);

    const result = await this._database.query(`
      INSERT INTO exchange_pair_ranges (exchange_id, from_block_number, to_block_number, started_at)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [
      exchange.id,
      fromBlockNumber,
      toBlockNumber,
      new Date(),
    ]);

    return result.rows.length > 0
      ? convertRowToExchangePairRange(result.rows[0])
      : null;
  }

  async updateExchangePairRange(
    exchangePairRange: ExchangePairRangeInterface,
    isFailed: boolean = false
  ): Promise<ExchangePairRangeInterface | null> {
    const result = await this._database.query(`
      UPDATE exchange_pair_ranges
      SET ${isFailed ? 'failed_at' : 'processed_at'} = $2, updated_at = $2
      WHERE id = $1
      RETURNING *
    `, [
      exchangePairRange.id,
      new Date(),
    ]);

    return result.rows.length > 0
      ? convertRowToExchangePairRange(result.rows[0])
      : null;
  }

  async getAvailableExchangePairRanges(
    exchange: ExchangeInterface,
    fromBlockNumber: number,
    toBlockNumber: number,
    limit: number,
    toleranceMilliseconds: number = 1000 * 60 * 60 * 4 // 4 hours
  ): Promise<RangeType[]> {
    const now = new Date();
    const timeSince = new Date(now.getTime() - toleranceMilliseconds);

    await this._database.query(`
      DELETE FROM exchange_pair_ranges
      WHERE
        exchange_id = $1 AND
        created_at < $2 AND
        started_at IS NOT NULL AND
        processed_at IS NULL AND
        failed_at IS NULL
    `, [
      exchange.id,
      timeSince
    ]);

    const result = await this._database.query(`
      SELECT
        exchange_pair_ranges.*,
        COUNT(exchange_pair_ranges.id) AS count
      FROM exchange_pair_ranges
      WHERE
        exchange_pair_ranges.exchange_id = $1 AND
        exchange_pair_ranges.from_block_number >= $2 AND
        exchange_pair_ranges.to_block_number <= $3
      GROUP BY
        exchange_pair_ranges.id,
        exchange_pair_ranges.from_block_number,
        exchange_pair_ranges.to_block_number
      ORDER BY
        exchange_pair_ranges.from_block_number ASC,
        exchange_pair_ranges.to_block_number ASC
    `, [
      exchange.id,
      fromBlockNumber,
      toBlockNumber,
    ]);

    const existingRanges: RangeType[] = [];
    for (const row of result.rows) {
      const exchangePairRange = convertRowToExchangePairRange(row);
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

  async getAvailablePairSwapRanges(
    pairs: PairInterface[],
    fromBlockNumber: number,
    toBlockNumber: number,
    limit: number,
    toleranceMilliseconds: number = 1000 * 60 * 60 * 4 // 4 hours
  ): Promise<RangeType[]> {
    const now = new Date();
    const timeSince = new Date(now.getTime() - toleranceMilliseconds);
    const pairIds = pairs.map((pair) => {
      return pair.id;
    });

    await this._database.query(`
      DELETE FROM pair_swap_ranges
      WHERE
        pair_id = ANY($1) AND
        created_at < $2 AND
        started_at IS NOT NULL AND
        processed_at IS NULL AND
        failed_at IS NULL
    `, [
      pairIds,
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
      pairIds,
      fromBlockNumber,
      toBlockNumber,
    ]);

    const existingRanges2D: RangeType[][] = [];
    for (const row of result.rows) {
      const exchangePairRange = convertRowToPairSwapRange(row);
      if (typeof existingRanges2D[exchangePairRange.pairId] === 'undefined') {
        existingRanges2D[exchangePairRange.pairId] = [];
      }

      existingRanges2D[exchangePairRange.pairId].push([
        exchangePairRange.fromBlockNumber,
        exchangePairRange.toBlockNumber,
      ]);
    }

    return getAvailableLowestDenominatorSubRanges(
      fromBlockNumber,
      toBlockNumber,
      limit,
      existingRanges2D
    );
  }
}
