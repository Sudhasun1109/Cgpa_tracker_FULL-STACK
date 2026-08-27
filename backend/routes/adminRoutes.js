const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const authMiddleware = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');
const { getGradePoint, calculateGpa } = require('../utils/cgpaCalculator');

const router = express.Router();

// Every route here requires a logged-in admin.
router.use(authMiddleware);
router.use(adminMiddleware);

// Columns selected for a user record. NOTE: `password` is never included,
// so hashes are never sent to the client.
const USER_FIELDS =
  'id, name, register_number, email, college, department, role, created_at';

// ======================================================
// LIST ALL USERS (no passwords)
// ======================================================

router.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${USER_FIELDS},
        (SELECT COUNT(*) FROM semesters s WHERE s.user_id = users.id) AS semester_count
       FROM users
       ORDER BY created_at DESC`
    );

    // Attach each user's overall CGPA (earned-credit weighted, failed excluded).
    const [agg] = await pool.query(`
      SELECT sem.user_id AS uid,
        SUM(CASE WHEN sub.grade_point > 0 AND sub.credits > 0
                 THEN sub.credits * sub.grade_point ELSE 0 END) AS weighted,
        SUM(CASE WHEN sub.grade_point > 0 AND sub.credits > 0
                 THEN sub.credits ELSE 0 END) AS earned
      FROM semesters sem
      JOIN subjects sub ON sub.semester_id = sem.id
      GROUP BY sem.user_id
    `);
    const cgpaMap = {};
    for (const a of agg) {
      const earned = Number(a.earned) || 0;
      cgpaMap[a.uid] = earned > 0 ? Number((Number(a.weighted) / earned).toFixed(2)) : 0;
    }
    rows.forEach(u => { u.cgpa = cgpaMap[u.id] || 0; });

    res.json(rows);
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ message: 'Could not load users' });
  }
});

// ======================================================
// GET ONE USER (no password)
// ======================================================

router.get('/users/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ${USER_FIELDS} FROM users WHERE id = ?`,
      [req.params.id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'Could not load user' });
  }
});

// ======================================================
// GET ONE USER'S FULL ACADEMICS (semesters + subjects + GPA + CGPA)
// ======================================================

