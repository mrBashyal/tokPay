// API Service for communicating with backend
const BASE_URL = 'http://localhost:3000/api';

class ApiService {
  // Register new user
  async register(phone, name, publicKey) {
    try {
      const response = await fetch(`${BASE_URL}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, publicKey }),
      });
      return await response.json();
    } catch (error) {
      throw new Error('Network error');
    }
  }

  // Get user balance
  async getBalance(phone) {
    try {
      const response = await fetch(`${BASE_URL}/balance/${phone}`);
      return await response.json();
    } catch (error) {
      throw new Error('Network error');
    }
  }

  // Load offline balance
  async loadBalance(phone, amount) {
    try {
      const response = await fetch(`${BASE_URL}/load-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, amount }),
      });
      return await response.json();
    } catch (error) {
      throw new Error('Network error');
    }
  }

  // Sync offline transactions
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
