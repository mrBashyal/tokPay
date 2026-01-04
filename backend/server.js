// Import required packages
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// Create Express app
const app = express();

// Security middleware
app.use(helmet()); // Adds security headers
app.use(bodyParser.json({ limit: '10kb' })); // Limit body size

// Rate limiting - prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { error: 'Too many attempts, please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests, please slow down' },
});

app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 12;

// Initialize SQLite database
const db = new sqlite3.Database('./tokpay.db', (err) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Connected to SQLite database');
    initDatabase();
  }
});

// Create tables with authentication fields
function initDatabase() {
  // Users table with password
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      pin_hash TEXT,
      balance REAL DEFAULT 0,
      offline_balance REAL DEFAULT 0,
      public_key TEXT NOT NULL,
      is_verified INTEGER DEFAULT 0,
      failed_attempts INTEGER DEFAULT 0,
      locked_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Merchants table with password
  db.run(`
    CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      pin_hash TEXT,
      balance REAL DEFAULT 0,
      public_key TEXT NOT NULL,
      is_verified INTEGER DEFAULT 0,
      failed_attempts INTEGER DEFAULT 0,
      locked_until DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Transactions table
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      txn_id TEXT PRIMARY KEY,
      from_phone TEXT NOT NULL,
      to_merchant TEXT NOT NULL,
      amount REAL NOT NULL,
      counter INTEGER NOT NULL,
      signature TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      synced_at DATETIME
    )
  `);

  // Refresh tokens table (for secure logout)
  db.run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_phone TEXT,
      merchant_id TEXT,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Database tables initialized');
}

// ==================== AUTH MIDDLEWARE ====================

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = decoded;
    next();
  });
}

// Generate tokens
function generateTokens(payload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  return { accessToken, refreshToken };
}

// Validate password strength
function validatePassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (password.length < minLength) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }
  if (!hasUpperCase || !hasLowerCase) {
    return { valid: false, error: 'Password must contain upper and lower case letters' };
  }
  if (!hasNumbers) {
    return { valid: false, error: 'Password must contain at least one number' };
  }
  if (!hasSpecialChar) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }
  return { valid: true };
}

// Validate phone number
function validatePhone(phone) {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone);
}

// Check if account is locked
function isAccountLocked(lockedUntil) {
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
}

// ==================== PUBLIC ROUTES ====================

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'TokPay Backend API',
    version: '1.0.0'
  });
});

// ==================== USER AUTH ROUTES ====================

