const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { calculateGpa, getGradePoint } = require('../utils/cgpaCalculator');

const router = express.Router();
router.use(authMiddleware);

async function getSemesterForUser(semesterId, userId) {
  const [rows] = await pool.query(
    'SELECT * FROM semesters WHERE id = ? AND user_id = ?',
    [semesterId, userId]
  );
  return rows[0];
}

router.get('/', async (req, res) => {
  try {
    const [semesters] = await pool.query(
      'SELECT * FROM semesters WHERE user_id = ? ORDER BY semester_number',
      [req.user.id]
    );

    for (const semester of semesters) {
      const [subjects] = await pool.query(
        'SELECT * FROM subjects WHERE semester_id = ? ORDER BY id',
        [semester.id]
      );
      const result = calculateGpa(subjects);
      semester.gpa = result.gpa;
      semester.totalCredits = result.totalCredits;
      semester.subjects = subjects;
    }

    res.json(semesters);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load semesters' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { semesterNumber, semesterName } = req.body;
    if (!semesterNumber || !semesterName) {
      return res.status(400).json({ message: 'Semester number and name are required' });
    }

    const [result] = await pool.query(
      'INSERT INTO semesters (user_id, semester_number, semester_name) VALUES (?, ?, ?)',
      [req.user.id, semesterNumber, semesterName]
    );

    res.status(201).json({ message: 'Semester created', id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'This semester already exists' });
    }
    console.error(err);
    res.status(500).json({ message: 'Could not create semester' });
  }
});

router.get('/:id/subjects', async (req, res) => {
  try {
    const semester = await getSemesterForUser(req.params.id, req.user.id);
    if (!semester) return res.status(404).json({ message: 'Semester not found' });

    const [subjects] = await pool.query(
      'SELECT * FROM subjects WHERE semester_id = ? ORDER BY id',
      [req.params.id]
    );
    res.json(subjects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not load subjects' });
  }
});

router.post('/:id/subjects', async (req, res) => {
  try {
    const semester = await getSemesterForUser(req.params.id, req.user.id);
    if (!semester) return res.status(404).json({ message: 'Semester not found' });

    const { subjectName, subjectCode, credits, grade } = req.body;
    const numericCredits = Number(credits);
    if (!subjectName || !numericCredits || numericCredits <= 0 || numericCredits > 10 || !grade) {
      return res.status(400).json({ message: 'Enter valid subject name, credits and grade' });
    }

    const gradePoint = getGradePoint(grade);
    const [result] = await pool.query(
      `INSERT INTO subjects
       (semester_id, subject_name, subject_code, credits, grade, grade_point)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, subjectName, subjectCode || null, numericCredits, grade.toUpperCase(), gradePoint]
    );

    res.status(201).json({ message: 'Subject added', id: result.insertId, gradePoint });
  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message || 'Could not add subject' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const semester = await getSemesterForUser(req.params.id, req.user.id);
    if (!semester) return res.status(404).json({ message: 'Semester not found' });

    await pool.query('DELETE FROM semesters WHERE id = ?', [req.params.id]);
    res.json({ message: 'Semester deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Could not delete semester' });
  }
});

module.exports = router;
