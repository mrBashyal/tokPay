import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';

export default function PaymentSuccessScreen({ route, navigation }) {
  const { amount, merchantName, txnId } = route.params;

  return (
    <View style={styles.container}>
      <View style={styles.successContainer}>
        <Text style={styles.checkmark}>✓</Text>
        <Text style={styles.successText}>Payment Successful!</Text>
      </View>

      <Card style={styles.detailsCard}>
        <Card.Content>
          <View style={styles.row}>
            <Text style={styles.label}>Amount</Text>
            <Text style={styles.amount}>₹{amount}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Paid to</Text>
            <Text style={styles.value}>{merchantName}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Transaction ID</Text>
            <Text style={styles.txnId}>{txnId}</Text>
          </View>
          
          <View style={styles.row}>
            <Text style={styles.label}>Mode</Text>
            <Text style={styles.value}>Offline Payment</Text>
          </View>
        </Card.Content>
      </Card>

      <Text style={styles.syncNote}>
        This payment will sync to the server when you're online.
      </Text>

      <Button
        mode="contained"
        onPress={() => navigation.navigate('Home')}
        style={styles.doneButton}
        contentStyle={styles.doneButtonContent}
      >
        Done
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
  successContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  checkmark: {
    fontSize: 100,
    color: '#4caf50',
  },
  successText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#4caf50',
    marginTop: 16,
  },
  detailsCard: {
    marginVertical: 20,
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
  amount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  value: {
    fontSize: 16,
    color: '#333',
  },
  txnId: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
  },
  syncNote: {
    textAlign: 'center',
    color: '#666',
    fontSize: 14,
    marginVertical: 20,
  },
  doneButton: {
    marginTop: 20,
  },
  doneButtonContent: {
    paddingVertical: 8,
  },
});
