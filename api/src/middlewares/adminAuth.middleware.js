const jwt = require('jsonwebtoken');
const env = require('../config/env');
const Admin = require('../models/Admin');

module.exports = async function adminAuth(req, res, next) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ message: 'Unauthorized' });
    const payload = jwt.verify(token, env.jwtSecret);
    const admin = await Admin.findById(payload.adminId).select('-passwordHash');
    if (!admin || admin.status !== 'active') return res.status(401).json({ message: 'Unauthorized' });
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
};
