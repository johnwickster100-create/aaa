'use strict';
const router  = require('express').Router();
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const pool    = require('../db');
const { requireAuth } = require('../middleware/auth');

const SALT_ROUNDS = 12;
const SPECIAL_CHAR_RE = /[!@#$%^&*()\-_=+\[\]{};':"\\|,.<>/?`~]/;

// ── helpers ──────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function safeUser(row) {
  return {
    id:             row.id,
    email:          row.email,
    username:       row.username,
    silver_balance: row.silver_balance,
    email_verified: row.email_verified,
    created_at:     row.created_at,
  };
}

function validatePassword(pw) {
  if (!pw || pw.length < 8)          return 'Password must be at least 8 characters.';
  if (!SPECIAL_CHAR_RE.test(pw))     return 'Password must contain at least one special character.';
  return null;
}

// ── POST /api/auth/signup ─────────────────────────────────────────

router.post('/signup', async (req, res) => {
  const { email, username, password } = req.body ?? {};

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'email, username, and password are required.' });
  }

  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ error: pwErr });

  try {
    // Check username conflict first (gives clearer error)
    const uCheck = await pool.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );
    if (uCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Username already taken.' });
    }

    // Check email conflict
    const eCheck = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );
    if (eCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered.' });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (email, username, password_hash)
       VALUES (LOWER($1), $2, $3)
       RETURNING id, email, username, silver_balance, email_verified, created_at`,
      [email.trim(), username.trim(), password_hash]
    );

    const user  = result.rows[0];
    const token = signToken(user);

    return res.status(201).json({ token, user: safeUser(user) });
  } catch (err) {
    console.error('[signup]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────

router.post('/login', async (req, res) => {
  const { username, password } = req.body ?? {};

  if (!username || !password) {
    return res.status(400).json({ error: 'username and password are required.' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );

    const user = result.rows[0];
    // Use a constant-time compare even on miss (mitigates timing attacks)
    const hash  = user?.password_hash ?? '$2b$12$invalidhashpadding000000000000000000000000000000000000';
    const valid = await bcrypt.compare(password, hash);

    if (!user || !valid) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    const token = signToken(user);
    return res.json({ token, user: safeUser(user) });
  } catch (err) {
    console.error('[login]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, username, silver_balance, email_verified, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    return res.json(safeUser(result.rows[0]));
  } catch (err) {
    console.error('[me]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ── PATCH /api/auth/silver ────────────────────────────────────────
// Body: { delta: <integer> }  — negative to deduct, positive to add.
// Deductions fail with 402 if the user's balance is insufficient.

router.patch('/silver', requireAuth, async (req, res) => {
  const { delta } = req.body ?? {};

  if (typeof delta !== 'number' || !Number.isInteger(delta) || delta === 0) {
    return res.status(400).json({ error: 'delta must be a non-zero integer.' });
  }

  try {
    let result;

    if (delta < 0) {
      // Atomic conditional deduction — only succeeds if balance is sufficient
      result = await pool.query(
        `UPDATE users
         SET silver_balance = silver_balance + $1
         WHERE id = $2 AND silver_balance >= $3
         RETURNING silver_balance`,
        [delta, req.user.id, -delta]
      );

      if (result.rows.length === 0) {
        return res.status(402).json({ error: 'Insufficient silver balance.' });
      }
    } else {
      result = await pool.query(
        `UPDATE users
         SET silver_balance = silver_balance + $1
         WHERE id = $2
         RETURNING silver_balance`,
        [delta, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'User not found.' });
      }
    }

    return res.json({ silver_balance: result.rows[0].silver_balance });
  } catch (err) {
    console.error('[silver]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

// ── PATCH /api/auth/password ──────────────────────────────────────
// Body: { currentPassword, newPassword }

router.patch('/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
  }

  const pwErr = validatePassword(newPassword);
  if (pwErr) return res.status(400).json({ error: pwErr });

  try {
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const valid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, req.user.id]);

    return res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('[password]', err);
    return res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;
