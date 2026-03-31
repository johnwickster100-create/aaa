'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const authRouter = require('./routes/auth');

const app = express();

// ── Middleware ────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || '*',
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);

// Health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// 404 catch-all
app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));

// ── Start ─────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Gacha backend running on http://localhost:${PORT}`);
  console.log(`  POST  /api/auth/signup`);
  console.log(`  POST  /api/auth/login`);
  console.log(`  GET   /api/auth/me`);
  console.log(`  PATCH /api/auth/silver`);
});
