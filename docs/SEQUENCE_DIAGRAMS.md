# TokPay - Sequence Diagrams

## 1. User Registration
```
User → App → Backend
  │      │      │
  │─Enter phone──►│
  │      │──POST /register──►│
  │      │      │──Generate Ed25519 keys
  │      │◄──private_key (encrypted)──│
  │      │──Save to Keychain
  │◄─Success────│
```

## 2. Load Offline Balance
```
User → App → Backend
  │      │      │
  │─Load ₹500───►│
  │      │──POST /user/load──►│
  │      │      │──main -= 500, offline += 500
  │      │◄──new balances──│
  │◄─Updated────│
```

## 3. Payment (Main Flow)
```
User        Wallet         Merchant        Backend
  │           │               │               │
  │──Scan QR──►│               │               │
  │           │◄──QR data─────│               │
  │           │──BLE connect──►│               │
  │           │◄──Connected────│               │
  │──Amount───►│               │               │
  │           │──Sign token────│               │
  │           │──Send token───►│               │
  │           │               │──Verify sig    │
  │           │               │──Store local   │
  │           │◄──ACK──────────│               │
  │◄─Success──│               │               │
  │           │               │               │
  │      [Later, when online]  │               │
  │           │               │──POST /sync───►│
  │           │               │               │──Validate
  │           │               │               │──Update bal
  │           │               │◄──Success──────│
```

## 4. QR Code Refresh
```
Merchant App (every 18 seconds)
  │
  │──Generate new nonce
  │──Create QR data { merchant_id, ble_uuid, nonce, timestamp }
  │──Display new QR
  │──Loop
```

## 5. BLE Auto-Connect
```
Wallet                    Merchant
  │                          │
  │──Extract UUID from QR    │
  │──startDeviceScan([uuid])─►│
  │◄──Device found────────────│
  │──device.connect()────────►│
  │◄──Connected───────────────│
  │──discoverServices()──────►│
  │◄──Services ready──────────│
  │──writeCharacteristic(token)─►│
  │◄──Notification (ACK)──────│
```

## 6. Error: QR Expired
```
User → Wallet
  │      │
  │─Scan QR─►│
  │      │──Check timestamp
  │      │──(Now - QR.timestamp) > 20s
  │◄─"QR expired, please rescan"
```

## 7. Error: BLE Failed
```
User → Wallet
  │      │
  │─Scan QR─►│
  │      │──BLE scan for 10s
  │      │──No device found
  │◄─"Cannot find merchant. Move closer."
```

## 8. Error: Invalid Token
```
Wallet → Merchant
  │         │
  │─Token──►│
  │         │──Verify signature
  │         │──FAILED
  │◄─NACK { error: "invalid_signature" }
```

## 9. Error: Double Spend (at sync)
```
Merchant → Backend
  │           │
  │─Sync tokens──►│
  │           │──Check token_id exists
  │           │──FOUND (duplicate!)
  │◄─{ token_id, status: "duplicate" }
```

## 10. Sync Flow
```
Merchant → Backend
  │           │
  │─POST /sync [tx1, tx2, tx3]──►│
  │           │
  │           │──For each tx:
  │           │    Check duplicate
  │           │    Verify signature
  │           │    Check counter
  │           │    Update balances
  │           │
  │◄─{ results: [ok, ok, duplicate] }
  │
  │──Mark tx1, tx2 as synced
  │──Keep tx3 for retry
```

That's all the flows! 🔄
