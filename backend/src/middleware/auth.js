const jwt = require('jsonwebtoken');
require('dotenv').config();

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'development-secret');
    next();
  } catch {
    return res.status(401).json({ error: 'โทเคนไม่ถูกต้องหรือหมดอายุ' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'เฉพาะแอดมินเท่านั้น' });
  next();
}

module.exports = { requireAuth, requireAdmin };

