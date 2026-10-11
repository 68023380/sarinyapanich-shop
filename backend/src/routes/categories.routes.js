const express = require('express');
const { z } = require('zod');
const { query } = require('../db/postgres');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');

const router = express.Router();
const categorySchema = z.object({ name: z.string().trim().min(1).max(60) });

function makeSlug(name) {
  const ascii = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${ascii || 'category'}-${Date.now().toString(36)}`;
}

router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      'SELECT id,slug,name,is_active AS "isActive",created_at AS "createdAt" FROM public.categories WHERE is_active=true ORDER BY name'
    );
    res.json({ categories: result.rows });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, requireAdmin, validate(categorySchema), async (req, res, next) => {
  try {
    const slug = makeSlug(req.body.name);
    const result = await query(
      `INSERT INTO public.categories (slug,name) VALUES ($1,$2)
       RETURNING id,slug,name,is_active AS "isActive",created_at AS "createdAt"`,
      [slug, req.body.name]
    );
    res.status(201).json({ category: result.rows[0] });
  } catch (error) { next(error); }
});

router.put('/:id', requireAuth, requireAdmin, validate(categorySchema), async (req, res, next) => {
  try {
    const result = await query(
      `UPDATE public.categories SET name=$1 WHERE id=$2 AND is_active=true
       RETURNING id,slug,name,is_active AS "isActive",created_at AS "createdAt"`,
      [req.body.name, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });
    res.json({ category: result.rows[0] });
  } catch (error) { next(error); }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const category = await query('SELECT slug FROM public.categories WHERE id=$1 AND is_active=true', [req.params.id]);
    if (!category.rows[0]) return res.status(404).json({ error: 'ไม่พบหมวดหมู่' });
    const used = await query('SELECT 1 FROM public.products WHERE category=$1 LIMIT 1', [category.rows[0].slug]);
    if (used.rows[0]) return res.status(409).json({ error: 'หมวดหมู่นี้มีสินค้าใช้งานอยู่ จึงยังลบไม่ได้' });
    await query('UPDATE public.categories SET is_active=false WHERE id=$1', [req.params.id]);
    res.status(204).send();
  } catch (error) { next(error); }
});

module.exports = router;
