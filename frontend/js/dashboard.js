requireAuth();

const semestersEl = document.getElementById('semesters');
const modal = document.getElementById('modal');

// Marksheet DOM
const marksheetsEl = document.getElementById('marksheets');
const bulkMarksModal = document.getElementById('bulkMarksModal');
const editSemesterModal = document.getElementById('editSemesterModal');
const marksheetModal = document.getElementById('marksheetModal');
const viewerModal = document.getElementById('viewerModal');

// Module-level state (used by the "Generate" feature)
let currentUser = null;
let currentCgpa = null;
let semestersData = [];

// Holds the compressed image chosen in the upload modal
let pendingImageData = null;

document.getElementById('logoutBtn').onclick = logout;

// Show an Admin Panel link in the header for admin users only.
(function showAdminLink() {
  const u = getUser();
  if (u && u.role === 'admin') {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn && logoutBtn.parentNode) {
      const link = document.createElement('a');
      link.href = 'admin.html';
      link.className = 'btn btn-outline admin-link';
      link.textContent = 'Admin Panel';
      logoutBtn.parentNode.insertBefore(link, logoutBtn);
    }
  }
})();
document.getElementById('addSemesterBtn').onclick = () => modal.classList.remove('hidden');

document.getElementById('bulkMarksBtn').onclick = () => {
  document.getElementById('userBulkFile').value = '';
  document.getElementById('userBulkResult').textContent = '';
  document.getElementById('userBulkResult').className = 'bulk-result';
  bulkMarksModal.classList.remove('hidden');
};

document.getElementById('closeBulkMarksModal').onclick = () => bulkMarksModal.classList.add('hidden');
document.getElementById('closeEditSemesterModal').onclick = () => editSemesterModal.classList.add('hidden');
document.getElementById('closeModal').onclick = () => modal.classList.add('hidden');

// Marksheet modal wiring
document.getElementById('addMarksheetBtn').onclick = () => {
  resetMarksheetForm();
  marksheetModal.classList.remove('hidden');
};
document.getElementById('closeMarksheetModal').onclick = () =>
  marksheetModal.classList.add('hidden');
document.getElementById('closeViewer').onclick = () =>
  viewerModal.classList.add('hidden');

// ======================================================
// LOAD DASHBOARD
// ======================================================

async function loadDashboard() {
  try {
    const [user, semesters, cgpa] = await Promise.all([
      api('/auth/me'),
      api('/semesters'),
      api('/cgpa')
    ]);

    // Save to state for the generate feature
    currentUser = user;
    currentCgpa = cgpa;
    semestersData = semesters;

    document.getElementById('welcome').textContent = `Welcome, ${user.name} 👋`;
    document.getElementById('profileText').textContent =
      `${user.registerNumber} | ${user.department || 'Student'} | ${user.college || ''}`;
    updateNavAvatar(user.profilePhoto);

    document.getElementById('cgpa').textContent = Number(cgpa.cgpa).toFixed(2);
    document.getElementById('credits').textContent = cgpa.totalCredits;
    document.getElementById('semesterCount').textContent = cgpa.totalSemesters;
    const best = cgpa.history.length ? Math.max(...cgpa.history.map(x => Number(x.gpa))) : 0;
    document.getElementById('bestGpa').textContent = best.toFixed(2);

    renderChart(cgpa.history);
    renderSemesters(semesters);
    loadMarksheets();
  } catch (err) {
    document.getElementById('status').textContent = err.message;
  }
}

function renderChart(history) {
  const chart = document.getElementById('chart');
  chart.innerHTML = '';
  if (!history.length) {
    chart.innerHTML = '<div class="empty">Add semesters and subjects to see your progress.</div>';
    return;
  }
  history.forEach(item => {
    const wrap = document.createElement('div');
    wrap.className = 'bar-wrap';
    const value = document.createElement('div');
    value.className = 'bar-value';
    value.textContent = Number(item.gpa).toFixed(2);
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.height = `${Math.max(4, Number(item.gpa) * 10)}%`;
    const label = document.createElement('div');
    label.className = 'bar-label';
    label.textContent = `S${item.semesterNumber}`;
    wrap.append(value, bar, label);
    chart.appendChild(wrap);
  });
}

