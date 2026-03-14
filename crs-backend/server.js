'use strict';
// server.js — CRS Ghana Backend · Express + SQLite
// ─────────────────────────────────────────────────
// Hostinger deployment:
//   1. Upload all files to public_html/api/ (or a subdomain)
//   2. Run: npm install
//   3. Copy .env.example to .env and edit values
//   4. Run: node server.js  (or use Hostinger's Node.js manager)

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const multer     = require('multer');
const path       = require('path');
const fs         = require('fs');

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const db = require('./db/init');

// ─── APP SETUP ────────────────────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3000;

// ─── SECURITY MIDDLEWARE ─────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost',
    /\.crs\.org\.gh$/,  // allow all subdomains
  ],
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const apiLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true });
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: { error: 'Too many login attempts' } });
app.use('/api/', apiLimit);
app.use('/api/auth/', authLimit);

// ─── FILE UPLOADS ─────────────────────────────────────────────────────────────
const UPLOAD_DIR = process.env.UPLOAD_DIR || './public/uploads';
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  destination: (req, file, cb) => {
    const sub = file.fieldname === 'pdf' ? 'pdfs' : 'images';
    const dir = path.join(UPLOAD_DIR, sub);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, safe);
  },
});
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg','image/png','image/webp','image/gif','application/pdf'];
  cb(null, allowed.includes(file.mimetype));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// Static file serving for uploads
app.use('/uploads', express.static(UPLOAD_DIR));

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  try {
    req.admin = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'dev-secret');
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function ok(res, data, meta = {}) {
  res.json({ success: true, ...meta, data });
}

function notFound(res, what = 'Resource') {
  res.status(404).json({ error: `${what} not found` });
}

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
  ok(res, { token, username: admin.username });
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { current, next: newPass } = req.body;
  if (!current || !newPass || newPass.length < 8) {
    return res.status(400).json({ error: 'Invalid password data' });
  }
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
  if (!bcrypt.compareSync(current, admin.password)) {
    return res.status(401).json({ error: 'Current password incorrect' });
  }
  db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(bcrypt.hashSync(newPass, 12), req.admin.id);
  ok(res, { message: 'Password updated' });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SERVICES API
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/services — public
app.get('/api/services', (req, res) => {
  const rows = db.prepare('SELECT * FROM services WHERE active=1 ORDER BY sort_order, id').all();
  ok(res, rows);
});

// GET /api/services/:id — public
app.get('/api/services/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM services WHERE id=? AND active=1').get(req.params.id);
  row ? ok(res, row) : notFound(res, 'Service');
});

// POST /api/services — admin
app.post('/api/services', requireAuth, (req, res) => {
  const { number, name, short_desc, full_desc, icon, sort_order } = req.body;
  if (!number || !name || !short_desc) return res.status(400).json({ error: 'number, name, short_desc required' });
  const result = db.prepare(`
    INSERT INTO services (number, name, short_desc, full_desc, icon, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(number, name, short_desc, full_desc || '', icon || 'circle', sort_order || 0);
  const row = db.prepare('SELECT * FROM services WHERE id=?').get(result.lastInsertRowid);
  res.status(201).json({ success: true, data: row });
});

// PUT /api/services/:id — admin
app.put('/api/services/:id', requireAuth, (req, res) => {
  const { number, name, short_desc, full_desc, icon, active, sort_order } = req.body;
  const existing = db.prepare('SELECT id FROM services WHERE id=?').get(req.params.id);
  if (!existing) return notFound(res, 'Service');
  db.prepare(`
    UPDATE services SET number=?, name=?, short_desc=?, full_desc=?, icon=?, active=?, sort_order=?
    WHERE id=?
  `).run(number, name, short_desc, full_desc, icon, active ?? 1, sort_order ?? 0, req.params.id);
  ok(res, db.prepare('SELECT * FROM services WHERE id=?').get(req.params.id));
});

// DELETE /api/services/:id — admin (soft delete)
app.delete('/api/services/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE services SET active=0 WHERE id=?').run(req.params.id);
  ok(res, { deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PROJECTS API
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/projects?category=health — public
app.get('/api/projects', (req, res) => {
  const { category } = req.query;
  let sql = 'SELECT * FROM projects WHERE 1=1';
  const params = [];
  if (category && category !== 'all') { sql += ' AND category=?'; params.push(category); }
  sql += ' ORDER BY sort_order, id';
  ok(res, db.prepare(sql).all(...params));
});

// GET /api/projects/:id — public
app.get('/api/projects/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id);
  row ? ok(res, row) : notFound(res, 'Project');
});

// POST /api/projects — admin
app.post('/api/projects', requireAuth, (req, res) => {
  const { title, category, years, location, description, status, sort_order } = req.body;
  if (!title || !category || !years || !location || !description) {
    return res.status(400).json({ error: 'title, category, years, location, description required' });
  }
  const r = db.prepare(`
    INSERT INTO projects (title, category, years, location, description, status, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, category, years, location, description, status || 'active', sort_order || 0);
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM projects WHERE id=?').get(r.lastInsertRowid) });
});

// PUT /api/projects/:id — admin
app.put('/api/projects/:id', requireAuth, (req, res) => {
  const { title, category, years, location, description, status, sort_order } = req.body;
  if (!db.prepare('SELECT id FROM projects WHERE id=?').get(req.params.id)) return notFound(res, 'Project');
  db.prepare(`
    UPDATE projects SET title=?, category=?, years=?, location=?, description=?, status=?, sort_order=?
    WHERE id=?
  `).run(title, category, years, location, description, status, sort_order ?? 0, req.params.id);
  ok(res, db.prepare('SELECT * FROM projects WHERE id=?').get(req.params.id));
});

// DELETE /api/projects/:id — admin
app.delete('/api/projects/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  ok(res, { deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  PUBLICATIONS API
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/publications?type=Report — public
app.get('/api/publications', (req, res) => {
  const { type } = req.query;
  let sql = 'SELECT * FROM publications WHERE active=1';
  const params = [];
  if (type && type !== 'all') { sql += ' AND type=?'; params.push(type); }
  sql += ' ORDER BY year DESC, sort_order, id';
  ok(res, db.prepare(sql).all(...params));
});

// GET /api/publications/:id — public
app.get('/api/publications/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM publications WHERE id=? AND active=1').get(req.params.id);
  row ? ok(res, row) : notFound(res, 'Publication');
});

