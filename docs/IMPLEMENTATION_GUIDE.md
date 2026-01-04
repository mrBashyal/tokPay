# TokPay - Implementation Guide

## Quick Setup

### 1. Backend (5 minutes)
```bash
mkdir backend && cd backend
npm init -y
npm install express sqlite3 tweetnacl cors
```

**server.js:**
```javascript
const express = require('express');
const sqlite3 = require('sqlite3');
const nacl = require('tweetnacl');
const app = express();

app.use(express.json());

// Database
const db = new sqlite3.Database('./tokpay.db');
db.run(`CREATE TABLE IF NOT EXISTS users (
  phone TEXT PRIMARY KEY, public_key TEXT, 
  main_balance REAL DEFAULT 1000, offline_balance REAL DEFAULT 0
)`);
db.run(`CREATE TABLE IF NOT EXISTS transactions (
  token_id TEXT PRIMARY KEY, amount REAL, merchant_id TEXT, 
  timestamp INTEGER, synced INTEGER DEFAULT 0
)`);

// Start server
app.listen(3000, () => console.log('Running on :3000'));
```

### 2. Wallet App (10 minutes)
```bash
npx react-native init TokPayWallet
cd TokPayWallet
npm install react-native-paper react-native-keychain \
  tweetnacl react-native-camera react-native-ble-plx \
  react-native-sqlite-storage
```

### 3. Merchant App (10 minutes)
```bash
npx react-native init TokPayMerchant
cd TokPayMerchant
npm install react-native-paper react-native-qrcode-svg \
  react-native-ble-plx react-native-sqlite-storage axios
```

---

## Core Modules

### QR Scanner (Wallet)
```javascript
import { RNCamera } from 'react-native-camera';

const QRScanner = ({ onScan }) => (
  <RNCamera
    onBarCodeRead={({ data }) => onScan(JSON.parse(data))}
    captureAudio={false}
  />
);
```

### QR Generator (Merchant)
```javascript
import QRCode from 'react-native-qrcode-svg';

const DynamicQR = ({ merchantId, bleUUID }) => {
  const [data, setData] = useState('');

  useEffect(() => {
    const refresh = () => setData(JSON.stringify({
      merchant_id: merchantId,
      ble_uuid: bleUUID,
      nonce: Math.random().toString(36),
      timestamp: Date.now()
    }));
    refresh();
    const interval = setInterval(refresh, 18000);
    return () => clearInterval(interval);
  }, []);

  return <QRCode value={data} size={250} />;
};
```

### Token Signing (Wallet)
```javascript
import nacl from 'tweetnacl';
import Keychain from 'react-native-keychain';

const signToken = async (amount, merchantId, counter) => {
  const creds = await Keychain.getGenericPassword();
  const privateKey = Buffer.from(creds.password, 'base64');
  
  const token = { amount, merchant_id: merchantId, timestamp: Date.now(), counter };
  const message = Buffer.from(JSON.stringify(token));
  const signature = nacl.sign.detached(message, privateKey);
  
  return { ...token, signature: Buffer.from(signature).toString('base64') };
};
```

### Token Verification (Merchant)
```javascript
import nacl from 'tweetnacl';

const verifyToken = (token) => {
  if (Date.now() - token.timestamp > 300000) return false; // 5 min max
  
  const message = Buffer.from(JSON.stringify({
    amount: token.amount,
    merchant_id: token.merchant_id,
    timestamp: token.timestamp,
    counter: token.counter
  }));
  
  return nacl.sign.detached.verify(
    message,
    Buffer.from(token.signature, 'base64'),
    Buffer.from(token.payer_pubkey, 'base64')
  );
};
```

### BLE Client (Wallet)
```javascript
import { BleManager } from 'react-native-ble-plx';

const manager = new BleManager();

const connectAndSend = async (uuid, token) => {
  // Scan for device with UUID
  return new Promise((resolve, reject) => {
    manager.startDeviceScan([uuid], null, async (err, device) => {
      if (device) {
        manager.stopDeviceScan();
        await device.connect();
        await device.discoverAllServicesAndCharacteristics();
        // Write token to characteristic
        resolve(device);
      }
    });
    setTimeout(() => reject('Timeout'), 10000);
  });
};
```

### BLE Server (Merchant)
```javascript
// Note: BLE peripheral mode needs native code
// Use react-native-ble-peripheral or native modules
```

---

## Payment Flow

```javascript
// Wallet: PaymentScreen.js
const handlePay = async (qrData, amount) => {
  try {
    // 1. Connect BLE
    const device = await connectAndSend(qrData.ble_uuid, null);
    
    // 2. Sign token
    const token = await signToken(amount, qrData.merchant_id, counter++);
    
    // 3. Send via BLE
    await sendToken(device, token);
    
    // 4. Wait ACK
    const ack = await waitForAck(device);
    
    // 5. Update balance
    if (ack.ok) updateBalance(-amount);
    
  } catch (e) {
    Alert.alert('Payment failed', e.message);
  }
};
```

---

## Backend Sync

```javascript
// POST /sync
app.post('/sync', (req, res) => {
  const { transactions } = req.body;
  
  transactions.forEach(tx => {
    // Check duplicate
    db.get('SELECT * FROM transactions WHERE token_id = ?', 
      [tx.token_id], (err, row) => {
        if (row) return; // Already exists
        
        // Verify & save
        if (verifyToken(tx)) {
          db.run('INSERT INTO transactions VALUES (?, ?, ?, ?, 1)',
            [tx.token_id, tx.amount, tx.merchant_id, tx.timestamp]);
        }
      });
  });
  
  res.json({ status: 'ok' });
});
```

---

## Run & Test

```bash
# Terminal 1: Backend
cd backend && node server.js

# Terminal 2: Wallet
cd wallet && npx react-native run-android

# Terminal 3: Merchant
cd merchant && npx react-native run-android
```

**Test Flow:**
1. Open merchant → shows QR
2. Open wallet → scan QR
3. Enter amount → Pay
4. See confirmation on both!

---

## Common Fixes

| Problem | Solution |
|---------|----------|
| BLE not finding | Enable Bluetooth, check permissions |
| Camera not working | Add camera permission to manifest |
| Keys not saving | Use real device, not emulator |
| QR not parsing | Check JSON.stringify/parse |

---

Ready to build! 🚀
