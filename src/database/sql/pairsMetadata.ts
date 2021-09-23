const dropPairsMetadataTable = `DROP TABLE IF EXISTS pairs_metadata CASCADE`;

const createPairsMetadataTable = `
  CREATE TABLE pairs_metadata (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    pair_id INTEGER NOT NULL REFERENCES pairs (id),
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  );
`;

export {
  dropPairsMetadataTable,
  createPairsMetadataTable,
}
