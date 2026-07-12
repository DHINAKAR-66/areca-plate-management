require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 5000;
if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined in the environment. Please set it in your .env file.');
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());




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
  db.query(`INSERT INTO activity_log (action, details, user_id) VALUES ($1, $2, $3)`,
    [action, details, userId])
    .catch(err => console.error('Failed to log activity:', err));
};

// Helper: Get today's date string
const todayStr = () => new Date().toISOString().split('T')[0];

// ==================== AUTH ROUTES ====================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await db.query(`SELECT * FROM users WHERE username = $1`, [username]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    logActivity('Login', `${user.username} logged in`, user.id);
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const result = await db.query(`SELECT id, username, role, created_at FROM users WHERE id = $1`, [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== DASHBOARD ROUTES ====================

app.get('/api/dashboard', authenticate, async (req, res) => {
  try {
    const today = todayStr();
    const result = {};

    // Current stock
    const stockResult = await db.query(`
      SELECT ps.id, ps.size, ps.price, s.quantity 
      FROM plate_sizes ps 
      LEFT JOIN stock s ON ps.id = s.plate_size_id
      ORDER BY ps.id
    `);
    const stock = stockResult.rows;
    result.stock = stock;

    // Today's production
    const prodResult = await db.query(`SELECT plate_size_id, SUM(quantity)::INTEGER as total FROM production WHERE date = $1 GROUP BY plate_size_id`, [today]);
    result.todayProduction = prodResult.rows;

    // Today's sales (total plates and amount)
    const salesResult = await db.query(`
      SELECT bi.plate_size_id, SUM(bi.quantity)::INTEGER as total_qty, SUM(bi.total)::REAL as total_amount
      FROM bill_items bi
      JOIN bills b ON bi.bill_id = b.id
      WHERE b.date = $1
      GROUP BY bi.plate_size_id
    `, [today]);
    result.todaySales = salesResult.rows;

    const salesAmtResult = await db.query(`SELECT SUM(total)::REAL as total FROM bills WHERE date = $1`, [today]);
    result.todaySalesAmount = salesAmtResult.rows[0]?.total || 0;

    const cashResult = await db.query(`SELECT SUM(total)::REAL as total FROM bills WHERE payment_method = 'Cash' AND date = $1`, [today]);
    result.todayCash = cashResult.rows[0]?.total || 0;

    const upiResult = await db.query(`SELECT SUM(total)::REAL as total FROM bills WHERE payment_method = 'GPay / UPI' AND date = $1`, [today]);
    result.todayUPI = upiResult.rows[0]?.total || 0;

    const elecResult = await db.query(`SELECT daily_consumption FROM electricity_readings WHERE date = $1`, [today]);
    result.todayElectricity = elecResult.rows[0]?.daily_consumption || 0;

    const revenueResult = await db.query(`SELECT SUM(total)::REAL as total FROM bills`);
    result.totalRevenue = revenueResult.rows[0]?.total || 0;

    // Recent activities
    const activitiesResult = await db.query(`SELECT al.*, u.username FROM activity_log al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT 10`);
    result.recentActivities = activitiesResult.rows;

    // Low stock warning (< 100)
    const lowStock = stock.filter(s => s.quantity < 100);
    result.lowStock = lowStock;

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Chart data
app.get('/api/dashboard/charts', authenticate, async (req, res) => {
  try {
    const { range = '7days' } = req.query;
    let dateFilter = '';

    if (range === '7days') dateFilter = "date >= to_char(CURRENT_DATE - INTERVAL '7 days', 'YYYY-MM-DD')";
    else if (range === '30days') dateFilter = "date >= to_char(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')";
    else if (range === 'year') dateFilter = "date >= to_char(CURRENT_DATE - INTERVAL '1 year', 'YYYY-MM-DD')";
    else dateFilter = "1=1";

    const productionResult = await db.query(`SELECT date, SUM(quantity)::INTEGER as total FROM production WHERE ${dateFilter} GROUP BY date ORDER BY date`);
    const salesResult = await db.query(`SELECT date, SUM(total)::REAL as total FROM bills WHERE ${dateFilter} GROUP BY date ORDER BY date`);
    const monthlySalesResult = await db.query(`SELECT substring(date, 1, 7) as month, SUM(total)::REAL as total FROM bills WHERE ${dateFilter} GROUP BY month ORDER BY month`);
    const electricityResult = await db.query(`SELECT date, daily_consumption FROM electricity_readings WHERE ${dateFilter} AND daily_consumption > 0 ORDER BY date`);

    res.json({ production: productionResult.rows, sales: salesResult.rows, monthlySales: monthlySalesResult.rows, electricity: electricityResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PRODUCTION ROUTES ====================

app.post('/api/production', authenticate, async (req, res) => {
  const { date, items } = req.body; // items: [{plate_size_id, quantity}]

  if (!date || !items || !items.length) {
    return res.status(400).json({ error: 'Date and items required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of items) {
      if (item.quantity > 0) {
        // Insert production record
        await client.query(`INSERT INTO production (date, plate_size_id, quantity, created_by) VALUES ($1, $2, $3, $4)`,
          [date, item.plate_size_id, item.quantity, req.user.id]);

        // Update stock (upsert)
        await client.query(`
          INSERT INTO stock (plate_size_id, quantity) 
          VALUES ($2, $1)
          ON CONFLICT (plate_size_id) 
          DO UPDATE SET quantity = stock.quantity + $1, updated_at = CURRENT_TIMESTAMP
        `, [item.quantity, item.plate_size_id]);

        // Stock history
        await client.query(`INSERT INTO stock_history (plate_size_id, quantity_change, reason, reference_type, created_by) VALUES ($1, $2, $3, $4, $5)`,
          [item.plate_size_id, item.quantity, `Production on ${date}`, 'production', req.user.id]);
      }
    }

    await client.query('COMMIT');
    logActivity('Production Added', `Production recorded for ${date}`, req.user.id);
    res.json({ message: 'Production recorded successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/production', authenticate, async (req, res) => {
  try {
    const { date, startDate, endDate } = req.query;
    let sql = `SELECT p.*, ps.size FROM production p JOIN plate_sizes ps ON p.plate_size_id = ps.id WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (date) {
      sql += ` AND p.date = $${paramIndex++}`;
      params.push(date);
    }
    if (startDate && endDate) {
      sql += ` AND p.date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(startDate, endDate);
    }
    sql += ` ORDER BY p.date DESC, p.created_at DESC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== STOCK ROUTES ====================

app.get('/api/stock', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT ps.id, ps.size, ps.price, s.quantity, s.updated_at
      FROM plate_sizes ps
      LEFT JOIN stock s ON ps.id = s.plate_size_id
      ORDER BY ps.id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stock/adjust', authenticate, requireAdmin, async (req, res) => {
  try {
    const { plate_size_id, quantity_change, reason } = req.body;

    if (!plate_size_id || quantity_change === undefined || !reason) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const stockResult = await db.query(`SELECT quantity FROM stock WHERE plate_size_id = $1`, [plate_size_id]);
    const row = stockResult.rows[0];

    const currentQty = row?.quantity || 0;
    const newQty = currentQty + quantity_change;

    if (newQty < 0) {
      return res.status(400).json({ error: 'Stock cannot be negative' });
    }

    await db.query(`
      INSERT INTO stock (plate_size_id, quantity)
      VALUES ($2, $1)
      ON CONFLICT (plate_size_id)
      DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = CURRENT_TIMESTAMP
    `, [newQty, plate_size_id]);

    await db.query(`INSERT INTO stock_history (plate_size_id, quantity_change, reason, reference_type, created_by) VALUES ($1, $2, $3, $4, $5)`,
      [plate_size_id, quantity_change, reason, 'adjustment', req.user.id]);

    logActivity('Stock Adjusted', `Stock adjusted by ${quantity_change} for plate size ${plate_size_id}`, req.user.id);
    res.json({ message: 'Stock adjusted', new_quantity: newQty });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stock/history', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT sh.*, ps.size, u.username
      FROM stock_history sh
      JOIN plate_sizes ps ON sh.plate_size_id = ps.id
      LEFT JOIN users u ON sh.created_by = u.id
      ORDER BY sh.created_at DESC
      LIMIT 100
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== BILLING ROUTES ====================

app.post('/api/bills', authenticate, async (req, res) => {
  const { date, customer_name, customer_mobile, payment_method, items } = req.body;

  if (!date || !items || !items.length) {
    return res.status(400).json({ error: 'Date and items required' });
  }

  // Validate stock availability (pre-check, outside transaction)
  try {
    for (const item of items) {
      const stockResult = await db.query(`SELECT quantity FROM stock WHERE plate_size_id = $1`, [item.plate_size_id]);
      const row = stockResult.rows[0];
      if (!row || row.quantity < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${item.plate_size_id}`, available: row?.quantity || 0 });
      }
    }
  } catch (err) {
    return res.status(400).json({ error: err.message || err });
  }

  // Generate bill number
  const billNumber = `BILL-${Date.now()}`;
  let subtotal = 0;
  items.forEach(item => {
    subtotal += item.quantity * item.price_per_unit;
  });

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const billResult = await client.query(`INSERT INTO bills (bill_number, date, customer_name, customer_mobile, payment_method, subtotal, total, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [billNumber, date, customer_name || null, customer_mobile || null, payment_method || 'Cash', subtotal, subtotal, req.user.id]);

    const billId = billResult.rows[0].id;

    for (const item of items) {
      const itemTotal = item.quantity * item.price_per_unit;
      await client.query(`INSERT INTO bill_items (bill_id, plate_size_id, quantity, price_per_unit, total) VALUES ($1, $2, $3, $4, $5)`,
        [billId, item.plate_size_id, item.quantity, item.price_per_unit, itemTotal]);

      // Decrease stock
      await client.query(`UPDATE stock SET quantity = quantity - $1, updated_at = CURRENT_TIMESTAMP WHERE plate_size_id = $2`,
        [item.quantity, item.plate_size_id]);

      // Stock history
      await client.query(`INSERT INTO stock_history (plate_size_id, quantity_change, reason, reference_type, reference_id, created_by) VALUES ($1, $2, $3, $4, $5, $6)`,
        [item.plate_size_id, -item.quantity, `Bill ${billNumber}`, 'sale', billId, req.user.id]);
    }

    await client.query('COMMIT');
    logActivity('Bill Created', `Bill ${billNumber} created`, req.user.id);
    res.json({ message: 'Bill created', bill_id: billId, bill_number: billNumber });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.get('/api/bills', authenticate, async (req, res) => {
  try {
    const { search, date, payment_method, page = 1, limit = 20 } = req.query;
    let sql = `SELECT b.*, u.username as created_by_name FROM bills b LEFT JOIN users u ON b.created_by = u.id WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (search) {
      sql += ` AND (b.bill_number LIKE $${paramIndex++} OR b.customer_name LIKE $${paramIndex++} OR b.customer_mobile LIKE $${paramIndex++})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (date) {
      sql += ` AND b.date = $${paramIndex++}`;
      params.push(date);
    }
    if (payment_method) {
      sql += ` AND b.payment_method = $${paramIndex++}`;
      params.push(payment_method);
    }
    sql += ` ORDER BY b.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/bills/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const billResult = await db.query(`SELECT b.*, u.username as created_by_name FROM bills b LEFT JOIN users u ON b.created_by = u.id WHERE b.id = $1`, [id]);
    const bill = billResult.rows[0];
    if (!bill) return res.status(404).json({ error: 'Bill not found' });

    const itemsResult = await db.query(`SELECT bi.*, ps.size FROM bill_items bi JOIN plate_sizes ps ON bi.plate_size_id = ps.id WHERE bi.bill_id = $1`, [id]);
    res.json({ ...bill, items: itemsResult.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/bills/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, customer_mobile, payment_method } = req.body;

    await db.query(`UPDATE bills SET customer_name = $1, customer_mobile = $2, payment_method = $3 WHERE id = $4`,
      [customer_name, customer_mobile, payment_method, id]);
    logActivity('Bill Updated', `Bill ${id} updated`, req.user.id);
    res.json({ message: 'Bill updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/bills/:id', authenticate, requireAdmin, async (req, res) => {
  const { id } = req.params;

  // First get bill items to restore stock (pre-check, outside transaction)
  let items;
  try {
    const itemsResult = await db.query(`SELECT plate_size_id, quantity FROM bill_items WHERE bill_id = $1`, [id]);
    items = itemsResult.rows;
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    for (const item of items) {
      await client.query(`UPDATE stock SET quantity = quantity + $1 WHERE plate_size_id = $2`, [item.quantity, item.plate_size_id]);
      await client.query(`INSERT INTO stock_history (plate_size_id, quantity_change, reason, reference_type, created_by) VALUES ($1, $2, $3, $4, $5)`,
        [item.plate_size_id, item.quantity, `Bill deleted - stock restored`, 'adjustment', req.user.id]);
    }

    await client.query(`DELETE FROM bills WHERE id = $1`, [id]);

    await client.query('COMMIT');
    logActivity('Bill Deleted', `Bill ${id} deleted`, req.user.id);
    res.json({ message: 'Bill deleted and stock restored' });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ==================== ELECTRICITY ROUTES ====================

app.post('/api/electricity', authenticate, async (req, res) => {
  try {
    const { date, meter_reading } = req.body;

    if (!date || meter_reading === undefined) {
      return res.status(400).json({ error: 'Date and meter reading required' });
    }

    if (meter_reading < 0) {
      return res.status(400).json({ error: 'Meter reading cannot be negative' });
    }

    // Get previous reading
    const prevResult = await db.query(`SELECT meter_reading FROM electricity_readings WHERE date < $1 ORDER BY date DESC LIMIT 1`, [date]);
    const prev = prevResult.rows[0];
    const prevReading = prev ? prev.meter_reading : 0;

    if (meter_reading < prevReading) {
      return res.status(400).json({ error: 'Meter reading cannot be less than previous reading' });
    }

    const dailyConsumption = prevReading > 0 ? meter_reading - prevReading : 0;

    await db.query(`INSERT INTO electricity_readings (date, meter_reading, daily_consumption, created_by) VALUES ($1, $2, $3, $4)
      ON CONFLICT (date) DO UPDATE SET meter_reading = EXCLUDED.meter_reading, daily_consumption = EXCLUDED.daily_consumption, created_by = EXCLUDED.created_by`,
      [date, meter_reading, dailyConsumption, req.user.id]);

    // Recalculate future readings
    await recalculateElectricity(date);

    logActivity('Electricity Reading', `Meter reading ${meter_reading} for ${date}`, req.user.id);
    res.json({ message: 'Reading saved', daily_consumption: dailyConsumption });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function recalculateElectricity(fromDate) {
  try {
    const result = await db.query(`SELECT * FROM electricity_readings WHERE date >= $1 ORDER BY date`, [fromDate]);
    const rows = result.rows;
    if (!rows.length) return;

    for (let i = 1; i < rows.length; i++) {
      const consumption = rows[i].meter_reading - rows[i - 1].meter_reading;
      await db.query(`UPDATE electricity_readings SET daily_consumption = $1 WHERE id = $2`, [consumption, rows[i].id]);
    }
  } catch (err) {
    console.error('Failed to recalculate electricity:', err);
  }
}

app.get('/api/electricity', authenticate, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let sql = `SELECT * FROM electricity_readings WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (startDate && endDate) {
      sql += ` AND date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      params.push(startDate, endDate);
    }
    sql += ` ORDER BY date DESC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/electricity/summary', authenticate, async (req, res) => {
  try {
    const monthlyResult = await db.query(`SELECT SUM(daily_consumption) as total FROM electricity_readings WHERE substring(date, 1, 7) = to_char(CURRENT_DATE, 'YYYY-MM')`);
    const yearlyResult = await db.query(`SELECT SUM(daily_consumption) as total FROM electricity_readings WHERE substring(date, 1, 4) = to_char(CURRENT_DATE, 'YYYY')`);
    res.json({ monthly: monthlyResult.rows[0]?.total || 0, yearly: yearlyResult.rows[0]?.total || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== REPORTS ROUTES ====================

app.get('/api/reports', authenticate, async (req, res) => {
  try {
    const { type, startDate, endDate } = req.query; // type: daily, weekly, monthly, yearly

    let dateFilter = '';
    const dateParams = [];
    let paramIndex = 1;

    if (startDate && endDate) {
      dateFilter = `date BETWEEN $${paramIndex++} AND $${paramIndex++}`;
      dateParams.push(startDate, endDate);
    } else {
      switch (type) {
        case 'daily': dateFilter = `date = to_char(CURRENT_DATE, 'YYYY-MM-DD')`; break;
        case 'weekly': dateFilter = `date >= to_char(CURRENT_DATE - INTERVAL '7 days', 'YYYY-MM-DD')`; break;
        case 'monthly': dateFilter = `date >= to_char(CURRENT_DATE - INTERVAL '30 days', 'YYYY-MM-DD')`; break;
        case 'yearly': dateFilter = `date >= to_char(CURRENT_DATE - INTERVAL '1 year', 'YYYY-MM-DD')`; break;
        default: dateFilter = `1=1`;
      }
    }

    const result = {};

    const productionResult = await db.query(`SELECT date, plate_size_id, SUM(quantity)::INTEGER as total FROM production WHERE ${dateFilter} GROUP BY date, plate_size_id ORDER BY date`, dateParams);
    result.production = productionResult.rows;

    const salesResult = await db.query(`SELECT date, SUM(total)::REAL as total, COUNT(*)::INTEGER as bill_count FROM bills WHERE ${dateFilter} GROUP BY date ORDER BY date`, dateParams);
    result.sales = salesResult.rows;

    const paymentResult = await db.query(`SELECT payment_method, SUM(total)::REAL as total FROM bills WHERE ${dateFilter} GROUP BY payment_method`, dateParams);
    result.paymentMethods = paymentResult.rows;

    const stockResult = await db.query(`SELECT ps.size, s.quantity FROM plate_sizes ps LEFT JOIN stock s ON ps.id = s.plate_size_id`);
    result.stock = stockResult.rows;

    const elecResult = await db.query(`SELECT date, daily_consumption FROM electricity_readings WHERE ${dateFilter} AND daily_consumption > 0 ORDER BY date`, dateParams);
    result.electricity = elecResult.rows;

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PLATE SIZES / PRICES ====================

app.get('/api/plate-sizes', authenticate, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM plate_sizes ORDER BY id`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/plate-sizes/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    await db.query(`UPDATE plate_sizes SET price = $1 WHERE id = $2`, [price, id]);
    logActivity('Price Updated', `Price updated for plate size ${id}`, req.user.id);
    res.json({ message: 'Price updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ==================== ACTIVITY LOG ====================

app.get('/api/activities', authenticate, async (req, res) => {
  try {
    const result = await db.query(`SELECT al.*, u.username FROM activity_log al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT 50`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SETTINGS ====================

app.get('/api/settings', authenticate, async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM settings`);
    const settings = {};
    result.rows.forEach(r => settings[r.key] = r.value);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', authenticate, requireAdmin, async (req, res) => {
  try {
    const { key, value } = req.body;
    await db.query(`INSERT INTO settings (key, value) VALUES ($1, $2)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [key, value]);
    res.json({ message: 'Setting saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== USERS ====================

app.get('/api/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`SELECT id, username, role, created_at FROM users`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const hashed = bcrypt.hashSync(password, 10);

    const result = await db.query(`INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING id`,
      [username, hashed, role || 'staff']);
    logActivity('User Created', `User ${username} created`, req.user.id);
    res.json({ message: 'User created', id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== NEW BACKUP ROUTES ====================

const backupsDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupsDir)) {
  fs.mkdirSync(backupsDir, { recursive: true });
}

app.post('/api/backup', authenticate, requireAdmin, async (req, res) => {
  try {
    const backupData = {};
    
    // Fetch all tables
    const users = await db.query('SELECT id, username, role, created_at FROM users');
    backupData.users = users.rows;
    
    const plateSizes = await db.query('SELECT * FROM plate_sizes');
    backupData.plate_sizes = plateSizes.rows;
    
    const stock = await db.query('SELECT * FROM stock');
    backupData.stock = stock.rows;
    
    const stockHistory = await db.query('SELECT * FROM stock_history');
    backupData.stock_history = stockHistory.rows;
    
    const production = await db.query('SELECT * FROM production');
    backupData.production = production.rows;
    
    const bills = await db.query('SELECT * FROM bills');
    backupData.bills = bills.rows;
    
    const billItems = await db.query('SELECT * FROM bill_items');
    backupData.bill_items = billItems.rows;
    
    const electricity = await db.query('SELECT * FROM electricity_readings');
    backupData.electricity_readings = electricity.rows;
    
    const activities = await db.query('SELECT * FROM activity_log');
    backupData.activity_log = activities.rows;
    
    const settings = await db.query('SELECT * FROM settings');
    backupData.settings = settings.rows;

    // Save to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(backupsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));

    await logActivity('Backup Created', `System backup saved to ${filename}`, req.user.id);
    
    res.json({ message: 'Backup created successfully', filename });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Failed to create backup' });
  }
});

app.get('/api/backups', authenticate, requireAdmin, (req, res) => {
  try {
    if (!fs.existsSync(backupsDir)) {
      return res.json([]);
    }
    
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.endsWith('.json'))
      .map(filename => {
        const stats = fs.statSync(path.join(backupsDir, filename));
        return {
          name: filename,
          date: stats.birthtime
        };
      })
      .sort((a, b) => b.date - a.date);
      
    res.json(files);
  } catch (err) {
    console.error('List backups error:', err);
    res.status(500).json({ error: 'Failed to list backups' });
  }
});

app.get('/api/backups/:filename', authenticate, requireAdmin, (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Airtight check: the requested filename must exactly match its base filename
    if (path.basename(filename) !== filename) {
      return res.status(400).json({ error: 'Invalid filename' });
    }
    
    const filepath = path.join(backupsDir, filename);
    if (!fs.existsSync(filepath)) {
      return res.status(404).json({ error: 'Backup file not found' });
    }
    
    res.download(filepath);
  } catch (err) {
    console.error('Download backup error:', err);
    res.status(500).json({ error: 'Failed to download backup' });
  }
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