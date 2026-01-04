# TokPay - Technology Stack

## Chosen Stack (Final)

| Component | Technology | Why |
|-----------|-----------|-----|
| **UI** | React Native Paper | Fast, beautiful, ready-made |
| **State** | React Context | Simple, built-in, no boilerplate |
| **Local DB** | SQLite | Offline-first, stable |
| **Backend DB** | SQLite | Fast setup, good for MVP |
| **Secure Keys** | react-native-keychain | TEE-backed, cross-platform |
| **Crypto** | tweetnacl | Ed25519, simple API |
| **QR Scan** | react-native-qrcode-scanner | Stable, well-documented |
| **QR Generate** | react-native-qrcode-svg | SVG-based, clean |
| **BLE** | react-native-ble-plx | Full BLE, auto-connect |
| **Backend** | Node.js + Express | Fast, REST APIs |

## Package Installation

### Wallet App
```bash
npm install react-native-paper react-native-vector-icons \
  react-native-keychain tweetnacl \
  react-native-camera react-native-qrcode-scanner \
  react-native-ble-plx react-native-sqlite-storage
```

### Merchant App
```bash
npm install react-native-paper react-native-vector-icons \
  react-native-qrcode-svg react-native-svg \
  react-native-ble-plx react-native-sqlite-storage axios
```

### Backend
```bash
npm install express cors sqlite3 tweetnacl body-parser
```

## Why These Choices?

### React Native Paper
- Material Design components
- Works out of the box
- Good documentation

### React Context (not Redux)
- Simple state management
- No extra dependencies
- Perfect for this scale

### SQLite (not PostgreSQL)
- No server needed for local storage
- Fast for hackathon
- Easy backup/export

### react-native-keychain
- Hardware-backed (TEE/Secure Enclave)
- Cross-platform API
- Biometric support

### tweetnacl
- Pure JavaScript Ed25519
- No native dependencies
- Battle-tested

### react-native-ble-plx
- Full BLE Central & Peripheral
- Promise-based API
- Active maintenance

## Configuration Required

### Android Permissions (AndroidManifest.xml)
```xml
<uses-permission android:name="android.permission.CAMERA"/>
<uses-permission android:name="android.permission.BLUETOOTH"/>
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
```

### iOS Permissions (Info.plist)
```xml
<key>NSCameraUsageDescription</key>
<string>To scan QR codes</string>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>To connect with merchant</string>
```

## Performance

| Metric | Target | Achievable? |
|--------|--------|-------------|
| QR Scan | <2s | ✅ Yes |
| BLE Connect | <3s | ✅ Yes |
| Sign Token | <100ms | ✅ Yes |
| Total Payment | <10s | ✅ Yes |

## Security Summary

- **Keys**: Hardware-backed keychain
- **Signing**: Ed25519 (64-byte signatures)
- **QR Expiry**: 18 seconds
- **Counter**: Monotonic, prevents replay
- **Verification**: Offline-capable

Done! Simple and proven stack. 🛠️
