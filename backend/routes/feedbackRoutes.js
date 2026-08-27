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

    // Store only the user id + message; the admin view joins the users
    // table at read time so the name/email are always current and correct.
    await pool.query(
      'INSERT INTO feedback (user_id, message) VALUES (?, ?)',
      [req.user.id, String(message).trim()]
    );

    res.status(201).json({ message: 'Thanks! Your feedback has been submitted.' });
  } catch (err) {
    console.error('Submit feedback error:', err);
    res.status(500).json({ message: 'Could not submit feedback' });
  }
});

module.exports = router;
