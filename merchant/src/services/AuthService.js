import * as Keychain from 'react-native-keychain';

const BASE_URL = 'http://localhost:3000/api';
const TOKEN_SERVICE = 'tokpay-merchant-tokens';

class AuthService {
  constructor() {
    this.accessToken = null;
    this.refreshToken = null;
  }

  // Store tokens securely
  async storeTokens(accessToken, refreshToken) {
    try {
      await Keychain.setGenericPassword(
        'tokens',
        JSON.stringify({ accessToken, refreshToken }),
        { service: TOKEN_SERVICE }
      );
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
    } catch (error) {
      console.error('Failed to store tokens:', error);
    }
  }

  // Load tokens from secure storage
  async loadTokens() {
    try {
      const credentials = await Keychain.getGenericPassword({ service: TOKEN_SERVICE });
      if (credentials) {
        const tokens = JSON.parse(credentials.password);
        this.accessToken = tokens.accessToken;
        this.refreshToken = tokens.refreshToken;
        return tokens;
      }
      return null;
    } catch (error) {
      console.error('Failed to load tokens:', error);
      return null;
    }
  }

  // Clear tokens (logout)
  async clearTokens() {
    try {
      await Keychain.resetGenericPassword({ service: TOKEN_SERVICE });
      this.accessToken = null;
      this.refreshToken = null;
    } catch (error) {
      console.error('Failed to clear tokens:', error);
    }
  }

  // Get valid access token (auto-refresh if needed)
  async getAccessToken() {
    if (!this.accessToken) {
      await this.loadTokens();
    }

    if (this.accessToken) {
      try {
        const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
        const expiresAt = payload.exp * 1000;
        
        if (Date.now() > expiresAt - 60000) {
          await this.refreshAccessToken();
        }
      } catch (e) {
        await this.refreshAccessToken();
      }
    }

    return this.accessToken;
  }

  // Refresh the access token
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      const data = await response.json();

      if (response.ok && data.accessToken) {
        await this.storeTokens(data.accessToken, data.refreshToken);
        return data.accessToken;
      } else {
        await this.clearTokens();
        throw new Error('Session expired. Please login again.');
      }
    } catch (error) {
      await this.clearTokens();
      throw error;
    }
  }

  // Make authenticated request
  async authFetch(url, options = {}) {
    const accessToken = await this.getAccessToken();
    
    if (!accessToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      const data = await response.json();
      if (data.code === 'TOKEN_EXPIRED') {
        await this.refreshAccessToken();
        return this.authFetch(url, options);
      }
      throw new Error('Authentication failed');
    }

    return response;
  }

  // Merchant Registration
  async merchantRegister(merchantId, phone, password, name, publicKey) {
    try {
      const response = await fetch(`${BASE_URL}/auth/merchant/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId, phone, password, name, publicKey }),
      });
      return await response.json();
    } catch (error) {
      throw new Error('Network error');
    }
  }

  // Merchant Login
  async merchantLogin(phone, password) {
    try {
      const response = await fetch(`${BASE_URL}/auth/merchant/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      return await response.json();
    } catch (error) {
      throw new Error('Network error');
    }
  }

  // Logout
  async logout() {
    try {
      const accessToken = await this.getAccessToken();
      if (accessToken) {
        await fetch(`${BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json' 
          },
        });
      }
    } catch (error) {
      console.error('Logout API failed:', error);
    } finally {
      await this.clearTokens();
    }
  }

  // Check if merchant is logged in
  async isLoggedIn() {
    const tokens = await this.loadTokens();
    if (!tokens) return false;

    try {
      const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      
      if (Date.now() > expiresAt) {
        await this.refreshAccessToken();
        return true;
      }
      return true;
    } catch (e) {
      return false;
    }
  }
}

export default new AuthService();
