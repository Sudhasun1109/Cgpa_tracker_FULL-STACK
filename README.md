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
| F | 0 |

GPA/CGPA uses:

`sum(credits × gradePoint) / sum(credits)`

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
