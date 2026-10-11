# Backend ฉบับใช้ Supabase PostgreSQL

ชุดนี้เปลี่ยน routes ของ auth, products, cart และ orders ให้ใช้ `src/db/postgres.js` แทน SQLite แล้ว

## ก่อนใช้

1. รัน `supabase/schema.sql` ใน Supabase SQL Editor
2. ตรวจว่า `.env` อยู่ที่ราก Backend
3. ตั้งค่าเชื่อมต่อแบบแยกช่อง หรือใช้ `SUPABASE_DB_URL`
4. รัน `npm install`
5. รัน `npm run test:supabase`
6. ถ้าย้ายข้อมูลแล้ว ให้ตรวจจำนวนข้อมูลใน Supabase

## เริ่ม Backend

```powershell
npm start
```

ตรวจ Health API:

```text
http://127.0.0.1:3000/api/health
```

ผลที่ควรเห็นมี:

```json
{"ok":true,"database":"postgresql"}
```

## ควรสำรองก่อนสลับ

เก็บ `data/shop.db` เดิมไว้ก่อน แม้ Backend ฉบับนี้จะไม่อ่าน SQLite แล้ว

## จุดที่เปลี่ยน

- `src/server.js` เชื่อม PostgreSQL
- `src/routes/auth.routes.js` ใช้ PostgreSQL
- `src/routes/products.routes.js` ใช้ PostgreSQL
- `src/routes/cart.routes.js` ใช้ PostgreSQL
- `src/routes/orders.routes.js` ใช้ PostgreSQL transaction
- Uploads ยังคงเก็บไฟล์ใน `uploads/` แบบเดิม ยังไม่ได้ย้าย Storage ไป Supabase

หาก API ใดขึ้น 500 ให้ดู Terminal Backend เพราะ Error จะระบุ SQL/ตารางที่มีปัญหา

## ระบบหมวดหมู่สินค้า

หลังอัปเดตไฟล์ ให้รัน `supabase/schema.sql` ใน Supabase SQL Editor อีกครั้ง เพื่อสร้าง `public.categories` และหมวดหมู่เริ่มต้น

Admin ใช้จัดการผ่าน `/api/categories` และหน้า Customer โหลดหมวดหมู่แบบไดนามิก
