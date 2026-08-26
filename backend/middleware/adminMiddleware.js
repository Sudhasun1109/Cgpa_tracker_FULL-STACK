const pool = require('../config/db');

// Must be used AFTER authMiddleware (which sets req.user from the JWT).
// We re-check the role against the database rather than trusting the token
// alone, so revoking admin access takes effect immediately.
async function adminMiddleware(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const [rows] = await pool.query(
      'SELECT role FROM users WHERE id = ?',
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (rows[0].role !== 'admin') {
      return res.status(403).json({ message: 'Admin access only' });
    }

    req.user.role = 'admin';
    next();
  } catch (err) {
    console.error('Admin middleware error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}

module.exports = adminMiddleware;
