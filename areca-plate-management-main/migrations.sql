CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS plate_sizes (
  id SERIAL PRIMARY KEY,
  size TEXT UNIQUE NOT NULL,
  price REAL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS stock (
  id SERIAL PRIMARY KEY,
  plate_size_id INTEGER NOT NULL UNIQUE,
  quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plate_size_id) REFERENCES plate_sizes(id)
);

CREATE TABLE IF NOT EXISTS stock_history (
  id SERIAL PRIMARY KEY,
  plate_size_id INTEGER NOT NULL,
  quantity_change INTEGER NOT NULL,
  reason TEXT,
  reference_type TEXT,
  reference_id INTEGER,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plate_size_id) REFERENCES plate_sizes(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS production (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  plate_size_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (plate_size_id) REFERENCES plate_sizes(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  bill_number TEXT UNIQUE NOT NULL,
  date TEXT NOT NULL,
  customer_name TEXT,
  customer_mobile TEXT,
  payment_method TEXT DEFAULT 'Cash',
  subtotal REAL DEFAULT 0,
  total REAL DEFAULT 0,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS bill_items (
  id SERIAL PRIMARY KEY,
  bill_id INTEGER NOT NULL,
  plate_size_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price_per_unit REAL NOT NULL,
  total REAL NOT NULL,
  FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
  FOREIGN KEY (plate_size_id) REFERENCES plate_sizes(id)
);

CREATE TABLE IF NOT EXISTS electricity_readings (
  id SERIAL PRIMARY KEY,
  date TEXT UNIQUE NOT NULL,
  meter_reading REAL NOT NULL,
  daily_consumption REAL DEFAULT 0,
  created_by INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  details TEXT,
  user_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
