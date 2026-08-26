requireAuth();

const params = new URLSearchParams(window.location.search);
const semesterId = params.get('id');

const modal = document.getElementById('modal');

if (!semesterId) {
  window.location.href = 'dashboard.html';
}

document.getElementById('logoutBtn').onclick = logout;

document.getElementById('addSubjectBtn').onclick = () => {
  modal.classList.remove('hidden');
};

document.getElementById('closeModal').onclick = () => {
  modal.classList.add('hidden');
};


// ==========================================
// GRADE POINTS
// ==========================================

const grades = {
  O: 10,
  'A+': 9,
  A: 8,
  'B+': 7,
  B: 6,
  C: 5,
  P: 4,
  U: 0,
  F: 0
};


// ==========================================
// LOAD SEMESTER
// ==========================================

async function loadSemester() {
  try {

    const semesters = await api('/semesters');

    const semester = semesters.find(
      s => String(s.id) === String(semesterId)
    );

    if (!semester) {
      throw new Error('Semester not found');
    }

    document.getElementById('semesterTitle').textContent =
      `${semester.semester_name} — Semester ${semester.semester_number}`;

    document.getElementById('gpa').textContent =
      Number(semester.gpa || 0).toFixed(2);


    const subjects =
      await api(`/semesters/${semesterId}/subjects`);

    const body =
      document.getElementById('subjects');

    document.getElementById('empty').style.display =
      subjects.length ? 'none' : 'block';


    body.innerHTML = subjects.map(s => `
      <tr id="subject-row-${s.id}">

        <td>
          ${escapeHtml(s.subject_name)}
        </td>

        <td>
          ${escapeHtml(s.subject_code || '-')}
        </td>

        <td>
          ${Number(s.credits)}
        </td>

        <td>
          <b>${escapeHtml(s.grade)}</b>
        </td>

        <td>
          ${Number(s.grade_point)}
        </td>

        <td>
          <button
            class="small-btn danger"
            onclick="deleteSubject(${s.id})">
            Delete
          </button>
        </td>

        <td>
          <button
            class="small-btn success" data-no-rl
            onclick="editSubject(${s.id})">
            Edit
          </button>
        </td>

      </tr>
    `).join('');

  } catch (err) {

    console.error('Load semester error:', err);

    alert(err.message);
  }
}


// ==========================================
// DELETE SUBJECT
// ==========================================

async function deleteSubject(id) {

  if (!confirm('Delete this subject?')) {
    return;
  }

  try {

    await api(`/subjects/${id}`, {
      method: 'DELETE'
    });

    await loadSemester();

  } catch (err) {

    console.error('Delete subject error:', err);

    alert(err.message);
  }
}


// ==========================================
// EDIT SUBJECT
// ==========================================

function editSubject(id) {

  const row =
    document.getElementById(`subject-row-${id}`);

  if (!row) {
    console.error('Subject row not found');
    return;
  }

  const cells =
    row.querySelectorAll('td');


  const subjectName =
    cells[0].textContent.trim();

  const subjectCode =
    cells[1].textContent.trim();

  const credits =
    cells[2].textContent.trim();

  const grade =
    cells[3].textContent.trim();


  // Subject name
  cells[0].innerHTML = `
    <input
      class="edit-input"
      value="${escapeHtml(subjectName)}"
    >
  `;


  // Subject code
  cells[1].innerHTML = `
    <input
      class="edit-input"
      value="${escapeHtml(subjectCode === '-' ? '' : subjectCode)}"
    >
  `;


  // Credits
  // IMPORTANT: min="0"
  cells[2].innerHTML = `
    <input
      class="edit-input"
      type="number"
      min="0"
      max="10"
      step="0.5"
      value="${credits}"
    >
  `;


  // Grade
  cells[3].innerHTML = `
    <select class="edit-input">

      <option value="O"
        ${grade === 'O' ? 'selected' : ''}>
        O
      </option>

      <option value="A+"
        ${grade === 'A+' ? 'selected' : ''}>
        A+
      </option>

      <option value="A"
        ${grade === 'A' ? 'selected' : ''}>
        A
      </option>

      <option value="B+"
        ${grade === 'B+' ? 'selected' : ''}>
        B+
      </option>

      <option value="B"
        ${grade === 'B' ? 'selected' : ''}>
        B
      </option>

      <option value="C"
        ${grade === 'C' ? 'selected' : ''}>
        C
      </option>

      <option value="P"
        ${grade === 'P' ? 'selected' : ''}>
        P
      </option>

      <option value="U"
        ${grade === 'U' ? 'selected' : ''}>
        U
      </option>

      <option value="F"
        ${grade === 'F' ? 'selected' : ''}>
        F
      </option>

    </select>
  `;


  // Save button
  cells[4].innerHTML = `
    <button
      class="small-btn"
      onclick="saveSubject(${id})">
      Save
    </button>
  `;


  // Cancel button
  cells[5].innerHTML = `
    <button
      class="small-btn danger" data-no-rl
      onclick="loadSemester()">
      Cancel
    </button>
  `;
}


