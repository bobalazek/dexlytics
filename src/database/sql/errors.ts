const dropErrorsTable = `DROP TABLE IF EXISTS errors CASCADE`;

const createErrorsTable = `
  CREATE TABLE errors (
    id SERIAL PRIMARY KEY,
    parameters JSONB NULL,
    error JSONB NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
  );
`;

export {
  dropErrorsTable,
  createErrorsTable,
}