function renderSemesters(semesters) {
  if (!semesters.length) {
    semestersEl.innerHTML = '<div class="empty">No semesters yet. Click “Add Semester”.</div>';
    return;
  }
  semestersEl.innerHTML = semesters.map(s => `
    <div class="semester-card">
      <h3>${escapeHtml(s.semester_name)}</h3>
      <div class="gpa">${Number(s.gpa).toFixed(2)} GPA</div>
      <p>${s.totalCredits} credits • ${s.subjects.length} subjects</p>
      <div class="card-actions">
        <button class="small-btn" onclick="openSemester(${s.id})">View Subjects</button>
        <button class="small-btn" onclick="openEditSemester(${s.id})">Edit Title</button>
        <button class="small-btn" onclick="generateMarksheet(${s.id})">Generate Sheet</button>
        <button class="small-btn danger" onclick="deleteSemester(${s.id})">Delete</button>
      </div>
    </div>
  `).join('');
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
}

function openSemester(id) {
  window.location.href = `semester.html?id=${id}`;
}

async function deleteSemester(id) {
  if (!confirm('Delete this semester and all its subjects?')) return;
  try {
    await api(`/semesters/${id}`, { method: 'DELETE' });
    loadDashboard();
  } catch (err) {
    alert(err.message);
  }
}

// ======================================================
// MARK SHEETS — UPLOAD, LIST, VIEW, DELETE
// ======================================================

function resetMarksheetForm() {
  document.getElementById('marksheetForm').reset();
  document.getElementById('marksheetPreview').innerHTML = '';
  document.getElementById('marksheetMessage').textContent = '';
  pendingImageData = null;
}

async function loadMarksheets() {
  try {
    const sheets = await api('/marksheets');
    if (!sheets.length) {
      marksheetsEl.innerHTML =
        '<div class="empty">No mark sheets yet. Upload a photo or generate one from a semester.</div>';
      return;
    }
    marksheetsEl.innerHTML = sheets.map(m => `
      <div class="marksheet-card">
        <img class="marksheet-thumb" src="${m.image_data}"
             alt="${escapeHtml(m.title)}"
             onclick="viewMarksheet(${m.id})">
        <div class="marksheet-body">
          <h4>${escapeHtml(m.title)}</h4>
          <small>${m.semester_number ? 'Semester ' + m.semester_number + ' • ' : ''}${new Date(m.created_at).toLocaleDateString()}</small>
          <div class="card-actions">
            <button class="small-btn" onclick="viewMarksheet(${m.id})">View</button>
            <button class="small-btn danger" onclick="deleteMarksheet(${m.id})">Delete</button>
          </div>
        </div>
      </div>
    `).join('');

    // Cache the image data for the viewer (avoids a second request)
    window.__marksheetCache = {};
    sheets.forEach(m => { window.__marksheetCache[m.id] = m.image_data; });
  } catch (err) {
    marksheetsEl.innerHTML = `<div class="empty">${escapeHtml(err.message)}</div>`;
  }
}

function viewMarksheet(id) {
  const src = (window.__marksheetCache || {})[id];
  if (!src) return;
  document.getElementById('viewerImage').src = src;
  viewerModal.classList.remove('hidden');
}

async function deleteMarksheet(id) {
  if (!confirm('Delete this mark sheet?')) return;
  try {
    await api(`/marksheets/${id}`, { method: 'DELETE' });
    loadMarksheets();
  } catch (err) {
    alert(err.message);
  }
}

// Compress an image file to a small JPEG data URL before upload.
function compressImage(file, maxDim = 1400, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Could not read image'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

document.getElementById('marksheetFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  const preview = document.getElementById('marksheetPreview');
  const msg = document.getElementById('marksheetMessage');
  msg.textContent = '';
  preview.innerHTML = '';
  pendingImageData = null;
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    msg.textContent = 'Please choose an image file.';
    return;
  }
  try {
    pendingImageData = await compressImage(file);
    preview.innerHTML = `<img src="${pendingImageData}" alt="preview">`;
  } catch (err) {
    msg.textContent = err.message;
  }
});

document.getElementById('marksheetForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('marksheetMessage');
  if (!pendingImageData) {
    msg.textContent = 'Please choose an image first.';
    return;
  }
  try {
    await api('/marksheets', {
      method: 'POST',
      body: JSON.stringify({
        title: document.getElementById('marksheetTitle').value.trim(),
        semesterNumber: document.getElementById('marksheetSemester').value || null,
        imageData: pendingImageData
      })
    });
    marksheetModal.classList.add('hidden');
    resetMarksheetForm();
    loadMarksheets();
  } catch (err) {
    msg.textContent = err.message;
  }
});

// ======================================================
// GENERATE A PRINTABLE MARK SHEET FROM ENTERED DATA
// ======================================================

