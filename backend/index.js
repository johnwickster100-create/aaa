'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const authRouter = require('./routes/auth');

const app = express();

// ── Request logger ────────────────────────────────────────────────
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// 404 catch-all
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
