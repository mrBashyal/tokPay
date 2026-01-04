import React, { createContext, useContext, useReducer, useEffect } from 'react';
import * as Keychain from 'react-native-keychain';
import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

// Initial state
const initialState = {
  user: null,
  isLoggedIn: false,
  balance: 0,
  offlineBalance: 0,
  keyPair: null,
  transactions: [],
  pendingSync: [],
  counter: 0,
};

// Action types
const ACTIONS = {
  SET_USER: 'SET_USER',
  SET_BALANCE: 'SET_BALANCE',
  SET_KEYPAIR: 'SET_KEYPAIR',
  ADD_TRANSACTION: 'ADD_TRANSACTION',
  ADD_PENDING_SYNC: 'ADD_PENDING_SYNC',
  CLEAR_PENDING_SYNC: 'CLEAR_PENDING_SYNC',
  INCREMENT_COUNTER: 'INCREMENT_COUNTER',
  LOGOUT: 'LOGOUT',
};

// Reducer
function appReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_USER:
      return { 
        ...state, 
        user: action.payload, 
        isLoggedIn: true 
      };
    
    case ACTIONS.SET_BALANCE:
      return { 
        ...state, 
        balance: action.payload.balance,
        offlineBalance: action.payload.offlineBalance 
      };
    
    case ACTIONS.SET_KEYPAIR:
      return { ...state, keyPair: action.payload };
    
    case ACTIONS.ADD_TRANSACTION:
      return { 
        ...state, 
        transactions: [action.payload, ...state.transactions],
        offlineBalance: state.offlineBalance - action.payload.amount
      };
    
    case ACTIONS.ADD_PENDING_SYNC:
      return { 
        ...state, 
        pendingSync: [...state.pendingSync, action.payload] 
      };
    
    case ACTIONS.CLEAR_PENDING_SYNC:
      return { ...state, pendingSync: [] };
    
    case ACTIONS.INCREMENT_COUNTER:
      return { ...state, counter: state.counter + 1 };
    
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
      const credentials = await Keychain.getGenericPassword({ service: 'tokpay-keys' });
      
      if (credentials) {
        // Parse existing keypair
        const keyPair = JSON.parse(credentials.password);
        dispatch({ type: ACTIONS.SET_KEYPAIR, payload: keyPair });
      } else {
        // Generate new Ed25519 keypair
        const newKeyPair = nacl.sign.keyPair();
        const keyData = {
          publicKey: naclUtil.encodeBase64(newKeyPair.publicKey),
          secretKey: naclUtil.encodeBase64(newKeyPair.secretKey),
        };
        
        // Store in secure storage
        await Keychain.setGenericPassword('tokpay', JSON.stringify(keyData), { 
          service: 'tokpay-keys' 
        });
        
        dispatch({ type: ACTIONS.SET_KEYPAIR, payload: keyData });
      }
    } catch (error) {
      console.error('Failed to load/create keypair:', error);
    }
  }

  // Sign a payment token
  function signPaymentToken(merchantId, amount) {
    if (!state.keyPair) return null;

    const tokenData = {
      from: state.user?.phone,
      to: merchantId,
      amount: amount,
      counter: state.counter,
      timestamp: Date.now(),
      txnId: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    const message = JSON.stringify(tokenData);
    const messageBytes = naclUtil.decodeUTF8(message);
    const secretKey = naclUtil.decodeBase64(state.keyPair.secretKey);
    const signature = nacl.sign.detached(messageBytes, secretKey);

    dispatch({ type: ACTIONS.INCREMENT_COUNTER });

    return {
      ...tokenData,
      signature: naclUtil.encodeBase64(signature),
      publicKey: state.keyPair.publicKey,
    };
  }

  // Actions
  const actions = {
    setUser: (user) => dispatch({ type: ACTIONS.SET_USER, payload: user }),
    setBalance: (balance, offlineBalance) => 
      dispatch({ type: ACTIONS.SET_BALANCE, payload: { balance, offlineBalance } }),
    addTransaction: (txn) => dispatch({ type: ACTIONS.ADD_TRANSACTION, payload: txn }),
    addPendingSync: (txn) => dispatch({ type: ACTIONS.ADD_PENDING_SYNC, payload: txn }),
    clearPendingSync: () => dispatch({ type: ACTIONS.CLEAR_PENDING_SYNC }),
    logout: () => dispatch({ type: ACTIONS.LOGOUT }),
    signPaymentToken,
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