// User Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { phone, password, name, publicKey } = req.body;

    // Validate inputs
    if (!phone || !password || !name || !publicKey) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.error });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // Insert user
    const sql = `INSERT INTO users (phone, password_hash, name, public_key, balance) 
                 VALUES (?, ?, ?, ?, 1000)`; // Starting balance of 1000 for testing
    
    db.run(sql, [phone, passwordHash, name, publicKey], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Phone number already registered' });
        }
        console.error('Registration error:', err);
        return res.status(500).json({ error: 'Registration failed' });
      }

      // Generate tokens
      const tokens = generateTokens({ 
        phone, 
        type: 'user',
        id: this.lastID 
      });

      res.status(201).json({
        success: true,
        message: 'Registration successful',
        user: { phone, name },
        ...tokens
      });
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// User Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password required' });
    }

    // Get user
    db.get('SELECT * FROM users WHERE phone = ?', [phone], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check if account is locked
      if (isAccountLocked(user.locked_until)) {
        const unlockTime = new Date(user.locked_until).toLocaleTimeString();
        return res.status(423).json({ 
          error: `Account locked. Try again after ${unlockTime}` 
        });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!validPassword) {
        // Increment failed attempts
        const newAttempts = user.failed_attempts + 1;
        let lockUntil = null;

        // Lock account after 5 failed attempts
        if (newAttempts >= 5) {
          lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes
        }

        db.run(
          'UPDATE users SET failed_attempts = ?, locked_until = ? WHERE phone = ?',
          [newAttempts, lockUntil, phone]
        );

        if (lockUntil) {
          return res.status(423).json({ 
            error: 'Too many failed attempts. Account locked for 15 minutes.' 
          });
        }

        return res.status(401).json({ 
          error: 'Invalid credentials',
          attemptsRemaining: 5 - newAttempts
        });
      }

      // Reset failed attempts on successful login
      db.run(
        'UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE phone = ?',
        [phone]
      );

      // Generate tokens
      const tokens = generateTokens({ 
        phone, 
        type: 'user',
        id: user.id 
      });

      // Store refresh token hash
      const refreshTokenHash = crypto
        .createHash('sha256')
        .update(tokens.refreshToken)
        .digest('hex');
      
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      db.run(
        'INSERT INTO refresh_tokens (user_phone, token_hash, expires_at) VALUES (?, ?, ?)',
        [phone, refreshTokenHash, expiresAt]
      );

      res.json({
        success: true,
        user: {
          phone: user.phone,
          name: user.name,
          balance: user.balance,
          offlineBalance: user.offline_balance,
          publicKey: user.public_key
        },
        ...tokens
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Refresh Token
app.post('/api/auth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    // Verify refresh token
    jwt.verify(refreshToken, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ error: 'Invalid refresh token' });
      }

      // Check if token exists in database
      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');

      db.get(
        'SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > datetime("now")',
        [tokenHash],
        (err, token) => {
          if (err || !token) {
            return res.status(403).json({ error: 'Refresh token not found or expired' });
          }

          // Generate new tokens
          const tokens = generateTokens({
            phone: decoded.phone,
            type: decoded.type,
            id: decoded.id
          });

          // Update refresh token
          const newTokenHash = crypto
            .createHash('sha256')
            .update(tokens.refreshToken)
            .digest('hex');
          
          db.run(
            'UPDATE refresh_tokens SET token_hash = ? WHERE id = ?',
            [newTokenHash, token.id]
          );

          res.json(tokens);
        }
      );
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Logout
app.post('/api/auth/logout', authenticateToken, (req, res) => {
  const { phone } = req.user;

  // Delete all refresh tokens for user
  db.run('DELETE FROM refresh_tokens WHERE user_phone = ?', [phone], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// ==================== MERCHANT AUTH ROUTES ====================

// Merchant Registration
app.post('/api/auth/merchant/register', async (req, res) => {
  try {
    const { merchantId, phone, password, name, publicKey } = req.body;

    if (!merchantId || !phone || !password || !name || !publicKey) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!validatePhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.error });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const sql = `INSERT INTO merchants (merchant_id, phone, password_hash, name, public_key, balance) 
                 VALUES (?, ?, ?, ?, ?, 0)`;
    
    db.run(sql, [merchantId, phone, passwordHash, name, publicKey], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'Merchant ID or phone already registered' });
        }
        return res.status(500).json({ error: 'Registration failed' });
      }

      const tokens = generateTokens({ 
        merchantId, 
        phone,
        type: 'merchant',
        id: this.lastID 
      });

      res.status(201).json({
        success: true,
        message: 'Merchant registration successful',
        merchant: { merchantId, name, phone },
        ...tokens
      });
    });
  } catch (error) {
    console.error('Merchant registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Merchant Login
app.post('/api/auth/merchant/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password required' });
    }

    db.get('SELECT * FROM merchants WHERE phone = ?', [phone], async (err, merchant) => {
      if (err) {
        return res.status(500).json({ error: 'Server error' });
      }

      if (!merchant) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (isAccountLocked(merchant.locked_until)) {
        return res.status(423).json({ error: 'Account locked. Try again later.' });
      }

      const validPassword = await bcrypt.compare(password, merchant.password_hash);
      
      if (!validPassword) {
        const newAttempts = merchant.failed_attempts + 1;
        let lockUntil = null;

        if (newAttempts >= 5) {
          lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }

        db.run(
          'UPDATE merchants SET failed_attempts = ?, locked_until = ? WHERE phone = ?',
          [newAttempts, lockUntil, phone]
        );

        return res.status(401).json({ 
          error: 'Invalid credentials',
          attemptsRemaining: 5 - newAttempts
        });
      }

      db.run(
        'UPDATE merchants SET failed_attempts = 0, locked_until = NULL WHERE phone = ?',
        [phone]
      );

      const tokens = generateTokens({ 
        merchantId: merchant.merchant_id,
        phone, 
        type: 'merchant',
        id: merchant.id 
      });

      const refreshTokenHash = crypto
        .createHash('sha256')
        .update(tokens.refreshToken)
        .digest('hex');
      
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      db.run(
        'INSERT INTO refresh_tokens (merchant_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [merchant.merchant_id, refreshTokenHash, expiresAt]
      );

      res.json({
        success: true,
        merchant: {
          merchantId: merchant.merchant_id,
          phone: merchant.phone,
          name: merchant.name,
          balance: merchant.balance,
          publicKey: merchant.public_key
        },
        ...tokens
      });
    });
  } catch (error) {
    console.error('Merchant login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== PROTECTED ROUTES ====================

// Get User Profile
app.get('/api/user/profile', authenticateToken, (req, res) => {
  if (req.user.type !== 'user') {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.get(
    'SELECT phone, name, balance, offline_balance, public_key, created_at FROM users WHERE phone = ?',
    [req.user.phone],
    (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({
        phone: user.phone,
        name: user.name,
        balance: user.balance,
        offlineBalance: user.offline_balance,
        publicKey: user.public_key,
        createdAt: user.created_at
      });
    }
  );
});

// Get Balance (Protected)
app.get('/api/balance', authenticateToken, (req, res) => {
  const { phone, type } = req.user;

  if (type === 'user') {
    db.get('SELECT balance, offline_balance FROM users WHERE phone = ?', [phone], (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json({
        balance: user.balance,
        offlineBalance: user.offline_balance
      });
    });
  } else if (type === 'merchant') {
    db.get('SELECT balance FROM merchants WHERE phone = ?', [phone], (err, merchant) => {
      if (err || !merchant) {
        return res.status(404).json({ error: 'Merchant not found' });
      }
      res.json({ balance: merchant.balance });
    });
  }
});

// Load Offline Balance (Protected)
app.post('/api/load-balance', authenticateToken, (req, res) => {
  if (req.user.type !== 'user') {
    return res.status(403).json({ error: 'Only users can load balance' });
  }

  const { amount } = req.body;
  const phone = req.user.phone;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  if (amount > 2000) {
    return res.status(400).json({ error: 'Maximum offline balance is ₹2000' });
  }

  db.get('SELECT balance, offline_balance FROM users WHERE phone = ?', [phone], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.offline_balance + amount > 2000) {
      return res.status(400).json({ 
        error: `Can only load ₹${2000 - user.offline_balance} more` 
      });
    }

    if (user.balance < amount) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const sql = 'UPDATE users SET balance = balance - ?, offline_balance = offline_balance + ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?';
    db.run(sql, [amount, amount, phone], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to load balance' });
      }

      res.json({
        success: true,
        message: 'Balance loaded successfully',
        balance: user.balance - amount,
        offlineBalance: user.offline_balance + amount
      });
    });
  });
});

