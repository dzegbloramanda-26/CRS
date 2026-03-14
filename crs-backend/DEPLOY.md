# CRS Ghana Backend — Hostinger Deployment Guide
# ═══════════════════════════════════════════════

## What You're Deploying

A Node.js backend with:
- Express REST API   → /api/*
- SQLite database   → db/crs.db
- Admin CMS         → /admin
- File uploads      → /public/uploads

---

## STEP 1 — Prepare Your Files

1. Extract the zip: you should have this folder structure:

   crs-backend/
   ├── server.js
   ├── package.json
   ├── .env.example
   ├── .htaccess
   ├── db/
   │   └── init.js
   ├── admin/
   │   └── index.html
   └── public/
       └── uploads/  (auto-created)

---

## STEP 2 — Set Up Node.js on Hostinger

1. Log in to hPanel (hpanel.hostinger.com)
2. Go to: Hosting → Manage → Advanced → Node.js
3. Click "Create Application"
4. Set:
   - Node.js version: 18.x or 20.x
   - Application root: public_html/api  (or a subdomain folder)
   - Application URL: your domain or api.yourdomain.com
   - Application startup file: server.js
5. Click "Create"

---

## STEP 3 — Upload Files

Option A (File Manager):
1. hPanel → File Manager
2. Navigate to your application root folder
3. Upload all files (keep folder structure)

Option B (FTP/SFTP):
1. hPanel → FTP Accounts → create account
2. Use FileZilla or similar to upload

---

## STEP 4 — Configure Environment Variables

1. In Node.js manager, click "Manage"
2. Go to "Environment Variables" tab
3. Add each variable from .env.example:

   PORT              = 3000  (Hostinger sets this automatically)
   NODE_ENV          = production
   JWT_SECRET        = [generate: openssl rand -hex 64]
   ADMIN_USERNAME    = admin
   ADMIN_PASSWORD    = [your strong password]
   DB_PATH           = ./db/crs.db
   UPLOAD_DIR        = ./public/uploads
   FRONTEND_URL      = https://yourdomain.com

   Generate JWT_SECRET online: https://generate-secret.vercel.app/64

---

## STEP 5 — Install Dependencies

1. In Node.js manager → SSH Terminal (or use hPanel SSH)
2. Navigate to your app folder:
   cd ~/public_html/api
3. Run:
   npm install
4. This installs: express, better-sqlite3, bcryptjs, jsonwebtoken, multer, cors, helmet, express-rate-limit, dotenv

---

## STEP 6 — Start the Application

1. In Node.js manager, click "Start"
2. Check "Application Status" shows "Running"
3. Visit: https://yourdomain.com/api — should show JSON status

---

## STEP 7 — Connect Your Frontend

In your community-resource-systems.html, add this before </body>:

   <script>
   const API_BASE = 'https://yourdomain.com';  // or api.yourdomain.com

   // Load services dynamically
   async function loadServices() {
     const res = await fetch(`${API_BASE}/api/services`);
     const { data } = await res.json();
     // render data into your services grid
   }

   // Load posts
   async function loadPosts(category = 'all') {
     const url = category === 'all'
       ? `${API_BASE}/api/posts`
       : `${API_BASE}/api/posts?category=${category}`;
     const res = await fetch(url);
     const { data } = await res.json();
     // render into blog grid
   }
   </script>

---

## STEP 8 — Access the Admin CMS

   URL:      https://yourdomain.com/admin
   Username: [your ADMIN_USERNAME]
   Password: [your ADMIN_PASSWORD]

IMPORTANT: Change your password immediately after first login
via Settings → Change Password in the admin dashboard.

---

## API REFERENCE

### Public Endpoints (no auth required)

   GET  /api/services              — all active services
   GET  /api/services/:id          — single service
   GET  /api/projects              — all projects
   GET  /api/projects?category=health
   GET  /api/publications          — all active publications
   GET  /api/publications?type=Report
   GET  /api/posts                 — all published posts
   GET  /api/posts?category=articles
   GET  /api/posts/:slug           — single post by slug
   POST /api/contact               — submit contact form

### Admin Endpoints (Bearer token required)

   POST /api/auth/login            — get token
   POST /api/auth/change-password  — change password

   POST   /api/services            — create
   PUT    /api/services/:id        — update
   DELETE /api/services/:id        — soft delete

   POST   /api/projects            — create
   PUT    /api/projects/:id        — update
   DELETE /api/projects/:id        — delete

   POST   /api/publications        — create (+ PDF upload)
   PUT    /api/publications/:id    — update
   DELETE /api/publications/:id    — soft delete

   POST   /api/posts               — create (+ image upload)
   PUT    /api/posts/:id           — update
   DELETE /api/posts/:id           — delete

   GET    /api/contacts            — list all
   PATCH  /api/contacts/:id/read   — mark read
   DELETE /api/contacts/:id        — delete

   GET    /api/stats               — dashboard counts

---

## TROUBLESHOOTING

App won't start?
→ Check Node.js version is 18+
→ Verify npm install completed without errors
→ Check environment variables are all set

"Cannot find module" error?
→ Run: npm install  again in your app directory

Database errors?
→ Check DB_PATH folder exists and is writable
→ Try: mkdir -p db  in your app directory

CORS errors from frontend?
→ Set FRONTEND_URL to your exact frontend domain
→ Ensure no trailing slash in the URL

File uploads not working?
→ Check UPLOAD_DIR exists: mkdir -p public/uploads
→ Ensure the folder has write permissions: chmod 755 public/uploads

---

## SECURITY NOTES

✓ Change ADMIN_PASSWORD before going live
✓ Generate a strong random JWT_SECRET (64+ hex chars)
✓ Never commit .env to version control
✓ Admin dashboard is at /admin — consider restricting by IP in .htaccess if needed
✓ Rate limiting is enabled: 300 req/15min (API), 10 req/15min (auth), 5/hr (contact form)
✓ All file uploads are validated by MIME type
✓ Passwords are bcrypt-hashed (cost factor 12)
✓ JWT tokens expire after 8 hours

---

## BACKUP

Your entire site data is in one file: db/crs.db
Back it up regularly via FTP or hPanel File Manager.

To restore: replace db/crs.db with your backup and restart the app.
