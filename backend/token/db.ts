import { SQLDatabase } from 'encore.dev/storage/sqldb';

export const tokenDB = new SQLDatabase("tokens", {
  migrations: "./migrations",
});
