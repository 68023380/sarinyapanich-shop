const express = require('express');
const { z } = require('zod');
const { query } = require('../db/postgres');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const router = express.Router();

const productSchema = z.object({
  name: z.string().min(1).max(160),
  category: z.string().min(1).max(60),
  price: z.coerce.number().int().nonnegative(),
  stock: z.coerce.number().int().nonnegative().default(0),
  image: z.string().max(500).optional().default(''),
  description: z.string().max(2000).optional().default(''),
  ingredients: z.string().max(2000).optional().default(''),
  details: z.array(z.string().max(300)).optional().default([]),
  isActive: z.boolean().optional().default(true)
});

function mapProduct(row) {
  return {
    ...row,
    isActive: Boolean(row.is_active),
    details: Array.isArray(row.details) ? row.details : []
  };
}

router.get('/', async (req, res, next) => {
  try {
    const params = [];
    let sql = 'SELECT * FROM public.products WHERE is_active=true';
    if (req.query.category) { params.push(req.query.category); sql += ` AND category=$${params.length}`; }
    if (req.query.search) { params.push(`%${req.query.search}%`); sql += ` AND name ILIKE $${params.length}`; }
    sql += ' ORDER BY id DESC';
    const result = await query(sql, params);
    res.json({ products: result.rows.map(mapProduct) });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM public.products WHERE id=$1 AND is_active=true', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'ไม่พบสินค้า' });
    res.json({ product: mapProduct(result.rows[0]) });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, requireAdmin, validate(productSchema), async (req, res, next) => {
  try {
    const p = req.body;
    const result = await query(
      `INSERT INTO public.products (name,category,price,stock,image,description,ingredients,details,is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)
       RETURNING *`,
      [p.name, p.category, p.price, p.stock, p.image, p.description, p.ingredients, JSON.stringify(p.details), p.isActive]
    );
    res.status(201).json({ product: mapProduct(result.rows[0]) });
  } catch (error) { next(error); }
});

router.put('/:id', requireAuth, requireAdmin, validate(productSchema.partial()), async (req, res, next) => {
  try {
    const oldResult = await query('SELECT * FROM public.products WHERE id=$1', [req.params.id]);
    const old = oldResult.rows[0];
    if (!old) return res.status(404).json({ error: 'ไม่พบสินค้า' });
    const p = {
      name: old.name, category: old.category, price: old.price, stock: old.stock,
      image: old.image || '', description: old.description || '', ingredients: old.ingredients || '',
      details: Array.isArray(old.details) ? old.details : [], isActive: Boolean(old.is_active), ...req.body
    };
    const result = await query(
      `UPDATE public.products SET name=$1,category=$2,price=$3,stock=$4,image=$5,description=$6,
       ingredients=$7,details=$8::jsonb,is_active=$9,updated_at=now() WHERE id=$10 RETURNING *`,
      [p.name, p.category, p.price, p.stock, p.image, p.description, p.ingredients, JSON.stringify(p.details), p.isActive, req.params.id]
    );
    res.json({ product: mapProduct(result.rows[0]) });
  } catch (error) { next(error); }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const result = await query('UPDATE public.products SET is_active=false,updated_at=now() WHERE id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'ไม่พบสินค้า' });
    res.status(204).send();
  } catch (error) { next(error); }
});

module.exports = router;
