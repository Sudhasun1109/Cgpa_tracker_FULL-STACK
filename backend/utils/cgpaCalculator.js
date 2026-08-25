const GRADE_POINTS = {
  O: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  P: 4,
  F: 0,
  U: 0
};


/**
 * Get grade point for a grade
 */
function getGradePoint(grade) {

  const normalized = String(grade || '')
    .trim()
    .toUpperCase();

  if (!(normalized in GRADE_POINTS)) {
    throw new Error(`Invalid grade: ${grade}`);
  }

  return GRADE_POINTS[normalized];
}


/**
 * Calculate GPA
 *
 * Rules:
 * 1. Subjects with 0 credits are ignored.
 * 2. F/U subjects do not contribute to GPA.
 * 3. Only passed subjects contribute to earned credits.
 * 4. GPA = weighted grade points / earned credits.
 */
function calculateGpa(subjects) {

  let registeredCredits = 0;
  let earnedCredits = 0;
  let weightedPoints = 0;


  for (const subject of subjects) {

    const credits = Number(subject.credits);
    const gradePoint = Number(subject.grade_point);


    // -----------------------------------------
    // VALIDATE CREDITS
    // -----------------------------------------

    if (Number.isNaN(credits) || credits < 0) {

      throw new Error(
        'Credits must be 0 or greater'
      );

    }


    // -----------------------------------------
    // VALIDATE GRADE POINT
    // -----------------------------------------

    if (
      Number.isNaN(gradePoint) ||
      gradePoint < 0
    ) {

      throw new Error(
        'Invalid grade point'
      );

    }


    // -----------------------------------------
    // 0 CREDIT SUBJECT
    // -----------------------------------------

    // Example:
    // Environmental Science = 0 credits
    //
    // It does NOT affect GPA.

    if (credits === 0) {
      continue;
    }


    // -----------------------------------------
    // REGISTERED CREDITS
    // -----------------------------------------

    registeredCredits += credits;


    // -----------------------------------------
    // FAILED SUBJECT
    // -----------------------------------------

    // F/U = 0 grade point
    //
    // Failed subject does not add
    // to earned credits.

    if (gradePoint === 0) {
      continue;
    }


    // -----------------------------------------
    // PASSED SUBJECT
    // -----------------------------------------

    earnedCredits += credits;

    weightedPoints += credits * gradePoint;

  }


  // -----------------------------------------
  // GPA CALCULATION
  // -----------------------------------------

  const gpa =
    earnedCredits > 0
      ? Number(
          (weightedPoints / earnedCredits)
            .toFixed(2)
        )
      : 0;


  return {

    gpa,

    registeredCredits,

    earnedCredits,

    weightedPoints

  };

}


module.exports = {

  GRADE_POINTS,

  getGradePoint,

  calculateGpa

};