'use strict';
const path = require('path');
// Load .env from the backend directory regardless of where node was launched from
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors    = require('cors');

const authRouter = require('./routes/auth');

const app = express();

// ── Request logger ────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── CORS ──────────────────────────────────────────────────────────
// Allow all origins — auth uses Bearer tokens, not cookies, so credentials
// mode is unnecessary and wildcard + credentials:true is rejected by browsers.
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
// Respond to OPTIONS preflight on every route immediately
app.options('*', cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ── Serve frontend static files ───────────────────────────────────
// index.html, style.css, app.js live one directory up from backend/
const FRONTEND_DIR = path.join(__dirname, '..');
app.use(express.static(FRONTEND_DIR));

// Fallback: any unmatched route serves index.html (SPA behaviour)
app.get('*', (_req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// 404 for unmatched API routes (must come before the static handler above
// in real usage, but API routes are already mounted so this is just a safety net)
app.use((req, res) => {
  console.warn(`[404] ${req.method} ${req.path}`);
  res.status(404).json({ error: 'Not found.' });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('─'.repeat(50));
  console.log(`Gacha backend  →  http://localhost:${PORT}`);
  console.log(`CORS origin    →  ${process.env.FRONTEND_ORIGIN || '*'}`);
  console.log(`Database       →  ${process.env.DATABASE_URL ? 'configured' : '⚠ DATABASE_URL not set'}`);
  console.log(`JWT secret     →  ${process.env.JWT_SECRET ? 'configured' : '⚠ JWT_SECRET not set'}`);
  console.log('─'.repeat(50));
  console.log('  POST  /api/auth/signup');
  console.log('  POST  /api/auth/login');
  console.log('  GET   /api/auth/me');
  console.log('  PATCH /api/auth/silver');
  console.log('  PATCH /api/auth/password');
  console.log('─'.repeat(50));
});