function generateMarksheet(semesterId) {
  const sem = semestersData.find(s => s.id === semesterId);
  if (!sem) return;

  const subjects = sem.subjects || [];
  if (!subjects.length) {
    alert('Add some subjects to this semester first.');
    return;
  }

  const registered = subjects.reduce((sum, s) => sum + Number(s.credits), 0);
  const earned = subjects.reduce(
    (sum, s) => sum + (Number(s.grade_point) > 0 ? Number(s.credits) : 0), 0
  );

  const rows = subjects.map(s => `
    <tr>
      <td>${escapeHtml(s.subject_code || '-')}</td>
      <td class="left">${escapeHtml(s.subject_name)}</td>
      <td>${Number(s.credits)}</td>
      <td><b>${escapeHtml(s.grade)}</b></td>
      <td>${Number(s.grade_point).toFixed(2)}</td>
      <td>${Number(s.grade_point) > 0 ? 'PASS' : 'RA'}</td>
    </tr>
  `).join('');

  const college = (currentUser && currentUser.college) || 'College of Engineering';
  const name = (currentUser && currentUser.name) || 'Student';
  const reg = (currentUser && currentUser.registerNumber) || '-';
  const dept = (currentUser && currentUser.department) || '-';
  const cgpa = currentCgpa ? Number(currentCgpa.cgpa).toFixed(2) : '-';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>${escapeHtml(sem.semester_name)} - Grade Sheet</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Inter, Segoe UI, Arial, sans-serif; color:#172033; margin:0; padding:34px; background:#fff; }
  .sheet { max-width:820px; margin:auto; border:1px solid #e2e5ee; border-radius:14px; padding:30px 34px; }
  .head { text-align:center; border-bottom:2px solid #4f46e5; padding-bottom:14px; margin-bottom:18px; }
  .head h1 { margin:0; font-size:22px; letter-spacing:.3px; }
  .head p { margin:4px 0 0; color:#667085; font-weight:600; text-transform:uppercase; letter-spacing:2px; font-size:12px; }
  .meta { display:flex; flex-wrap:wrap; gap:6px 40px; margin-bottom:18px; font-size:14px; }
  .meta div span { color:#667085; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { border:1px solid #e6e8f0; padding:9px 10px; text-align:center; }
  th { background:#f5f7fb; font-weight:700; }
  td.left, th.left { text-align:left; }
  tbody tr:nth-child(even) { background:#fafbff; }
  .summary { display:flex; flex-wrap:wrap; gap:12px; margin-top:20px; }
  .box { flex:1; min-width:130px; border:1px solid #e6e8f0; border-radius:12px; padding:12px 14px; }
  .box small { color:#667085; display:block; margin-bottom:4px; font-size:12px; }
  .box strong { font-size:20px; color:#4f46e5; }
  .actions { text-align:center; margin-top:24px; }
  .btn { background:#4f46e5; color:#fff; border:0; padding:11px 22px; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; }
  @media print { .actions { display:none; } body { padding:0; } .sheet { border:0; } }
</style></head>
<body>
  <div class="sheet">
    <div class="head">
      <h1>${escapeHtml(college)}</h1>
      <p>Grade Sheet</p>
    </div>
    <div class="meta">
      <div><span>Name:</span> <b>${escapeHtml(name)}</b></div>
      <div><span>Register No:</span> <b>${escapeHtml(reg)}</b></div>
      <div><span>Department:</span> <b>${escapeHtml(dept)}</b></div>
      <div><span>Semester:</span> <b>${escapeHtml(sem.semester_name)}</b></div>
    </div>
    <table>
      <thead>
        <tr><th>Code</th><th class="left">Course Title</th><th>Credits</th><th>Grade</th><th>Point</th><th>Result</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="summary">
      <div class="box"><small>Credits Registered</small><strong>${registered}</strong></div>
      <div class="box"><small>Credits Earned</small><strong>${earned}</strong></div>
      <div class="box"><small>GPA</small><strong>${Number(sem.gpa).toFixed(2)}</strong></div>
      <div class="box"><small>CGPA</small><strong>${cgpa}</strong></div>
    </div>
    <div class="actions">
      <button class="btn" onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>
</body></html>`;

  const win = window.open('', '_blank');
  if (!win) {
    alert('Please allow pop-ups to generate the sheet.');
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}


// ======================================================
// EDIT SEMESTER TITLE
// ======================================================

function openEditSemester(id) {
  const semester = semestersData.find(s => Number(s.id) === Number(id));
  if (!semester) {
    alert('Semester not found');
    return;
  }
  document.getElementById('editSemesterId').value = semester.id;
  document.getElementById('editSemesterName').value = semester.semester_name || `Semester ${semester.semester_number}`;
  document.getElementById('editSemesterMessage').textContent = '';
  editSemesterModal.classList.remove('hidden');
}

document.getElementById('editSemesterForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = document.getElementById('editSemesterId').value;
  const name = document.getElementById('editSemesterName').value.trim();
  const msg = document.getElementById('editSemesterMessage');

  if (!name) {
    msg.textContent = 'Semester title is required.';
    return;
  }

  try {
    await api(`/semesters/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ semesterName: name })
    });
    editSemesterModal.classList.add('hidden');
    await loadDashboard();
  } catch (err) {
    msg.textContent = err.message;
  }
});

// ======================================================
// USER BULK MARKS UPLOAD
// ======================================================

function parseUserBulkCsv(text) {
  const rows = [];
  let field = '', record = [], inQuotes = false;

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
      if (record.some(v => String(v).trim() !== '')) rows.push(record);
      record = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || record.length) {
    record.push(field);
    if (record.some(v => String(v).trim() !== '')) rows.push(record);
  }
  return rows;
}

document.getElementById('uploadUserBulkBtn').onclick = () => {
  const input = document.getElementById('userBulkFile');
  const result = document.getElementById('userBulkResult');
  const file = input.files[0];

  result.className = 'bulk-result';

  if (!file) {
    result.textContent = 'Please choose bulk_marks_upload2.csv first.';
    return;
  }

  if (!file.name.toLowerCase().endsWith('.csv')) {
    result.textContent = 'Please upload a CSV file.';
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = parseUserBulkCsv(String(reader.result));
      if (parsed.length < 2) {
        result.textContent = 'The CSV has no data rows.';
        return;
      }

      const headers = parsed[0].map(h => String(h).trim().toLowerCase());
      const required = ['email', 'semester_number', 'semester_name', 'subject_code', 'subject_name', 'credits', 'grade'];
      const idx = Object.fromEntries(required.map(h => [h, headers.indexOf(h)]));

      const missing = required.filter(h => idx[h] === -1);
      if (missing.length) {
        result.textContent = `Invalid template. Missing columns: ${missing.join(', ')}`;
        return;
      }

      const currentUser = getUser();
      if (!currentUser || !currentUser.email) {
        result.textContent = 'Your login session is missing. Please log in again.';
        return;
      }

      const rows = parsed.slice(1).map(cols => ({
        // The student cannot upload marks to another account.
        // Blank/template email values are automatically assigned to the logged-in account.
        email: String(cols[idx.email] || '').trim() || currentUser.email,
        semesterNumber: String(cols[idx.semester_number] || '').trim(),
        semesterName: String(cols[idx.semester_name] || '').trim(),
        subjectCode: String(cols[idx.subject_code] || '').trim(),
        subjectName: String(cols[idx.subject_name] || '').trim(),
        credits: String(cols[idx.credits] || '').trim(),
        grade: String(cols[idx.grade] || '').trim()
      }));

      result.textContent = 'Uploading...';

      const res = await api('/semesters/bulk-marks', {
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
      input.value = '';

      if (res.inserted > 0) await loadDashboard();
    } catch (err) {
      result.className = 'bulk-result warn';
      result.textContent = err.message;
    }
  };

  reader.onerror = () => {
    result.className = 'bulk-result warn';
    result.textContent = 'Could not read the CSV file.';
  };

  reader.readAsText(file);
};

document.getElementById('semesterForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('modalMessage');
  try {
    await api('/semesters', {
      method: 'POST',
      body: JSON.stringify({
        semesterNumber: Number(document.getElementById('semesterNumber').value),
        semesterName: document.getElementById('semesterName').value
      })
    });
    modal.classList.add('hidden');
    e.target.reset();
    msg.textContent = '';
    loadDashboard();
  } catch (err) {
    msg.textContent = err.message;
  }
});

loadDashboard();

// ======================================================
// EDIT PROFILE
// ======================================================

const profileModal = document.getElementById('profileModal');
const feedbackModal = document.getElementById('feedbackModal');

// undefined = keep existing photo, null = remove, string = new photo
let pendingProfilePhoto = undefined;

const COLLEGE_OPTIONS = [
  'Erode Sengunthar Engineering College',
  'Anna University',
  'PSG College of Technology',
  'Kongu Engineering College',
  'Coimbatore Institute of Technology',
  'Sri Krishna College of Engineering and Technology',
  'Bannari Amman Institute of Technology',
  'Government College of Technology'
];
const DEPARTMENT_OPTIONS = [
  'Computer Science and Engineering',
  'Artificial Intelligence and Data Science',
  'Artificial Intelligence and Machine Learning',
  'Information Technology',
  'Electronics and Communication Engineering',
  'Electrical and Electronics Engineering',
  'Mechanical Engineering',
  'Civil Engineering',
  'Biomedical Engineering'
];

function fillDatalist(id, options) {
  const dl = document.getElementById(id);
  if (dl) dl.innerHTML = options.map(o => `<option value="${o}"></option>`).join('');
}
fillDatalist('collegeList', COLLEGE_OPTIONS);
fillDatalist('deptList', DEPARTMENT_OPTIONS);
fillDatalist('semList', ['1', '2', '3', '4', '5', '6', '7', '8']);

function updateNavAvatar(photo) {
  const img = document.getElementById('navAvatar');
  if (!img) return;
  if (photo) {
    img.src = photo;
    img.classList.remove('hidden');
  } else {
    img.classList.add('hidden');
    img.removeAttribute('src');
  }
}

const PHOTO_PLACEHOLDER =
  'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="48" fill="#eef1f8"/><text x="50%" y="54%" font-size="40" text-anchor="middle" fill="#9aa4bf" font-family="Arial">?</text></svg>'
  );

document.getElementById('editProfileBtn').onclick = () => {
  const u = currentUser || getUser() || {};
  document.getElementById('pfName').value = u.name || '';
  document.getElementById('pfEmail').value = u.email || '';
  document.getElementById('pfReg').value = u.registerNumber || u.register_number || '';
  document.getElementById('pfCollege').value = u.college || '';
  document.getElementById('pfDept').value = u.department || '';
  document.getElementById('pfSem').value = u.semesterNumber || '';
  document.getElementById('profilePreview').src = u.profilePhoto || PHOTO_PLACEHOLDER;
  document.getElementById('profileMessage').textContent = '';
  pendingProfilePhoto = undefined;
  profileModal.classList.remove('hidden');
};
document.getElementById('closeProfileModal').onclick = () => profileModal.classList.add('hidden');

document.getElementById('profilePhotoFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  const msg = document.getElementById('profileMessage');
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    msg.textContent = 'Please choose an image file.';
    return;
  }
  try {
    pendingProfilePhoto = await compressImage(file, 512, 0.8);
    document.getElementById('profilePreview').src = pendingProfilePhoto;
    msg.textContent = '';
  } catch (err) {
    msg.textContent = err.message;
  }
});

