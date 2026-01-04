import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, AppState } from 'react-native';
import { Text, Card, FAB, Badge, Switch } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';
import { useApp } from '../context/AppContext';
import BLEService from '../services/BLEService';

export default function HomeScreen({ navigation }) {
  const { state, addTransaction, addPendingSync, updateCounter, setBleActive } = useApp();
  const [qrData, setQrData] = useState('');
  const [qrTimestamp, setQrTimestamp] = useState(Date.now());
  const [countdown, setCountdown] = useState(18);
  const intervalRef = useRef(null);

  // Generate dynamic QR code
  const generateQR = () => {
    const data = {
      merchantId: state.merchant?.merchantId || 'MERCHANT001',
      merchantName: state.merchant?.name || 'Demo Merchant',
      bleId: `TOKPAY-${state.merchant?.merchantId || 'M001'}`,
      timestamp: Date.now(),
    };
    setQrData(JSON.stringify(data));
    setQrTimestamp(Date.now());
    setCountdown(18);
  };

  // Start QR refresh timer (every 18 seconds)
  useEffect(() => {
    generateQR();
    
    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          generateQR();
          return 18;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Start BLE server to receive payments
  useEffect(() => {
    startBLEServer();

    return () => {
      BLEService.stopAdvertising();
    };
  }, []);

  const startBLEServer = async () => {
    try {
      await BLEService.startAdvertising(
        `TOKPAY-${state.merchant?.merchantId || 'M001'}`,
        handlePaymentReceived
      );
      setBleActive(true);
    } catch (error) {
      console.error('BLE start failed:', error);
      setBleActive(false);
    }
  };

  // Handle incoming payment from customer
  const handlePaymentReceived = async (paymentToken) => {
    const verification = state.verifyPaymentToken?.(paymentToken);
    
    if (!verification) {
      return { success: false, error: 'Verification not available' };
    }

    if (!verification.valid) {
      return { success: false, error: verification.error };
    }

    // Accept payment
    const transaction = {
      ...paymentToken,
      status: 'received',
      receivedAt: Date.now(),
    };

    addTransaction(transaction);
    addPendingSync(transaction);
    updateCounter(paymentToken.from, paymentToken.counter);

    return { 
      success: true, 
      txnId: paymentToken.txnId,
      message: 'Payment received'
    };
  };

  return (
    <View style={styles.container}>
      {/* Balance Card */}
      <Card style={styles.balanceCard}>
        <Card.Content>
          <Text style={styles.balanceTitle}>Today's Collection</Text>
          <Text style={styles.balanceAmount}>₹{state.balance.toFixed(2)}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, state.bleActive ? styles.active : styles.inactive]} />
            <Text style={styles.statusText}>
              {state.bleActive ? 'Ready to receive' : 'BLE offline'}
            </Text>
          </View>
        </Card.Content>
      </Card>

      {/* QR Code Display */}
      <Card style={styles.qrCard}>
        <Card.Content style={styles.qrContent}>
          <Text style={styles.scanText}>Scan to Pay</Text>
          
          {qrData ? (
            <View style={styles.qrContainer}>
              <QRCode
                value={qrData}
                size={220}
                backgroundColor="white"
              />
            </View>
          ) : (
            <Text>Generating QR...</Text>
          )}

          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>
              Refreshes in {countdown}s
            </Text>
            <View style={styles.timerBar}>
              <View 
                style={[
                  styles.timerProgress, 
                  { width: `${(countdown / 18) * 100}%` }
                ]} 
              />
            </View>
          </View>
        </Card.Content>
      </Card>

      {/* Recent Transactions */}
      <Card style={styles.transactionsCard}>
        <Card.Content>
          <View style={styles.txnHeader}>
            <Text style={styles.txnTitle}>Recent Payments</Text>
            {state.pendingSync.length > 0 && (
              <Badge style={styles.syncBadge}>{state.pendingSync.length} pending</Badge>
            )}
          </View>
          
          {state.transactions.length === 0 ? (
            <Text style={styles.noTxn}>No payments received yet</Text>
          ) : (
            state.transactions.slice(0, 3).map((txn, index) => (
              <View key={index} style={styles.txnItem}>
                <View>
                  <Text>{txn.from}</Text>
                  <Text style={styles.txnTime}>
                    {new Date(txn.receivedAt || txn.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
                <Text style={styles.txnAmount}>+₹{txn.amount}</Text>
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      {/* History FAB */}
      <FAB
        icon="history"
        style={styles.fab}
        onPress={() => navigation.navigate('Transactions')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5',
  },
  balanceCard: {
    marginBottom: 16,
    backgroundColor: '#4caf50',
  },
  balanceTitle: {
    color: '#fff',
    fontSize: 14,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  active: {
    backgroundColor: '#c8e6c9',
  },
  inactive: {
    backgroundColor: '#ffcdd2',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
  },
  qrCard: {
    marginBottom: 16,
  },
  qrContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  scanText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  timerContainer: {
    width: '100%',
    marginTop: 16,
    alignItems: 'center',
  },
  timerText: {
    color: '#666',
    marginBottom: 8,
  },
  timerBar: {
    width: '80%',
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  timerProgress: {
    height: '100%',
    backgroundColor: '#6200ee',
    borderRadius: 2,
  },
  transactionsCard: {
    flex: 1,
  },
  txnHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  txnTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  syncBadge: {
    backgroundColor: '#ff9800',
  },
  noTxn: {
    color: '#888',
    textAlign: 'center',
    marginTop: 20,
  },
  txnItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  txnTime: {
    color: '#888',
    fontSize: 12,
  },
  txnAmount: {
    color: '#4caf50',
    fontWeight: 'bold',
    fontSize: 18,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});
