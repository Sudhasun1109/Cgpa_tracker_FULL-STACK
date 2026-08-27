require('dotenv').config();

const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const semesterRoutes = require('./routes/semesterRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const cgpaRoutes = require('./routes/cgpaRoutes');
const marksheetRoutes = require('./routes/marksheetRoutes');
const adminRoutes = require('./routes/adminRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const ensureSchema = require('./config/ensureSchema');

const app = express();

// CORS
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Mark sheet images are sent as base64, so allow a larger body than the
// 100kb Express default. The frontend compresses images before upload.
app.use(express.json({ limit: '12mb' }));

// Test route
app.get('/', (req, res) => {
  res.json({
    message: 'CGPA Tracker API is running successfully 🚀'
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/semesters', semesterRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/cgpa', cgpaRoutes);
app.use('/api/marksheets', marksheetRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);

// IMPORTANT FOR RENDER
const PORT = process.env.PORT || 5000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ CGPA Tracker API running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  // Auto-migrate the database so missing columns/tables never cause 500s.
  try {
    await ensureSchema();
  } catch (e) {
    console.warn('Schema auto-migration failed:', e.message);
  }
});