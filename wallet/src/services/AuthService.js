import * as Keychain from 'react-native-keychain';

const BASE_URL = 'http://localhost:3000/api';
const TOKEN_SERVICE = 'tokpay-auth-tokens';

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

    // Check if token is expired (decode JWT without verification)
    if (this.accessToken) {
      try {
        const payload = JSON.parse(atob(this.accessToken.split('.')[1]));
        const expiresAt = payload.exp * 1000;
        
        // Refresh if expiring in less than 1 minute
        if (Date.now() > expiresAt - 60000) {
          await this.refreshAccessToken();
        }
      } catch (e) {
        // Token is invalid, try refresh
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
        // Refresh failed, clear tokens and force re-login
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

    // Handle token expired error
    if (response.status === 401) {
      const data = await response.json();
      if (data.code === 'TOKEN_EXPIRED') {
        // Try to refresh and retry request
        await this.refreshAccessToken();
        return this.authFetch(url, options);
      }
      throw new Error('Authentication failed');
    }

    return response;
  }

  // User Registration
  async register(phone, password, name, publicKey) {
    try {
      const response = await fetch(`${BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password, name, publicKey }),
      });
      return await response.json();
    } catch (error) {
      throw new Error('Network error');
    }
  }

  // User Login
  async login(phone, password) {
    try {
      const response = await fetch(`${BASE_URL}/auth/login`, {
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

  // Check if user is logged in
  async isLoggedIn() {
    const tokens = await this.loadTokens();
    if (!tokens) return false;

    try {
      // Verify token is still valid
      const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
      const expiresAt = payload.exp * 1000;
      
      if (Date.now() > expiresAt) {
        // Token expired, try refresh
        await this.refreshAccessToken();
        return true;
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  // Change password
  async changePassword(currentPassword, newPassword) {
    const response = await this.authFetch(`${BASE_URL}/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return await response.json();
  }

  // Set payment PIN
  async setPin(pin) {
    const response = await this.authFetch(`${BASE_URL}/auth/set-pin`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    return await response.json();
  }

  // Verify PIN
  async verifyPin(pin) {
    const response = await this.authFetch(`${BASE_URL}/auth/verify-pin`, {
      method: 'POST',
      body: JSON.stringify({ pin }),
    });
    return await response.json();
  }
}

export default new AuthService();
