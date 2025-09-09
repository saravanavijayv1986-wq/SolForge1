import { SQLDatabase } from 'encore.dev/storage/sqldb';

export const launchpadDB = new SQLDatabase("launchpad", {
  migrations: "./migrations",
});
