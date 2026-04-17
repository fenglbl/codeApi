const mongoose = require('mongoose');

const ModelMappingSchema = new mongoose.Schema({
  localModel: { type: String, required: true },
  upstreamModel: { type: String, required: true }
}, { _id: false });

const UpstreamModelMappingSchema = new mongoose.Schema({
  upstreamId: { type: mongoose.Schema.Types.ObjectId, ref: 'UpstreamProvider', required: true },
  modelMappings: { type: [ModelMappingSchema], default: [] }
}, { _id: false });

const LocalApiKeySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  keyPrefix: { type: String, required: true },
  keyHash: { type: String, required: true, unique: true },
  rawKeyEncrypted: { type: String, required: true },
  rawKeyIv: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  remark: { type: String, default: '' },
  upstreamBindings: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UpstreamProvider' }],
  defaultUpstreamId: { type: mongoose.Schema.Types.ObjectId, ref: 'UpstreamProvider', default: null },
  modelMappings: [ModelMappingSchema],
  upstreamModelMappings: { type: [UpstreamModelMappingSchema], default: [] },
  lastUsedAt: { type: Date, default: null },
  usageCount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('LocalApiKey', LocalApiKeySchema);
