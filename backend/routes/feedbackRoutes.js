const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// ======================================================
// SUBMIT FEEDBACK
// ======================================================

router.post('/', async (req, res) => {
  try {
    const { message, rating } = req.body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'Feedback message is required' });
    }
    if (String(message).length > 2000) {
      return res.status(400).json({ message: 'Feedback is too long (max 2000 characters)' });
    }

    let ratingValue = null;
    if (rating !== undefined && rating !== null && rating !== '') {
      const n = Number(rating);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
      ratingValue = n;
    }

    await pool.query(
      'INSERT INTO feedback (user_id, message, rating) VALUES (?, ?, ?)',
      [req.user.id, String(message).trim(), ratingValue]
    );

    res.status(201).json({ message: 'Thanks for your feedback!' });
  } catch (err) {
    console.error('Submit feedback error:', err);
    res.status(500).json({ message: 'Could not submit feedback' });
  }
});

// ======================================================
// MY FEEDBACK (the current user's own submissions)
// ======================================================

router.get('/mine', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, message, rating, created_at FROM feedback WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('Load my feedback error:', err);
    res.status(500).json({ message: 'Could not load feedback' });
  }
});

module.exports = router;
