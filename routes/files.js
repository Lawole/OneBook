// ============================================
// routes/files.js  –  Files & Receipts Module
// ============================================

const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const pool    = require('../config/database');
const auth    = require('../middleware/auth');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// ── helpers ───────────────────────────────────────────────────

// Ensure a "Receipts" section always exists for this company.
// Returns the section row.
async function ensureReceiptsSection(companyId) {
  const existing = await pool.query(
    `SELECT * FROM file_sections WHERE company_id=$1 AND LOWER(name)='receipts' LIMIT 1`,
    [companyId]
  );
  if (existing.rows.length) return existing.rows[0];
  const created = await pool.query(
    `INSERT INTO file_sections (company_id, name, description, color)
     VALUES ($1,'Receipts','Bank transaction receipts & proofs','#10b981') RETURNING *`,
    [companyId]
  );
  return created.rows[0];
}

async function uploadToSupabase(buffer, mimeType, path, supabaseUrl, supabaseKey) {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/files/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${supabaseKey}`,
      'Content-Type': mimeType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Storage upload failed: ${txt}`);
  }
  return `${supabaseUrl}/storage/v1/object/public/files/${path}`;
}

// ── File Sections ─────────────────────────────────────────────

// GET /files/sections
router.get('/sections', auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fs.*,
         (SELECT COUNT(*) FROM files f WHERE f.section_id = fs.id) AS file_count
       FROM file_sections fs
       WHERE fs.company_id = $1
       ORDER BY fs.created_at ASC`,
      [req.companyId]
    );
    res.json({ sections: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching sections', error: err.message });
  }
});

// POST /files/sections
router.post('/sections', auth, async (req, res) => {
  const { name, description, color } = req.body;
  if (!name) return res.status(400).json({ message: 'Section name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO file_sections (company_id, name, description, color)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.companyId, name, description || null, color || '#3b82f6']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error creating section', error: err.message });
  }
});

// PUT /files/sections/:id
router.put('/sections/:id', auth, async (req, res) => {
  const { name, description, color } = req.body;
  try {
    const result = await pool.query(
      `UPDATE file_sections SET name=$1, description=$2, color=$3, updated_at=NOW()
       WHERE id=$4 AND company_id=$5 RETURNING *`,
      [name, description || null, color || '#3b82f6', req.params.id, req.companyId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Section not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error updating section', error: err.message });
  }
});

// DELETE /files/sections/:id
router.delete('/sections/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM file_sections WHERE id=$1 AND company_id=$2',
      [req.params.id, req.companyId]
    );
    res.json({ message: 'Section deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting section', error: err.message });
  }
});

// ── Files ─────────────────────────────────────────────────────

// GET /files?section_id=&search=&source_type=
router.get('/', auth, async (req, res) => {
  const { section_id, search, source_type } = req.query;
  try {
    let where = 'WHERE f.company_id = $1';
    const params = [req.companyId];
    let idx = 2;

    if (section_id) { where += ` AND f.section_id = $${idx++}`; params.push(section_id); }
    if (source_type) { where += ` AND f.source_type = $${idx++}`; params.push(source_type); }
    if (search) {
      where += ` AND (f.name ILIKE $${idx} OR f.reference ILIKE $${idx} OR f.notes ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }

    const result = await pool.query(
      `SELECT f.*,
              fs.name AS section_name, fs.color AS section_color
       FROM files f
       LEFT JOIN file_sections fs ON f.section_id = fs.id
       ${where}
       ORDER BY f.created_at DESC`,
      params
    );
    res.json({ files: result.rows });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching files', error: err.message });
  }
});

// POST /files/upload  (multipart: file, section_id?, reference?, notes?, source_type?, source_id?)
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ message: 'Storage not configured. Add SUPABASE_URL and SUPABASE_SERVICE_KEY.' });
  }

  try {
    const { section_id, reference, notes, source_type, source_id, auto_receipts } = req.body;

    // If auto_receipts flag is set, find or create the Receipts section
    let resolvedSectionId = section_id || null;
    if (auto_receipts === 'true' || auto_receipts === true) {
      const receiptsSection = await ensureReceiptsSection(req.companyId);
      resolvedSectionId = receiptsSection.id;
    }

    // Build storage path
    const ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase();
    const safeName = req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${req.companyId}/${resolvedSectionId || 'unsorted'}/${Date.now()}_${safeName}`;

    // Upload to Supabase Storage
    const publicUrl = await uploadToSupabase(
      req.file.buffer,
      req.file.mimetype,
      storagePath,
      supabaseUrl,
      supabaseKey
    );

    // Persist file record
    const result = await pool.query(
      `INSERT INTO files
         (company_id, section_id, name, original_name, reference, url, storage_path, mime_type, size_bytes, source_type, source_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        req.companyId,
        resolvedSectionId,
        safeName,
        req.file.originalname,
        reference || null,
        publicUrl,
        storagePath,
        req.file.mimetype,
        req.file.size,
        source_type || 'manual',
        source_id   ? parseInt(source_id) : null,
        notes       || null,
      ]
    );

    const file = result.rows[0];

    // If attached to a bank transaction, update receipt_file_id
    if (source_type === 'bank_transaction' && source_id) {
      await pool.query(
        `UPDATE bank_transactions SET receipt_file_id=$1 WHERE id=$2 AND company_id=$3`,
        [file.id, source_id, req.companyId]
      );
    }

    res.status(201).json(file);
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ message: 'Upload failed', error: err.message });
  }
});

// PUT /files/:id  (rename, update reference / notes)
router.put('/:id', auth, async (req, res) => {
  const { name, reference, notes, section_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE files SET name=COALESCE($1,name), reference=$2, notes=$3, section_id=COALESCE($4,section_id)
       WHERE id=$5 AND company_id=$6 RETURNING *`,
      [name || null, reference || null, notes || null, section_id || null, req.params.id, req.companyId]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'File not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ message: 'Error updating file', error: err.message });
  }
});

// DELETE /files/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const fileRes = await pool.query(
      'SELECT * FROM files WHERE id=$1 AND company_id=$2',
      [req.params.id, req.companyId]
    );
    if (!fileRes.rows.length) return res.status(404).json({ message: 'File not found' });
    const file = fileRes.rows[0];

    // Optionally delete from Supabase storage
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
    if (supabaseUrl && supabaseKey && file.storage_path) {
      await fetch(`${supabaseUrl}/storage/v1/object/files/${file.storage_path}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${supabaseKey}` },
      }).catch(() => {}); // Don't fail if storage delete errors
    }

    await pool.query('DELETE FROM files WHERE id=$1 AND company_id=$2', [req.params.id, req.companyId]);
    res.json({ message: 'File deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting file', error: err.message });
  }
});

module.exports = router;