// POST /api/publications — admin (with optional PDF upload)
app.post('/api/publications', requireAuth, upload.single('pdf'), (req, res) => {
  const { type, title, authors, pub_date, year, excerpt, sort_order } = req.body;
  if (!type || !title || !authors || !pub_date || !year || !excerpt) {
    return res.status(400).json({ error: 'type, title, authors, pub_date, year, excerpt required' });
  }
  const file_url = req.file ? `/uploads/pdfs/${req.file.filename}` : null;
  const r = db.prepare(`
    INSERT INTO publications (type, title, authors, pub_date, year, excerpt, file_url, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(type, title, authors, pub_date, parseInt(year), excerpt, file_url, sort_order || 0);
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM publications WHERE id=?').get(r.lastInsertRowid) });
});

// PUT /api/publications/:id — admin
app.put('/api/publications/:id', requireAuth, upload.single('pdf'), (req, res) => {
  const { type, title, authors, pub_date, year, excerpt, active, sort_order } = req.body;
  if (!db.prepare('SELECT id FROM publications WHERE id=?').get(req.params.id)) return notFound(res, 'Publication');
  const existing = db.prepare('SELECT file_url FROM publications WHERE id=?').get(req.params.id);
  const file_url = req.file ? `/uploads/pdfs/${req.file.filename}` : existing.file_url;
  db.prepare(`
    UPDATE publications SET type=?, title=?, authors=?, pub_date=?, year=?, excerpt=?, file_url=?, active=?, sort_order=?
    WHERE id=?
  `).run(type, title, authors, pub_date, parseInt(year), excerpt, file_url, active ?? 1, sort_order ?? 0, req.params.id);
  ok(res, db.prepare('SELECT * FROM publications WHERE id=?').get(req.params.id));
});

// DELETE /api/publications/:id — admin (soft)
app.delete('/api/publications/:id', requireAuth, (req, res) => {
  db.prepare('UPDATE publications SET active=0 WHERE id=?').run(req.params.id);
  ok(res, { deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  BLOG POSTS API
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/posts?category=articles&published=1 — public
app.get('/api/posts', (req, res) => {
  const { category, all: showAll } = req.query;
  let sql = 'SELECT id,category,title,slug,author,author_role,pub_date,excerpt,cover_image,published,sort_order,created_at FROM posts WHERE 1=1';
  const params = [];
  if (!showAll || !req.headers.authorization) { sql += ' AND published=1'; }
  if (category && category !== 'all') { sql += ' AND category=?'; params.push(category); }
  sql += ' ORDER BY sort_order, id DESC';
  ok(res, db.prepare(sql).all(...params));
});

// GET /api/posts/:slug — public
app.get('/api/posts/:slug', (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE slug=? AND published=1').get(req.params.slug);
  row ? ok(res, row) : notFound(res, 'Post');
});

// GET /api/posts/id/:id — admin (includes drafts)
app.get('/api/posts/id/:id', requireAuth, (req, res) => {
  const row = db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id);
  row ? ok(res, row) : notFound(res, 'Post');
});

// POST /api/posts — admin
app.post('/api/posts', requireAuth, upload.single('cover_image'), (req, res) => {
  const { category, title, author, author_role, pub_date, excerpt, body, published, sort_order } = req.body;
  if (!category || !title || !author || !pub_date || !excerpt) {
    return res.status(400).json({ error: 'category, title, author, pub_date, excerpt required' });
  }
  const slug = slugify(title);
  // ensure unique slug
  let finalSlug = slug;
  let i = 1;
  while (db.prepare('SELECT id FROM posts WHERE slug=?').get(finalSlug)) {
    finalSlug = `${slug}-${i++}`;
  }
  const cover_image = req.file ? `/uploads/images/${req.file.filename}` : null;
  const r = db.prepare(`
    INSERT INTO posts (category, title, slug, author, author_role, pub_date, excerpt, body, cover_image, published, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(category, title, finalSlug, author, author_role || null, pub_date, excerpt, body || '', cover_image, published ? 1 : 0, sort_order || 0);
  res.status(201).json({ success: true, data: db.prepare('SELECT * FROM posts WHERE id=?').get(r.lastInsertRowid) });
});

// PUT /api/posts/:id — admin
app.put('/api/posts/:id', requireAuth, upload.single('cover_image'), (req, res) => {
  const { category, title, author, author_role, pub_date, excerpt, body, published, sort_order } = req.body;
  if (!db.prepare('SELECT id FROM posts WHERE id=?').get(req.params.id)) return notFound(res, 'Post');
  const existing = db.prepare('SELECT cover_image FROM posts WHERE id=?').get(req.params.id);
  const cover_image = req.file ? `/uploads/images/${req.file.filename}` : existing.cover_image;
  db.prepare(`
    UPDATE posts SET category=?, title=?, author=?, author_role=?, pub_date=?, excerpt=?, body=?, cover_image=?, published=?, sort_order=?
    WHERE id=?
  `).run(category, title, author, author_role || null, pub_date, excerpt, body || '', cover_image, published ? 1 : 0, sort_order ?? 0, req.params.id);
  ok(res, db.prepare('SELECT * FROM posts WHERE id=?').get(req.params.id));
});

// DELETE /api/posts/:id — admin
app.delete('/api/posts/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM posts WHERE id=?').run(req.params.id);
  ok(res, { deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  CONTACT FORM API
// ═══════════════════════════════════════════════════════════════════════════════

const contactLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: { error: 'Too many submissions' } });

// POST /api/contact — public
app.post('/api/contact', contactLimit, (req, res) => {
  const { first_name, last_name, organisation, email, interest, message } = req.body;
  if (!first_name || !email || !message) {
    return res.status(400).json({ error: 'first_name, email, message required' });
  }
  const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRx.test(email)) return res.status(400).json({ error: 'Invalid email' });

  db.prepare(`
    INSERT INTO contacts (first_name, last_name, organisation, email, interest, message)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(first_name, last_name || '', organisation || '', email, interest || '', message);

  ok(res, { submitted: true });
});

// GET /api/contacts — admin
app.get('/api/contacts', requireAuth, (req, res) => {
  const { unread } = req.query;
  let sql = 'SELECT * FROM contacts';
  if (unread) sql += ' WHERE read=0';
  sql += ' ORDER BY created_at DESC';
  ok(res, db.prepare(sql).all());
});

// PATCH /api/contacts/:id/read — admin
app.patch('/api/contacts/:id/read', requireAuth, (req, res) => {
  db.prepare('UPDATE contacts SET read=1 WHERE id=?').run(req.params.id);
  ok(res, { marked: true });
});

// DELETE /api/contacts/:id — admin
app.delete('/api/contacts/:id', requireAuth, (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id=?').run(req.params.id);
  ok(res, { deleted: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  DASHBOARD STATS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/stats', requireAuth, (req, res) => {
  ok(res, {
    services:     db.prepare('SELECT COUNT(*) as n FROM services WHERE active=1').get().n,
    projects:     db.prepare('SELECT COUNT(*) as n FROM projects').get().n,
    publications: db.prepare('SELECT COUNT(*) as n FROM publications WHERE active=1').get().n,
    posts:        db.prepare('SELECT COUNT(*) as n FROM posts WHERE published=1').get().n,
    drafts:       db.prepare('SELECT COUNT(*) as n FROM posts WHERE published=0').get().n,
    contacts_new: db.prepare('SELECT COUNT(*) as n FROM contacts WHERE read=0').get().n,
    contacts_all: db.prepare('SELECT COUNT(*) as n FROM contacts').get().n,
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SERVE ADMIN & FRONTEND
// ═══════════════════════════════════════════════════════════════════════════════

app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all for SPA frontend
app.get('*', (req, res) => {
  const index = path.join(__dirname, 'public', 'index.html');
  if (fs.existsSync(index)) {
    res.sendFile(index);
  } else {
    res.json({ status: 'CRS Ghana API running', version: '1.0' });
  }
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✓ CRS Ghana API running on port ${PORT}`);
  console.log(`  Admin CMS: http://localhost:${PORT}/admin`);
  console.log(`  API root:  http://localhost:${PORT}/api`);
});

module.exports = app;
