const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  status: { type: String, enum: ['active', 'disabled'], default: 'active' }
}, { timestamps: true });

module.exports = mongoose.model('Admin', AdminSchema);
