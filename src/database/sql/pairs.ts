const dropPairsTable = `DROP TABLE IF EXISTS pairs CASCADE`;

const createPairsTable = `
  CREATE TABLE pairs (
    id SERIAL PRIMARY KEY,
    address TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    exchange_id INTEGER NOT NULL REFERENCES exchanges (id),
    token0_id INTEGER NOT NULL REFERENCES tokens (id),
    token1_id INTEGER NOT NULL REFERENCES tokens (id),
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX idx_pairs_exchange_token_ids
  ON pairs(exchange_id, token0_id, token1_id);
`;

export {
  dropPairsTable,
  createPairsTable,
}