// ==========================================
// SAVE EDITED SUBJECT
// ==========================================

async function saveSubject(id) {

  const row =
    document.getElementById(`subject-row-${id}`);

  if (!row) {
    alert('Subject row not found');
    return;
  }


  const inputs =
    row.querySelectorAll('.edit-input');


  const subjectName =
    inputs[0].value.trim();

  const subjectCode =
    inputs[1].value.trim();

  const creditsInput =
    inputs[2].value;

  const credits =
    Number(creditsInput);

  const grade =
    inputs[3].value;


  // IMPORTANT:
  // 0 is VALID.
  // Therefore DON'T use !credits.
  if (
    !subjectName ||
    creditsInput === '' ||
    Number.isNaN(credits) ||
    credits < 0 ||
    credits > 10 ||
    !grade
  ) {

    alert(
      'Please enter valid subject name, credits and grade'
    );

    return;
  }


  try {

    console.log('Updating subject:', {
      id,
      subjectName,
      subjectCode,
      credits,
      grade
    });


    const result =
      await api(`/subjects/${id}`, {

        method: 'PUT',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({

          subjectName,
          subjectCode,
          credits,
          grade

        })

      });


    console.log(
      'Update successful:',
      result
    );


    await loadSemester();


  } catch (err) {

    console.error(
      'Save subject error:',
      err
    );

    alert(
      `Save failed: ${err.message}`
    );
  }
}


// ==========================================
// ADD SUBJECT
// ==========================================

document
  .getElementById('subjectForm')
  .addEventListener('submit', async e => {

    e.preventDefault();


    const msg =
      document.getElementById('modalMessage');


    const subjectName =
      document
        .getElementById('subjectName')
        .value
        .trim();


    const subjectCode =
      document
        .getElementById('subjectCode')
        .value
        .trim();


    const creditsInput =
      document
        .getElementById('credits')
        .value;


    const credits =
      Number(creditsInput);


    const grade =
      document
        .getElementById('grade')
        .value;


    // ======================================
    // VALIDATION
    // ======================================

    // 0 IS VALID.
    // Don't use: !credits
    if (
      !subjectName ||
      creditsInput === '' ||
      Number.isNaN(credits) ||
      credits < 0 ||
      credits > 10 ||
      !grade
    ) {

      msg.textContent =
        'Enter valid subject name, credits and grade';

      return;
    }


    try {

      await api(
        `/semesters/${semesterId}/subjects`,
        {

          method: 'POST',

          body: JSON.stringify({

            subjectName,
            subjectCode,
            credits,
            grade

          })

        }
      );


      modal.classList.add('hidden');

      e.target.reset();

      msg.textContent = '';


      await loadSemester();


    } catch (err) {

      console.error(
        'Add subject error:',
        err
      );

      msg.textContent =
        err.message;
    }

  });


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHtml(value) {

  return String(value).replace(
    /[&<>"']/g,

    ch => ({

      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'

    }[ch])
  );
}


// ==========================================
// INITIAL LOAD
// ==========================================

loadSemester();