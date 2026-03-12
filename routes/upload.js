// ============================================
// routes/upload.js - Avatar / Image Upload
// ============================================

const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

// POST /api/upload/avatar
// Body: multipart/form-data { avatar: File, type: 'company'|'customer'|'vendor', id?: string }
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const { type, id } = req.body;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ message: 'Storage not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY to environment variables.' });
    }

    const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase();
    const entityId = type === 'company' ? req.companyId : (id || req.companyId);
    const fileName = `${type}/${entityId}_${Date.now()}.${ext}`;
    const bucketName = 'avatars';

    // Upload to Supabase Storage via REST API (no SDK needed)
    const uploadRes = await fetch(`${supabaseUrl}/storage/v1/object/${bucketName}/${fileName}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': req.file.mimetype,
        'x-upsert': 'true',
      },
      body: req.file.buffer,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return res.status(500).json({ message: 'Upload to storage failed', error: errText });
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/${bucketName}/${fileName}`;

    // Persist URL to the relevant table
    if (type === 'company') {
      await pool.query('UPDATE companies SET avatar_url = $1 WHERE id = $2', [publicUrl, req.companyId]);
    } else if (type === 'customer') {
      await pool.query('UPDATE customers SET avatar_url = $1 WHERE id = $2 AND company_id = $3', [publicUrl, id, req.companyId]);
    } else if (type === 'vendor') {
      await pool.query('UPDATE vendors SET avatar_url = $1 WHERE id = $2 AND company_id = $3', [publicUrl, id, req.companyId]);
    }

    res.json({ url: publicUrl });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

module.exports = router;
