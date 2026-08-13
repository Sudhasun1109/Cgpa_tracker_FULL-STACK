const GRADE_POINTS = {
  O: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  P: 4,
  F: 0
};

function getGradePoint(grade) {
  const normalized = String(grade || '').trim().toUpperCase();
  if (!(normalized in GRADE_POINTS)) {
    throw new Error('Invalid grade');
  }
  return GRADE_POINTS[normalized];
}

function calculateGpa(subjects) {
  const totalCredits = subjects.reduce((sum, s) => sum + Number(s.credits), 0);
  const weightedPoints = subjects.reduce(
    (sum, s) => sum + Number(s.credits) * Number(s.grade_point),
    0
  );
  return {
    gpa: totalCredits ? Number((weightedPoints / totalCredits).toFixed(2)) : 0,
    totalCredits
  };
}

module.exports = { GRADE_POINTS, getGradePoint, calculateGpa };
