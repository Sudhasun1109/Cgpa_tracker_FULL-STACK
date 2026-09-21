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
// EDIT SEMESTER TITLE
// ======================================================

router.put('/:id', async (req, res) => {
  try {
    const semester = await getSemesterForUser(req.params.id, req.user.id);
    if (!semester) {
      return res.status(404).json({ message: 'Semester not found' });
    }

    const semesterName = String(req.body.semesterName || '').trim();
    if (!semesterName) {
      return res.status(400).json({ message: 'Semester title is required' });
    }
    if (semesterName.length > 100) {
      return res.status(400).json({ message: 'Semester title must be 100 characters or less' });
    }

    await pool.query(
      'UPDATE semesters SET semester_name = ? WHERE id = ? AND user_id = ?',
      [semesterName, req.params.id, req.user.id]
    );

    res.json({ message: 'Semester title updated' });
  } catch (err) {
    console.error('Update semester title error:', err);
    res.status(500).json({ message: 'Could not update semester title' });
  }
});

// ======================================================
// BULK MARKS UPLOAD FOR CURRENT USER
// ======================================================

router.post('/bulk-marks', async (req, res) => {
  try {
    const rows = Array.isArray(req.body.rows) ? req.body.rows : null;
    if (!rows || !rows.length) {
      return res.status(400).json({ message: 'No rows provided' });
    }
    if (rows.length > 2000) {
      return res.status(413).json({ message: 'Too many rows (max 2000 per upload)' });
    }

    const [users] = await pool.query(
      'SELECT id, email FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!users.length) {
      return res.status(401).json({ message: 'User account not found' });
    }

    const currentEmail = String(users[0].email).trim().toLowerCase();
    const semesterCache = new Map();
    let inserted = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const line = i + 2;
      const row = rows[i] || {};
      const suppliedEmail = String(row.email || '').trim().toLowerCase();

      // Never allow a normal user to write marks to another account.
      if (suppliedEmail && suppliedEmail !== currentEmail) {
        errors.push({ line, message: 'Email does not match the logged-in account' });
        continue;
      }

      const semesterNumber = Number(row.semesterNumber);
      const semesterName = String(row.semesterName || '').trim();
      const subjectName = String(row.subjectName || '').trim();
      const subjectCode = String(row.subjectCode || '').trim() || null;
      const creditsRaw = row.credits;
      const credits = Number(creditsRaw);
      const grade = String(row.grade || '').trim().toUpperCase();

      if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 12) {
        errors.push({ line, message: 'Invalid semester_number' });
        continue;
      }
      if (!subjectName) {
        errors.push({ line, message: 'Missing subject_name' });
        continue;
      }
      if (creditsRaw === undefined || creditsRaw === null || String(creditsRaw).trim() === '' ||
          Number.isNaN(credits) || credits < 0 || credits > 10) {
        errors.push({ line, message: 'Credits must be between 0 and 10' });
        continue;
      }

      let gradePoint;
      try {
        gradePoint = getGradePoint(grade);
      } catch {
        errors.push({ line, message: `Invalid grade "${row.grade}"` });
        continue;
      }

      const semKey = String(semesterNumber);
      let semesterId = semesterCache.get(semKey);

      if (semesterId === undefined) {
        const [sem] = await pool.query(
          'SELECT id FROM semesters WHERE user_id = ? AND semester_number = ?',
          [req.user.id, semesterNumber]
        );

        if (sem.length) {
          semesterId = sem[0].id;

          // A supplied CSV title can also name an existing semester.
          if (semesterName) {
            await pool.query(
              'UPDATE semesters SET semester_name = ? WHERE id = ? AND user_id = ?',
              [semesterName, semesterId, req.user.id]
            );
          }
        } else {
          const [created] = await pool.query(
            `INSERT INTO semesters (user_id, semester_number, semester_name)
             VALUES (?, ?, ?)`,
            [req.user.id, semesterNumber, semesterName || `Semester ${semesterNumber}`]
          );
          semesterId = created.insertId;
        }

        semesterCache.set(semKey, semesterId);
      }

      try {
        await pool.query(
          `INSERT INTO subjects
             (semester_id, subject_name, subject_code, credits, grade, grade_point)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [semesterId, subjectName, subjectCode, credits, grade, gradePoint]
        );
        inserted++;
      } catch (err) {
        console.error('Student bulk row error:', err);
        errors.push({ line, message: 'Could not insert subject' });
      }
    }

    res.json({
      message: 'Bulk upload processed',
      total: rows.length,
      inserted,
      failed: errors.length,
      errors: errors.slice(0, 100)
    });
  } catch (err) {
    console.error('Student bulk marks error:', err);
    res.status(500).json({ message: 'Bulk upload failed' });
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