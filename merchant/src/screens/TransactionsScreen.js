import React from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Card, Chip, Button } from 'react-native-paper';
import { useApp } from '../context/AppContext';
import ApiService from '../services/ApiService';

export default function TransactionsScreen() {
  const { state, clearPendingSync } = useApp();

  const handleSync = async () => {
    if (state.pendingSync.length === 0) return;

    try {
      const response = await ApiService.syncTransactions(state.pendingSync);
      
      if (response.success) {
        clearPendingSync();
        alert(`Synced ${response.processed} transactions`);
      } else {
        alert('Sync failed. Try again later.');
      }
    } catch (error) {
      alert('Network error. Please check your connection.');
    }
  };

  const renderTransaction = ({ item }) => (
    <Card style={styles.txnCard}>
      <Card.Content>
        <View style={styles.txnRow}>
          <View>
            <Text style={styles.txnFrom}>{item.from}</Text>
            <Text style={styles.txnTime}>
              {new Date(item.receivedAt || item.timestamp).toLocaleString()}
            </Text>
            <Text style={styles.txnId}>ID: {item.txnId}</Text>
          </View>
          <View style={styles.txnRight}>
            <Text style={styles.txnAmount}>+₹{item.amount}</Text>
            <Chip 
              mode="outlined" 
              style={[
                styles.statusChip,
                item.status === 'synced' ? styles.synced : styles.pending
              ]}
            >
              {item.status === 'synced' ? 'Synced' : 'Pending'}
            </Chip>
          </View>
        </View>
      </Card.Content>
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Sync Button */}
      {state.pendingSync.length > 0 && (
        <Card style={styles.syncCard}>
          <Card.Content style={styles.syncContent}>
            <Text>{state.pendingSync.length} transactions pending sync</Text>
            <Button mode="contained" onPress={handleSync}>
              Sync Now
            </Button>
          </Card.Content>
        </Card>
      )}

      {/* Transaction List */}
      <FlatList
        data={state.transactions}
        renderItem={renderTransaction}
        keyExtractor={(item) => item.txnId}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No transactions yet</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  syncCard: {
    margin: 16,
    backgroundColor: '#fff3e0',
  },
  syncContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  list: {
    padding: 16,
  },
  txnCard: {
    marginBottom: 12,
  },
  txnRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  txnFrom: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  txnTime: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  txnId: {
    color: '#888',
    fontSize: 10,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  txnRight: {
    alignItems: 'flex-end',
  },
  txnAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  statusChip: {
    marginTop: 8,
  },
  synced: {
    borderColor: '#4caf50',
  },
  pending: {
    borderColor: '#ff9800',
  },
  empty: {
    textAlign: 'center',
    color: '#888',
    marginTop: 50,
  },
});
