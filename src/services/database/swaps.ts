import { Pool } from 'pg';

import { convertRowToSwap } from '../../database/converter';
import SwapInterface from '../../database/interfaces/swap';

export default class DatabaseSwaps {
  private _database: Pool;

  constructor(database: Pool) {
    this._database = database;
  }

  async getSwapsByTransactionHash(transactionHashes: string[]): Promise<SwapInterface[]> {
    const result = await this._database.query(`
      SELECT * FROM swaps
      WHERE transaction_hash = ANY($1)
    `, [
      transactionHashes,
    ]);

    return result.rows.length > 0
      ? result.rows.map((row) => {
        return convertRowToSwap(row);
      })
      : [];
  }

  async insertSwap(
    transactionHash: string,
    senderAddress: string,
    recipientAddress: string,
    blockNumber: number,
    amount0In: string,
    amount0Out: string,
    amount1In: string,
    amount1Out: string,
    exchangeId: number,
    pairId: number,
    timestamp: Date
  ): Promise<SwapInterface | null> {
    const query = await this._database.query(`
      INSERT INTO swaps (
        transaction_hash,
        sender_address,
        recipient_address,
        block_number,
        amount0_in,
        amount0_out,
        amount1_in,
        amount1_out,
        exchange_id,
        pair_id,
        timestamp
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [
      transactionHash,
      senderAddress,
      recipientAddress,
      blockNumber,
      amount0In,
      amount0Out,
      amount1In,
      amount1Out,
      exchangeId,
      pairId,
      timestamp,
    ]);

    return query.rows.length > 0
      ? convertRowToSwap(query.rows[0])
      : null;
  }

  async insertSwaps(swaps: SwapInterface[]): Promise<boolean> {
    for (const swap of swaps) {
      const {
        transactionHash,
        senderAddress,
        recipientAddress,
        blockNumber,
        amount0In,
        amount0Out,
        amount1In,
        amount1Out,
        exchangeId,
        pairId,
        timestamp,
      } = swap;

      let i = 0;
      await this._database.query(`
        INSERT INTO swaps (
          transaction_hash,
          sender_address,
          recipient_address,
          block_number,
          amount0_in,
          amount0_out,
          amount1_in,
          amount1_out,
          exchange_id,
          pair_id,
          timestamp
        )
        VALUES ($${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i})
        ON CONFLICT DO NOTHING
      `, [
        transactionHash,
        senderAddress,
        recipientAddress,
        blockNumber,
        amount0In,
        amount0Out,
        amount1In,
        amount1Out,
        exchangeId,
        pairId,
        timestamp,
      ]);
    }

    return true;
  }

  async insertSwapsBatch(swaps: SwapInterface[], batchSize: number = 250): Promise<boolean> {
    const batches = [
      ...Array(Math.ceil(swaps.length / batchSize)),
    ].map(_ => swaps.splice(0, batchSize));
    for (const swapsBatch of batches) {
      const queryInserts: string[] = [];
      const values: any[] = [];
      let i = 0;
      for (const swap of swapsBatch) {
        const {
          transactionHash,
          senderAddress,
          recipientAddress,
          blockNumber,
          amount0In,
          amount0Out,
          amount1In,
          amount1Out,
          exchangeId,
          pairId,
          timestamp,
        } = swap;

        queryInserts.push(
          `($${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i})`
        );
        values.push(
          transactionHash,
          senderAddress,
          recipientAddress,
          blockNumber,
          amount0In,
          amount0Out,
          amount1In,
          amount1Out,
          exchangeId,
          pairId,
          timestamp,
        );
      }

      await this._database.query(`
        INSERT INTO swaps (
          transaction_hash,
          sender_address,
          recipient_address,
          block_number,
          amount0_in,
          amount0_out,
          amount1_in,
          amount1_out,
          exchange_id,
          pair_id,
          timestamp
        )
        VALUES ${queryInserts.join(', ')}
        ON CONFLICT DO NOTHING
      `, values);
    }

    return true;
  }
}
