'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors    = require('cors');

const authRouter = require('./routes/auth');
const FRONTEND_DIR = path.join(__dirname, '..');
const PORT = process.env.PORT || 3001;

const app = express();

// ── CORS — allow every origin (Bearer token auth, no cookies) ─────
app.use(cors({ origin: '*', methods: ['GET','POST','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'] }));
app.options('*', cors());

// ── Body parser ───────────────────────────────────────────────────
app.use(express.json());

// ── Request logger ────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── API routes ────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// Health check — MUST be at /api/health per spec
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString(), service: 'gacha-backend' }));

// Legacy alias
app.get('/health', (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString() }));

// ── Static frontend files ─────────────────────────────────────────
app.use(express.static(FRONTEND_DIR));

// SPA fallback — any unknown GET serves index.html
app.get('*', (_req, res) => res.sendFile(path.join(FRONTEND_DIR, 'index.html')));

// ── Global error handler ──────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
  const db  = process.env.DATABASE_URL ? 'configured' : '⚠ NOT SET';
  const jwt = process.env.JWT_SECRET   ? 'configured' : '⚠ NOT SET';
  console.log(`\nGacha backend  →  http://localhost:${PORT}`);
  console.log(`DATABASE_URL   →  ${db}`);
  console.log(`JWT_SECRET     →  ${jwt}`);
  console.log(`CORS           →  * (all origins)`);
  console.log(`Routes:`);
  console.log(`  GET  /api/health`);
  console.log(`  POST /api/auth/signup`);
  console.log(`  POST /api/auth/login`);
  console.log(`  GET  /api/auth/me`);
  console.log(`  PATCH /api/auth/silver`);
  console.log(`  PATCH /api/auth/password\n`);
});
