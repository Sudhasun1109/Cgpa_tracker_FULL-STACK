requireAuth();

const params = new URLSearchParams(window.location.search);
const semesterId = params.get('id');
const modal = document.getElementById('modal');

if (!semesterId) window.location.href = 'dashboard.html';

document.getElementById('logoutBtn').onclick = logout;
document.getElementById('addSubjectBtn').onclick = () => modal.classList.remove('hidden');
document.getElementById('closeModal').onclick = () => modal.classList.add('hidden');

const grades = { O:10, 'A+':9, A:8, 'B+':7, B:6, C:5, P:4, F:0 };

async function loadSemester() {
  try {
    const semesters = await api('/semesters');
    const semester = semesters.find(s => String(s.id) === String(semesterId));
    if (!semester) throw new Error('Semester not found');

    document.getElementById('semesterTitle').textContent =
      `${semester.semester_name} — Semester ${semester.semester_number}`;
    document.getElementById('gpa').textContent = Number(semester.gpa).toFixed(2);

    const subjects = await api(`/semesters/${semesterId}/subjects`);
    const body = document.getElementById('subjects');
    document.getElementById('empty').style.display = subjects.length ? 'none' : 'block';

    body.innerHTML = subjects.map(s => `
      <tr id="subject-row-${s.id}">
        <td>${escapeHtml(s.subject_name)}</td>
        <td>${escapeHtml(s.subject_code || '-')}</td>
        <td>${s.credits}</td>
        <td><b>${s.grade}</b></td>
        <td>${s.grade_point}</td>
        <td><button class="small-btn danger" onclick="deleteSubject(${s.id})">Delete</button></td>
         <td><button class="small-btn success" onclick="editSubject(${s.id})">Edit</button></td>
      </tr>
    `).join('');
  } catch (err) {
    alert(err.message);
  }
}

async function deleteSubject(id) {
  if (!confirm('Delete this subject?')) return;
  try {
    await api(`/subjects/${id}`, { method: 'DELETE' });
    loadSemester();
  } catch (err) {
    alert(err.message);
  }
}
function editSubject(id) {

    const row = document.getElementById(`subject-row-${id}`);

    if (!row) {
        console.error("Subject row not found");
        return;
    }

    const cells = row.querySelectorAll("td");

    const subjectName = cells[0].textContent.trim();
    const subjectCode = cells[1].textContent.trim();
    const credits = cells[2].textContent.trim();
    const grade = cells[3].textContent.trim();

    cells[0].innerHTML =
        `<input class="edit-input" value="${subjectName}">`;

    cells[1].innerHTML =
        `<input class="edit-input" value="${subjectCode}">`;

    cells[2].innerHTML =
        `<input class="edit-input" type="number" value="${credits}">`;

    cells[3].innerHTML = `
        <select class="edit-input">
            <option value="O" ${grade === "O" ? "selected" : ""}>O</option>
            <option value="A+" ${grade === "A+" ? "selected" : ""}>A+</option>
            <option value="A" ${grade === "A" ? "selected" : ""}>A</option>
            <option value="B+" ${grade === "B+" ? "selected" : ""}>B+</option>
            <option value="B" ${grade === "B" ? "selected" : ""}>B</option>
            <option value="C" ${grade === "C" ? "selected" : ""}>C</option>
            <option value="P" ${grade === "P" ? "selected" : ""}>P</option>
            <option value="F" ${grade === "F" ? "selected" : ""}>F</option>
        </select>
    `;

    cells[4].innerHTML = `
        <button class="small-btn"
                onclick="saveSubject(${id})">
            Save
        </button>
    `;

    cells[5].innerHTML = `
        <button class="small-btn danger"
                onclick="loadSemesters()">
            Cancel
        </button>
    `;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
}
async function saveSubject(id) {
    const row = document.getElementById(`subject-row-${id}`);

    if (!row) {
        alert("Subject row not found");
        return;
    }

    const inputs = row.querySelectorAll(".edit-input");

    const subjectName = inputs[0].value.trim();
    const subjectCode = inputs[1].value.trim();
    const credits = Number(inputs[2].value);
    const grade = inputs[3].value;

    if (!subjectName || !subjectCode || credits <= 0 || !grade) {
        alert("Please fill all required fields");
        return;
    }

    try {
        console.log("Updating subject:", {
            id,
            subjectName,
            subjectCode,
            credits,
            grade
        });

        const result = await api(`/subjects/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                subjectName,
                subjectCode,
                credits,
                grade
            })
        });

        console.log("Update successful:", result);

        await loadSemester();

    } catch (err) {
        console.error("Save subject error:", err);
        alert(`Save failed: ${err.message}`);
    }
}

document.getElementById('subjectForm').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = document.getElementById('modalMessage');
  try {
    await api(`/semesters/${semesterId}/subjects`, {
      method: 'POST',
      body: JSON.stringify({
        subjectName: document.getElementById('subjectName').value,
        subjectCode: document.getElementById('subjectCode').value,
        credits: Number(document.getElementById('credits').value),
        grade: document.getElementById('grade').value
      })
    });
    modal.classList.add('hidden');
    e.target.reset();
    msg.textContent = '';
    loadSemester();
  } catch (err) {
    msg.textContent = err.message;
  }
});

loadSemester();
