import React, { useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, Card, HelperText } from 'react-native-paper';
import { useApp } from '../context/AppContext';
import AuthService from '../services/AuthService';

export default function LoginScreen({ navigation }) {
  const { setMerchant } = useApp();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const validateInputs = () => {
    const newErrors = {};
    
    if (!phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[6-9]\d{9}$/.test(phone)) {
      newErrors.phone = 'Enter valid 10-digit phone number';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateInputs()) return;

    try {
      setLoading(true);
      const response = await AuthService.merchantLogin(phone, password);

      if (response.success) {
        await AuthService.storeTokens(response.accessToken, response.refreshToken);
        
        setMerchant(response.merchant);
        
        navigation.reset({
          index: 0,
          routes: [{ name: 'Home' }],
        });
      } else {
        Alert.alert('Login Failed', response.error || 'Invalid credentials');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.logo}>TokPay</Text>
          <Text style={styles.tagline}>Merchant Portal</Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.title}>Merchant Login</Text>
            
            <TextInput
              label="Phone Number"
              value={phone}
              onChangeText={(text) => {
                setPhone(text.replace(/[^0-9]/g, '').slice(0, 10));
                setErrors({ ...errors, phone: null });
              }}
              keyboardType="phone-pad"
              mode="outlined"
              style={styles.input}
              left={<TextInput.Affix text="+91" />}
              error={!!errors.phone}
              disabled={loading}
            />
            <HelperText type="error" visible={!!errors.phone}>
              {errors.phone}
            </HelperText>

            <TextInput
              label="Password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setErrors({ ...errors, password: null });
              }}
              secureTextEntry={!showPassword}
              mode="outlined"
              style={styles.input}
              right={
                <TextInput.Icon 
                  icon={showPassword ? 'eye-off' : 'eye'} 
                  onPress={() => setShowPassword(!showPassword)}
                />
              }
              error={!!errors.password}
              disabled={loading}
            />
            <HelperText type="error" visible={!!errors.password}>
              {errors.password}
            </HelperText>

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.loginButton}
              contentStyle={styles.buttonContent}
            >
              Login
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>New merchant?</Text>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate('Register')}
            style={styles.registerButton}
            disabled={loading}
          >
            Register Business
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4caf50',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
  },
  tagline: {
    fontSize: 18,
    color: '#e8f5e9',
    marginTop: 8,
  },
  card: {
    borderRadius: 16,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  input: {
    marginBottom: 4,
  },
  loginButton: {
    marginTop: 16,
    backgroundColor: '#4caf50',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  footer: {
    marginTop: 30,
    alignItems: 'center',
  },
  footerText: {
    color: '#fff',
    marginBottom: 12,
  },
  registerButton: {
    borderColor: '#fff',
  },
});
