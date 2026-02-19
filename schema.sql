-- StatusJolt Database Schema

-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  company TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  stripe_customer_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Status pages table
CREATE TABLE status_pages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE NOT NULL,
  custom_domain TEXT,
  description TEXT,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#3B82F6',
  is_public BOOLEAN DEFAULT true,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Components table (services being monitored)
CREATE TABLE components (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  status_page_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'operational' CHECK (status IN ('operational', 'degraded', 'partial_outage', 'major_outage')),
  position INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (status_page_id) REFERENCES status_pages(id) ON DELETE CASCADE
);

-- Incidents table
CREATE TABLE incidents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  status_page_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'investigating' CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  impact TEXT DEFAULT 'minor' CHECK (impact IN ('minor', 'major', 'critical')),
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (status_page_id) REFERENCES status_pages(id) ON DELETE CASCADE
);

-- Incident updates table
CREATE TABLE incident_updates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  incident_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
  message TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Component incidents relationship (many-to-many)
CREATE TABLE component_incidents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  component_id TEXT NOT NULL,
  incident_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(component_id, incident_id),
  FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE,
  FOREIGN KEY (incident_id) REFERENCES incidents(id) ON DELETE CASCADE
);

-- Subscribers table
CREATE TABLE subscribers (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  status_page_id TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  verified BOOLEAN DEFAULT false,
  verification_token TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(status_page_id, email),
  FOREIGN KEY (status_page_id) REFERENCES status_pages(id) ON DELETE CASCADE
);

-- Sessions table for authentication
CREATE TABLE sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX idx_status_pages_user_id ON status_pages(user_id);
CREATE INDEX idx_status_pages_subdomain ON status_pages(subdomain);
CREATE INDEX idx_components_status_page_id ON components(status_page_id);
CREATE INDEX idx_incidents_status_page_id ON incidents(status_page_id);
CREATE INDEX idx_incidents_created_at ON incidents(created_at DESC);
CREATE INDEX idx_incident_updates_incident_id ON incident_updates(incident_id);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_subscribers_status_page_id ON subscribers(status_page_id);

-- Initial data
INSERT INTO users (id, name, email, password_hash, company, plan) 
VALUES ('demo', 'Demo User', 'demo@statusjolt.com', '$2a$10$placeholder', 'StatusJolt', 'pro');

INSERT INTO status_pages (id, user_id, name, subdomain, description) 
VALUES ('demo-page', 'demo', 'StatusJolt Demo', 'demo', 'Demo status page showing StatusJolt features');

INSERT INTO components (status_page_id, name, description, status, position) VALUES
('demo-page', 'Website', 'Main website and marketing pages', 'operational', 1),
('demo-page', 'API', 'REST API and webhooks', 'operational', 2),
('demo-page', 'Database', 'Primary database cluster', 'operational', 3),
('demo-page', 'Payment Processing', 'Stripe payment processing', 'degraded', 4);

INSERT INTO incidents (id, status_page_id, title, description, status, impact, started_at) 
VALUES ('demo-incident', 'demo-page', 'Payment Processing Slowdown', 'We are experiencing slower than usual payment processing times. Our team is investigating the issue.', 'investigating', 'minor', datetime('now', '-2 hours'));

INSERT INTO incident_updates (incident_id, status, message) VALUES 
('demo-incident', 'investigating', 'We have identified increased latency in our payment processing system and are working to resolve the issue.');

INSERT INTO component_incidents (component_id, incident_id) 
VALUES ((SELECT id FROM components WHERE name = 'Payment Processing'), 'demo-incident');