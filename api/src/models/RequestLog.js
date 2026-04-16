const mongoose = require('mongoose');

const RequestLogSchema = new mongoose.Schema({
  localKeyId: { type: mongoose.Schema.Types.ObjectId, ref: 'LocalApiKey', default: null },
  upstreamId: { type: mongoose.Schema.Types.ObjectId, ref: 'UpstreamProvider', default: null },
  path: { type: String, required: true },
  model: { type: String, default: '' },
  isStream: { type: Boolean, default: false },
  statusCode: { type: Number, default: 0 },
  durationMs: { type: Number, default: 0 },
  firstByteMs: { type: Number, default: 0 },
  promptTokens: { type: Number, default: 0 },
  completionTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  cacheReadTokens: { type: Number, default: 0 },
  cacheWriteTokens: { type: Number, default: 0 },
  inputChars: { type: Number, default: 0 },
  outputChars: { type: Number, default: 0 },
  errorMessage: { type: String, default: '' }
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('RequestLog', RequestLogSchema);
