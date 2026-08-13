require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const semesterRoutes = require('./routes/semesterRoutes');
const subjectRoutes = require('./routes/subjectRoutes');
const cgpaRoutes = require('./routes/cgpaRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'CGPA Tracker API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/semesters', semesterRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/cgpa', cgpaRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`CGPA Tracker API running at http://localhost:${PORT}`);
});
