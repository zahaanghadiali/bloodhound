const app = require('./app');
const { connectDb } = require('./config/db');
const { port } = require('./config/env');
const logger = require('./utils/logger');

async function main() {
  await connectDb();
  app.listen(port, () => logger.info(`Bloodhound server listening on port ${port}`));
}

main().catch((err) => {
  logger.error('Failed to start server', { error: err.message });
  process.exit(1);
});
