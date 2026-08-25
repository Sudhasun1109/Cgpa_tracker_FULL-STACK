# CGPA Tracker - Full Stack Application

A beginner-friendly full-stack CGPA tracking application using HTML, CSS, JavaScript, Node.js, Express.js and MySQL.

## Features
- Student registration and login
- JWT authentication
- bcrypt password hashing
- Student profile
- Semester CRUD
- Subject CRUD
- Automatic GPA and CGPA calculation
- CGPA history
- Responsive dashboard
- MySQL database

## Requirements
- Node.js 18+
- MySQL 8+
- VS Code (recommended)

## 1. Create the database

Open MySQL:

```bash
mysql -u root -p
```

Run:

```sql
CREATE DATABASE cgpa_tracker;
```

Then exit with:

```sql
exit;
```

## 2. Configure backend

Go to `backend/.env.example`, copy it as `.env`, and set your MySQL password.

Example:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=cgpa_tracker
JWT_SECRET=change_this_to_a_long_random_secret
```

## 3. Install backend packages

```bash
cd backend
npm install
```

## 4. Create tables

```bash
npm run init-db
```

## 5. Start backend

Development mode:

```bash
npm run dev
```

The API runs at:

`http://localhost:5000`

## 6. Start frontend

Install the VS Code **Live Server** extension.

Open:

`frontend/index.html`

Right-click -> **Open with Live Server**

The frontend normally opens at:

`http://127.0.0.1:5500`

## Test account

Register a new account from the Register page. Passwords are never stored as plain text.

## Grade points

| Grade | Point |
|---|---:|
| O | 10 |
| A+ | 9 |
| A | 8 |
| B+ | 7 |
| B | 6 |
| C | 5 |
| P | 4 |
| U / F | 0 |

GPA/CGPA uses the R-2023 (CBCS) college formula:

`GPA = sum(credits × gradePoint) / sum(credits of PASSED subjects)`

Rules applied:
- **Failed subjects (U / F, grade point 0) are excluded from the denominator.** They add nothing to the total and their credits are not counted as earned. This is why Semester 2 = 8.26 (157 / 19 earned credits), not 7.14 (157 / 22 registered credits).
- **0-credit subjects** (e.g. Environmental Science) do not affect GPA at all.
- CGPA = total weighted points across all semesters / total earned credits.

The dashboard "Total Credits" shows **earned** credits, matching the "Cumulative Credits Earned" line on the official transcript.

## API
- POST `/api/auth/register`
- POST `/api/auth/login`
- GET `/api/auth/me`
- POST `/api/auth/logout`
- GET `/api/semesters`
- POST `/api/semesters`
- DELETE `/api/semesters/:id`
- GET `/api/semesters/:id/subjects`
- POST `/api/semesters/:id/subjects`
- DELETE `/api/subjects/:id`
- GET `/api/cgpa`
- GET `/api/cgpa/history`
- GET `/api/marksheets`
- POST `/api/marksheets`
- DELETE `/api/marksheets/:id`

## Mark Sheets (new)

From the dashboard, click **+ Add Mark Sheet**, give it a title (and optional
semester number), and choose a photo of your grade sheet. The image is
compressed in the browser before upload (longest side capped at 1400px, JPEG),
so a 4 MB phone photo becomes ~200 KB. Click any thumbnail to view it full
size, or Delete to remove it. Images are stored in the database as base64, so
they survive redeploys on hosts with an ephemeral disk (like Render free tier).

## Note on the CGPA calculation fix

The calculation logic in this project is correct. If your **deployed** site
still shows an old value (e.g. Semester 2 as 7.14), the deployed backend is
running older code — **redeploy the backend** so it picks up the current
`utils/cgpaCalculator.js`, `routes/semesterRoutes.js` and `routes/cgpaRoutes.js`.
The `/api/cgpa` endpoint recomputes fresh on every request, so no manual DB
edit is needed.

> If you already have a live database from before this update, run
> `npm run init-db` once more. It is safe to re-run: it only creates the new
> `marksheets` table and adds a missing unique key on `cgpa_records`.
