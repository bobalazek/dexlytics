import { Pool } from 'pg';

import AbiInterface from '../../database/interfaces/abi';
import { convertRowToAbi } from '../../database/converter';

export default class DatabaseAbis {
  private _database: Pool;

  constructor(database: Pool) {
    this._database = database;
  }

  async getAbiByKey(key: string): Promise<AbiInterface | null> {
    const result = await this._database.query(`
      SELECT * FROM abis
      WHERE key = $1
      LIMIT 1
    `, [
      key,
    ]);

    return result.rows.length > 0
      ? convertRowToAbi(result.rows[0])
      : null;
  }
}
