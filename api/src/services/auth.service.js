const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const env = require('../config/env');
const Admin = require('../models/Admin');

async function ensureAdminSeeded() {
  const exists = await Admin.findOne({ username: env.adminUsername });
  if (exists) return exists;
  const passwordHash = await bcrypt.hash(env.adminPassword, 10);
  return Admin.create({ username: env.adminUsername, passwordHash, status: 'active' });
}

function signAdminToken(admin) {
  return jwt.sign({ adminId: admin._id, username: admin.username }, env.jwtSecret, { expiresIn: '7d' });
}

async function verifyAdminLogin(username, password) {
  const admin = await Admin.findOne({ username });
  if (!admin || admin.status !== 'active') return null;
  const ok = await bcrypt.compare(password, admin.passwordHash);
  return ok ? admin : null;
}

module.exports = { ensureAdminSeeded, signAdminToken, verifyAdminLogin };
