import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { Text, TextInput, Button, Card, ActivityIndicator } from 'react-native-paper';
import { useApp } from '../context/AppContext';
import ApiService from '../services/ApiService';

export default function LoadBalanceScreen({ navigation }) {
  const { state, setBalance } = useApp();
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoad = async () => {
    const loadAmount = parseFloat(amount);

    if (!loadAmount || loadAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (loadAmount > 2000) {
      Alert.alert('Limit Exceeded', 'Maximum offline balance is ₹2000');
      return;
    }

    if (state.offlineBalance + loadAmount > 2000) {
      Alert.alert('Limit Exceeded', `You can only load ₹${2000 - state.offlineBalance} more`);
      return;
    }

    if (loadAmount > state.balance) {
      Alert.alert('Insufficient Balance', 'Not enough main balance');
      return;
    }

    try {
      setLoading(true);
      
      // Call API to load balance
      const response = await ApiService.loadBalance(state.user.phone, loadAmount);
      
      if (response.success) {
        setBalance(
          state.balance - loadAmount,
          state.offlineBalance + loadAmount
        );
        
        Alert.alert('Success', `₹${loadAmount} loaded to offline wallet`);
        navigation.goBack();
      } else {
        Alert.alert('Error', response.error || 'Failed to load balance');
      }
    } catch (error) {
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.infoCard}>
        <Card.Content>
          <View style={styles.row}>
            <Text style={styles.label}>Main Balance</Text>
            <Text style={styles.value}>₹{state.balance.toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Offline Balance</Text>
            <Text style={styles.value}>₹{state.offlineBalance.toFixed(2)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Can Load More</Text>
            <Text style={styles.value}>₹{(2000 - state.offlineBalance).toFixed(2)}</Text>
          </View>
        </Card.Content>
      </Card>

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

      <Text style={styles.hint}>
        Enter amount to transfer from main wallet to offline wallet.
        Maximum offline balance: ₹2000
      </Text>

      <Button
        mode="contained"
        onPress={handleLoad}
        style={styles.loadButton}
        contentStyle={styles.loadButtonContent}
        disabled={loading || !amount}
        loading={loading}
      >
        Load ₹{amount || '0'} to Offline Wallet
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  infoCard: {
    marginBottom: 30,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  label: {
    color: '#666',
    fontSize: 16,
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
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
  hint: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginBottom: 30,
  },
  loadButton: {
    marginTop: 20,
  },
  loadButtonContent: {
    paddingVertical: 10,
  },
});
