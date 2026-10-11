require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./database');
const products = [
  ['ข้าวหอมมะลิ 5 กก.','grain',189,25,'🍚','ข้าวหอมมะลิคุณภาพดี','ข้าวหอมมะลิ 100%', ['น้ำหนักสุทธิ 5 กิโลกรัม','เก็บในที่แห้ง']],
  ['น้ำมันพืช 1 ลิตร','oil',55,30,'🫗','น้ำมันพืชสำหรับประกอบอาหาร','น้ำมันปาล์มโอเลอีน 100%', ['ปริมาตรสุทธิ 1 ลิตร','เก็บให้พ้นแสงแดด']],
  ['ไข่ไก่ เบอร์ 2 แพ็ก 10 ฟอง','fresh',52,40,'🥚','ไข่ไก่สดคัดขนาด','ไข่ไก่ 100%', ['บรรจุ 10 ฟอง','ควรเก็บในตู้เย็น']],
  ['ปลากระป๋องในซอสมะเขือเทศ','canned',25,50,'🥫','ปลากระป๋องรสเข้มข้น','ปลา, ซอสมะเขือเทศ, เกลือ', ['ตรวจสอบกระป๋องก่อนเปิด']]
];
const insertUser = db.prepare('INSERT OR IGNORE INTO users(username,password_hash,name,phone,email,role) VALUES(?,?,?,?,?,?)');
insertUser.run('admin',bcrypt.hashSync('ChangeMe123!',12),'ผู้ดูแลระบบ','0800000000','admin@example.com','admin');
insertUser.run('demo',bcrypt.hashSync('ChangeMe123!',12),'ผู้ใช้ทดลอง','0812345678','demo@example.com','customer');
const insertProduct = db.prepare('INSERT INTO products(name,category,price,stock,image,description,ingredients,details) SELECT ?,?,?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM products WHERE name=?)');
for (const p of products) insertProduct.run(p[0],p[1],p[2],p[3],p[4],p[5],p[6],JSON.stringify(p[7]),p[0]);
console.log('Seed complete');
