const pool = require('./db');

// Runs every time the server starts. It brings an existing database up to
// date without needing a manual migration step, so newly added columns
// (role, semester_number, profile_photo) and the feedback table are always
// present. Each step is guarded so it is safe to run repeatedly.
async function ensureSchema() {
  const columnAlters = [
    { name: 'role', sql: "ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'" },
    { name: 'semester_number', sql: 'ALTER TABLE users ADD COLUMN semester_number INT' },
    { name: 'profile_photo', sql: 'ALTER TABLE users ADD COLUMN profile_photo LONGTEXT' }
  ];

  for (const col of columnAlters) {
    try {
      await pool.query(col.sql);
      console.log(`🛠  Schema: added users.${col.name}`);
    } catch (e) {
      // ER_DUP_FIELDNAME = column already exists -> nothing to do.
      if (e.code !== 'ER_DUP_FIELDNAME') {
        console.warn(`Schema note (users.${col.name}):`, e.message);
      }
    }
  }

  try {
    await pool.query(`
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
  } catch (e) {
    console.warn('Schema note (feedback table):', e.message);
  }

  console.log('✅ Schema check complete');
}

module.exports = ensureSchema;
