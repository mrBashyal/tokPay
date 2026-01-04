# TokPay

**Offline payment app using QR + Bluetooth**

## How It Works

1. Merchant shows QR code
2. User scans QR
3. Phones connect via Bluetooth (auto)
4. User enters amount & confirms
5. Payment done! (under 10 seconds)
6. Merchant syncs with server later

## Tech Stack

- **Apps**: React Native + Paper
- **State**: React Context
- **Database**: SQLite
- **Crypto**: Ed25519 (tweetnacl)
- **BLE**: react-native-ble-plx
- **Backend**: Node.js + Express

## Quick Start

```bash
# Clone
git clone <repo>
cd tokPay

# Backend
cd backend
npm install
npm start

# Wallet (new terminal)
cd wallet
npm install
npx react-native run-android

# Merchant (new terminal)
cd merchant
npm install
npx react-native run-android
```

## Documentation

All docs in `/docs`:

- **PLANNING.md** - Timeline, features, milestones
- **ARCHITECTURE.md** - System design, modules
- **SEQUENCE_DIAGRAMS.md** - Flow diagrams
- **TECH_STACK.md** - Technology choices
- **IMPLEMENTATION_GUIDE.md** - Code examples

## Project Structure

```
tokPay/
├── backend/     # Node.js server
├── wallet/      # User app
├── merchant/    # Merchant app
└── docs/        # Documentation
```

## Key Features

- ✅ Works offline
- ✅ Auto Bluetooth connect
- ✅ Secure (Ed25519 signatures)
- ✅ QR expires in 18 seconds
- ✅ Syncs when online

## Limits

- Max payment: ₹500
- Daily limit: ₹2000
- QR expiry: 18 seconds

## Timeline

12 weeks to production-ready app.

---

Start with `docs/PLANNING.md` 🚀
