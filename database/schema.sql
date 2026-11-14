-- ============================================================================
-- Kora Residency — Hostel & PG Management Database Schema
-- Compatible with SQLite 3 (and easily portable to PostgreSQL)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Rooms Table: Stores physical room inventory, pricing, and configuration
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_number TEXT NOT NULL UNIQUE,
  floor INTEGER NOT NULL DEFAULT 1,
  sharing_type TEXT NOT NULL CHECK (sharing_type IN ('Single', 'Double', 'Triple')),
  ac_type TEXT NOT NULL CHECK (ac_type IN ('AC', 'Non-AC')),
  monthly_rent INTEGER NOT NULL CHECK (monthly_rent >= 0),
  security_deposit INTEGER NOT NULL CHECK (security_deposit >= 0),
  total_beds INTEGER NOT NULL CHECK (total_beds BETWEEN 1 AND 6),
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '',
  amenities_list TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Maintenance')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Tenants Table: Digital onboarding, KYC records, emergency contacts, deposits
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  kyc_id_type TEXT NOT NULL CHECK (kyc_id_type IN ('Aadhaar', 'Passport', 'Driving License', 'PAN')),
  kyc_id_number TEXT NOT NULL,
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  occupation_or_college TEXT NOT NULL DEFAULT '',
  check_in_date TEXT NOT NULL,
  check_out_date TEXT,
  security_deposit_paid INTEGER NOT NULL DEFAULT 0,
  deposit_status TEXT NOT NULL DEFAULT 'Held' CHECK (deposit_status IN ('Held', 'Pending', 'Refunded')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Checked Out')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 3. Beds Table: Individual bed slots per room with automated occupancy mapping
CREATE TABLE IF NOT EXISTS beds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_label TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Vacant' CHECK (status IN ('Vacant', 'Occupied', 'Reserved')),
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  UNIQUE(room_id, bed_label)
);

-- 4. Users Table: Portal authentication for Admins and Resident Tenants
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'tenant')),
  full_name TEXT NOT NULL,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Invoices Table: Monthly rent billing, utilities, payment tracking
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL UNIQUE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  billing_month TEXT NOT NULL,
  rent_amount INTEGER NOT NULL CHECK (rent_amount >= 0),
  electricity_amount INTEGER NOT NULL DEFAULT 0 CHECK (electricity_amount >= 0),
  other_charges INTEGER NOT NULL DEFAULT 0 CHECK (other_charges >= 0),
  total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
  due_date TEXT NOT NULL,
  paid_date TEXT,
  payment_method TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending', 'Overdue')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(tenant_id, billing_month)
);

-- 6. Expenses Table: Property operations, mess groceries, utilities, and repairs
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Groceries & Mess', 'Utilities', 'Maintenance', 'Housekeeping', 'Internet & Security', 'Other')),
  description TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  recorded_by TEXT NOT NULL DEFAULT 'Admin',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 7. Complaints Table: Resident maintenance, Wi-Fi, housekeeping, and food tickets
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number TEXT NOT NULL UNIQUE,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  category TEXT NOT NULL CHECK (category IN ('Maintenance', 'Food & Mess', 'Wi-Fi & IT', 'Housekeeping', 'Security')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  assigned_to TEXT NOT NULL DEFAULT 'Unassigned',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
  admin_notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 8. Inquiries Table: Public landing page visit bookings & callback leads
CREATE TABLE IF NOT EXISTS inquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  preferred_sharing TEXT NOT NULL CHECK (preferred_sharing IN ('Single', 'Double', 'Triple')),
  preferred_ac TEXT NOT NULL CHECK (preferred_ac IN ('AC', 'Non-AC')),
  visit_date TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Scheduled', 'Converted', 'Closed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 9. Mess Menu Table: Weekly dining schedule editable from Admin CMS
CREATE TABLE IF NOT EXISTS mess_menu (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day_of_week TEXT NOT NULL UNIQUE CHECK (day_of_week IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  breakfast TEXT NOT NULL,
  lunch TEXT NOT NULL,
  evening_snack TEXT NOT NULL,
  dinner TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 10. Announcements Table: Notices published to public site & resident portal
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'All Residents' CHECK (audience IN ('All Residents', 'Public & Residents')),
  pinned INTEGER NOT NULL DEFAULT 0 CHECK (pinned IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 11. CMS Content Table: Key-value website copy and hero configuration
CREATE TABLE IF NOT EXISTS cms_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 12. Gallery Photos Table: Property showcase imagery managed from Admin CMS
CREATE TABLE IF NOT EXISTS gallery_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Rooms', 'Common Areas', 'Dining', 'Exterior')),
  image_url TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Helpful Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_beds_room_id ON beds(room_id);
CREATE INDEX IF NOT EXISTS idx_beds_tenant_id ON beds(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_complaints_tenant_id ON complaints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