// Sync Transactions (Protected)
app.post('/api/sync', authenticateToken, (req, res) => {
  const { transactions } = req.body;

  if (!transactions || !Array.isArray(transactions)) {
    return res.status(400).json({ error: 'Invalid transaction data' });
  }

  if (transactions.length === 0) {
    return res.json({ success: true, processed: 0, failed: 0, results: [] });
  }

  let processed = 0;
  let failed = 0;
  const results = [];
  let responseSent = false;

  const sendResponse = () => {
    if (!responseSent && processed + failed === transactions.length) {
      responseSent = true;
      res.json({
        success: true,
        processed,
        failed,
        results
      });
    }
  };

  transactions.forEach((txn) => {
    const { txnId, fromPhone, toMerchant, amount, counter, signature } = txn;

    db.get('SELECT * FROM transactions WHERE txn_id = ?', [txnId], (err, existing) => {
      if (existing) {
        failed++;
        results.push({ txnId, status: 'duplicate' });
        sendResponse();
      } else if (amount > 500) {
        failed++;
        results.push({ txnId, status: 'amount_exceeded' });
        sendResponse();
      } else {
        const sql = 'INSERT INTO transactions (txn_id, from_phone, to_merchant, amount, counter, signature, status, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)';
        db.run(sql, [txnId, fromPhone, toMerchant, amount, counter, signature, 'completed'], function(err) {
          if (err) {
            failed++;
            results.push({ txnId, status: 'error' });
          } else {
            db.run('UPDATE users SET offline_balance = offline_balance - ? WHERE phone = ?', [amount, fromPhone]);
            db.run('UPDATE merchants SET balance = balance + ? WHERE merchant_id = ?', [amount, toMerchant]);
            processed++;
            results.push({ txnId, status: 'success' });
          }
          sendResponse();
        });
      }
    });
  });
});

