const mongoose = require('mongoose');

const UpstreamProviderSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  baseUrl: { type: String, required: true, trim: true },
  apiKeyEncrypted: { type: String, required: true },
  apiKeyIv: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  remark: { type: String, default: '' },
  models: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('UpstreamProvider', UpstreamProviderSchema);
