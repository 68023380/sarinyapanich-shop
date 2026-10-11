const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { requireAuth, requireAdmin } = require('../middleware/auth');
require('dotenv').config();
const router = express.Router();
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
fs.mkdirSync(uploadDir, { recursive:true });
const storage = multer.diskStorage({ destination: uploadDir, filename: (req,file,cb) => { const ext=path.extname(file.originalname).toLowerCase(); cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`); } });
const upload = multer({ storage, limits:{ fileSize:5*1024*1024 }, fileFilter:(req,file,cb) => cb(null, ['image/jpeg','image/png','image/webp'].includes(file.mimetype)) });
router.post('/product-image', requireAuth, requireAdmin, upload.single('image'), (req,res) => { if(!req.file)return res.status(400).json({error:'กรุณาแนบไฟล์รูปภาพ jpg, png หรือ webp'}); res.status(201).json({ url:`/uploads/${req.file.filename}`, filename:req.file.filename }); });
module.exports = router;