router.get('/users/:id/academics', async (req, res) => {
  try {
    const [users] = await pool.query(
      `SELECT ${USER_FIELDS} FROM users WHERE id = ?`,
      [req.params.id]
    );
    if (!users.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [semesters] = await pool.query(
      'SELECT * FROM semesters WHERE user_id = ? ORDER BY semester_number',
      [req.params.id]
    );

    let totalWeighted = 0;
    let totalEarned = 0;

    for (const sem of semesters) {
      const [subjects] = await pool.query(
        'SELECT * FROM subjects WHERE semester_id = ? ORDER BY id',
        [sem.id]
      );
      const result = calculateGpa(subjects);
      sem.gpa = result.gpa;
      sem.registeredCredits = result.registeredCredits;
      sem.earnedCredits = result.earnedCredits;
      sem.subjects = subjects;
      totalWeighted += result.weightedPoints;
      totalEarned += result.earnedCredits;
    }

    const cgpa = totalEarned > 0
      ? Number((totalWeighted / totalEarned).toFixed(2))
      : 0;

    res.json({
      user: users[0],
      cgpa,
      totalCredits: totalEarned,
      semesters
    });
  } catch (err) {
    console.error('User academics error:', err);
    res.status(500).json({ message: 'Could not load academics' });
  }
});

// ======================================================
// CREATE USER
// ======================================================

router.post('/users', async (req, res) => {
  try {
    const {
      name, registerNumber, email, password,
      college, department, role
    } = req.body;

    if (!name || !registerNumber || !email || !password) {
      return res.status(400).json({
        message: 'Name, register number, email and password are required'
      });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const userRole = role === 'admin' ? 'admin' : 'user';

    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) {
      return res.status(409).json({ message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(String(password), 10);
    const [result] = await pool.query(
      `INSERT INTO users (name, register_number, email, password, college, department, role)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, registerNumber, email, hashed, college || null, department || null, userRole]
    );

    res.status(201).json({ message: 'User created', id: result.insertId });
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ message: 'Could not create user' });
  }
});

// ======================================================
// UPDATE USER (password optional)
// ======================================================

router.put('/users/:id', async (req, res) => {
  try {
    const {
      name, registerNumber, email,
      college, department, role, password
    } = req.body;

    if (!name || !registerNumber || !email) {
      return res.status(400).json({
        message: 'Name, register number and email are required'
      });
    }

    const [rows] = await pool.query('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Email must stay unique across other users.
    const [dupe] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND id <> ?',
      [email, req.params.id]
    );
    if (dupe.length) {
      return res.status(409).json({ message: 'Email already used by another user' });
    }

    const userRole = role === 'admin' ? 'admin' : 'user';

    // Build the update. Only touch the password when a new one is supplied.
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ message: 'Password must be at least 6 characters' });
      }
      const hashed = await bcrypt.hash(String(password), 10);
      await pool.query(
        `UPDATE users SET name = ?, register_number = ?, email = ?,
           college = ?, department = ?, role = ?, password = ?
         WHERE id = ?`,
        [name, registerNumber, email, college || null, department || null,
         userRole, hashed, req.params.id]
      );
    } else {
      await pool.query(
        `UPDATE users SET name = ?, register_number = ?, email = ?,
           college = ?, department = ?, role = ?
         WHERE id = ?`,
        [name, registerNumber, email, college || null, department || null,
         userRole, req.params.id]
      );
    }

    res.json({ message: 'User updated' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ message: 'Could not update user' });
  }
});

// ======================================================
// DELETE USER (cascades to their semesters/subjects/etc)
// ======================================================

router.delete('/users/:id', async (req, res) => {
  try {
    // Admins cannot delete their own account from the panel.
    if (Number(req.params.id) === Number(req.user.id)) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Could not delete user' });
  }
});

// ======================================================
// BULK MARKS TEMPLATE (CSV)
// ======================================================

router.get('/bulk-template', (req, res) => {
  const header = 'email,semester_number,semester_name,subject_code,subject_name,credits,grade';
  const example =
    'student@example.com,1,Semester 1,23BS101,Engineering Mathematics,4,A';
  const csv = `${header}\n${example}\n`;

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="bulk_marks_template.csv"');
  res.send(csv);
});

// ======================================================
// BULK UPLOAD MARKS
// ------------------------------------------------------
// Body: { rows: [ { email, semesterNumber, semesterName,
//                   subjectCode, subjectName, credits, grade } ] }
//
// Each row is processed independently. A summary of inserted rows
// and per-row errors is returned so the admin can fix and re-upload.
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

    let inserted = 0;
    const errors = [];

    // Cache of "email|semesterNumber" -> semester_id to avoid repeat lookups.
    const semesterCache = new Map();
    // Cache of email -> user_id (null if not found).
    const userCache = new Map();

    for (let i = 0; i < rows.length; i++) {
      const line = i + 2; // +1 for header, +1 for 1-based
      const row = rows[i] || {};

      const email = String(row.email || '').trim().toLowerCase();
      const semesterNumber = Number(row.semesterNumber);
      const semesterName = String(row.semesterName || '').trim();
      const subjectName = String(row.subjectName || '').trim();
      const subjectCode = row.subjectCode ? String(row.subjectCode).trim() : null;
      const credits = Number(row.credits);
      const grade = String(row.grade || '').trim().toUpperCase();

      // ---- validate ----
      if (!email) { errors.push({ line, message: 'Missing email' }); continue; }
      if (!Number.isInteger(semesterNumber) || semesterNumber < 1 || semesterNumber > 12) {
        errors.push({ line, message: 'Invalid semester_number' }); continue;
      }
      if (!subjectName) { errors.push({ line, message: 'Missing subject_name' }); continue; }
      if (Number.isNaN(credits) || credits < 0 || credits > 10) {
        errors.push({ line, message: 'Credits must be 0-10' }); continue;
      }

      let gradePoint;
      try {
        gradePoint = getGradePoint(grade);
      } catch {
        errors.push({ line, message: `Invalid grade "${row.grade}"` });
        continue;
      }

      // ---- resolve user by email ----
      let userId = userCache.get(email);
      if (userId === undefined) {
        const [u] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        userId = u.length ? u[0].id : null;
        userCache.set(email, userId);
      }
      if (!userId) {
        errors.push({ line, message: `No user with email ${email}` });
        continue;
      }

      // ---- find or create semester ----
      const semKey = `${userId}|${semesterNumber}`;
      let semesterId = semesterCache.get(semKey);
      if (semesterId === undefined) {
        const [sem] = await pool.query(
          'SELECT id FROM semesters WHERE user_id = ? AND semester_number = ?',
          [userId, semesterNumber]
        );
        if (sem.length) {
          semesterId = sem[0].id;
        } else {
          const [created] = await pool.query(
            `INSERT INTO semesters (user_id, semester_number, semester_name)
             VALUES (?, ?, ?)`,
            [userId, semesterNumber, semesterName || `Semester ${semesterNumber}`]
          );
          semesterId = created.insertId;
        }
        semesterCache.set(semKey, semesterId);
      }

      // ---- insert subject ----
      try {
        await pool.query(
          `INSERT INTO subjects
             (semester_id, subject_name, subject_code, credits, grade, grade_point)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [semesterId, subjectName, subjectCode, credits, grade, gradePoint]
        );
        inserted++;
      } catch (e) {
        errors.push({ line, message: 'Could not insert subject' });
      }
    }

    res.json({
      message: 'Bulk upload processed',
      total: rows.length,
      inserted,
      failed: errors.length,
      errors: errors.slice(0, 100) // cap the payload
    });
  } catch (err) {
    console.error('Bulk marks error:', err);
    res.status(500).json({ message: 'Bulk upload failed' });
  }
});

// ======================================================
// SINGLE MARKS ENTRY
// ------------------------------------------------------
// Add ONE subject's marks for ONE selected student.
// This is the single-entry counterpart to /bulk-marks.
// The semester is created automatically if it doesn't exist.
// ======================================================

router.post('/single-marks', async (req, res) => {
  try {
    const {
      userId, semesterNumber, semesterName,
      subjectCode, subjectName, credits, grade
    } = req.body;

    // ---- validate student ----
    const uid = Number(userId);
    if (!Number.isInteger(uid) || uid < 1) {
      return res.status(400).json({ message: 'Please select a valid student' });
    }
    const [users] = await pool.query('SELECT id FROM users WHERE id = ?', [uid]);
    if (!users.length) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // ---- validate semester ----
    const semNo = Number(semesterNumber);
    if (!Number.isInteger(semNo) || semNo < 1 || semNo > 12) {
      return res.status(400).json({ message: 'Semester number must be between 1 and 12' });
    }

    // ---- validate subject ----
    const name = String(subjectName || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Subject name is required' });
    }

    const numCredits = Number(credits);
    // 0 credits is valid (e.g. mandatory non-credit courses).
    if (credits === undefined || credits === null || credits === '' ||
        Number.isNaN(numCredits) || numCredits < 0 || numCredits > 10) {
      return res.status(400).json({ message: 'Credits must be between 0 and 10' });
    }

    const normGrade = String(grade || '').trim().toUpperCase();
    let gradePoint;
    try {
      gradePoint = getGradePoint(normGrade);
    } catch {
      return res.status(400).json({ message: `Invalid grade "${grade}"` });
    }

    // ---- find or create the semester ----
    const [sem] = await pool.query(
      'SELECT id FROM semesters WHERE user_id = ? AND semester_number = ?',
      [uid, semNo]
    );

    let semesterId;
    if (sem.length) {
      semesterId = sem[0].id;
    } else {
      const [created] = await pool.query(
        `INSERT INTO semesters (user_id, semester_number, semester_name)
         VALUES (?, ?, ?)`,
        [uid, semNo, String(semesterName || '').trim() || `Semester ${semNo}`]
      );
      semesterId = created.insertId;
    }

    // ---- insert the subject ----
    const [result] = await pool.query(
      `INSERT INTO subjects
         (semester_id, subject_name, subject_code, credits, grade, grade_point)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        semesterId, name,
        subjectCode ? String(subjectCode).trim() : null,
        numCredits, normGrade, gradePoint
      ]
    );

    res.status(201).json({
      message: 'Marks added successfully',
      subjectId: result.insertId,
      gradePoint
    });
  } catch (err) {
    console.error('Single marks error:', err);
    res.status(500).json({ message: 'Could not add marks' });
  }
});

// ======================================================
// FEEDBACK (admin view)
// ======================================================

router.get('/feedback', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT f.id, f.user_id, f.message, f.created_at,
              u.name, u.email, u.register_number
       FROM feedback f
       LEFT JOIN users u ON u.id = f.user_id
       ORDER BY f.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Load feedback error:', err);
    res.status(500).json({ message: 'Could not load feedback' });
  }
});

router.delete('/feedback/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM feedback WHERE id = ?', [req.params.id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Feedback not found' });
    }
    res.json({ message: 'Feedback deleted' });
  } catch (err) {
    console.error('Delete feedback error:', err);
    res.status(500).json({ message: 'Could not delete feedback' });
  }
});

module.exports = router;
