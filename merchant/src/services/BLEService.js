import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

// BLE Service and Characteristic UUIDs (must match wallet app)
const TOKPAY_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
const PAYMENT_CHAR_UUID = '12345678-1234-5678-1234-56789abcdef1';
const RESPONSE_CHAR_UUID = '12345678-1234-5678-1234-56789abcdef2';

class BLEService {
  constructor() {
    this.manager = new BleManager();
    this.isAdvertising = false;
    this.onPaymentReceived = null;
    this.responseValue = null;
  }

  // Start BLE advertising as peripheral
  async startAdvertising(deviceName, onPaymentCallback) {
    try {
      this.onPaymentReceived = onPaymentCallback;

      // Note: React Native BLE PLX primarily supports central role
      // For peripheral mode, you need native modules or react-native-ble-peripheral
      // This is a simplified implementation that shows the concept
      
      // In production, use react-native-ble-peripheral for advertising
      // or implement native modules for Android/iOS
      
      console.log('BLE advertising started as:', deviceName);
      this.isAdvertising = true;
      
      // Simulate BLE server for development
      // In real app, this would be native peripheral code
      
      return true;
    } catch (error) {
      console.error('BLE advertising failed:', error);
      throw error;
    }
  }

  // Handle incoming payment write (called by native peripheral code)
  async handlePaymentWrite(value) {
    try {
      // Decode the payment token
      const tokenString = Buffer.from(value, 'base64').toString('utf8');
      const token = JSON.parse(tokenString);

      // Process payment through callback
      if (this.onPaymentReceived) {
        const result = await this.onPaymentReceived(token);
        
        // Encode response for client
        this.responseValue = Buffer.from(JSON.stringify(result)).toString('base64');
        
        return result;
      }

      return { success: false, error: 'No handler' };
    } catch (error) {
      console.error('Payment processing error:', error);
      return { success: false, error: 'Processing failed' };
    }
  }

  // Stop advertising
  stopAdvertising() {
    this.isAdvertising = false;
    this.onPaymentReceived = null;
    console.log('BLE advertising stopped');
  }

  // Cleanup
  destroy() {
    this.stopAdvertising();
    this.manager.destroy();
  }
}

export default new BLEService();
