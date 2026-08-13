requireAuth();

const semestersEl = document.getElementById('semesters');
const modal = document.getElementById('modal');

document.getElementById('logoutBtn').onclick = logout;
document.getElementById('addSemesterBtn').onclick = () => modal.classList.remove('hidden');
document.getElementById('closeModal').onclick = () => modal.classList.add('hidden');

async function loadDashboard() {
  try {
    const [user, semesters, cgpa] = await Promise.all([
      api('/auth/me'),
      api('/semesters'),
      api('/cgpa')
    ]);

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
