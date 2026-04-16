const { verifyAdminLogin, signAdminToken } = require('../services/auth.service');

async function login(req, res, next) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ message: 'username and password are required' });
    const admin = await verifyAdminLogin(username, password);
    if (!admin) return res.status(401).json({ message: 'Invalid credentials' });
    const token = signAdminToken(admin);
    res.json({ token, admin: { id: admin._id, username: admin.username, status: admin.status } });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ admin: req.admin });
}

module.exports = { login, me };