// Get Transaction History (Protected)
app.get('/api/transactions', authenticateToken, (req, res) => {
  const { phone, type, merchantId } = req.user;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  let sql, params;
  
  if (type === 'user') {
    sql = 'SELECT * FROM transactions WHERE from_phone = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params = [phone, limit, offset];
  } else {
    sql = 'SELECT * FROM transactions WHERE to_merchant = ? ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params = [merchantId, limit, offset];
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to fetch transactions' });
    }
    res.json({ transactions: rows });
  });
});

// Change Password (Protected)
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { phone, type } = req.user;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password required' });
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({ error: passwordCheck.error });
    }

    const table = type === 'user' ? 'users' : 'merchants';
    
    db.get(`SELECT password_hash FROM ${table} WHERE phone = ?`, [phone], async (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'Account not found' });
      }

      const validPassword = await bcrypt.compare(currentPassword, row.password_hash);
      if (!validPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }

      const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      
      db.run(
        `UPDATE ${table} SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?`,
        [newHash, phone],
        (err) => {
          if (err) {
            return res.status(500).json({ error: 'Failed to update password' });
          }

          // Invalidate all refresh tokens
          if (type === 'user') {
            db.run('DELETE FROM refresh_tokens WHERE user_phone = ?', [phone]);
          } else {
            db.run('DELETE FROM refresh_tokens WHERE merchant_id = ?', [req.user.merchantId]);
          }

          res.json({ success: true, message: 'Password updated. Please login again.' });
        }
      );
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Set Payment PIN (Protected)
app.post('/api/auth/set-pin', authenticateToken, async (req, res) => {
  try {
    const { pin } = req.body;
    const { phone, type } = req.user;

    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'PIN must be 4-6 digits' });
    }

    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
    const table = type === 'user' ? 'users' : 'merchants';

    db.run(
      `UPDATE ${table} SET pin_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE phone = ?`,
      [pinHash, phone],
      (err) => {
        if (err) {
          return res.status(500).json({ error: 'Failed to set PIN' });
        }
        res.json({ success: true, message: 'PIN set successfully' });
      }
    );
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify PIN (for payments)
app.post('/api/auth/verify-pin', authenticateToken, async (req, res) => {
  try {
    const { pin } = req.body;
    const { phone, type } = req.user;

    if (!pin) {
      return res.status(400).json({ error: 'PIN required' });
    }

    const table = type === 'user' ? 'users' : 'merchants';
    
    db.get(`SELECT pin_hash FROM ${table} WHERE phone = ?`, [phone], async (err, row) => {
      if (err || !row) {
        return res.status(404).json({ error: 'Account not found' });
      }

      if (!row.pin_hash) {
        return res.status(400).json({ error: 'PIN not set' });
      }

      const validPin = await bcrypt.compare(pin, row.pin_hash);
      res.json({ valid: validPin });
    });
  } catch (error) {
    console.error('Verify PIN error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ TokPay Backend running on http://localhost:${PORT}`);
  console.log('🔐 Security features enabled: Helmet, Rate Limiting, JWT Auth');
});
