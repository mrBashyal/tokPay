# TokPay - Project Plan

## Overview
Offline payment app using QR + Bluetooth. Pay without internet!

## Tech Stack (Fixed)

| Layer | Technology |
|-------|-----------|
| UI | React Native Paper |
| State | React Context |
| Local DB | SQLite |
| Backend DB | SQLite |
| Keys | react-native-keychain |
| Crypto | tweetnacl |
| QR Scan | react-native-qrcode-scanner |
| QR Gen | react-native-qrcode-svg |
| BLE | react-native-ble-plx |
| Backend | Node.js + Express |

## Project Structure

```
tokPay/
├── backend/           # Node.js server
│   ├── server.js
│   ├── routes/
│   └── db/
├── wallet/            # User app (React Native)
│   ├── src/
│   │   ├── screens/
│   │   ├── context/
│   │   └── modules/
│   └── App.js
├── merchant/          # Merchant app (React Native)
│   ├── src/
│   │   ├── screens/
│   │   ├── context/
│   │   └── modules/
│   └── App.js
└── docs/
```

## Timeline (12 Weeks)

### Phase 1: Setup (Week 1-2)
- [ ] Initialize all 3 projects
- [ ] Setup SQLite databases
- [ ] Create basic navigation
- [ ] Setup React Context
- [ ] Backend: Basic Express server

### Phase 2: Core (Week 3-4)
- [ ] QR code generation (merchant)
- [ ] QR code scanning (wallet)
- [ ] BLE advertising (merchant)
- [ ] BLE scanning & connect (wallet)
- [ ] Ed25519 key generation

### Phase 3: Payment (Week 5-6)
- [ ] Token creation & signing
- [ ] Token verification
- [ ] BLE data transfer
- [ ] Offline balance management
- [ ] Payment confirmation

### Phase 4: Sync (Week 7-8)
- [ ] Local transaction storage
- [ ] Batch sync to backend
- [ ] Duplicate detection
- [ ] Balance reconciliation

### Phase 5: Testing (Week 9-10)
- [ ] Unit tests
- [ ] End-to-end testing
- [ ] Security review
- [ ] Performance testing

### Phase 6: Polish (Week 11-12)
- [ ] Error handling
- [ ] UI improvements
- [ ] Documentation
- [ ] APK builds

## Key Features

### Wallet App
1. **Home**: Balance display
2. **Scan**: QR scanner → auto BLE
3. **Pay**: Amount entry → confirm
4. **History**: Transaction list

### Merchant App
1. **Dashboard**: Today's earnings
2. **QR Display**: Auto-refresh every 18s
3. **Transactions**: Pending + synced
4. **Sync**: Manual sync button

### Backend
1. **Auth**: Register/login
2. **Keys**: Generate Ed25519 keypairs
3. **Sync**: Receive & validate transactions
4. **Balance**: Update user/merchant balances

## Data Models

### User
```javascript
{ phone, name, public_key, main_balance, offline_balance, counter }
```

### Merchant
```javascript
{ merchant_id, name, public_key, balance }
```

### Transaction
```javascript
{ token_id, payer_pubkey, merchant_id, amount, timestamp, counter, signature, synced }
```

### QR Payload
```javascript
{ merchant_id, merchant_name, ble_uuid, nonce, timestamp }
```

### Token Payload
```javascript
{ payer_pubkey, amount, merchant_id, timestamp, counter, qr_nonce, signature }
```

## Security Rules

- QR expires: **18 seconds**
- Max payment: **₹500**
- Daily limit: **₹2000**
- Keys in: **Keychain/Keystore (TEE)**
- Counter: **Monotonic (prevents replay)**

## API Endpoints

```
POST /auth/register    - Create user
POST /auth/login       - Get JWT token
GET  /user/balance     - Get balances
POST /user/load        - Load offline wallet
POST /sync/transactions - Sync merchant transactions
GET  /merchant/balance  - Merchant balance
```

## Development Commands

```bash
# Backend
cd backend && npm start

# Wallet
cd wallet && npx react-native run-android

# Merchant  
cd merchant && npx react-native run-android
```

## Milestones

| Week | Deliverable |
|------|-------------|
| 2 | Apps running, basic UI |
| 4 | QR scan + BLE connect works |
| 6 | Full payment works offline |
| 8 | Sync to backend works |
| 10 | All tests pass |
| 12 | Production ready APKs |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| BLE unreliable | Retry logic, timeout handling |
| Key extraction | Use hardware keystore |
| Double spend | Counter + backend validation |
| QR too slow | Pre-generate next QR |

## Success Criteria

- [ ] Payment in <10 seconds
- [ ] Works fully offline
- [ ] Syncs correctly when online
- [ ] No security vulnerabilities
- [ ] Clean, simple UI

---

Ready to build! Start with `IMPLEMENTATION_GUIDE.md` 🚀
