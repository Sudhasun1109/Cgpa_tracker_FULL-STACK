requireAdmin();

const usersBody = document.getElementById('usersBody');
let usersCache = [];
const userModal = document.getElementById('userModal');

document.getElementById('logoutBtn').onclick = logout;

const me = getUser();
document.getElementById('welcome').textContent =
  me && me.name ? `Welcome, ${me.name}` : 'Admin';

// ======================================================
// HELPERS
// ======================================================

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[ch]));
}

// ======================================================
// LOAD USERS
// ======================================================

async function loadUsers() {
  const status = document.getElementById('usersStatus');
  try {
    status.textContent = 'Loading...';
    const users = await api('/admin/users');
    usersCache = users;
    populateStudentDropdown(users);
    status.textContent = '';

    document.getElementById('userCount').textContent = users.length;
    document.getElementById('adminCount').textContent =
      users.filter(u => u.role === 'admin').length;
    document.getElementById('studentCount').textContent =
      users.filter(u => u.role !== 'admin').length;

    if (!users.length) {
      usersBody.innerHTML = '<tr><td colspan="9" class="empty">No users yet.</td></tr>';
      return;
    }

    usersBody.innerHTML = users.map(u => `
      <tr>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.register_number)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td>${escapeHtml(u.college || '-')}</td>
        <td>${escapeHtml(u.department || '-')}</td>
        <td><span class="role-pill ${u.role === 'admin' ? 'is-admin' : ''}">${escapeHtml(u.role)}</span></td>
        <td><b>${Number(u.cgpa || 0).toFixed(2)}</b></td>
        <td>${u.semester_count}</td>
        <td>
          <div class="card-actions">
            <button class="small-btn" onclick="viewAcademics(${u.id})">View</button>
            <button class="small-btn" onclick="openEditUser(${u.id})">Edit</button>
            <button class="small-btn danger" onclick="deleteUser(${u.id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    status.textContent = err.message;
  }
}

// ======================================================
// ADD / EDIT USER
// ======================================================

document.getElementById('addUserBtn').onclick = () => openAddUser();
document.getElementById('closeUserModal').onclick = () => userModal.classList.add('hidden');

function openAddUser() {
  document.getElementById('userModalTitle').textContent = 'Add User';
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
  const pw = document.getElementById('uPassword');
  pw.required = true;
  pw.placeholder = '';
  document.getElementById('userMessage').textContent = '';
  userModal.classList.remove('hidden');
}

function openEditUser(id) {
  const u = usersCache.find(x => x.id === Number(id));
  if (!u) return;
  document.getElementById('userModalTitle').textContent = 'Edit User';
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = u.id;
  document.getElementById('uName').value = u.name || '';
  document.getElementById('uReg').value = u.register_number || '';
  document.getElementById('uEmail').value = u.email || '';
  document.getElementById('uCollege').value = u.college || '';
  document.getElementById('uDept').value = u.department || '';
  document.getElementById('uRole').value = u.role || 'user';
  const pw = document.getElementById('uPassword');
  pw.value = '';
  pw.required = false;
  pw.placeholder = 'Leave blank to keep current';
  document.getElementById('userMessage').textContent = '';
  userModal.classList.remove('hidden');
}

document.getElementById('userForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('userMessage');
  const id = document.getElementById('userId').value;

  const payload = {
    name: document.getElementById('uName').value.trim(),
    registerNumber: document.getElementById('uReg').value.trim(),
    email: document.getElementById('uEmail').value.trim(),
    college: document.getElementById('uCollege').value.trim(),
    department: document.getElementById('uDept').value.trim(),
    role: document.getElementById('uRole').value
  };
  const password = document.getElementById('uPassword').value;
  if (password) payload.password = password;

  try {
    if (id) {
      await api(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      await api('/admin/users', { method: 'POST', body: JSON.stringify(payload) });
    }
    userModal.classList.add('hidden');
    loadUsers();
  } catch (err) {
    msg.textContent = err.message;
  }
});

async function deleteUser(id) {
  if (!confirm('Delete this user and all their data? This cannot be undone.')) return;
  try {
    await api(`/admin/users/${id}`, { method: 'DELETE' });
    loadUsers();
  } catch (err) {
    alert(err.message);
  }
}

// ======================================================
// BULK UPLOAD MARKS
// ======================================================

const TEMPLATE_HEADERS =
  ['email', 'semester_number', 'semester_name', 'subject_code', 'subject_name', 'credits', 'grade'];

document.getElementById('downloadTemplateBtn').onclick = () => {
  const example =
    'student@example.com,1,Semester 1,23BS101,Engineering Mathematics,4,A';
  const csv = TEMPLATE_HEADERS.join(',') + '\n' + example + '\n';
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bulk_marks_template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

// Minimal CSV parser that supports quoted fields and commas inside quotes.
function parseCsv(text) {
  const rows = [];
  let field = '';
  let record = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      record.push(field); field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      record.push(field); field = '';
      if (record.length > 1 || record[0] !== '') rows.push(record);
      record = [];
    } else {
      field += c;
    }
  }
  // last field / record
  if (field !== '' || record.length) {
    record.push(field);
    if (record.length > 1 || record[0] !== '') rows.push(record);
  }
  return rows;
}

document.getElementById('uploadBulkBtn').onclick = () => {
  const fileInput = document.getElementById('bulkFile');
  const result = document.getElementById('bulkResult');
  const file = fileInput.files[0];
  result.className = 'bulk-result';

  if (!file) {
    result.textContent = 'Please choose a CSV file first.';
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = parseCsv(String(reader.result));
      if (parsed.length < 2) {
        result.textContent = 'The file has no data rows.';
        return;
      }

      const header = parsed[0].map(h => h.trim().toLowerCase());
      const idx = {};
      TEMPLATE_HEADERS.forEach(h => { idx[h] = header.indexOf(h); });

      if (idx.email === -1 || idx.subject_name === -1 || idx.credits === -1 || idx.grade === -1) {
        result.textContent =
          'Invalid template. Required columns: ' + TEMPLATE_HEADERS.join(', ');
        return;
      }

      const rows = parsed.slice(1).map(cols => ({
        email: cols[idx.email],
        semesterNumber: cols[idx.semester_number],
        semesterName: idx.semester_name > -1 ? cols[idx.semester_name] : '',
        subjectCode: idx.subject_code > -1 ? cols[idx.subject_code] : '',
        subjectName: cols[idx.subject_name],
        credits: cols[idx.credits],
        grade: cols[idx.grade]
      }));

      result.textContent = 'Uploading...';
      const res = await api('/admin/bulk-marks', {
        method: 'POST',
        body: JSON.stringify({ rows })
      });

      let html = `<div class="bulk-summary">
        <b>${res.inserted}</b> inserted · <b>${res.failed}</b> failed · ${res.total} total
      </div>`;
      if (res.errors && res.errors.length) {
        html += '<ul class="bulk-errors">' +
          res.errors.map(e => `<li>Row ${e.line}: ${escapeHtml(e.message)}</li>`).join('') +
          '</ul>';
      }
      result.className = 'bulk-result ' + (res.failed ? 'warn' : 'ok');
      result.innerHTML = html;
      fileInput.value = '';
    } catch (err) {
      result.className = 'bulk-result warn';
      result.textContent = err.message;
    }
  };
  reader.onerror = () => { result.textContent = 'Could not read the file.'; };
  reader.readAsText(file);
};

loadUsers();

// ======================================================
// VIEW A USER'S FULL ACADEMICS (CGPA, semesters, subjects)
// ======================================================

const academicsModal = document.getElementById('academicsModal');
document.getElementById('closeAcademics').onclick = () => academicsModal.classList.add('hidden');

async function viewAcademics(id) {
  const body = document.getElementById('academicsBody');
  body.innerHTML = '<p class="hint">Loading...</p>';
  academicsModal.classList.remove('hidden');
  try {
    const data = await api(`/admin/users/${id}/academics`);
    const u = data.user;

    let html = `
      <h2>${escapeHtml(u.name)}</h2>
      <p class="hint">
        ${escapeHtml(u.register_number)} · ${escapeHtml(u.email)}
        ${u.department ? '· ' + escapeHtml(u.department) : ''}
        ${u.college ? '· ' + escapeHtml(u.college) : ''}
      </p>
      <div class="stats acad-stats">
        <div class="stat-card"><small>CGPA</small><strong>${Number(data.cgpa).toFixed(2)}</strong></div>
        <div class="stat-card"><small>Credits Earned</small><strong>${data.totalCredits}</strong></div>
        <div class="stat-card"><small>Semesters</small><strong>${data.semesters.length}</strong></div>
      </div>
    `;

    if (!data.semesters.length) {
      html += '<div class="empty">No academic data for this student yet.</div>';
    } else {
      data.semesters.forEach(sem => {
        html += `
          <div class="acad-sem">
            <div class="acad-sem-head">
              <h3>${escapeHtml(sem.semester_name)}</h3>
              <span>GPA ${Number(sem.gpa).toFixed(2)} · ${sem.earnedCredits}/${sem.registeredCredits} credits</span>
            </div>`;
        if (!sem.subjects.length) {
          html += '<p class="hint">No subjects.</p>';
        } else {
          html += `
            <div class="table-wrap">
              <table>
                <thead><tr>
                  <th>Code</th><th>Subject</th><th>Credits</th><th>Grade</th><th>Point</th><th>Result</th>
                </tr></thead>
                <tbody>
                  ${sem.subjects.map(su => `
                    <tr>
                      <td>${escapeHtml(su.subject_code || '-')}</td>
                      <td>${escapeHtml(su.subject_name)}</td>
                      <td>${Number(su.credits)}</td>
                      <td><b>${escapeHtml(su.grade)}</b></td>
                      <td>${Number(su.grade_point).toFixed(2)}</td>
                      <td>${Number(su.grade_point) > 0 ? 'PASS' : 'RA'}</td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`;
        }
        html += '</div>';
      });
    }
    body.innerHTML = html;
  } catch (err) {
    body.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
}

