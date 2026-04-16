const app = require('./app');
const env = require('./config/env');
const { connectDb } = require('./config/db');
const { ensureAdminSeeded } = require('./services/auth.service');

async function bootstrap() {
  await connectDb();
  await ensureAdminSeeded();
  app.listen(env.port, () => {
    console.log(`CodeAip API listening on http://127.0.0.1:${env.port}`);
  });
}

bootstrap().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
