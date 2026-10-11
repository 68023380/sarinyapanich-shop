const express = require('express');
const { z } = require('zod');
const { query } = require('../db/postgres');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const router = express.Router();
router.use(requireAuth);

async function getCart(userId) {
  const result = await query(
    `SELECT p.id,p.name,p.category,p.price,p.stock,p.image,ci.quantity,
            (p.price * ci.quantity) AS subtotal
     FROM public.cart_items ci
     JOIN public.products p ON p.id=ci.product_id
     WHERE ci.user_id=$1 AND p.is_active=true
     ORDER BY ci.product_id DESC`,
    [userId]
  );
  return result.rows;
}

router.get('/', async (req, res, next) => {
  try { res.json({ items: await getCart(req.user.id) }); } catch (error) { next(error); }
});

router.put('/items/:productId', validate(z.object({ quantity: z.coerce.number().int().min(1).max(999) })), async (req, res, next) => {
  try {
    const productResult = await query('SELECT id,stock,is_active FROM public.products WHERE id=$1', [req.params.productId]);
    const product = productResult.rows[0];
    if (!product || !product.is_active) return res.status(404).json({ error: 'ไม่พบสินค้า' });
    if (req.body.quantity > product.stock) return res.status(400).json({ error: 'สินค้าในสต็อกไม่เพียงพอ' });
    await query(
      `INSERT INTO public.cart_items(user_id,product_id,quantity) VALUES($1,$2,$3)
       ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=EXCLUDED.quantity`,
      [req.user.id, product.id, req.body.quantity]
    );
    res.json({ items: await getCart(req.user.id) });
  } catch (error) { next(error); }
});

router.delete('/items/:productId', async (req, res, next) => {
  try {
    await query('DELETE FROM public.cart_items WHERE user_id=$1 AND product_id=$2', [req.user.id, req.params.productId]);
    res.json({ items: await getCart(req.user.id) });
  } catch (error) { next(error); }
});

router.delete('/', async (req, res, next) => {
  try { await query('DELETE FROM public.cart_items WHERE user_id=$1', [req.user.id]); res.status(204).send(); } catch (error) { next(error); }
});

module.exports = router;
