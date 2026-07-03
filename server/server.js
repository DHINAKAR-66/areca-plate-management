const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'areca-plate-secret-key-2024';

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Ensure backups directory exists
const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

// Auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access denied' });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Helper: Log activity
const logActivity = (action, details, userId) => {
  db.run(`INSERT INTO activity_log (action, details, user_id) VALUES (?, ?, ?)`,
    [action, details, userId]);
};

// Helper: Get today's date string
const todayStr = () => new Date().toISOString().split('T')[0];

// ==================== AUTH ROUTES ====================

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Invalid credentials' });
    
    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    logActivity('Login', `${user.username} logged in`, user.id);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  db.get(`SELECT id, username, role, created_at FROM users WHERE id = ?`, [req.user.id], (err, user) => {
    if (err || !user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  });
});

// ==================== DASHBOARD ROUTES ====================

app.get('/api/dashboard', authenticate, (req, res) => {
  const today = todayStr();
  const result = {};
  
  // Current stock
  db.all(`
    SELECT ps.id, ps.size, ps.price, s.quantity 
    FROM plate_sizes ps 
    LEFT JOIN stock s ON ps.id = s.plate_size_id
    ORDER BY ps.id
  `, [], (err, stock) => {
    if (err) return res.status(500).json({ error: err.message });
    result.stock = stock;
    
    // Today's production
    db.all(`SELECT plate_size_id, SUM(quantity) as total FROM production WHERE date = ? GROUP BY plate_size_id`, [today], (err, prod) => {
      result.todayProduction = prod;
      
      // Today's sales (total plates and amount)
      db.all(`
        SELECT bi.plate_size_id, SUM(bi.quantity) as total_qty, SUM(bi.total) as total_amount
        FROM bill_items bi
        JOIN bills b ON bi.bill_id = b.id
        WHERE b.date = ?
        GROUP BY bi.plate_size_id
      `, [today], (err, sales) => {
        result.todaySales = sales;
        
        db.get(`SELECT SUM(total) as total FROM bills WHERE date = ?`, [today], (err, salesAmt) => {
          result.todaySalesAmount = salesAmt?.total || 0;
          
          db.get(`SELECT SUM(total) as total FROM bills WHERE payment_method = 'Cash' AND date = ?`, [today], (err, cash) => {
            result.todayCash = cash?.total || 0;
            
            db.get(`SELECT SUM(total) as total FROM bills WHERE payment_method = 'GPay / UPI' AND date = ?`, [today], (err, upi) => {
              result.todayUPI = upi?.total || 0;
              
              db.get(`SELECT daily_consumption FROM electricity_readings WHERE date = ?`, [today], (err, elec) => {
                result.todayElectricity = elec?.daily_consumption || 0;
                
                db.get(`SELECT SUM(total) as total FROM bills`, [], (err, revenue) => {
                  result.totalRevenue = revenue?.total || 0;
                  
                  // Recent activities
                  db.all(`SELECT al.*, u.username FROM activity_log al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT 10`, [], (err, activities) => {
                    result.recentActivities = activities;
                    
                    // Low stock warning (< 100)
                    const lowStock = stock.filter(s => s.quantity < 100);
                    result.lowStock = lowStock;
                    
                    res.json(result);
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

// Chart data
app.get('/api/dashboard/charts', authenticate, (req, res) => {
  const { range = '7days' } = req.query;
  let dateFilter = '';
  
  if (range === '7days') dateFilter = "date >= date('now', '-7 days')";
  else if (range === '30days') dateFilter = "date >= date('now', '-30 days')";
  else if (range === 'year') dateFilter = "date >= date('now', '-1 year')";
  else dateFilter = "1=1";
  
  db.all(`SELECT date, SUM(quantity) as total FROM production WHERE ${dateFilter} GROUP BY date ORDER BY date`, [], (err, production) => {
    db.all(`SELECT date, SUM(total) as total FROM bills WHERE ${dateFilter} GROUP BY date ORDER BY date`, [], (err, sales) => {
      db.all(`SELECT strftime('%Y-%m', date) as month, SUM(total) as total FROM bills WHERE ${dateFilter} GROUP BY month ORDER BY month`, [], (err, monthlySales) => {
        db.all(`SELECT date, daily_consumption FROM electricity_readings WHERE ${dateFilter} AND daily_consumption > 0 ORDER BY date`, [], (err, electricity) => {
          res.json({ production, sales, monthlySales, electricity });
        });
      });
    });
  });
});

// ==================== PRODUCTION ROUTES ====================

app.post('/api/production', authenticate, (req, res) => {
  const { date, items } = req.body; // items: [{plate_size_id, quantity}]
  
  if (!date || !items || !items.length) {
    return res.status(400).json({ error: 'Date and items required' });
  }
  
  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    items.forEach(item => {
      if (item.quantity > 0) {
        // Insert production record
        db.run(`INSERT INTO production (date, plate_size_id, quantity, created_by) VALUES (?, ?, ?, ?)`,
          [date, item.plate_size_id, item.quantity, req.user.id]);
        
        // Update stock
        db.run(`UPDATE stock SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE plate_size_id = ?`,
          [item.quantity, item.plate_size_id]);
        
        // Stock history
        db.run(`INSERT INTO stock_history (plate_size_id, quantity_change, reason, reference_type, created_by) VALUES (?, ?, ?, ?, ?)`,
          [item.plate_size_id, item.quantity, `Production on ${date}`, 'production', req.user.id]);
      }
    });
    
    db.run('COMMIT', (err) => {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      logActivity('Production Added', `Production recorded for ${date}`, req.user.id);
      res.json({ message: 'Production recorded successfully' });
    });
  });
});

app.get('/api/production', authenticate, (req, res) => {
  const { date, startDate, endDate } = req.query;
  let sql = `SELECT p.*, ps.size FROM production p JOIN plate_sizes ps ON p.plate_size_id = ps.id WHERE 1=1`;
  const params = [];
  
  if (date) {
    sql += ` AND p.date = ?`;
    params.push(date);
  }
  if (startDate && endDate) {
    sql += ` AND p.date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }
  sql += ` ORDER BY p.date DESC, p.created_at DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ==================== STOCK ROUTES ====================

app.get('/api/stock', authenticate, (req, res) => {
  db.all(`
    SELECT ps.id, ps.size, ps.price, s.quantity, s.updated_at
    FROM plate_sizes ps
    LEFT JOIN stock s ON ps.id = s.plate_size_id
    ORDER BY ps.id
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/stock/adjust', authenticate, (req, res) => {
  const { plate_size_id, quantity_change, reason } = req.body;
  
  if (!plate_size_id || quantity_change === undefined || !reason) {
    return res.status(400).json({ error: 'All fields required' });
  }
  
  db.get(`SELECT quantity FROM stock WHERE plate_size_id = ?`, [plate_size_id], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const currentQty = row?.quantity || 0;
    const newQty = currentQty + quantity_change;
    
    if (newQty < 0) {
      return res.status(400).json({ error: 'Stock cannot be negative' });
    }
    
    db.run(`UPDATE stock SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE plate_size_id = ?`,
      [newQty, plate_size_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        db.run(`INSERT INTO stock_history (plate_size_id, quantity_change, reason, reference_type, created_by) VALUES (?, ?, ?, ?, ?)`,
          [plate_size_id, quantity_change, reason, 'adjustment', req.user.id]);
        
        logActivity('Stock Adjusted', `Stock adjusted by ${quantity_change} for plate size ${plate_size_id}`, req.user.id);
        res.json({ message: 'Stock adjusted', new_quantity: newQty });
      });
  });
});

app.get('/api/stock/history', authenticate, (req, res) => {
  db.all(`
    SELECT sh.*, ps.size, u.username
    FROM stock_history sh
    JOIN plate_sizes ps ON sh.plate_size_id = ps.id
    LEFT JOIN users u ON sh.created_by = u.id
    ORDER BY sh.created_at DESC
    LIMIT 100
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ==================== BILLING ROUTES ====================

app.post('/api/bills', authenticate, (req, res) => {
  const { date, customer_name, customer_mobile, payment_method, items } = req.body;
  
  if (!date || !items || !items.length) {
    return res.status(400).json({ error: 'Date and items required' });
  }
  
  // Validate stock availability
  const stockChecks = items.map(item => new Promise((resolve, reject) => {
    db.get(`SELECT quantity FROM stock WHERE plate_size_id = ?`, [item.plate_size_id], (err, row) => {
      if (err) return reject(err);
      if (!row || row.quantity < item.quantity) {
        return reject({ message: `Insufficient stock for ${item.plate_size_id}`, available: row?.quantity || 0 });
      }
      resolve(row.quantity);
    });
  }));
  
  Promise.all(stockChecks)
    .then(() => {
      // Generate bill number
      const billNumber = `BILL-${Date.now()}`;
      let subtotal = 0;
      items.forEach(item => {
        subtotal += item.quantity * item.price_per_unit;
      });
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        db.run(`INSERT INTO bills (bill_number, date, customer_name, customer_mobile, payment_method, subtotal, total, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [billNumber, date, customer_name || null, customer_mobile || null, payment_method || 'Cash', subtotal, subtotal, req.user.id],
          function(err) {
            if (err) {
              db.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            
            const billId = this.lastID;
            
            items.forEach(item => {
              const itemTotal = item.quantity * item.price_per_unit;
              db.run(`INSERT INTO bill_items (bill_id, plate_size_id, quantity, price_per_unit, total) VALUES (?, ?, ?, ?, ?)`,
                [billId, item.plate_size_id, item.quantity, item.price_per_unit, itemTotal]);
              
              // Decrease stock
              db.run(`UPDATE stock SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP WHERE plate_size_id = ?`,
                [item.quantity, item.plate_size_id]);
              
              // Stock history
              db.run(`INSERT INTO stock_history (plate_size_id, quantity_change, reason, reference_type, reference_id, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
                [item.plate_size_id, -item.quantity, `Bill ${billNumber}`, 'sale', billId, req.user.id]);
            });
            
            db.run('COMMIT', (err) => {
              if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: err.message });
              }
              logActivity('Bill Created', `Bill ${billNumber} created`, req.user.id);
              res.json({ message: 'Bill created', bill_id: billId, bill_number: billNumber });
            });
          });
      });
    })
    .catch(err => {
      res.status(400).json({ error: err.message || err });
    });
});

app.get('/api/bills', authenticate, (req, res) => {
  const { search, date, payment_method, page = 1, limit = 20 } = req.query;
  let sql = `SELECT b.*, u.username as created_by_name FROM bills b LEFT JOIN users u ON b.created_by = u.id WHERE 1=1`;
  const params = [];
  
  if (search) {
    sql += ` AND (b.bill_number LIKE ? OR b.customer_name LIKE ? OR b.customer_mobile LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (date) {
    sql += ` AND b.date = ?`;
    params.push(date);
  }
  if (payment_method) {
    sql += ` AND b.payment_method = ?`;
    params.push(payment_method);
  }
  sql += ` ORDER BY b.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/bills/:id', authenticate, (req, res) => {
  const { id } = req.params;
  
  db.get(`SELECT b.*, u.username as created_by_name FROM bills b LEFT JOIN users u ON b.created_by = u.id WHERE b.id = ?`, [id], (err, bill) => {
    if (err || !bill) return res.status(404).json({ error: 'Bill not found' });
    
    db.all(`SELECT bi.*, ps.size FROM bill_items bi JOIN plate_sizes ps ON bi.plate_size_id = ps.id WHERE bi.bill_id = ?`, [id], (err, items) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...bill, items });
    });
  });
});

app.put('/api/bills/:id', authenticate, (req, res) => {
  const { id } = req.params;
  const { customer_name, customer_mobile, payment_method } = req.body;
  
  db.run(`UPDATE bills SET customer_name = ?, customer_mobile = ?, payment_method = ? WHERE id = ?`,
    [customer_name, customer_mobile, payment_method, id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logActivity('Bill Updated', `Bill ${id} updated`, req.user.id);
      res.json({ message: 'Bill updated' });
    });
});

app.delete('/api/bills/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  
  // First restore stock
  db.all(`SELECT plate_size_id, quantity FROM bill_items WHERE bill_id = ?`, [id], (err, items) => {
    if (err) return res.status(500).json({ error: err.message });
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      items.forEach(item => {
        db.run(`UPDATE stock SET quantity = quantity + ? WHERE plate_size_id = ?`, [item.quantity, item.plate_size_id]);
        db.run(`INSERT INTO stock_history (plate_size_id, quantity_change, reason, reference_type, created_by) VALUES (?, ?, ?, ?, ?)`,
          [item.plate_size_id, item.quantity, `Bill deleted - stock restored`, 'adjustment', req.user.id]);
      });
      
      db.run(`DELETE FROM bills WHERE id = ?`, [id], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        
        db.run('COMMIT', (err) => {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          logActivity('Bill Deleted', `Bill ${id} deleted`, req.user.id);
          res.json({ message: 'Bill deleted and stock restored' });
        });
      });
    });
  });
});

// ==================== ELECTRICITY ROUTES ====================

app.post('/api/electricity', authenticate, (req, res) => {
  const { date, meter_reading } = req.body;
  
  if (!date || meter_reading === undefined) {
    return res.status(400).json({ error: 'Date and meter reading required' });
  }
  
  if (meter_reading < 0) {
    return res.status(400).json({ error: 'Meter reading cannot be negative' });
  }
  
  // Get previous reading
  db.get(`SELECT meter_reading FROM electricity_readings WHERE date < ? ORDER BY date DESC LIMIT 1`, [date], (err, prev) => {
    const prevReading = prev ? prev.meter_reading : 0;
    
    if (meter_reading < prevReading) {
      return res.status(400).json({ error: 'Meter reading cannot be less than previous reading' });
    }
    
    const dailyConsumption = prevReading > 0 ? meter_reading - prevReading : 0;
    
    db.run(`INSERT OR REPLACE INTO electricity_readings (date, meter_reading, daily_consumption, created_by) VALUES (?, ?, ?, ?)`,
      [date, meter_reading, dailyConsumption, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Recalculate future readings
        recalculateElectricity(date);
        
        logActivity('Electricity Reading', `Meter reading ${meter_reading} for ${date}`, req.user.id);
        res.json({ message: 'Reading saved', daily_consumption: dailyConsumption });
      });
  });
});

function recalculateElectricity(fromDate) {
  db.all(`SELECT * FROM electricity_readings WHERE date >= ? ORDER BY date`, [fromDate], (err, rows) => {
    if (err || !rows.length) return;
    
    for (let i = 1; i < rows.length; i++) {
      const consumption = rows[i].meter_reading - rows[i-1].meter_reading;
      db.run(`UPDATE electricity_readings SET daily_consumption = ? WHERE id = ?`, [consumption, rows[i].id]);
    }
  });
}

app.get('/api/electricity', authenticate, (req, res) => {
  const { startDate, endDate } = req.query;
  let sql = `SELECT * FROM electricity_readings WHERE 1=1`;
  const params = [];
  
  if (startDate && endDate) {
    sql += ` AND date BETWEEN ? AND ?`;
    params.push(startDate, endDate);
  }
  sql += ` ORDER BY date DESC`;
  
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/electricity/summary', authenticate, (req, res) => {
  db.get(`SELECT SUM(daily_consumption) as total FROM electricity_readings WHERE strftime('%Y-%m', date) = strftime('%Y-%m', 'now')`, [], (err, monthly) => {
    db.get(`SELECT SUM(daily_consumption) as total FROM electricity_readings WHERE strftime('%Y', date) = strftime('%Y', 'now')`, [], (err, yearly) => {
      res.json({ monthly: monthly?.total || 0, yearly: yearly?.total || 0 });
    });
  });
});

// ==================== REPORTS ROUTES ====================

app.get('/api/reports', authenticate, (req, res) => {
  const { type, startDate, endDate } = req.query; // type: daily, weekly, monthly, yearly
  
  let dateFilter = '';
  if (startDate && endDate) {
    dateFilter = `date BETWEEN '${startDate}' AND '${endDate}'`;
  } else {
    switch(type) {
      case 'daily': dateFilter = `date = date('now')`; break;
      case 'weekly': dateFilter = `date >= date('now', '-7 days')`; break;
      case 'monthly': dateFilter = `date >= date('now', '-30 days')`; break;
      case 'yearly': dateFilter = `date >= date('now', '-1 year')`; break;
      default: dateFilter = `1=1`;
    }
  }
  
  const result = {};
  
  db.all(`SELECT date, plate_size_id, SUM(quantity) as total FROM production WHERE ${dateFilter} GROUP BY date, plate_size_id ORDER BY date`, [], (err, production) => {
    result.production = production;
    
    db.all(`SELECT date, SUM(total) as total, COUNT(*) as bill_count FROM bills WHERE ${dateFilter} GROUP BY date ORDER BY date`, [], (err, sales) => {
      result.sales = sales;
      
      db.all(`SELECT payment_method, SUM(total) as total FROM bills WHERE ${dateFilter} GROUP BY payment_method`, [], (err, paymentMethods) => {
        result.paymentMethods = paymentMethods;
        
        db.all(`SELECT ps.size, s.quantity FROM plate_sizes ps LEFT JOIN stock s ON ps.id = s.plate_size_id`, [], (err, stock) => {
          result.stock = stock;
          
          db.all(`SELECT date, daily_consumption FROM electricity_readings WHERE ${dateFilter} AND daily_consumption > 0 ORDER BY date`, [], (err, electricity) => {
            result.electricity = electricity;
            res.json(result);
          });
        });
      });
    });
  });
});

// ==================== PLATE SIZES / PRICES ====================

app.get('/api/plate-sizes', authenticate, (req, res) => {
  db.all(`SELECT * FROM plate_sizes ORDER BY id`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/plate-sizes/:id', authenticate, requireAdmin, (req, res) => {
  const { id } = req.params;
  const { price } = req.body;
  
  db.run(`UPDATE plate_sizes SET price = ? WHERE id = ?`, [price, id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    logActivity('Price Updated', `Price updated for plate size ${id}`, req.user.id);
    res.json({ message: 'Price updated' });
  });
});

// ==================== BACKUP & RESTORE ====================

app.post('/api/backup', authenticate, requireAdmin, (req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupDir, `backup-${timestamp}.db`);
  
  fs.copyFile(dbPath, backupFile, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    logActivity('Backup Created', `Backup created: backup-${timestamp}.db`, req.user.id);
    res.json({ message: 'Backup created', file: `backup-${timestamp}.db` });
  });
});

app.get('/api/backups', authenticate, requireAdmin, (req, res) => {
  fs.readdir(backupDir, (err, files) => {
    if (err) return res.status(500).json({ error: err.message });
    const backups = files.filter(f => f.endsWith('.db')).map(f => ({
      name: f,
      date: fs.statSync(path.join(backupDir, f)).mtime
    }));
    res.json(backups);
  });
});

app.post('/api/restore/:filename', authenticate, requireAdmin, (req, res) => {
  const { filename } = req.params;
  const backupFile = path.join(backupDir, filename);
  
  if (!fs.existsSync(backupFile)) {
    return res.status(404).json({ error: 'Backup file not found' });
  }
  
  // Close current db connection
  db.close((err) => {
    if (err) return res.status(500).json({ error: err.message });
    
    fs.copyFile(backupFile, dbPath, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      
      // Reopen database
      const newDb = require('./database');
      logActivity('Backup Restored', `Backup restored: ${filename}`, req.user.id);
      res.json({ message: 'Backup restored successfully. Please restart server.' });
    });
  });
});

// ==================== ACTIVITY LOG ====================

app.get('/api/activities', authenticate, (req, res) => {
  db.all(`SELECT al.*, u.username FROM activity_log al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT 50`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// ==================== SETTINGS ====================

app.get('/api/settings', authenticate, (req, res) => {
  db.all(`SELECT * FROM settings`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const settings = {};
    rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  });
});

app.post('/api/settings', authenticate, requireAdmin, (req, res) => {
  const { key, value } = req.body;
  db.run(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Setting saved' });
  });
});

// ==================== USERS ====================

app.get('/api/users', authenticate, requireAdmin, (req, res) => {
  db.all(`SELECT id, username, role, created_at FROM users`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/users', authenticate, requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  const hashed = bcrypt.hashSync(password, 10);
  
  db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
    [username, hashed, role || 'staff'], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      logActivity('User Created', `User ${username} created`, req.user.id);
      res.json({ message: 'User created', id: this.lastID });
    });
});

// ==================== SERVE FRONTEND IN PRODUCTION ====================

const clientBuildPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientBuildPath, 'index.html'));
    }
  });
}

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;