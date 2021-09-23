const dropSwapsTable = `DROP TABLE IF EXISTS swaps CASCADE`;

const createSwapsTable = `
  CREATE TABLE swaps (
    id SERIAL PRIMARY KEY,
    transaction_hash TEXT NOT NULL,
    sender_address TEXT NOT NULL,
    recipient_address TEXT NOT NULL,
    amount0_in TEXT NOT NULL,
    amount0_out TEXT NOT NULL,
    amount1_in TEXT NOT NULL,
    amount1_out TEXT NOT NULL,
    block_number INTEGER NOT NULL,
    exchange_id INTEGER NOT NULL REFERENCES exchanges (id),
    pair_id INTEGER NOT NULL REFERENCES pairs (id),
    timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  );
  CREATE UNIQUE INDEX idx_swaps_exchange_id_pair_id_transaction_hash
  ON swaps(exchange_id, pair_id, transaction_hash);
`;

export {
  dropSwapsTable,
  createSwapsTable,
}
