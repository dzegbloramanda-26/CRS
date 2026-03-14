'use strict';
// db/init.js — Creates all tables and seeds default data on first run

const Database = require('better-sqlite3');
const bcrypt   = require('bcryptjs');
const path     = require('path');
const fs       = require('fs');
require('dotenv').config();

const DB_PATH = process.env.DB_PATH || './db/crs.db';
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── SCHEMA ──────────────────────────────────────────────────────────────────

db.exec(`
  -- Admin users
  CREATE TABLE IF NOT EXISTS admins (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    username   TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Services
  CREATE TABLE IF NOT EXISTS services (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    number      TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    short_desc  TEXT    NOT NULL,
    full_desc   TEXT,
    icon        TEXT    DEFAULT 'circle',
    active      INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Projects
  CREATE TABLE IF NOT EXISTS projects (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT    NOT NULL,
    category    TEXT    NOT NULL,
    years       TEXT    NOT NULL,
    location    TEXT    NOT NULL,
    description TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'active',
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Publications
  CREATE TABLE IF NOT EXISTS publications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type        TEXT    NOT NULL,
    title       TEXT    NOT NULL,
    authors     TEXT    NOT NULL,
    pub_date    TEXT    NOT NULL,
    year        INTEGER NOT NULL,
    excerpt     TEXT    NOT NULL,
    file_url    TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Blog posts
  CREATE TABLE IF NOT EXISTS posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    category     TEXT    NOT NULL,
    title        TEXT    NOT NULL,
    slug         TEXT    NOT NULL UNIQUE,
    author       TEXT    NOT NULL,
    author_role  TEXT,
    pub_date     TEXT    NOT NULL,
    excerpt      TEXT    NOT NULL,
    body         TEXT,
    cover_image  TEXT,
    published    INTEGER NOT NULL DEFAULT 0,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Contact form submissions
  CREATE TABLE IF NOT EXISTS contacts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name   TEXT    NOT NULL,
    last_name    TEXT    NOT NULL,
    organisation TEXT,
    email        TEXT    NOT NULL,
    interest     TEXT,
    message      TEXT    NOT NULL,
    read         INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  -- Triggers for updated_at
  CREATE TRIGGER IF NOT EXISTS services_updated
    AFTER UPDATE ON services
    BEGIN UPDATE services SET updated_at = datetime('now') WHERE id = NEW.id; END;

  CREATE TRIGGER IF NOT EXISTS projects_updated
    AFTER UPDATE ON projects
    BEGIN UPDATE projects SET updated_at = datetime('now') WHERE id = NEW.id; END;

  CREATE TRIGGER IF NOT EXISTS publications_updated
    AFTER UPDATE ON publications
    BEGIN UPDATE publications SET updated_at = datetime('now') WHERE id = NEW.id; END;

  CREATE TRIGGER IF NOT EXISTS posts_updated
    AFTER UPDATE ON posts
    BEGIN UPDATE posts SET updated_at = datetime('now') WHERE id = NEW.id; END;
`);

// ─── SEED ADMIN ──────────────────────────────────────────────────────────────

const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(
  process.env.ADMIN_USERNAME || 'admin'
);

if (!existing) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'changeme123!', 12);
  db.prepare('INSERT INTO admins (username, password) VALUES (?, ?)').run(
    process.env.ADMIN_USERNAME || 'admin', hash
  );
  console.log('✓ Admin account created');
}

// ─── SEED SERVICES ───────────────────────────────────────────────────────────

