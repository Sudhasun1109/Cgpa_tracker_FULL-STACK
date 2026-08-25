const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { calculateGpa } = require('../utils/cgpaCalculator');

const router = express.Router();
router.use(authMiddleware);

// ======================================================
// GET CGPA + PER-SEMESTER HISTORY
// ======================================================
//
// IMPORTANT (bug fix):
// GPA and CGPA are divided by EARNED credits, NOT
// registered credits. Failed subjects (F / U = 0 point)
// are excluded from the denominator, exactly like the
// college formula:  GPA = Σ(Ci·GPi) / Σ(Ci passed).
//
// We now reuse calculateGpa() so /cgpa and /semesters
// always agree (single source of truth).
// ======================================================

router.get('/', async (req, res) => {
  try {
    const [semesters] = await pool.query(
      `SELECT id, semester_number, semester_name
       FROM semesters
       WHERE user_id = ?
       ORDER BY semester_number`,
      [req.user.id]
    );

    let totalEarnedCredits = 0;
    let totalWeightedPoints = 0;

    const history = [];

    for (const sem of semesters) {
      const [subjects] = await pool.query(
        `SELECT credits, grade_point
         FROM subjects
         WHERE semester_id = ?`,
        [sem.id]
      );

      const result = calculateGpa(subjects);

      // Accumulate using EARNED credits + weighted points
      totalEarnedCredits += result.earnedCredits;
      totalWeightedPoints += result.weightedPoints;

      history.push({
        semesterNumber: sem.semester_number,
        semesterName: sem.semester_name,
        gpa: result.gpa,
        credits: result.earnedCredits,          // earned credits for this sem
        registeredCredits: result.registeredCredits
      });
    }

    // CGPA from raw totals (no rounding drift)
    const cgpa = totalEarnedCredits
      ? Number((totalWeightedPoints / totalEarnedCredits).toFixed(2))
      : 0;

    await pool.query(
      `INSERT INTO cgpa_records
         (user_id, cgpa, total_credits, total_semesters)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         cgpa = VALUES(cgpa),
         total_credits = VALUES(total_credits),
         total_semesters = VALUES(total_semesters)`,
      [req.user.id, cgpa, totalEarnedCredits, history.length]
    );

    res.json({
      cgpa,
      totalCredits: totalEarnedCredits,   // earned credits (matches transcript)
      totalSemesters: history.length,
      history
    });
  } catch (err) {
    console.error('CGPA calc error:', err);
    res.status(500).json({ message: 'Could not calculate CGPA' });
  }
});

// ======================================================
// GET CGPA HISTORY (saved records)
// ======================================================

router.get('/history', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cgpa, total_credits, total_semesters, updated_at
       FROM cgpa_records
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load CGPA history' });
  }
});

module.exports = router;
