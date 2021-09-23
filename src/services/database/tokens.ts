import { Pool } from 'pg';

import TokenInterface from '../../database/interfaces/token';
import { convertRowToToken } from '../../database/converter';

export default class DatabaseTokens {
  private _database: Pool;

  constructor(database: Pool) {
    this._database = database;
  }

  async insertToken(
    name: string,
    symbol: string,
    decimals: number,
    platform: string,
    address: string,
    blockNumber: number | null,
    timestamp: Date,
    coingeckoId: number | null = null
  ): Promise<TokenInterface | null> {
    const query = await this._database.query(`
      INSERT INTO tokens (
        name,
        symbol,
        decimals,
        platform,
        address,
        block_number,
        timestamp,
        coingecko_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ${coingeckoId
        ? 'ON CONFLICT DO UPDATE SET coingecko_id = EXCLUDED.coingecko_id'
        : 'ON CONFLICT DO NOTHING'}
      RETURNING *
    `, [
      name,
      symbol,
      decimals,
      platform,
      address,
      blockNumber,
      timestamp,
      coingeckoId,
    ]);

    return query.rows.length > 0
      ? convertRowToToken(query.rows[0])
      : null;
  }

  async insertTokens(tokens: TokenInterface[]): Promise<boolean> {
    for (const token of tokens) {
      const {
        name,
        symbol,
        decimals,
        platform,
        address,
        blockNumber,
        timestamp,
        coingeckoId,
      } = token;

      let i = 0;
      await this._database.query(`
        INSERT INTO tokens (
          name,
          symbol,
          decimals,
          platform,
          address,
          block_number,
          timestamp,
          coingecko_id
        )
        VALUES ($${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i})
        ON CONFLICT DO NOTHING
      `, [
        name,
        symbol,
        decimals,
        platform,
        address,
        blockNumber,
        timestamp,
        coingeckoId,
      ]);
    }

    return true;
  }

  async insertTokensBatch(tokens: TokenInterface[], batchSize: number = 250): Promise<boolean> {
    const batches = [
      ...Array(Math.ceil(tokens.length / batchSize)),
    ].map(_ => tokens.splice(0, batchSize));
    for (const tokensBatch of batches) {
      const queryInserts: string[] = [];
      const values: any[] = [];
      let i = 0;
      for (const token of tokensBatch) {
        const {
          name,
          symbol,
          decimals,
          platform,
          address,
          blockNumber,
          timestamp,
          coingeckoId,
        } = token;

        queryInserts.push(
          `($${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i}, $${++i})`
        );
        values.push(
          name,
          symbol,
          decimals,
          platform ?? null,
          address ?? null,
          blockNumber ?? null,
          timestamp,
          coingeckoId ?? null
        );
      }

      await this._database.query(`
        INSERT INTO tokens (
          name,
          symbol,
          decimals,
          platform,
          address,
          block_number,
          timestamp,
          coingecko_id
        )
        VALUES ${queryInserts.join(', ')}
        ON CONFLICT DO NOTHING
      `, values);
    }

    return true;
  }

  async getTokenById(id: number): Promise<TokenInterface | null> {
    const result = await this._database.query(`
      SELECT * FROM tokens
      WHERE id = $1
      LIMIT 1
    `, [
      id,
    ]);

    return result.rows.length > 0
      ? convertRowToToken(result.rows[0])
      : null;
  }

  async getTokenByPlatformAndAddress(
    platform: string,
    address: string
  ): Promise<TokenInterface | null> {
    const result = await this._database.query(`
      SELECT * FROM tokens
      WHERE platform = $1 AND address = $2
      LIMIT 1
    `, [
      platform,
      address,
    ]);

    return result.rows.length > 0
      ? convertRowToToken(result.rows[0])
      : null;
  }

  async getTokensByAddresses(addresses: string[]): Promise<TokenInterface[]> {
    const result = await this._database.query(`
      SELECT * FROM tokens
      WHERE address = ANY($1)
    `, [
      addresses,
    ]);

    return result.rows.length > 0
      ? result.rows.map((row) => {
        return convertRowToToken(row);
      })
      : [];
  }
}