const serviceCount = db.prepare('SELECT COUNT(*) as n FROM services').get().n;
if (serviceCount === 0) {
  const insertSvc = db.prepare(`
    INSERT INTO services (number, name, short_desc, full_desc, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);
  const services = [
    ['01', 'Research & Evaluation',
     'Rigorous, contextually sensitive research generating evidence that speaks to Ghanaian realities.',
     'We design rigorous, contextually sensitive research that generates evidence speaking to Ghanaian realities — informing decision-making at community, district, and national levels. We specialise in participatory, mixed-method approaches that integrate community knowledge with quantitative evidence.', 1],
    ['02', 'Strategy & Leadership',
     'Supporting NGOs, government bodies, and CBOs across Ghana to develop strategies grounded in local context.',
     'We support NGOs, government bodies, and CBOs across Ghana to develop strategies grounded in local context and accountable to those they serve. We facilitate strategic planning, organisational review, and leadership development for institutions at every level.', 2],
    ['03', 'Capability Strengthening',
     'Building the skills and institutional capacity to sustain impact long after our engagement ends.',
     'From District Assemblies to national institutions, we build the skills, knowledge, and institutional capacity to sustain impact long after our engagement ends. Training, mentoring, and embedded advisory support delivered with a commitment to local ownership.', 3],
    ['04', 'Community Facilitation',
     'Participatory methods creating spaces where people drive their own development.',
     'Participatory methods refined across Ghana\'s diverse communities — creating spaces where people drive their own development as architects, not beneficiaries, of change. We facilitate community planning, dialogue, visioning, and conflict transformation processes.', 4],
    ['05', 'Livelihoods & Inclusion',
     'Livelihood programmes addressing structural inequity for marginalised populations across Ghana.',
     'We design and evaluate livelihood programmes addressing structural inequity — with focus on women, youth, persons with disabilities, and marginalised populations across Ghana. Market systems development, enterprise support, and financial inclusion strategies.', 5],
    ['06', 'Policy & Governance',
     'Translating evidence into policy with Ghana\'s ministries and development partners.',
     'We work with Ghana\'s ministries, development partners, and district authorities to translate evidence into policy — building governance systems that are responsive, equitable, and durable. Policy analysis, reform facilitation, and stakeholder engagement.', 6],
  ];
  services.forEach(s => insertSvc.run(...s));
  console.log('✓ Services seeded');
}

// ─── SEED PROJECTS ───────────────────────────────────────────────────────────

const projCount = db.prepare('SELECT COUNT(*) as n FROM projects').get().n;
if (projCount === 0) {
  const insertProj = db.prepare(`
    INSERT INTO projects (title, category, years, location, description, status, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const projects = [
    ['Smallholder Farmer Inclusion Programme', 'livelihoods', '2022–2025',
     'Upper East & Upper West Regions',
     'Strengthening market access, cooperative structures, and financial literacy for smallholder farming families — with focus on women-led households and climate-adaptive practices.',
     'active', 1],
    ['Community Health Systems Strengthening', 'health', '2021–2024',
     'Ashanti & Bono Regions',
     'Building capacity of community health workers, CHPS compounds, and district health teams to deliver integrated primary care with community oversight mechanisms.',
     'active', 2],
    ['Youth Leadership & Civic Agency', 'youth', '2023–2026',
     'Greater Accra Region',
     'Supporting young people in urban areas to develop civic skills, engage local government, and build peer-led advocacy networks in their own communities.',
     'active', 3],
    ['District Assembly Capacity Building', 'governance', '2020–2023',
     'Central & Western Regions',
     'Supporting District Assemblies to improve participatory planning, citizen engagement, and revenue mobilisation — strengthening Ghana\'s decentralisation system.',
     'completed', 4],
    ['Women\'s Economic Networks', 'gender', '2022–2025',
     'Volta & Oti Regions',
     'Establishing and strengthening women-led savings and enterprise groups, linking them to formal financial services and building sustainable peer support structures.',
     'active', 5],
    ['Climate-Resilient Community Planning', 'environment', '2023–2026',
     'Northern Region',
     'Integrating climate risk into community development plans in the northern savanna — building local adaptation strategies grounded in indigenous environmental knowledge.',
     'active', 6],
  ];
  projects.forEach(p => insertProj.run(...p));
  console.log('✓ Projects seeded');
}

// ─── SEED PUBLICATIONS ───────────────────────────────────────────────────────

const pubCount = db.prepare('SELECT COUNT(*) as n FROM publications').get().n;
if (pubCount === 0) {
  const insertPub = db.prepare(`
    INSERT INTO publications (type, title, authors, pub_date, year, excerpt, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const pubs = [
    ['Report', 'State of Community Health Systems in Ghana',
     'Dr. Abena Asante & Dr. Kofi Mensah', 'March 2025', 2025,
     'A comprehensive review of Ghana\'s community health infrastructure, findings from 48 CHPS zones across six regions, and recommendations for district-level reform.', 1],
    ['Working Paper', 'Participatory Planning and Local Accountability',
     'Efua Darko', 'November 2024', 2024,
     'An analysis of participatory planning mechanisms in twelve Ghanaian District Assemblies — examining what conditions enable genuine citizen influence over local budgets.', 2],
    ['Policy Brief', 'Women\'s Land Rights and Agricultural Productivity',
     'CRS Gender Team', 'August 2024', 2024,
     'Drawing on evidence from Volta and Oti Regions, this brief argues for legislative reform to secure women\'s land tenure as a prerequisite for sustainable agricultural development.', 3],
    ['Report', 'Youth Civic Engagement in Urban Ghana',
     'Kwame Acheampong', 'June 2023', 2023,
     'Findings from a three-year longitudinal study tracking youth civic participation across Ghana — examining barriers, enablers, and the role of peer-led networks.', 4],
    ['Working Paper', 'Climate Adaptation and Indigenous Knowledge in Northern Ghana',
     'Dr. Fatima Ibrahim', 'October 2022', 2022,
     'Documents traditional ecological knowledge held by farming communities in the northern savanna and its potential integration into formal climate adaptation frameworks.', 5],
    ['Policy Brief', 'Decentralisation and Service Delivery: A Reform Agenda',
     'CRS Governance Team', 'April 2021', 2021,
     'Concrete recommendations for the Ministry of Local Government on improving service delivery through deeper fiscal and administrative decentralisation to district level.', 6],
  ];
  pubs.forEach(p => insertPub.run(...p));
  console.log('✓ Publications seeded');
}

// ─── SEED POSTS ──────────────────────────────────────────────────────────────

const postCount = db.prepare('SELECT COUNT(*) as n FROM posts').get().n;
if (postCount === 0) {
  const insertPost = db.prepare(`
    INSERT INTO posts (category, title, slug, author, author_role, pub_date, excerpt, published, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const posts = [
    ['articles', 'Why Community-Led Development Still Matters',
     'why-community-led-development-still-matters',
     'Dr. Abena Asante', 'Executive Director', 'February 2026',
     'Thirty years in this work has only deepened my conviction that the most durable change happens when communities lead it. Not because it is a nice idea — but because the evidence consistently shows it works better and lasts longer.',
     1, 1],
    ['field-notes', 'Listening in the Upper East: Notes from the Field',
     'listening-in-the-upper-east',
     'Kwame Acheampong', 'Programme Officer', 'January 2026',
     'Three weeks in Bolgatanga, sitting with farmers, market women, and district officials — trying to understand what the data couldn\'t tell us. What I found challenged several assumptions I\'d carried into the trip.',
     1, 2],
    ['news', 'CRS Launches Climate Resilience Programme in the North',
     'crs-launches-climate-resilience-programme',
     'CRS Communications Team', null, 'December 2025',
     'We are pleased to announce the launch of our three-year climate resilience programme in the Northern Region, working alongside 24 communities.',
     1, 3],
    ['articles', 'The Problem With "Best Practices"',
     'the-problem-with-best-practices',
     'Efua Darko', 'Research Lead', 'November 2025',
     'The development sector loves best practices. They travel well in PowerPoint slides. But when you sit in Volta Region and try to apply what worked somewhere else — things get complicated fast.',
     1, 4],
    ['field-notes', 'What a Women\'s Susu Group Taught Me About Systems Change',
     'womens-susu-group-systems-change',
     'Ama Boateng', 'Gender Specialist', 'October 2025',
     'I went to document a savings group. What I witnessed was a sophisticated governance system — transparent, accountable, adaptive — that had evolved without any external design input.',
     1, 5],
    ['news', 'CRS Joins the Ghana Civil Society Platform on SDGs',
     'crs-joins-ghana-civil-society-platform-sdgs',
     'CRS Communications Team', null, 'September 2025',
     'CRS has formally joined the Ghana Civil Society Platform on Sustainable Development Goals, contributing our research and community engagement expertise to the national monitoring process.',
     1, 6],
  ];
  posts.forEach(p => insertPost.run(...p));
  console.log('✓ Blog posts seeded');
}

console.log('✓ Database initialised:', DB_PATH);
module.exports = db;
