# TokPay - Architecture

## System Overview

```
┌──────────────┐        BLE         ┌──────────────┐
│    Wallet    │◄──────────────────►│   Merchant   │
│     App      │   Token + ACK      │     App      │
└──────┬───────┘                    └──────┬───────┘
       │                                   │
       │ HTTP (when online)                │ HTTP (when online)
       │                                   │
       └───────────────┬───────────────────┘
                       │
                ┌──────▼──────┐
                │   Backend   │
                │  (Node.js)  │
                └──────┬──────┘
                       │
                ┌──────▼──────┐
                │   SQLite    │
                └─────────────┘
```

## Payment Flow

```
1. Merchant shows QR (refreshes every 18s)
2. User scans QR → extracts BLE UUID
3. Wallet auto-connects via BLE
4. User enters amount
5. Wallet signs token (Ed25519)
6. Token sent via BLE
7. Merchant verifies signature
8. Merchant sends ACK
9. Both update local balance
10. Merchant syncs later (when online)
```

## Module Structure

### Wallet App
```
wallet/
├── App.js
├── src/
│   ├── context/
│   │   └── WalletContext.js    # Balance, keys, counter
│   ├── screens/
│   │   ├── HomeScreen.js       # Balance display
│   │   ├── ScanScreen.js       # QR scanner
│   │   └── PayScreen.js        # Amount + confirm
│   └── modules/
│       ├── QRScanner.js        # Camera + parsing
│       ├── BLEClient.js        # Connect + send
│       ├── Crypto.js           # Sign tokens
│       └── Storage.js          # SQLite ops
```

### Merchant App
```
merchant/
├── App.js
├── src/
│   ├── context/
│   │   └── MerchantContext.js  # Balance, transactions
│   ├── screens/
│   │   ├── QRScreen.js         # Show QR code
│   │   ├── TransactionsScreen.js
│   │   └── SyncScreen.js
│   └── modules/
│       ├── QRGenerator.js      # Dynamic QR
│       ├── BLEServer.js        # Advertise + receive
│       ├── Verify.js           # Check signatures
│       └── Storage.js          # SQLite ops
```

### Backend
```
backend/
├── server.js
├── routes/
│   ├── auth.js         # Register, login
│   ├── user.js         # Balance, load
│   └── sync.js         # Transaction sync
├── crypto/
│   └── keys.js         # Ed25519 generation
└── db/
    └── sqlite.js       # Database setup
```

## Data Flow

### Token Creation (Wallet)
```
Amount + Merchant ID
        ↓
Get counter from storage
        ↓
Create token payload
        ↓
Sign with private key (from Keychain)
        ↓
Send via BLE
```

### Token Verification (Merchant)
```
Receive token via BLE
        ↓
Check timestamp (<5 min old)
        ↓
Verify signature (Ed25519)
        ↓
Check nonce matches current QR
        ↓
Store locally
        ↓
Send ACK
```

### Reconciliation (Backend)
```
Receive batch of tokens
        ↓
For each token:
  - Check not duplicate (token_id)
  - Verify signature
  - Check counter sequence
        ↓
Update balances atomically
        ↓
Return success/failure for each
```

## Security Layers

1. **Device**: Keys in TEE/Keychain
2. **QR**: Expires in 18 seconds
3. **Token**: Ed25519 signature
4. **Counter**: Prevents replay
5. **Backend**: Validates everything

## SQLite Schemas

### Wallet (local)
```sql
CREATE TABLE wallet (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- Stores: balance, counter, public_key
```

### Merchant (local)
```sql
CREATE TABLE transactions (
  token_id TEXT PRIMARY KEY,
  amount REAL,
  payer_pubkey TEXT,
  timestamp INTEGER,
  synced INTEGER DEFAULT 0
);
```

### Backend
```sql
CREATE TABLE users (
  phone TEXT PRIMARY KEY,
  public_key TEXT,
  main_balance REAL,
  offline_balance REAL,
  counter INTEGER
);

CREATE TABLE transactions (
  token_id TEXT PRIMARY KEY,
  payer_pubkey TEXT,
  merchant_id TEXT,
  amount REAL,
  timestamp INTEGER
);
```

That's it! Simple architecture. 🏗️
