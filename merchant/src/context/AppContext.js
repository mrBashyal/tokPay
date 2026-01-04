import React, { createContext, useContext, useReducer, useEffect } from 'react';
import * as Keychain from 'react-native-keychain';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

// Initial state
const initialState = {
  merchant: null,
  isLoggedIn: false,
  balance: 0,
  keyPair: null,
  transactions: [],
  pendingSync: [],
  bleActive: false,
  lastCounter: {}, // Track last counter per user to prevent replay
};

// Action types
const ACTIONS = {
  SET_MERCHANT: 'SET_MERCHANT',
  SET_BALANCE: 'SET_BALANCE',
  SET_KEYPAIR: 'SET_KEYPAIR',
  ADD_TRANSACTION: 'ADD_TRANSACTION',
  ADD_PENDING_SYNC: 'ADD_PENDING_SYNC',
  CLEAR_PENDING_SYNC: 'CLEAR_PENDING_SYNC',
  SET_BLE_ACTIVE: 'SET_BLE_ACTIVE',
  UPDATE_COUNTER: 'UPDATE_COUNTER',
  LOGOUT: 'LOGOUT',
};

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_MERCHANT:
      return { 
        ...state, 
        merchant: action.payload, 
        isLoggedIn: true 
      };
    
    case ACTIONS.SET_BALANCE:
      return { ...state, balance: action.payload };
    
    case ACTIONS.SET_KEYPAIR:
      return { ...state, keyPair: action.payload };
    
    case ACTIONS.ADD_TRANSACTION:
      return { 
        ...state, 
        transactions: [action.payload, ...state.transactions],
        balance: state.balance + action.payload.amount
      };
    
    case ACTIONS.ADD_PENDING_SYNC:
      return { 
        ...state, 
        pendingSync: [...state.pendingSync, action.payload] 
      };
    
    case ACTIONS.CLEAR_PENDING_SYNC:
      return { ...state, pendingSync: [] };
    
    case ACTIONS.SET_BLE_ACTIVE:
      return { ...state, bleActive: action.payload };
    
    case ACTIONS.UPDATE_COUNTER:
      return { 
        ...state, 
        lastCounter: {
          ...state.lastCounter,
          [action.payload.userPhone]: action.payload.counter
        }
      };
    
    case ACTIONS.LOGOUT:
      return initialState;
    
    default:
      return state;
  }
}

// Create context
const AppContext = createContext();

// Provider component
export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Generate or load keypair on startup
  useEffect(() => {
    loadOrCreateKeyPair();
  }, []);

  // Load existing keypair or create new one
  async function loadOrCreateKeyPair() {
    try {
      const credentials = await Keychain.getGenericPassword({ service: 'tokpay-merchant-keys' });
      
      if (credentials) {
        const keyPair = JSON.parse(credentials.password);
        dispatch({ type: ACTIONS.SET_KEYPAIR, payload: keyPair });
      } else {
        // Generate new Ed25519 keypair
        const newKeyPair = nacl.sign.keyPair();
        const keyData = {
          publicKey: naclUtil.encodeBase64(newKeyPair.publicKey),
          secretKey: naclUtil.encodeBase64(newKeyPair.secretKey),
        };
        
        await Keychain.setGenericPassword('tokpay', JSON.stringify(keyData), { 
          service: 'tokpay-merchant-keys' 
        });
        
        dispatch({ type: ACTIONS.SET_KEYPAIR, payload: keyData });
      }
    } catch (error) {
      console.error('Failed to load/create keypair:', error);
    }
  }

  // Verify payment token from customer
  function verifyPaymentToken(token) {
    try {
      const { signature, publicKey, ...tokenData } = token;
      
      // Verify signature
      const message = JSON.stringify(tokenData);
      const messageBytes = naclUtil.decodeUTF8(message);
      const signatureBytes = naclUtil.decodeBase64(signature);
      const publicKeyBytes = naclUtil.decodeBase64(publicKey);
      
      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
      
      if (!isValid) {
        return { valid: false, error: 'Invalid signature' };
      }

      // Check amount limit
      if (token.amount > 500) {
        return { valid: false, error: 'Amount exceeds limit' };
      }

      // Check counter (prevent replay)
      const lastCounter = state.lastCounter[token.from] || -1;
      if (token.counter <= lastCounter) {
        return { valid: false, error: 'Duplicate transaction' };
      }

      // Check token expiry (60 seconds)
      const tokenAge = Date.now() - token.timestamp;
      if (tokenAge > 60000) {
        return { valid: false, error: 'Token expired' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Verification failed' };
    }
  }

  // Actions
  const actions = {
    setMerchant: (merchant) => dispatch({ type: ACTIONS.SET_MERCHANT, payload: merchant }),
    setBalance: (balance) => dispatch({ type: ACTIONS.SET_BALANCE, payload: balance }),
    addTransaction: (txn) => dispatch({ type: ACTIONS.ADD_TRANSACTION, payload: txn }),
    addPendingSync: (txn) => dispatch({ type: ACTIONS.ADD_PENDING_SYNC, payload: txn }),
    clearPendingSync: () => dispatch({ type: ACTIONS.CLEAR_PENDING_SYNC }),
    setBleActive: (active) => dispatch({ type: ACTIONS.SET_BLE_ACTIVE, payload: active }),
    updateCounter: (userPhone, counter) => 
      dispatch({ type: ACTIONS.UPDATE_COUNTER, payload: { userPhone, counter } }),
    logout: () => dispatch({ type: ACTIONS.LOGOUT }),
    verifyPaymentToken,
  };

  return (
    <AppContext.Provider value={{ state, ...actions }}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use context
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
