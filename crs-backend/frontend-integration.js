/**
 * CRS Ghana — Frontend API Integration
 * ─────────────────────────────────────
 * Add this <script> block to community-resource-systems.html
 * just before the closing </body> tag, AFTER the existing <script> block.
 *
 * Change API_BASE to your actual deployed domain.
 */

const API_BASE = 'https://yourdomain.com'; // ← change this

// ─── CONTACT FORM ────────────────────────────────────────────────────────────
// Replace the existing submitForm function with this one:
async function submitForm(e) {
  e.preventDefault();
  const btn = e.target.querySelector('.form-btn');
  btn.disabled = true;
  btn.innerHTML = 'Sending… <span class="form-btn-arr">→</span>';

  const body = {
    first_name:   e.target.querySelector('[placeholder="Kwame"]')?.value || '',
    last_name:    e.target.querySelector('[placeholder="Mensah"]')?.value || '',
    organisation: e.target.querySelector('[placeholder="Where you work"]')?.value || '',
    email:        e.target.querySelector('[type="email"]')?.value || '',
    interest:     e.target.querySelector('select')?.value || '',
    message:      e.target.querySelector('textarea')?.value || '',
  };

  try {
    const res = await fetch(`${API_BASE}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed');
    btn.innerHTML = 'Message Sent ✓';
    btn.style.background = 'var(--forest)';
  } catch {
    btn.disabled = false;
    btn.innerHTML = 'Try Again <span class="form-btn-arr">→</span>';
    alert('Could not send message. Please email us directly at info@crs.org.gh');
  }
}

// ─── DYNAMIC CONTENT LOADER ──────────────────────────────────────────────────
// Optionally call these after page load to populate content from the database.

async function fetchServices() {
  try {
    const { data } = await fetch(`${API_BASE}/api/services`).then(r => r.json());
    return data;
  } catch { return null; }
}

async function fetchProjects(category = 'all') {
  try {
    const url = category === 'all'
      ? `${API_BASE}/api/projects`
      : `${API_BASE}/api/projects?category=${category}`;
    const { data } = await fetch(url).then(r => r.json());
    return data;
  } catch { return null; }
}

async function fetchPublications(type = 'all') {
  try {
    const url = type === 'all'
      ? `${API_BASE}/api/publications`
      : `${API_BASE}/api/publications?type=${encodeURIComponent(type)}`;
    const { data } = await fetch(url).then(r => r.json());
    return data;
  } catch { return null; }
}

async function fetchPosts(category = 'all') {
  try {
    const url = category === 'all'
      ? `${API_BASE}/api/posts`
      : `${API_BASE}/api/posts?category=${category}`;
    const { data } = await fetch(url).then(r => r.json());
    return data;
  } catch { return null; }
}
