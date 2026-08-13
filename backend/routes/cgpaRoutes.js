const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.semester_number, s.semester_name,
              COALESCE(SUM(sub.credits), 0) AS credits,
              COALESCE(SUM(sub.credits * sub.grade_point), 0) AS weighted
       FROM semesters s
       LEFT JOIN subjects sub ON sub.semester_id = s.id
       WHERE s.user_id = ?
       GROUP BY s.id
       ORDER BY s.semester_number`,
      [req.user.id]
    );

    let totalCredits = 0;
    let totalWeighted = 0;

    const history = rows.map(row => {
      const credits = Number(row.credits);
      const weighted = Number(row.weighted);
      const gpa = credits ? Number((weighted / credits).toFixed(2)) : 0;
      totalCredits += credits;
      totalWeighted += weighted;
      return {
        semesterNumber: row.semester_number,
        semesterName: row.semester_name,
        credits,
        gpa
      };
    });

    const cgpa = totalCredits ? Number((totalWeighted / totalCredits).toFixed(2)) : 0;

    await pool.query(
      `INSERT INTO cgpa_records (user_id, cgpa, total_credits, total_semesters)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE cgpa = VALUES(cgpa),
       total_credits = VALUES(total_credits),
       total_semesters = VALUES(total_semesters)`,
      [req.user.id, cgpa, totalCredits, history.length]
    );

    res.json({ cgpa, totalCredits, totalSemesters: history.length, history });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not calculate CGPA' });
  }
});

router.get('/history', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cgpa, total_credits, total_semesters, updated_at
       FROM cgpa_records WHERE user_id = ? ORDER BY updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load CGPA history' });
  }
});

module.exports = router;
