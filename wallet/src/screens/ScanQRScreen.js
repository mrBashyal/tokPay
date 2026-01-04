import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { useApp } from '../context/AppContext';
import BLEService from '../services/BLEService';

export default function ScanQRScreen({ navigation }) {
  const { state, signPaymentToken, addTransaction, addPendingSync } = useApp();
  const [scanning, setScanning] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [qrData, setQrData] = useState(null);

  // Handle QR code scan
  const onScan = async (e) => {
    try {
      setScanning(false);
      const data = JSON.parse(e.data);
      
      // Validate QR data
      if (!data.merchantId || !data.bleId || !data.timestamp) {
        throw new Error('Invalid QR code');
      }

      // Check if QR expired (18 seconds)
      const qrAge = Date.now() - data.timestamp;
      if (qrAge > 18000) {
        Alert.alert('QR Expired', 'This QR code has expired. Please scan a new one.');
        setScanning(true);
        return;
      }

      setQrData(data);
      
      // Navigate to payment screen with merchant data
      navigation.navigate('Payment', {
        merchantId: data.merchantId,
        merchantName: data.merchantName,
        bleId: data.bleId,
        amount: data.amount, // Optional: pre-filled amount
      });

    } catch (error) {
      Alert.alert('Invalid QR', 'Could not read QR code. Please try again.');
      setScanning(true);
    }
  };

  return (
    <View style={styles.container}>
      {scanning ? (
        <>
          <QRCodeScanner
            onRead={onScan}
            topContent={
              <Text style={styles.instruction}>
                Scan merchant's QR code to pay
              </Text>
            }
            bottomContent={
              <View style={styles.bottomContent}>
                <Text style={styles.balance}>
                  Available: ₹{state.offlineBalance.toFixed(2)}
                </Text>
              </View>
            }
            containerStyle={styles.scannerContainer}
          />
        </>
      ) : connecting ? (
        <View style={styles.connecting}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.connectingText}>Connecting to merchant...</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scannerContainer: {
    flex: 1,
  },
  instruction: {
    fontSize: 18,
    color: '#fff',
    textAlign: 'center',
    padding: 20,
  },
  bottomContent: {
    padding: 20,
  },
  balance: {
    fontSize: 16,
    color: '#4caf50',
    textAlign: 'center',
  },
  connecting: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  connectingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
});
