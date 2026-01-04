// Import required packages
const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const nacl = require('tweetnacl');
const naclUtil = require('tweetnacl-util');

// Create Express app
const app = express();
app.use(bodyParser.json());

// Initialize SQLite database
const db = new sqlite3.Database('./tokpay.db', (err) => {
    if (err) {
        console.error('❌ Database connection failed:', err);
    } else {
        console.log('✅ Connected to SQLite database');
        initDatabase();
    }
});

// Create tables
function initDatabase() {
    // Users table
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      phone TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      balance REAL DEFAULT 0,
      offline_balance REAL DEFAULT 0,
      public_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

    // Merchants table
    db.run(`
    CREATE TABLE IF NOT EXISTS merchants (
      merchant_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      balance REAL DEFAULT 0,
      public_key TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    console.log('✅ Database tables initialized');
}

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        status: 'running',
        message: 'TokPay Backend API',
        version: '1.0.0'
    });
});

// User Registration
app.post('/api/register', (req, res) => {
    const { phone, name, publicKey } = req.body;

    if (!phone || !name || !publicKey) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = 'INSERT INTO users (phone, name, public_key, balance) VALUES (?, ?, ?, 0)';
    db.run(sql, [phone, name, publicKey], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'User already exists' });
            }
            return res.status(500).json({ error: 'Registration failed' });
        }

        res.json({
            success: true,
            message: 'User registered successfully',
            phone: phone
        });
    });
});

// Merchant Registration
app.post('/api/merchant/register', (req, res) => {
    const { merchantId, name, phone, publicKey } = req.body;

    if (!merchantId || !name || !phone || !publicKey) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const sql = 'INSERT INTO merchants (merchant_id, name, phone, public_key, balance) VALUES (?, ?, ?, ?, 0)';
    db.run(sql, [merchantId, name, phone, publicKey], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(409).json({ error: 'Merchant already exists' });
            }
            return res.status(500).json({ error: 'Registration failed' });
        }

        res.json({
            success: true,
            message: 'Merchant registered successfully',
            merchantId: merchantId
        });
    });
});

// Load Offline Balance
app.post('/api/load-balance', (req, res) => {
    const { phone, amount } = req.body;

    if (!phone || !amount) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    //   if (amount > 2000) {
    //     return res.status(400).json({ error: 'Maximum offline balance is ₹2000' });
    //   }

    // Check if user has enough main balance
    db.get('SELECT balance, offline_balance FROM users WHERE phone = ?', [phone], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Transfer from main balance to offline balance
        const sql = 'UPDATE users SET balance = balance - ?, offline_balance = offline_balance + ? WHERE phone = ?';
        db.run(sql, [amount, amount, phone], function (err) {
            if (err) {
                return res.status(500).json({ error: 'Failed to load balance' });
            }

            res.json({
                success: true,
                message: 'Balance loaded successfully',
                offlineBalance: user.offline_balance + amount
            });
        });
    });
});

// Get Balance
app.get('/api/balance/:phone', (req, res) => {
    const { phone } = req.params;

    db.get('SELECT balance, offline_balance FROM users WHERE phone = ?', [phone], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            phone: phone,
            balance: user.balance,
            offlineBalance: user.offline_balance
        });
    });
});

// Sync Offline Transactions
app.post('/api/sync', (req, res) => {
    const { transactions } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
        return res.status(400).json({ error: 'Invalid transaction data' });
    }

    let processed = 0;
    let failed = 0;
    const results = [];

    transactions.forEach((txn, index) => {
        const { txnId, fromPhone, toMerchant, amount, counter, signature } = txn;

        // Check for duplicate transaction
        db.get('SELECT * FROM transactions WHERE txn_id = ?', [txnId], (err, existing) => {
            if (existing) {
                failed++;
                results.push({ txnId, status: 'duplicate' });
            } else {
                // Verify transaction amount limit
                // if (amount > 500) {
                //   failed++;
                //   results.push({ txnId, status: 'amount_exceeded' });
                // } else {
                // Insert transaction
                const sql = 'INSERT INTO transactions (txn_id, from_phone, to_merchant, amount, counter, signature, status, synced_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)';
                db.run(sql, [txnId, fromPhone, toMerchant, amount, counter, signature, 'completed'], function (err) {
                    if (err) {
                        failed++;
                        results.push({ txnId, status: 'error' });
                    } else {
                        // Update user offline balance
                        db.run('UPDATE users SET offline_balance = offline_balance - ? WHERE phone = ?', [amount, fromPhone]);

                        // Update merchant balance
                        db.run('UPDATE merchants SET balance = balance + ? WHERE merchant_id = ?', [amount, toMerchant]);

                        processed++;
                        results.push({ txnId, status: 'success' });
                    }

                    // Send response after processing all
                    if (processed + failed === transactions.length) {
                        res.json({
                            success: true,
                            processed: processed,
                            failed: failed,
                            results: results
                        });
                    }
                });
            }
        }

      // Send response if no insert needed
      if (processed + failed === transactions.length) {
            res.json({
                success: true,
                processed: processed,
                failed: failed,
                results: results
            });
        }
    });
});
});

// Start server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ TokPay Backend running on http://localhost:${PORT}`);
});
