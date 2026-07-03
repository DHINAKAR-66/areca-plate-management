const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'areca_plates.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log('Connected to SQLite database');
    initializeDatabase();
  }
});

function initializeDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'staff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Plate sizes (fixed)
    db.run(`CREATE TABLE IF NOT EXISTS plate_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      size TEXT UNIQUE NOT NULL,
      price REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Stock
    db.run(`CREATE TABLE IF NOT EXISTS stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate_size_id INTEGER NOT NULL UNIQUE,
      quantity INTEGER DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plate_size_id) REFERENCES plate_sizes(id)
    )`);

    // Stock history
    db.run(`CREATE TABLE IF NOT EXISTS stock_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plate_size_id INTEGER NOT NULL,
      quantity_change INTEGER NOT NULL,
      reason TEXT,
      reference_type TEXT,
      reference_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plate_size_id) REFERENCES plate_sizes(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    // Production
    db.run(`CREATE TABLE IF NOT EXISTS production (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      plate_size_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (plate_size_id) REFERENCES plate_sizes(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    // Bills
    db.run(`CREATE TABLE IF NOT EXISTS bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_number TEXT UNIQUE NOT NULL,
      date TEXT NOT NULL,
      customer_name TEXT,
      customer_mobile TEXT,
      payment_method TEXT DEFAULT 'Cash',
      subtotal REAL DEFAULT 0,
      total REAL DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    // Bill items
    db.run(`CREATE TABLE IF NOT EXISTS bill_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bill_id INTEGER NOT NULL,
      plate_size_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_per_unit REAL NOT NULL,
      total REAL NOT NULL,
      FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY (plate_size_id) REFERENCES plate_sizes(id)
    )`);

    // Electricity readings
    db.run(`CREATE TABLE IF NOT EXISTS electricity_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      meter_reading REAL NOT NULL,
      daily_consumption REAL DEFAULT 0,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`);

    // Activity log
    db.run(`CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT,
      user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    // Settings
    db.run(`CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Insert default plate sizes if not exists
    const sizes = ['6 inch', '8 inch', '10 inch', '12 inch'];
    const stmt = db.prepare(`INSERT OR IGNORE INTO plate_sizes (size, price) VALUES (?, ?)`);
    sizes.forEach(size => {
      stmt.run(size, size === '6 inch' ? 3 : size === '8 inch' ? 5 : size === '10 inch' ? 7 : 9);
    });
    stmt.finalize();

    // Initialize stock if not exists
    db.all(`SELECT id FROM plate_sizes`, [], (err, rows) => {
      if (!err && rows) {
        rows.forEach(row => {
          db.run(`INSERT OR IGNORE INTO stock (plate_size_id, quantity) VALUES (?, 0)`, [row.id]);
        });
      }
    });

    // Create default admin user
    const adminPassword = bcrypt.hashSync('admin123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`, 
      ['admin', adminPassword, 'admin']);
    
    // Create default staff user
    const staffPassword = bcrypt.hashSync('staff123', 10);
    db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES (?, ?, ?)`, 
      ['staff', staffPassword, 'staff']);

    console.log('Database initialized successfully');
  });
}

module.exports = db;