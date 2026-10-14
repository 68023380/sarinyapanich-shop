const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { query } = require('../db/postgres');
const { validate } = require('../middleware/validate');
const { requireAuth, requireAdmin } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();
const authSchema = z.object({
  username: z.string().min(3).max(40).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(100),
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\d{10}$/),
  email: z.string().email().max(150)
});

function publicUser(user) {
  const { password_hash, ...safe } = user;
  return safe;
}

function tokenFor(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'development-secret',
    { expiresIn: '7d' }
  );
}

router.post('/register', validate(authSchema), async (req, res, next) => {
  try {
    const { username, password, name, phone, email } = req.body;
    const hash = bcrypt.hashSync(password, 12);
    const result = await query(
      `INSERT INTO public.users (username,password_hash,name,phone,email)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id,username,name,phone,email,role,avatar,address,created_at`,
      [username, hash, name, phone, email]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้งานแล้ว' });
    next(error);
  }
});

router.post('/login', validate(z.object({ username: z.string().min(1), password: z.string().min(1) })), async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM public.users WHERE username=$1', [req.body.username]);
    const user = result.rows[0];
    if (user && user.is_active === false) {
      return res.status(403).json({ error: 'บัญชีนี้ถูกปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ' });
    }
    if (!user || !bcrypt.compareSync(req.body.password, user.password_hash)) {
      return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
    }
    res.json({ token: tokenFor(user), user: publicUser(user) });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id,username,name,phone,email,role,avatar,address,is_active AS "isActive",created_at FROM public.users WHERE id=$1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
    res.json({ user: result.rows[0] });
  } catch (error) { next(error); }
});

router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await query('SELECT id,username,name,phone,email,role,avatar,address,is_active AS "isActive",created_at FROM public.users ORDER BY id DESC');
    res.json({ users: result.rows });
  } catch (error) { next(error); }
});

router.delete('/users/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const target = await query('SELECT id,role FROM public.users WHERE id=$1', [req.params.id]);
    if (!target.rows[0]) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    if (Number(target.rows[0].id) === Number(req.user.id)) return res.status(400).json({ error: 'ไม่สามารถปิดใช้งานบัญชีตัวเองได้' });
    if (target.rows[0].role === 'admin') return res.status(400).json({ error: 'ไม่อนุญาตให้ปิดใช้งานบัญชี Admin จากหน้านี้' });
    const result = await query('UPDATE public.users SET is_active=false WHERE id=$1 RETURNING id,username,is_active AS "isActive"', [req.params.id]);
    res.json({ user: result.rows[0], message: 'ปิดใช้งานบัญชีแล้ว' });
  } catch (error) { next(error); }
});

router.patch('/users/:id/restore', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await query('UPDATE public.users SET is_active=true WHERE id=$1 RETURNING id,username,is_active AS "isActive"', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'ไม่พบผู้ใช้' });
    res.json({ user: result.rows[0], message: 'กู้คืนบัญชีแล้ว' });
  } catch (error) { next(error); }
});

router.patch('/change-password', requireAuth, validate(z.object({
  currentPassword: z.string().min(1).max(100),
  newPassword: z.string().min(8).max(100)
})), async (req, res, next) => {
  try {
    const result = await query('SELECT id,password_hash FROM public.users WHERE id=$1', [req.user.id]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(req.body.currentPassword, user.password_hash)) {
      return res.status(400).json({ error: 'รหัสผ่านเดิมไม่ถูกต้อง' });
    }
    if (req.body.currentPassword === req.body.newPassword) {
      return res.status(400).json({ error: 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม' });
    }
    await query('UPDATE public.users SET password_hash=$1 WHERE id=$2', [bcrypt.hashSync(req.body.newPassword, 12), user.id]);
    res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
  } catch (error) { next(error); }
});

router.patch('/me', requireAuth, validate(z.object({
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\d{10}$/),
  email: z.string().email().max(150),
  address: z.string().max(500).default(''),
  avatar: z.string().max(1000000).optional()
})), async (req, res, next) => {
  try {
    const { name, phone, email, address, avatar } = req.body;
    const result = await query(
      `UPDATE public.users SET name=$1,phone=$2,email=$3,address=$4,avatar=COALESCE($5,avatar)
       WHERE id=$6
       RETURNING id,username,name,phone,email,role,avatar,address,created_at`,
      [name, phone, email, address, avatar ?? null, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้' });
    res.json({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' });
    next(error);
  }
});

module.exports = router;
