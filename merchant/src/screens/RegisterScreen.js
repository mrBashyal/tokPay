import React, { useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, Card, HelperText, Checkbox } from 'react-native-paper';
import { useApp } from '../context/AppContext';
import AuthService from '../services/AuthService';

export default function RegisterScreen({ navigation }) {
  const { setMerchant, state } = useApp();
  const [merchantId, setMerchantId] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const validateInputs = () => {
    const newErrors = {};
    
    if (!merchantId || merchantId.length < 3) {
      newErrors.merchantId = 'Merchant ID must be at least 3 characters';
    } else if (!/^[A-Z0-9]+$/.test(merchantId)) {
      newErrors.merchantId = 'Only uppercase letters and numbers allowed';
    }

    if (!businessName || businessName.trim().length < 2) {
      newErrors.businessName = 'Business name is required';
    }

    if (!phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^[6-9]\d{9}$/.test(phone)) {
      newErrors.phone = 'Enter valid 10-digit phone number';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else {
      if (password.length < 8) {
        newErrors.password = 'Password must be at least 8 characters';
      } else if (!/[A-Z]/.test(password) || !/[a-z]/.test(password)) {
        newErrors.password = 'Include upper and lowercase letters';
      } else if (!/\d/.test(password)) {
        newErrors.password = 'Include at least one number';
      } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        newErrors.password = 'Include a special character';
      }
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      newErrors.terms = 'Accept terms to continue';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateInputs()) return;

    try {
      setLoading(true);

      const publicKey = state.keyPair?.publicKey || 'temp-merchant-key';

      const response = await AuthService.merchantRegister(
        merchantId,
        phone,
        password,
        businessName,
        publicKey
      );

      if (response.success) {
        await AuthService.storeTokens(response.accessToken, response.refreshToken);
        
        setMerchant(response.merchant);
        
        Alert.alert(
          'Registration Successful',
          `Welcome to TokPay! Your Merchant ID is ${merchantId}`,
          [
            {
              text: 'Start Accepting Payments',
              onPress: () => navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }],
              })
            }
          ]
        );
      } else {
        Alert.alert('Registration Failed', response.error || 'Please try again');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Network error');
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
          <Text style={styles.tagline}>Register Your Business</Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Merchant ID"
              value={merchantId}
              onChangeText={(text) => {
                setMerchantId(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10));
                setErrors({ ...errors, merchantId: null });
              }}
              mode="outlined"
              style={styles.input}
              placeholder="e.g., SHOP001"
              left={<TextInput.Icon icon="store" />}
              error={!!errors.merchantId}
              disabled={loading}
            />
            <HelperText type="error" visible={!!errors.merchantId}>
              {errors.merchantId}
            </HelperText>

            <TextInput
              label="Business Name"
              value={businessName}
              onChangeText={(text) => {
                setBusinessName(text);
                setErrors({ ...errors, businessName: null });
              }}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="domain" />}
              error={!!errors.businessName}
              disabled={loading}
            />
            <HelperText type="error" visible={!!errors.businessName}>
              {errors.businessName}
            </HelperText>

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

            <TextInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setErrors({ ...errors, confirmPassword: null });
              }}
              secureTextEntry={!showPassword}
              mode="outlined"
              style={styles.input}
              error={!!errors.confirmPassword}
              disabled={loading}
            />
            <HelperText type="error" visible={!!errors.confirmPassword}>
              {errors.confirmPassword}
            </HelperText>

            <View style={styles.termsContainer}>
              <Checkbox
                status={acceptTerms ? 'checked' : 'unchecked'}
                onPress={() => {
                  setAcceptTerms(!acceptTerms);
                  setErrors({ ...errors, terms: null });
                }}
                color="#4caf50"
                disabled={loading}
              />
              <Text style={styles.termsText}>
                I accept the Merchant Agreement and Terms of Service
              </Text>
            </View>
            <HelperText type="error" visible={!!errors.terms}>
              {errors.terms}
            </HelperText>

            <Button
              mode="contained"
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.registerButton}
              contentStyle={styles.buttonContent}
            >
              Register Business
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already registered?</Text>
          <Button
            mode="outlined"
            onPress={() => navigation.navigate('Login')}
            style={styles.loginButton}
            disabled={loading}
          >
            Login
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
    padding: 20,
    paddingTop: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  tagline: {
    fontSize: 16,
    color: '#e8f5e9',
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    elevation: 4,
  },
  input: {
    marginBottom: 4,
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  termsText: {
    flex: 1,
    fontSize: 12,
    color: '#666',
  },
  registerButton: {
    marginTop: 16,
    backgroundColor: '#4caf50',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
    paddingBottom: 20,
  },
  footerText: {
    color: '#fff',
    marginBottom: 12,
  },
  loginButton: {
    borderColor: '#fff',
  },
});
