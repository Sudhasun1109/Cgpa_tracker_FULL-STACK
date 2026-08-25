const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const {
  calculateGpa,
  getGradePoint
} = require('../utils/cgpaCalculator');

const router = express.Router();

router.use(authMiddleware);


// ======================================================
// GET SEMESTER FOR CURRENT USER
// ======================================================

async function getSemesterForUser(semesterId, userId) {

  const [rows] = await pool.query(
    'SELECT * FROM semesters WHERE id = ? AND user_id = ?',
    [semesterId, userId]
  );

  return rows[0];
}


// ======================================================
// GET ALL SEMESTERS
// ======================================================

router.get('/', async (req, res) => {

  try {

    const [semesters] = await pool.query(
      `SELECT *
       FROM semesters
       WHERE user_id = ?
       ORDER BY semester_number`,
      [req.user.id]
    );


    for (const semester of semesters) {

      const [subjects] = await pool.query(
        `SELECT *
         FROM subjects
         WHERE semester_id = ?
         ORDER BY id`,
        [semester.id]
      );


      const result = calculateGpa(subjects);


      semester.gpa = result.gpa;

      // Total registered credits
      semester.totalCredits =
        result.registeredCredits;

      // Credits actually earned
      semester.earnedCredits =
        result.earnedCredits;

      // Total weighted grade points
      semester.gradePointsEarned =
        result.weightedPoints;

      semester.subjects = subjects;
    }


    res.json(semesters);

  } catch (err) {

    console.error('Load semesters error:', err);

    res.status(500).json({
      message: 'Could not load semesters'
    });

  }

});


// ======================================================
// CREATE SEMESTER
// ======================================================

router.post('/', async (req, res) => {

  try {

    const {
      semesterNumber,
      semesterName
    } = req.body;


    if (!semesterNumber || !semesterName) {

      return res.status(400).json({
        message: 'Semester number and name are required'
      });

    }


    const [result] = await pool.query(
      `INSERT INTO semesters
       (user_id, semester_number, semester_name)
       VALUES (?, ?, ?)`,
      [
        req.user.id,
        semesterNumber,
        semesterName
      ]
    );


    res.status(201).json({
      message: 'Semester created',
      id: result.insertId
    });


  } catch (err) {

    if (err.code === 'ER_DUP_ENTRY') {

      return res.status(409).json({
        message: 'This semester already exists'
      });

    }


    console.error('Create semester error:', err);


    res.status(500).json({
      message: 'Could not create semester'
    });

  }

});


// ======================================================
// GET SUBJECTS FOR A SEMESTER
// ======================================================

router.get('/:id/subjects', async (req, res) => {

  try {

    const semester =
      await getSemesterForUser(
        req.params.id,
        req.user.id
      );


    if (!semester) {

      return res.status(404).json({
        message: 'Semester not found'
      });

    }


    const [subjects] = await pool.query(
      `SELECT *
       FROM subjects
       WHERE semester_id = ?
       ORDER BY id`,
      [req.params.id]
    );


    res.json(subjects);


  } catch (err) {

    console.error('Load subjects error:', err);


    res.status(500).json({
      message: 'Could not load subjects'
    });

  }

});


// ======================================================
// ADD SUBJECT
// ======================================================

router.post('/:id/subjects', async (req, res) => {

  try {

    const semester =
      await getSemesterForUser(
        req.params.id,
        req.user.id
      );


    if (!semester) {

      return res.status(404).json({
        message: 'Semester not found'
      });

    }


    const {
      subjectName,
      subjectCode,
      credits,
      grade
    } = req.body;


    const numericCredits =
      Number(credits);


    // ==================================================
    // VALIDATION
    // ==================================================

    // IMPORTANT:
    // 0 CREDIT IS VALID.
    //
    // Do NOT use:
    //
    // !numericCredits
    //
    // because !0 === true.
    //
    // Also do NOT use:
    //
    // numericCredits <= 0
    //
    // because that rejects 0.
    // ==================================================

    if (
      !subjectName ||
      credits === undefined ||
      credits === null ||
      credits === '' ||
      Number.isNaN(numericCredits) ||
      numericCredits < 0 ||
      numericCredits > 10 ||
      !grade
    ) {

      return res.status(400).json({
        message:
          'Enter valid subject name, credits and grade'
      });

    }


    // ==================================================
    // GET GRADE POINT
    // ==================================================

    const normalizedGrade =
      String(grade)
        .trim()
        .toUpperCase();


    const gradePoint =
      getGradePoint(normalizedGrade);


    // ==================================================
    // INSERT SUBJECT
    // ==================================================

    const [result] = await pool.query(

      `INSERT INTO subjects
       (
         semester_id,
         subject_name,
         subject_code,
         credits,
         grade,
         grade_point
       )
       VALUES (?, ?, ?, ?, ?, ?)`,
      
      [
        req.params.id,
        subjectName.trim(),
        subjectCode
          ? subjectCode.trim()
          : null,
        numericCredits,
        normalizedGrade,
        gradePoint
      ]

    );


    res.status(201).json({

      message: 'Subject added',

      id: result.insertId,

      gradePoint

    });


  } catch (err) {

    console.error('Add subject error:', err);


    res.status(400).json({
      message:
        err.message ||
        'Could not add subject'
    });

  }

});


// ======================================================
// DELETE SEMESTER
// ======================================================

router.delete('/:id', async (req, res) => {

  try {

    const semester =
      await getSemesterForUser(
        req.params.id,
        req.user.id
      );


    if (!semester) {

      return res.status(404).json({
        message: 'Semester not found'
      });

    }


    await pool.query(
      'DELETE FROM semesters WHERE id = ?',
      [req.params.id]
    );


    res.json({
      message: 'Semester deleted'
    });


  } catch (err) {

    console.error('Delete semester error:', err);


    res.status(500).json({
      message: 'Could not delete semester'
    });

  }

});


module.exports = router;