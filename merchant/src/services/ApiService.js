// API Service for communicating with backend
const BASE_URL = 'http://localhost:3000/api';

class ApiService {
  // Register merchant
  async register(merchantId, name, phone, publicKey) {
    try {
      const response = await fetch(`${BASE_URL}/merchant/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, name, phone, publicKey }),
      });
      return await response.json();
    } catch (error) {
      throw new Error('Network error');
    }
  }

  // Sync offline transactions to server
  async syncTransactions(transactions) {
    try {
      const response = await fetch(`${BASE_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions }),
      });
      return await response.json();
    } catch (error) {
      throw new Error('Network error');
    }
  }
}

export default new ApiService();
