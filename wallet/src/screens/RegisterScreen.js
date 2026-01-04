import React, { useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, Card, HelperText, Checkbox } from 'react-native-paper';
import { useApp } from '../context/AppContext';
import AuthService from '../services/AuthService';

export default function RegisterScreen({ navigation }) {
  const { setUser, setBalance, state } = useApp();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const validateInputs = () => {
    const newErrors = {};
    
    if (!name || name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
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
      } else if (!/[A-Z]/.test(password)) {
        newErrors.password = 'Password must contain uppercase letter';
      } else if (!/[a-z]/.test(password)) {
        newErrors.password = 'Password must contain lowercase letter';
      } else if (!/\d/.test(password)) {
        newErrors.password = 'Password must contain a number';
      } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        newErrors.password = 'Password must contain special character';
      }
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!acceptTerms) {
      newErrors.terms = 'You must accept the terms';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateInputs()) return;

    try {
      setLoading(true);

      // Get public key from app context (generated on startup)
      const publicKey = state.keyPair?.publicKey || 'temp-public-key';

      const response = await AuthService.register(phone, password, name, publicKey);

      if (response.success) {
        // Store tokens
        await AuthService.storeTokens(response.accessToken, response.refreshToken);
        
        // Update app state
        setUser({ phone, name, publicKey });
        setBalance(1000, 0); // Starting balance
        
        Alert.alert(
          'Registration Successful',
          'Welcome to TokPay! Your account has been created.',
          [
            {
              text: 'Continue',
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
      Alert.alert('Error', error.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (!password) return { strength: 0, label: '', color: '#ccc' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength++;

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
    const colors = ['#ccc', '#f44336', '#ff9800', '#ffeb3b', '#8bc34a', '#4caf50'];

    return { strength, label: labels[strength], color: colors[strength] };
  };

  const passwordStrength = getPasswordStrength();

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.logo}>TokPay</Text>
          <Text style={styles.tagline}>Create Your Account</Text>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <TextInput
              label="Full Name"
              value={name}
              onChangeText={(text) => {
                setName(text);
                setErrors({ ...errors, name: null });
              }}
              mode="outlined"
              style={styles.input}
              left={<TextInput.Icon icon="account" />}
              error={!!errors.name}
              disabled={loading}
            />
            <HelperText type="error" visible={!!errors.name}>
              {errors.name}
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
            {password.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthSegment,
                        { backgroundColor: i <= passwordStrength.strength ? passwordStrength.color : '#e0e0e0' }
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                  {passwordStrength.label}
                </Text>
              </View>
            )}
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
                disabled={loading}
              />
              <Text style={styles.termsText}>
                I accept the Terms of Service and Privacy Policy
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
              Create Account
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account?</Text>
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
    backgroundColor: '#6200ee',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
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
    color: '#e0e0e0',
    marginTop: 4,
  },
  card: {
    borderRadius: 16,
    elevation: 4,
  },
  input: {
    marginBottom: 4,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  strengthBar: {
    flex: 1,
    flexDirection: 'row',
    height: 4,
    gap: 4,
  },
  strengthSegment: {
    flex: 1,
    borderRadius: 2,
  },
  strengthLabel: {
    marginLeft: 8,
    fontSize: 12,
    fontWeight: 'bold',
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
