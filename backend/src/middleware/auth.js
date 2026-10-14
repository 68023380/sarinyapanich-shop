const jwt = require('jsonwebtoken');
const { query } = require('../db/postgres');
require('dotenv').config();

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'development-secret');
    const result = await query('SELECT is_active AS "isActive" FROM public.users WHERE id=$1', [req.user.id]);
    if (!result.rows[0]) return res.status(401).json({ error: 'ไม่พบผู้ใช้' });
    if (result.rows[0].isActive === false) return res.status(403).json({ error: 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') return res.status(401).json({ error: 'โทเคนไม่ถูกต้องหรือหมดอายุ' });
    next(error);
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'เฉพาะแอดมินเท่านั้น' });
  next();
}

module.exports = { requireAuth, requireAdmin };