document.getElementById('removePhotoBtn').onclick = () => {
  pendingProfilePhoto = null;
  document.getElementById('profilePreview').src = PHOTO_PLACEHOLDER;
};

document.getElementById('profileForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('profileMessage');
  const payload = {
    name: document.getElementById('pfName').value.trim(),
    email: document.getElementById('pfEmail').value.trim(),
    college: document.getElementById('pfCollege').value.trim(),
    department: document.getElementById('pfDept').value.trim(),
    semesterNumber: document.getElementById('pfSem').value.trim()
  };
  if (pendingProfilePhoto !== undefined) payload.profilePhoto = pendingProfilePhoto;

  try {
    msg.style.color = '';
    msg.textContent = 'Saving...';
    const res = await api('/auth/profile', { method: 'PUT', body: JSON.stringify(payload) });
    // Refresh cached user + header.
    currentUser = res.user;
    localStorage.setItem('cgpa_user', JSON.stringify(res.user));
    updateNavAvatar(res.user.profilePhoto);
    document.getElementById('profileText').textContent =
      `${res.user.registerNumber} | ${res.user.department || 'Student'} | ${res.user.college || ''}`;
    msg.style.color = '#16803c';
    msg.textContent = 'Profile updated!';
    setTimeout(() => profileModal.classList.add('hidden'), 700);
  } catch (err) {
    msg.style.color = '#d12f2f';
    msg.textContent = err.message;
  }
});

// ======================================================
// FEEDBACK
// ======================================================

document.getElementById('feedbackBtn').onclick = () => {
  document.getElementById('feedbackForm').reset();
  document.getElementById('feedbackResult').textContent = '';
  feedbackModal.classList.remove('hidden');
};
document.getElementById('closeFeedbackModal').onclick = () => feedbackModal.classList.add('hidden');

document.getElementById('feedbackForm').addEventListener('submit', async e => {
  e.preventDefault();
  const out = document.getElementById('feedbackResult');
  const message = document.getElementById('feedbackMessage').value.trim();
  if (!message) { out.textContent = 'Please write something first.'; return; }
  try {
    out.style.color = '';
    out.textContent = 'Sending...';
    const res = await api('/feedback', { method: 'POST', body: JSON.stringify({ message }) });
    out.style.color = '#16803c';
    out.textContent = res.message;
    setTimeout(() => feedbackModal.classList.add('hidden'), 900);
  } catch (err) {
    out.style.color = '#d12f2f';
    out.textContent = err.message;
  }
});
