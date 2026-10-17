const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { z } = require('zod');
const { pool } = require('../db/postgres');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const router = express.Router();
router.use(requireAuth);
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const slipStorage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => cb(null, `slip-${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`)
});
const slipUpload = multer({
  storage: slipStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});

const orderSchema = z.object({
  address: z.string().min(1).max(500),
  paymentMethod: z.string().min(1).max(100).default('QR Code PromptPay')
});

async function orderWithItems(client, order) {
  const result = await client.query(
    `SELECT product_id AS "productId",product_name AS name,price,quantity,
            (price * quantity) AS subtotal
     FROM public.order_items WHERE order_id=$1 ORDER BY id`,
    [order.id]
  );
  return { ...order, items: result.rows };
}

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM public.orders WHERE user_id=$1 ORDER BY id DESC', [req.user.id]);
    const orders = await Promise.all(result.rows.map((order) => orderWithItems(pool, order)));
    res.json({ orders });
  } catch (error) { next(error); }
});

router.get('/all', requireAdmin, async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM public.orders ORDER BY id DESC');
    const orders = await Promise.all(result.rows.map((order) => orderWithItems(pool, order)));
    res.json({ orders });
  } catch (error) { next(error); }
});

router.post('/', validate(orderSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const userResult = await client.query('SELECT * FROM public.users WHERE id=$1 FOR UPDATE', [req.user.id]);
    const user = userResult.rows[0];
    if (!user) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'ไม่พบข้อมูลผู้ใช้' }); }

    const cartResult = await client.query(
      `SELECT ci.product_id,ci.quantity,p.name,p.price,p.stock,p.is_active
       FROM public.cart_items ci JOIN public.products p ON p.id=ci.product_id
       WHERE ci.user_id=$1 AND p.is_active=true FOR UPDATE OF p`,
      [req.user.id]
    );
    const cart = cartResult.rows;
    if (!cart.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'ตะกร้าว่างเปล่า' }); }
    for (const item of cart) {
      if (item.quantity > item.stock) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `สินค้า ${item.name} มีไม่พอในสต็อก` });
      }
    }

    const total = cart.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const orderResult = await client.query(
      `INSERT INTO public.orders(user_id,status,total,payment_method,customer_name,customer_phone,address)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.user.id, 'กำลังเตรียมพัสดุ', total, req.body.paymentMethod, user.name, user.phone, req.body.address]
    );
    const order = orderResult.rows[0];
    for (const item of cart) {
      await client.query(
        `INSERT INTO public.order_items(order_id,product_id,product_name,price,quantity) VALUES($1,$2,$3,$4,$5)`,
        [order.id, item.product_id, item.name, item.price, item.quantity]
      );
      await client.query('UPDATE public.products SET stock=stock-$1,updated_at=now() WHERE id=$2', [item.quantity, item.product_id]);
    }
    await client.query('DELETE FROM public.cart_items WHERE user_id=$1', [req.user.id]);
    await client.query('COMMIT');
    res.status(201).json({ order: await orderWithItems(client, order) });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    next(error);
  } finally { client.release(); }
});

router.post('/:id/slip', slipUpload.single('slip'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'กรุณาแนบไฟล์สลิป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB' });
    const orderResult = await pool.query('SELECT id,user_id FROM public.orders WHERE id=$1', [req.params.id]);
    const order = orderResult.rows[0];
    if (!order) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    if (req.user.role !== 'admin' && Number(order.user_id) !== Number(req.user.id)) return res.status(403).json({ error: 'ไม่มีสิทธิ์แนบสลิปให้คำสั่งซื้อนี้' });
    // Render Web Service ใช้ดิสก์ชั่วคราว ไฟล์ใน /uploads อาจหายหลัง Restart/Deploy
    // จึงเก็บสลิปเป็น Data URL ใน PostgreSQL เพื่อให้เปิดดูได้ถาวร
    const fileBuffer = fs.readFileSync(req.file.path);
    const url = `data:${req.file.mimetype};base64,${fileBuffer.toString('base64')}`;
    const result = await pool.query('UPDATE public.orders SET slip_url=$1,slip_uploaded_at=now() WHERE id=$2 RETURNING *', [url, req.params.id]);
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(201).json({ order: result.rows[0], url });
  } catch (error) { next(error); }
});

router.patch('/:id/status', requireAdmin, validate(z.object({ status: z.string().min(1).max(60) })), async (req, res, next) => {
  try {
    const result = await pool.query('UPDATE public.orders SET status=$1 WHERE id=$2 RETURNING *', [req.body.status, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อ' });
    res.json({ order: await orderWithItems(pool, result.rows[0]) });
  } catch (error) { next(error); }
});

module.exports = router;
