const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id FROM subjects s
       JOIN semesters sem ON sem.id = s.semester_id
       WHERE s.id = ? AND sem.user_id = ?`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Subject not found' });

    await pool.query('DELETE FROM subjects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Subject deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not delete subject' });
  }
});
router.put('/:id', async (req, res) => {
    try {
        const { subjectName, subjectCode, credits, grade } = req.body;
        const { getGradePoint } = require('../utils/cgpaCalculator');
        const normalizedGrade = grade.toUpperCase();
        const gradePoint = getGradePoint(normalizedGrade);
        const subjectId = req.params.id;
        const userId = req.user.id;

        // Check whether subject belongs to logged-in user
        const [rows] = await pool.query(
            `SELECT s.id
             FROM subjects s
             JOIN semesters sem ON sem.id = s.semester_id
             WHERE s.id = ? AND sem.user_id = ?`,
            [subjectId, userId]
        );

        if (!rows.length) {
            return res.status(404).json({
                message: 'Subject not found'
            });
        }

        // Validate input
        if (!subjectName || !credits || !grade) {
            return res.status(400).json({
                message: 'Please provide subject name, credits and grade'
            });
        }

        // Update subject
        await pool.query(
    `UPDATE subjects
     SET subject_name = ?,
         subject_code = ?,
         credits = ?,
         grade = ?,
         grade_point = ?
     WHERE id = ?`,
    [
        subjectName,
        subjectCode || null,
        credits,
        normalizedGrade,
        gradePoint,
        subjectId
    ]
);

        res.json({
            message: 'Subject updated successfully'
        });

    } catch (err) {
        console.error('Update subject error:', err);

        res.status(500).json({
            message: 'Could not update subject'
        });
    }
});

module.exports = router;
