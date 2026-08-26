const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function init() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
  await connection.query(`USE \`${process.env.DB_NAME}\``);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      register_number VARCHAR(50) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      college VARCHAR(200),
      department VARCHAR(100),
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      semester_number INT,
      profile_photo LONGTEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ---------------------------------------------------------------
  // Feedback submitted by users, shown in the admin panel.
  // ---------------------------------------------------------------
  await connection.query(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      name VARCHAR(100),
      email VARCHAR(150),
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS semesters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      semester_number INT NOT NULL,
      semester_name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_user_semester (user_id, semester_number)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INT AUTO_INCREMENT PRIMARY KEY,
      semester_id INT NOT NULL,
      subject_name VARCHAR(150) NOT NULL,
      subject_code VARCHAR(50),
      credits DECIMAL(4,1) NOT NULL,
      grade VARCHAR(5) NOT NULL,
      grade_point DECIMAL(4,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS cgpa_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      cgpa DECIMAL(4,2) NOT NULL,
      total_credits DECIMAL(8,2) NOT NULL,
      total_semesters INT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user (user_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Mark sheets (grade sheet photos) uploaded by the student.
  // The image is stored as a base64 data URL so it survives redeploys on
  // hosts with an ephemeral disk (e.g. Render free tier).
  await connection.query(`
    CREATE TABLE IF NOT EXISTS marksheets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      semester_number INT,
      image_data LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // ---------------------------------------------------------------
  // Migration for databases created before the unique key existed.
  // Without a UNIQUE key on user_id, the ON DUPLICATE KEY UPDATE in
  // /api/cgpa never fires and a new row is inserted on every request.
  // This adds the key once; it's safe to ignore if it already exists.
  // ---------------------------------------------------------------
  try {
    // Remove any duplicate cgpa_records first, keeping the newest per user.
    await connection.query(`
      DELETE c1 FROM cgpa_records c1
      JOIN cgpa_records c2
        ON c1.user_id = c2.user_id
       AND c1.id < c2.id
    `);
    await connection.query(
      'ALTER TABLE cgpa_records ADD UNIQUE KEY unique_user (user_id)'
    );
    console.log('Added unique key on cgpa_records.user_id');
  } catch (e) {
    if (e.code === 'ER_DUP_KEYNAME' || e.code === 'ER_DUP_ENTRY') {
      // Key already present — nothing to do.
    } else {
      console.warn('cgpa_records migration note:', e.message);
    }
  }

  // ---------------------------------------------------------------
  // Migration: add the `role` column for databases created before
  // roles existed. Safe to ignore if the column is already present.
  // ---------------------------------------------------------------
  try {
    await connection.query(
      "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'"
    );
    console.log('Added role column to users');
  } catch (e) {
    if (e.code !== 'ER_DUP_FIELDNAME') {
      console.warn('users.role migration note:', e.message);
    }
  }

  // ---------------------------------------------------------------
  // Seed an admin account if one does not already exist.
  // Credentials come from ADMIN_EMAIL / ADMIN_PASSWORD in .env
  // (with safe defaults). Change the password after first login.
  // ---------------------------------------------------------------
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@cgpa.local').trim();
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

    const [admins] = await connection.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (!admins.length) {
      const [byEmail] = await connection.query(
        'SELECT id FROM users WHERE email = ?',
        [adminEmail]
      );
      const hashed = await bcrypt.hash(adminPassword, 10);

      if (byEmail.length) {
        // Promote the existing account to admin.
        await connection.query(
          "UPDATE users SET role = 'admin' WHERE id = ?",
          [byEmail[0].id]
        );
        console.log(`Promoted existing user ${adminEmail} to admin`);
      } else {
        await connection.query(
          `INSERT INTO users (name, register_number, email, password, role)
           VALUES (?, ?, ?, ?, 'admin')`,
          ['Administrator', 'ADMIN', adminEmail, hashed]
        );
        console.log('----------------------------------------------');
        console.log('Admin account created:');
        console.log('  email   :', adminEmail);
        console.log('  password:', adminPassword);
        console.log('  (change this password after first login)');
        console.log('----------------------------------------------');
      }
    } else {
      console.log('Admin account already exists — skipping seed.');
    }
  } catch (e) {
    console.warn('Admin seed note:', e.message);
  }

  // ---------------------------------------------------------------
  // Migration: profile fields (photo + semester) for older databases.
  // ---------------------------------------------------------------
  for (const col of [
    'ADD COLUMN semester_number INT',
    'ADD COLUMN profile_photo LONGTEXT'
  ]) {
    try {
      await connection.query('ALTER TABLE users ' + col);
      console.log('users migration: ' + col);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.warn('users profile migration note:', e.message);
      }
    }
  }

  console.log('Database and tables are ready.');
  await connection.end();
}

init().catch(err => {
  console.error('Database initialization failed:', err.message);
  process.exit(1);
});
