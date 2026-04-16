const os = require('os');
const { getDbStatus } = require('../config/db');
const startTime = Date.now();

async function health(req, res) {
  res.json({
    status: 'ok',
    db: getDbStatus(),
    nodeEnv: process.env.NODE_ENV || 'development',
    hostname: os.hostname(),
    uptimeMs: Date.now() - startTime
  });
}

module.exports = { health };
