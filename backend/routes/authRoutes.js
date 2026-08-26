const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, registerNumber, email, password, college, department } = req.body;
    if (!name || !registerNumber || !email || !password) {
      return res.status(400).json({ message: 'Name, register number, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO users (name, register_number, email, password, college, department)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, registerNumber, email, hashed, college || null, department || null]
    );

    res.status(201).json({ message: 'Registration successful', userId: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during registration' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);

    if (!rows.length) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        registerNumber: user.register_number,
        email: user.email,
        college: user.college,
        department: user.department,
        role: user.role
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, register_number, email, college, department, role FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!rows.length) return res.status(404).json({ message: 'User not found' });

  const u = rows[0];
  res.json({
    id: u.id,
    name: u.name,
    registerNumber: u.register_number,
    email: u.email,
    college: u.college,
    department: u.department,
    role: u.role
  });
});

router.post('/logout', (req, res) => {
  res.json({ message: 'Logged out. Remove the token on the client.' });
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email, registerNumber, newPassword } = req.body;

    if (!email || !registerNumber || !newPassword) {
      return res.status(400).json({
        message: 'Email, register number and new password are required'
      });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const [rows] = await pool.query(
      'SELECT id, register_number FROM users WHERE email = ?',
      [email]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'No account found with that email' });
    }

    // Identity check: the register number must match our records
    // (case-insensitive, trimmed). This lets users reset their own
    // password without an email server.
    const stored = String(rows[0].register_number || '').trim().toLowerCase();
    const given = String(registerNumber).trim().toLowerCase();
    if (stored !== given) {
      return res.status(401).json({ message: 'Register number does not match our records' });
    }

    const hashed = await bcrypt.hash(String(newPassword), 10);
    await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashed, rows[0].id]);

    res.json({ message: 'Password reset successful. You can now log in.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Could not reset password' });
  }
});

module.exports = router;
