import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSSO, useSignIn, useSignUp } from '@clerk/expo';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Haptics from 'expo-haptics';
import { Feather } from '@expo/vector-icons';
import colors from '@/constants/colors';

WebBrowser.maybeCompleteAuthSession();

const C = colors.dark;

function clerkErrorMessage(err: unknown): string {
  const e = err as {
    errors?: Array<{ longMessage?: string; message?: string }>;
    message?: string;
  };
  return (
    e?.errors?.[0]?.longMessage ??
    e?.errors?.[0]?.message ??
    e?.message ??
    'Something went wrong. Please try again.'
  );
}

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { startSSOFlow } = useSSO();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();

  const [mode, setMode] = useState<'options' | 'email' | 'verify'>('options');
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleResendCode() {
    if (resending) return;
    try {
      setResending(true);
      const { error } = await signUp.verifications.sendEmailCode();
      if (error) {
        Alert.alert('Could not resend code', clerkErrorMessage(error));
      } else {
        Alert.alert('Code sent', 'A new verification code is on its way to your email.');
      }
    } catch (err: unknown) {
      Alert.alert('Could not resend code', clerkErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  function handleAbandonVerification() {
    // Reset the in-progress Clerk sign-up so retrying with different
    // credentials doesn't operate on stale state.
    setCode('');
    signUp.reset?.();
    setMode('email');
  }

  async function handleGoogle() {
    try {
      setGoogleLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err: unknown) {
      Alert.alert('Sign-in failed', clerkErrorMessage(err));
    } finally {
      setGoogleLoading(false);
    }
  }

  async function handleEmailAuth() {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (authMode === 'sign-in') {
        const { error } = await signIn.password({
          emailAddress: email.trim(),
          password,
        });
        if (error) {
          Alert.alert('Sign-in failed', clerkErrorMessage(error));
          return;
        }
        if (signIn.status === 'complete') {
          await signIn.finalize();
        } else {
          Alert.alert('Sign-in incomplete', 'Additional verification is required for this account.');
        }
      } else {
        const { error } = await signUp.password({
          emailAddress: email.trim(),
          password,
        });
        if (error) {
          Alert.alert('Sign-up failed', clerkErrorMessage(error));
          return;
        }
        if (signUp.status === 'complete') {
          await signUp.finalize();
          return;
        }
        // Email verification required: send a one-time code and show the code form
        const { error: sendError } = await signUp.verifications.sendEmailCode();
        if (sendError) {
          Alert.alert('Verification failed', clerkErrorMessage(sendError));
          return;
        }
        setMode('verify');
      }
    } catch (err: unknown) {
      Alert.alert('Error', clerkErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (!code.trim()) {
      Alert.alert('Missing code', 'Please enter the verification code from your email.');
      return;
    }
    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const { error } = await signUp.verifications.verifyEmailCode({ code: code.trim() });
      if (error) {
        Alert.alert('Verification failed', clerkErrorMessage(error));
        return;
      }
      if (signUp.status === 'complete') {
        await signUp.finalize();
      } else {
        Alert.alert('Almost there', 'More information is required to finish creating your account.');
      }
    } catch (err: unknown) {
      Alert.alert('Error', clerkErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 0) }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 40 + (Platform.OS === 'web' ? 34 : 0) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand */}
          <View style={styles.brand}>
            <View style={styles.iconBox}>
              <Text style={styles.iconEmoji}>🧠</Text>
            </View>
            <Text style={styles.appName}>LearnMate AI</Text>
            <Text style={styles.tagline}>Your AI-powered study companion</Text>
          </View>

          {mode === 'options' ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Get started</Text>
              <Text style={styles.cardSubtitle}>Sign in to continue learning</Text>

              <Pressable
                style={({ pressed }) => [styles.googleBtn, pressed && styles.pressed]}
                onPress={handleGoogle}
                disabled={googleLoading}
              >
                {googleLoading ? (
                  <ActivityIndicator color={C.foreground} size="small" />
                ) : (
                  <>
                    <Text style={styles.googleIcon}>G</Text>
                    <Text style={styles.googleText}>Continue with Google</Text>
                  </>
                )}
              </Pressable>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              <Pressable
                style={({ pressed }) => [styles.emailBtn, pressed && styles.pressed]}
                onPress={() => setMode('email')}
              >
                <Feather name="mail" size={18} color={C.foreground} />
                <Text style={styles.emailText}>Continue with Email</Text>
              </Pressable>
            </View>
          ) : mode === 'verify' ? (
            <View style={styles.card}>
              <Pressable style={styles.backBtn} onPress={handleAbandonVerification}>
                <Feather name="arrow-left" size={20} color={C.mutedForeground} />
              </Pressable>

              <Text style={styles.cardTitle}>Check your email</Text>
              <Text style={styles.cardSubtitle}>
                We sent a verification code to {email.trim()}
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Verification code"
                placeholderTextColor={C.mutedForeground}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleVerifyCode}
              />

              <Pressable
                style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                onPress={handleVerifyCode}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitText}>Verify</Text>
                )}
              </Pressable>

              <Pressable style={styles.resendBtn} onPress={handleResendCode} disabled={resending}>
                {resending ? (
                  <ActivityIndicator color={C.mutedForeground} size="small" />
                ) : (
                  <Text style={styles.resendText}>I need a new code</Text>
                )}
              </Pressable>
            </View>
          ) : (
            <View style={styles.card}>
              <Pressable style={styles.backBtn} onPress={() => setMode('options')}>
                <Feather name="arrow-left" size={20} color={C.mutedForeground} />
              </Pressable>

              <View style={styles.toggleRow}>
                <Pressable
                  style={[styles.toggleBtn, authMode === 'sign-in' && styles.toggleActive]}
                  onPress={() => setAuthMode('sign-in')}
                >
                  <Text style={[styles.toggleText, authMode === 'sign-in' && styles.toggleTextActive]}>
                    Sign In
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.toggleBtn, authMode === 'sign-up' && styles.toggleActive]}
                  onPress={() => setAuthMode('sign-up')}
                >
                  <Text style={[styles.toggleText, authMode === 'sign-up' && styles.toggleTextActive]}>
                    Sign Up
                  </Text>
                </Pressable>
              </View>

              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={C.mutedForeground}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={C.mutedForeground}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleEmailAuth}
              />

              <Pressable
                style={({ pressed }) => [styles.submitBtn, pressed && styles.pressed]}
                onPress={handleEmailAuth}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitText}>
                    {authMode === 'sign-in' ? 'Sign In' : 'Create Account'}
                  </Text>
                )}
              </Pressable>

              {/* Required for sign-up flows — Clerk's bot protection is enabled by default */}
              <View nativeID="clerk-captcha" />
            </View>
          )}

          <Text style={styles.legal}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.background },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  brand: { alignItems: 'center', marginBottom: 40 },
  iconBox: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: C.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  iconEmoji: { fontSize: 36 },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 15,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    marginTop: 6,
  },
  card: {
    backgroundColor: C.card,
    borderRadius: colors.radius,
    borderWidth: 1,
    borderColor: C.cardBorder,
    padding: 24,
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: C.foreground,
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    marginBottom: 24,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.primary,
    borderRadius: colors.radius - 2,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  googleIcon: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    fontFamily: 'Inter_700Bold',
  },
  googleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  dividerText: { fontSize: 13, color: C.mutedForeground, fontFamily: 'Inter_400Regular' },
  emailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.secondary,
    borderRadius: colors.radius - 2,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  emailText: { fontSize: 16, fontWeight: '600', color: C.foreground, fontFamily: 'Inter_600SemiBold' },
  pressed: { opacity: 0.75 },
  backBtn: { marginBottom: 16 },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: C.secondary,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  toggleActive: { backgroundColor: C.primary },
  toggleText: { fontSize: 14, fontWeight: '600', color: C.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  toggleTextActive: { color: '#fff' },
  input: {
    backgroundColor: C.secondary,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: C.foreground,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    marginBottom: 12,
  },
  submitBtn: {
    backgroundColor: C.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  submitText: { fontSize: 16, fontWeight: '700', color: '#fff', fontFamily: 'Inter_700Bold' },
  resendBtn: { alignItems: 'center', paddingVertical: 12, marginTop: 8 },
  resendText: { fontSize: 14, color: C.mutedForeground, fontFamily: 'Inter_600SemiBold' },
  legal: {
    textAlign: 'center',
    fontSize: 12,
    color: C.mutedForeground,
    fontFamily: 'Inter_400Regular',
    lineHeight: 18,
  },
});
