import { BleManager } from 'react-native-ble-plx';
import { Buffer } from 'buffer';

// BLE Service and Characteristic UUIDs (must match merchant app)
const TOKPAY_SERVICE_UUID = '12345678-1234-5678-1234-56789abcdef0';
const PAYMENT_CHAR_UUID = '12345678-1234-5678-1234-56789abcdef1';
const RESPONSE_CHAR_UUID = '12345678-1234-5678-1234-56789abcdef2';

class BLEService {
  constructor() {
    this.manager = new BleManager();
    this.device = null;
    this.isConnected = false;
  }

  // Initialize BLE
  async initialize() {
    return new Promise((resolve, reject) => {
      const subscription = this.manager.onStateChange((state) => {
        if (state === 'PoweredOn') {
          subscription.remove();
          resolve(true);
        } else if (state === 'PoweredOff') {
          subscription.remove();
          reject(new Error('Bluetooth is off. Please turn it on.'));
        }
      }, true);
    });
  }

  // Connect to merchant device using BLE ID from QR code
  async connect(bleId) {
    try {
      await this.initialize();

      // Scan for the specific device
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.manager.stopDeviceScan();
          reject(new Error('Could not find merchant. Please try again.'));
        }, 10000); // 10 second timeout

        this.manager.startDeviceScan(
          [TOKPAY_SERVICE_UUID],
          { allowDuplicates: false },
          async (error, device) => {
            if (error) {
              clearTimeout(timeout);
              reject(error);
              return;
            }

            // Match the device by BLE ID from QR
            if (device && device.name === bleId) {
              clearTimeout(timeout);
              this.manager.stopDeviceScan();

              try {
                // Connect to device
                this.device = await device.connect({ timeout: 5000 });
                
                // Discover services
                await this.device.discoverAllServicesAndCharacteristics();
                
                this.isConnected = true;
                resolve(true);
              } catch (connectError) {
                reject(new Error('BLE connection failed'));
              }
            }
          }
        );
      });
    } catch (error) {
      throw new Error('BLE initialization failed: ' + error.message);
    }
  }

  // Send payment token to merchant
  async sendPayment(token) {
    if (!this.isConnected || !this.device) {
      throw new Error('Not connected to merchant');
    }

    try {
      // Convert token to base64
      const tokenString = JSON.stringify(token);
      const tokenBase64 = Buffer.from(tokenString).toString('base64');

      // Write token to payment characteristic
      await this.device.writeCharacteristicWithResponseForService(
        TOKPAY_SERVICE_UUID,
        PAYMENT_CHAR_UUID,
        tokenBase64
      );

      // Read response from merchant
      const response = await this.device.readCharacteristicForService(
        TOKPAY_SERVICE_UUID,
        RESPONSE_CHAR_UUID
      );

      // Decode response
      const responseData = Buffer.from(response.value, 'base64').toString('utf8');
      const result = JSON.parse(responseData);

      // Disconnect after payment
      await this.disconnect();

      return result;
    } catch (error) {
      await this.disconnect();
      throw new Error('Payment transmission failed: ' + error.message);
    }
  }

  // Disconnect from device
  async disconnect() {
    if (this.device) {
      try {
        await this.device.cancelConnection();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.device = null;
      this.isConnected = false;
    }
  }

  // Cleanup
  destroy() {
    this.disconnect();
    this.manager.destroy();
  }
}

export default new BLEService();
