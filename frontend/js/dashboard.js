requireAuth();

const semestersEl = document.getElementById('semesters');
const modal = document.getElementById('modal');

// Marksheet DOM
const marksheetsEl = document.getElementById('marksheets');
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
    const nav = document.querySelector('.topbar .nav');
    const logoutBtn = document.getElementById('logoutBtn');
    if (nav && logoutBtn) {
      const link = document.createElement('a');
      link.href = 'admin.html';
      link.className = 'btn btn-outline admin-link';
      link.textContent = 'Admin Panel';
      nav.insertBefore(link, logoutBtn);
    }
  }
})();
document.getElementById('addSemesterBtn').onclick = () => modal.classList.remove('hidden');
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
