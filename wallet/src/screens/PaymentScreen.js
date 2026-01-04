import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Vibration } from 'react-native';
import { Text, TextInput, Button, Card, ActivityIndicator } from 'react-native-paper';
import { useApp } from '../context/AppContext';
import BLEService from '../services/BLEService';

export default function PaymentScreen({ route, navigation }) {
  const { merchantId, merchantName, bleId, amount: prefilledAmount } = route.params;
  const { state, signPaymentToken, addTransaction, addPendingSync } = useApp();
  
  const [amount, setAmount] = useState(prefilledAmount?.toString() || '');
  const [status, setStatus] = useState('idle'); // idle, connecting, sending, success, error
  const [errorMessage, setErrorMessage] = useState('');

  // Handle payment
  const handlePay = async () => {
    const payAmount = parseFloat(amount);

    // Validate amount
    if (!payAmount || payAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (payAmount > 500) {
      Alert.alert('Limit Exceeded', 'Maximum offline payment is ₹500');
      return;
    }

    if (payAmount > state.offlineBalance) {
      Alert.alert('Insufficient Balance', 'Not enough offline balance');
      return;
    }

    try {
      setStatus('connecting');
      
      // Connect to merchant via BLE
      await BLEService.connect(bleId);
      
      setStatus('sending');
      
      // Sign the payment token
      const token = signPaymentToken(merchantId, payAmount);
      
      if (!token) {
        throw new Error('Failed to sign token');
      }

      // Send token via BLE
      const response = await BLEService.sendPayment(token);
      
      if (response.success) {
        setStatus('success');
        Vibration.vibrate(200);
        
        // Add to local transactions
        addTransaction({
          ...token,
          merchantName,
          status: 'completed',
        });

        // Add to pending sync queue
        addPendingSync(token);

        // Navigate to success screen after delay
        setTimeout(() => {
          navigation.navigate('PaymentSuccess', {
            amount: payAmount,
            merchantName,
            txnId: token.txnId,
          });
        }, 1000);
      } else {
        throw new Error(response.error || 'Payment failed');
      }

    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message);
      
      // Retry with offline mode if BLE fails
      if (error.message.includes('BLE') || error.message.includes('connect')) {
        Alert.alert(
          'Connection Failed',
          'Could not connect to merchant. Save payment for later sync?',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Save Offline', 
              onPress: () => saveOfflinePayment(payAmount)
            },
          ]
        );
      }
    }
  };

  // Save payment for later sync (when BLE fails)
  const saveOfflinePayment = (payAmount) => {
    const token = signPaymentToken(merchantId, payAmount);
    
    addTransaction({
      ...token,
      merchantName,
      status: 'pending',
    });
    
    addPendingSync(token);
    
    Alert.alert('Saved', 'Payment saved. Will sync when online.');
    navigation.navigate('Home');
  };

  return (
    <View style={styles.container}>
      <Card style={styles.merchantCard}>
        <Card.Content>
          <Text style={styles.payingTo}>Paying to</Text>
          <Text style={styles.merchantName}>{merchantName || merchantId}</Text>
        </Card.Content>
      </Card>

      {status === 'idle' && (
        <>
          <View style={styles.amountContainer}>
            <Text style={styles.rupee}>₹</Text>
            <TextInput
              style={styles.amountInput}
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholder="0"
              autoFocus
            />
          </View>

          <Text style={styles.available}>
            Available: ₹{state.offlineBalance.toFixed(2)}
          </Text>

          <Button
            mode="contained"
            onPress={handlePay}
            style={styles.payButton}
            contentStyle={styles.payButtonContent}
            disabled={!amount}
          >
            Pay ₹{amount || '0'}
          </Button>
        </>
      )}

      {status === 'connecting' && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.statusText}>Connecting to merchant...</Text>
        </View>
      )}

      {status === 'sending' && (
        <View style={styles.statusContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <Text style={styles.statusText}>Sending payment...</Text>
        </View>
      )}

      {status === 'success' && (
        <View style={styles.statusContainer}>
          <Text style={styles.successIcon}>✓</Text>
          <Text style={styles.successText}>Payment Successful!</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.statusContainer}>
          <Text style={styles.errorIcon}>✗</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <Button mode="outlined" onPress={() => setStatus('idle')}>
            Try Again
          </Button>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  merchantCard: {
    marginBottom: 30,
  },
  payingTo: {
    color: '#666',
    fontSize: 14,
  },
  merchantName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  rupee: {
    fontSize: 48,
    color: '#333',
  },
  amountInput: {
    fontSize: 48,
    fontWeight: 'bold',
    minWidth: 150,
    textAlign: 'center',
    backgroundColor: 'transparent',
  },
  available: {
    textAlign: 'center',
    color: '#666',
    marginBottom: 30,
  },
  payButton: {
    marginTop: 20,
  },
  payButtonContent: {
    paddingVertical: 10,
  },
  statusContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    marginTop: 20,
    fontSize: 18,
    color: '#666',
  },
  successIcon: {
    fontSize: 80,
    color: '#4caf50',
  },
  successText: {
    marginTop: 20,
    fontSize: 24,
    color: '#4caf50',
    fontWeight: 'bold',
  },
  errorIcon: {
    fontSize: 80,
    color: '#f44336',
  },
  errorText: {
    marginTop: 20,
    fontSize: 18,
    color: '#f44336',
    textAlign: 'center',
    marginBottom: 20,
  },
});
