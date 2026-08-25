const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

// Roughly ~6 MB of base64 text. The frontend compresses images before
// upload, so real uploads are far smaller than this. This is just a guard.
const MAX_IMAGE_CHARS = 8_000_000;


// ======================================================
// GET ALL MARK SHEETS FOR CURRENT USER
// ======================================================

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, title, semester_number, image_data, created_at
       FROM marksheets
       WHERE user_id = ?
       ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );

    res.json(rows);
  } catch (err) {
    console.error('Load marksheets error:', err);
    res.status(500).json({ message: 'Could not load mark sheets' });
  }
});


// ======================================================
// ADD A MARK SHEET
// ======================================================
//
// Body: { title, semesterNumber, imageData }
// imageData is a base64 data URL, e.g. "data:image/jpeg;base64,...."
// We store it directly in the DB so it survives redeploys on hosts
// (like Render free tier) where the local disk is wiped on every deploy.
// ======================================================

router.post('/', async (req, res) => {
  try {
    const { title, semesterNumber, imageData } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Please enter a title' });
    }

    if (!imageData || typeof imageData !== 'string') {
      return res.status(400).json({ message: 'Please choose an image' });
    }

    if (!imageData.startsWith('data:image/')) {
      return res.status(400).json({ message: 'File must be an image' });
    }

    if (imageData.length > MAX_IMAGE_CHARS) {
      return res.status(400).json({
        message: 'Image is too large. Please use a smaller photo.'
      });
    }

    // semesterNumber is optional
    let semNumber = null;
    if (
      semesterNumber !== undefined &&
      semesterNumber !== null &&
      semesterNumber !== ''
    ) {
      const n = Number(semesterNumber);
      if (Number.isNaN(n) || n < 1 || n > 12) {
        return res.status(400).json({
          message: 'Semester number must be between 1 and 12'
        });
      }
      semNumber = n;
    }

    const [result] = await pool.query(
      `INSERT INTO marksheets
         (user_id, title, semester_number, image_data)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, title.trim(), semNumber, imageData]
    );

    res.status(201).json({
      message: 'Mark sheet added',
      id: result.insertId
    });
  } catch (err) {
    console.error('Add marksheet error:', err);
    res.status(500).json({ message: 'Could not add mark sheet' });
  }
});


// ======================================================
// DELETE A MARK SHEET
// ======================================================

router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM marksheets WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Mark sheet not found' });
    }

    await pool.query(
      'DELETE FROM marksheets WHERE id = ?',
      [req.params.id]
    );

    res.json({ message: 'Mark sheet deleted' });
  } catch (err) {
    console.error('Delete marksheet error:', err);
    res.status(500).json({ message: 'Could not delete mark sheet' });
  }
});


module.exports = router;
