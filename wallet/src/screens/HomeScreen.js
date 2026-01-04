import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Title, Paragraph, Button, Text } from 'react-native-paper';
import { useApp } from '../context/AppContext';

export default function HomeScreen({ navigation }) {
  const { state } = useApp();

  return (
    <View style={styles.container}>
      {/* Balance Card */}
      <Card style={styles.balanceCard}>
        <Card.Content>
          <Title style={styles.balanceTitle}>Offline Wallet</Title>
          <Text style={styles.balanceAmount}>₹{state.offlineBalance.toFixed(2)}</Text>
          <Paragraph style={styles.mainBalance}>
            Main Balance: ₹{state.balance.toFixed(2)}
          </Paragraph>
        </Card.Content>
      </Card>

      {/* Quick Actions */}
      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="qrcode-scan"
          onPress={() => navigation.navigate('ScanQR')}
          style={styles.scanButton}
          contentStyle={styles.buttonContent}
        >
          Scan & Pay
        </Button>

        <Button
          mode="outlined"
          icon="wallet-plus"
          onPress={() => navigation.navigate('LoadBalance')}
          style={styles.loadButton}
          contentStyle={styles.buttonContent}
        >
          Load Offline Balance
        </Button>
      </View>

      {/* Recent Transactions */}
      <Card style={styles.transactionsCard}>
        <Card.Content>
          <Title>Recent Payments</Title>
          {state.transactions.length === 0 ? (
            <Paragraph style={styles.noTxn}>No transactions yet</Paragraph>
          ) : (
            state.transactions.slice(0, 5).map((txn, index) => (
              <View key={index} style={styles.txnItem}>
                <Text>{txn.merchantName || txn.to}</Text>
                <Text style={styles.txnAmount}>-₹{txn.amount}</Text>
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      {/* Pending Sync Indicator */}
      {state.pendingSync.length > 0 && (
        <Card style={styles.syncCard}>
          <Card.Content>
            <Text style={styles.syncText}>
              {state.pendingSync.length} transaction(s) pending sync
            </Text>
            <Button mode="text" onPress={() => navigation.navigate('Sync')}>
              Sync Now
            </Button>
          </Card.Content>
        </Card>
      )}
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
    backgroundColor: '#6200ee',
  },
  balanceTitle: {
    color: '#fff',
    fontSize: 16,
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 42,
    fontWeight: 'bold',
  },
  mainBalance: {
    color: '#e0e0e0',
    marginTop: 8,
  },
  actions: {
    marginBottom: 16,
  },
  scanButton: {
    marginBottom: 12,
  },
  loadButton: {
    borderColor: '#6200ee',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  transactionsCard: {
    flex: 1,
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
  txnAmount: {
    color: '#d32f2f',
    fontWeight: 'bold',
  },
  syncCard: {
    marginTop: 16,
    backgroundColor: '#fff3e0',
  },
  syncText: {
    color: '#e65100',
  },
});
