const express = require('express');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const { getGradePoint } = require('../utils/cgpaCalculator');

const router = express.Router();

router.use(authMiddleware);


// =====================================================
// DELETE SUBJECT
// =====================================================

router.delete('/:id', async (req, res) => {

  try {

    const [rows] = await pool.query(
      `SELECT s.id
       FROM subjects s
       JOIN semesters sem
         ON sem.id = s.semester_id
       WHERE s.id = ?
       AND sem.user_id = ?`,
      [
        req.params.id,
        req.user.id
      ]
    );


    if (!rows.length) {

      return res.status(404).json({
        message: 'Subject not found'
      });

    }


    await pool.query(
      'DELETE FROM subjects WHERE id = ?',
      [req.params.id]
    );


    res.json({
      message: 'Subject deleted'
    });


  } catch (err) {

    console.error('Delete subject error:', err);

    res.status(500).json({
      message: 'Could not delete subject'
    });

  }

});


// =====================================================
// UPDATE SUBJECT
// =====================================================

router.put('/:id', async (req, res) => {

  try {

    const {
      subjectName,
      subjectCode,
      credits,
      grade
    } = req.body;


    // ================================================
    // BASIC VALIDATION
    // ================================================

    if (
      !subjectName ||
      credits === undefined ||
      credits === null ||
      credits === '' ||
      !grade
    ) {

      return res.status(400).json({
        message:
          'Please provide subject name, credits and grade'
      });

    }


    const numericCredits = Number(credits);


    // ================================================
    // CREDIT VALIDATION
    // ================================================

    // IMPORTANT:
    // 0 IS VALID
    //
    // Do NOT use:
    // !credits
    //
    // because 0 is considered false.
    //
    // We only reject values below 0 or above 10.
    // ================================================

    if (
      Number.isNaN(numericCredits) ||
      numericCredits < 0 ||
      numericCredits > 10
    ) {

      return res.status(400).json({
        message:
          'Credits must be between 0 and 10'
      });

    }


    // ================================================
    // NORMALIZE GRADE
    // ================================================

    const normalizedGrade =
      String(grade)
        .trim()
        .toUpperCase();


    // ================================================
    // GET GRADE POINT
    // ================================================

    let gradePoint;

    try {

      gradePoint =
        getGradePoint(normalizedGrade);

    } catch (err) {

      return res.status(400).json({
        message: 'Invalid grade'
      });

    }


    const subjectId =
      req.params.id;

    const userId =
      req.user.id;


    // ================================================
    // CHECK SUBJECT BELONGS TO LOGGED-IN USER
    // ================================================

    const [rows] = await pool.query(

      `SELECT s.id
       FROM subjects s
       JOIN semesters sem
         ON sem.id = s.semester_id
       WHERE s.id = ?
       AND sem.user_id = ?`,

      [
        subjectId,
        userId
      ]

    );


    if (!rows.length) {

      return res.status(404).json({
        message: 'Subject not found'
      });

    }


    // ================================================
    // UPDATE SUBJECT
    // ================================================

    await pool.query(

      `UPDATE subjects
       SET
         subject_name = ?,
         subject_code = ?,
         credits = ?,
         grade = ?,
         grade_point = ?
       WHERE id = ?`,

      [
        subjectName.trim(),
        subjectCode
          ? subjectCode.trim()
          : null,
        numericCredits,
        normalizedGrade,
        gradePoint,
        subjectId
      ]

    );


    // ================================================
    // SUCCESS RESPONSE
    // ================================================

    res.json({

      message:
        'Subject updated successfully',

      gradePoint

    });


  } catch (err) {

    console.error(
      'Update subject error:',
      err
    );


    res.status(500).json({

      message:
        'Could not update subject'

    });

  }

});


module.exports = router;