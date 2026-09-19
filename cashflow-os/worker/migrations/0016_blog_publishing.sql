-- First-party Runway Systems Blog publishing, revisions, reusable media, stable
-- canonical redirects, and durable publication side effects.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS blog_categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_media (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  public_path TEXT NOT NULL UNIQUE,
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  byte_size INTEGER NOT NULL CHECK (byte_size BETWEEN 64 AND 5242880),
  width INTEGER NOT NULL CHECK (width BETWEEN 1 AND 6000),
  height INTEGER NOT NULL CHECK (height BETWEEN 1 AND 6000),
  sha256 TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  original_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'quarantined', 'trashed')),
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body_markdown TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'published', 'archived')),
  layout TEXT NOT NULL DEFAULT 'editorial' CHECK (layout IN ('editorial', 'tutorial', 'field-note', 'case-study')),
  category_id TEXT REFERENCES blog_categories(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL DEFAULT 'Runway Systems',
  cover_media_id TEXT REFERENCES blog_media(id) ON DELETE SET NULL,
  seo_title TEXT NOT NULL DEFAULT '',
  seo_description TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  scheduled_at TEXT,
  first_published_at TEXT,
  published_at TEXT,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  CHECK (status != 'scheduled' OR scheduled_at IS NOT NULL),
  CHECK (status != 'published' OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS blog_tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_post_tags (
  post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE IF NOT EXISTS blog_post_media (
  post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  media_id TEXT NOT NULL REFERENCES blog_media(id) ON DELETE RESTRICT,
  role TEXT NOT NULL CHECK (role IN ('cover', 'inline')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (post_id, media_id, role)
);

CREATE TABLE IF NOT EXISTS blog_post_revisions (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  reason TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (post_id, version, reason)
);

CREATE TABLE IF NOT EXISTS blog_slug_redirects (
  old_slug TEXT PRIMARY KEY COLLATE NOCASE,
  post_id TEXT NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  created_by_user_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS blog_publication_outbox (
  id TEXT PRIMARY KEY,
  post_id TEXT REFERENCES blog_posts(id) ON DELETE SET NULL,
  post_version INTEGER NOT NULL DEFAULT 0,
  event_type TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  next_attempt_at TEXT NOT NULL,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_public
  ON blog_posts(status, published_at DESC, updated_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_schedule
  ON blog_posts(status, scheduled_at)
  WHERE status = 'scheduled' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_blog_posts_admin
  ON blog_posts(deleted_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category
  ON blog_posts(category_id, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_media_status
  ON blog_media(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_media_hash
  ON blog_media(sha256);
CREATE INDEX IF NOT EXISTS idx_blog_revisions_post
  ON blog_post_revisions(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_outbox_pending
  ON blog_publication_outbox(processed_at, next_attempt_at);

INSERT OR IGNORE INTO blog_categories (id, slug, name, description, sort_order, active, created_at, updated_at) VALUES
  ('blog-category-finance', 'finance', 'Finance', 'Cash flow, forecasting, pricing, and financial operating rhythms.', 10, 1, datetime('now'), datetime('now')),
  ('blog-category-clients', 'clients', 'Clients', 'Client relationships, pipelines, onboarding, and retention.', 20, 1, datetime('now'), datetime('now')),
  ('blog-category-projects', 'projects', 'Projects', 'Planning, delivery, capacity, and project control.', 30, 1, datetime('now'), datetime('now')),
  ('blog-category-invoicing', 'invoicing', 'Invoicing', 'Billing, collections, and payment operations.', 40, 1, datetime('now'), datetime('now')),
  ('blog-category-operations', 'operations', 'Operations', 'Calmer systems for running an independent business.', 50, 1, datetime('now'), datetime('now'));