// ======================================================
// SINGLE MARKS ENTRY
// ======================================================

function populateStudentDropdown(users) {
  const sel = document.getElementById('smUser');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Select a student</option>' +
    users.map(u => `<option value="${u.id}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`).join('');
  if (prev) sel.value = prev;
}

document.getElementById('singleForm').addEventListener('submit', async e => {
  e.preventDefault();
  const result = document.getElementById('singleResult');
  result.className = 'bulk-result';

  const payload = {
    userId: document.getElementById('smUser').value,
    semesterNumber: document.getElementById('smSemNo').value,
    semesterName: document.getElementById('smSemName').value.trim(),
    subjectCode: document.getElementById('smCode').value.trim(),
    subjectName: document.getElementById('smName').value.trim(),
    credits: document.getElementById('smCredits').value,
    grade: document.getElementById('smGrade').value
  };

  if (!payload.userId) {
    result.className = 'bulk-result warn';
    result.textContent = 'Please select a student.';
    return;
  }

  try {
    result.textContent = 'Adding...';
    const res = await api('/admin/single-marks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    result.className = 'bulk-result ok';
    result.textContent = `${res.message} (grade point ${res.gradePoint}).`;
    document.getElementById('smCode').value = '';
    document.getElementById('smName').value = '';
    document.getElementById('smCredits').value = '';
    document.getElementById('smGrade').value = '';
  } catch (err) {
    result.className = 'bulk-result warn';
    result.textContent = err.message;
  }
});
