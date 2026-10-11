# Sarinyapanich Backend

Backend แยกจาก Frontend Demo สำหรับร้านศริณญาพานิช ใช้ Express, SQLite และ JWT

## เริ่มใช้งาน

```bash
cp .env.example .env
npm install
npm run seed
npm run dev
```

API จะทำงานที่ `http://localhost:3000`

## บัญชีเริ่มต้นหลัง seed

- Admin: `admin` / `ChangeMe123!`
- ผู้ใช้ทดลอง: `demo` / `ChangeMe123!`

ควรเปลี่ยนรหัสผ่านทันทีเมื่อเริ่มใช้งานจริง และเปลี่ยน `JWT_SECRET` ใน `.env`

## API หลัก

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products` (admin)
- `PUT /api/products/:id` (admin)
- `DELETE /api/products/:id` (admin; soft delete)
- `GET /api/cart`
- `PUT /api/cart/items/:productId`
- `DELETE /api/cart/items/:productId`
- `POST /api/orders`
- `GET /api/orders`
- `POST /api/uploads/product-image` (admin)

ส่ง JWT ใน Header:

```text
Authorization: Bearer <token>
```

ระบบนี้เป็นฐาน Backend สำหรับต่อกับ Frontend จริง ยังไม่รวม payment gateway, email/SMS, production reverse proxy และระบบสำรองข้อมูลอัตโนมัติ

