const mongoose = require('mongoose');
const env = require('./env');

async function connectDb() {
  if (!env.mongodbUri) throw new Error('MONGODB_URI is required');
  await mongoose.connect(env.mongodbUri, { autoIndex: true });
  return mongoose.connection;
}

function getDbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return states[mongoose.connection.readyState] || 'unknown';
}

module.exports = { connectDb, getDbStatus };
