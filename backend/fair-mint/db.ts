import { SQLDatabase } from 'encore.dev/storage/sqldb';

export const fairMintDB = new SQLDatabase("fair_mint", {
  migrations: "./migrations",
});
