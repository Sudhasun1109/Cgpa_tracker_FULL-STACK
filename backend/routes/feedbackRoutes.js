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
    const { message } = req.body;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'Feedback message is required' });
    }
    if (String(message).length > 2000) {
      return res.status(400).json({ message: 'Feedback is too long (max 2000 characters)' });
    }

    // Store a snapshot of the user's name/email for easy admin display.
    const [users] = await pool.query(
      'SELECT name, email FROM users WHERE id = ?',
      [req.user.id]
    );
    const name = users.length ? users[0].name : null;
    const email = users.length ? users[0].email : null;

    await pool.query(
      'INSERT INTO feedback (user_id, name, email, message) VALUES (?, ?, ?, ?)',
      [req.user.id, name, email, String(message).trim()]
    );

    res.status(201).json({ message: 'Thanks! Your feedback has been submitted.' });
  } catch (err) {
    console.error('Submit feedback error:', err);
    res.status(500).json({ message: 'Could not submit feedback' });
  }
});

module.exports = router;
