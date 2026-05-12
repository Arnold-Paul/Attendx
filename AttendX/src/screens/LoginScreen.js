import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Device from 'expo-device';
import { colors, radius, spacing, shadow } from '../theme';
import { login, signup, getToken, getUser } from '../api';
import { useAuth } from '../context/AuthContext';

const DOMAIN = '@students.jkuat.ac.ke';

export default function LoginScreen() {
  const { signIn }            = useAuth();
  const [mode, setMode]       = useState('login');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const [showPw, setShowPw]   = useState(false);
  const [bioAvailable, setBioAvailable]   = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);

  // Login
  const [loginId, setLoginId] = useState('');
  const [loginPw, setLoginPw] = useState('');

  // Signup
  const [name,       setName]      = useState('');
  const [email,      setEmail]     = useState('');
  const [password,   setPassword]  = useState('');
  const [confirm,    setConfirm]   = useState('');
  const [programme,  setProgramme] = useState('');
  const [year,       setYear]      = useState('');

  const deviceId = Device.modelId || Device.osInternalBuildId || 'device';

  useEffect(() => {
    (async () => {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBioAvailable(hardware && enrolled);

      
      const token = await getToken();
      setHasSavedSession(!!token);
    })();
  }, []);

  
  const handleBiometric = async () => {
    const [savedToken, savedUser] = await Promise.all([getToken(), getUser()]);

    if (!savedToken || !savedUser) {
      Alert.alert(
        'Sign In First',
        'Please sign in with your email and password first. After that you can use biometrics.'
      );
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Sign in to AttendX',
      fallbackLabel: 'Use Password',
      cancelLabel:   'Cancel',
      disableDeviceFallback: false,
    });

    if (result.success) {
      signIn(savedUser, savedToken);
    } else if (result.error === 'user_cancel') {
      // user cancelled — do nothing
    } else {
      Alert.alert('Biometric Failed', 'Could not verify your identity. Please sign in with your password.');
    }
  };

  
  const handleLogin = async () => {
    if (!loginId.trim() || !loginPw.trim()) return;
    setLoading(true);
    try {
      const data = await login(loginId.trim(), loginPw, deviceId);
      setHasSavedSession(true);
      signIn(data.user, data.token);
    } catch (err) {
      Alert.alert('Login Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  
  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password.trim()) {
      return Alert.alert('Missing Fields', 'Name, email and password are required.');
    }
    if (!email.toLowerCase().endsWith(DOMAIN)) {
      return Alert.alert('Invalid Email', `Please use your official JKUAT student email ending in ${DOMAIN}`);
    }
    if (password !== confirm) {
      return Alert.alert('Password Mismatch', 'The passwords you entered do not match.');
    }
    if (password.length < 8) {
      return Alert.alert('Weak Password', 'Password must be at least 8 characters.');
    }
    setLoading(true);
    try {
      const data = await signup(name.trim(), email.trim().toLowerCase(), password, programme, year, deviceId);
      setHasSavedSession(true);
      signIn(data.user, data.token);
    } catch (err) {
      Alert.alert('Signup Failed', err.message);
    } finally {
      setLoading(false);
    }
  };

  const showBioBtn = bioAvailable && hasSavedSession;

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={s.logoRow}>
          <View style={s.logoIcon}><Feather name="map-pin" size={16} color="#fff" /></View>
          <Text style={s.logoText}>AttendX</Text>
        </View>

        <Text style={s.title}>{mode === 'login' ? 'Welcome back' : 'Create account'}</Text>
        <Text style={s.sub}>
          {mode === 'login'
            ? 'Sign in with your JKUAT email or staff ID'
            : 'Register with your official JKUAT student email'}
        </Text>

        {/* Mode toggle */}
        <View style={s.modeRow}>
          {['login', 'signup'].map((m) => (
            <TouchableOpacity key={m} style={[s.modeTab, mode === m && s.modeTabActive]} onPress={() => setMode(m)}>
              <Text style={[s.modeTabText, mode === m && s.modeTabTextActive]}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── LOGIN FORM ── */}
        {mode === 'login' && (
          <View style={s.form}>
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Email or Staff ID</Text>
              <View style={[s.inputWrap, focused === 'lid' && s.inputFocused]}>
                <Feather name="user" size={15} color={focused === 'lid' ? colors.accent : colors.textMuted} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="student@students.jkuat.ac.ke or STAFF/001"
                  placeholderTextColor={colors.textMuted}
                  value={loginId}
                  onChangeText={setLoginId}
                  onFocus={() => setFocused('lid')}
                  onBlur={() => setFocused(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={s.fieldGroup}>
              <View style={s.labelRow}>
                <Text style={s.fieldLabel}>Password</Text>
                <TouchableOpacity><Text style={s.forgot}>Forgot password?</Text></TouchableOpacity>
              </View>
              <View style={[s.inputWrap, focused === 'lpw' && s.inputFocused]}>
                <Feather name="lock" size={15} color={focused === 'lpw' ? colors.accent : colors.textMuted} style={s.inputIcon} />
                <TextInput
                  style={s.input}
                  placeholder="••••••••••"
                  placeholderTextColor={colors.textMuted}
                  value={loginPw}
                  onChangeText={setLoginPw}
                  onFocus={() => setFocused('lpw')}
                  onBlur={() => setFocused(null)}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                />
                <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eyeBtn}>
                  <Feather name={showPw ? 'eye-off' : 'eye'} size={15} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[s.btnPrimary, (!loginId || !loginPw) && s.btnDisabled]}
              onPress={handleLogin}
              disabled={loading || !loginId || !loginPw}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Sign In</Text>}
            </TouchableOpacity>

            {/* Biometric — only shows when device has biometrics AND a session was previously saved */}
            {showBioBtn && (
              <>
                <View style={s.divRow}>
                  <View style={s.divLine} /><Text style={s.divText}>or</Text><View style={s.divLine} />
                </View>
                <TouchableOpacity style={s.btnBiometric} onPress={handleBiometric} activeOpacity={0.8}>
                  <Feather name="cpu" size={17} color={colors.accent} />
                  <Text style={s.btnBiometricText}>Use Biometric Authentication</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* ── SIGNUP FORM ── */}
        {mode === 'signup' && (
          <View style={s.form}>
            {[
              { id: 'sname',  label: 'Full Name',          ph: 'Your full name',                        val: name,      set: setName,      kb: 'default',       cap: 'words' },
              { id: 'semail', label: 'JKUAT Student Email', ph: `yourname${DOMAIN}`,                    val: email,     set: setEmail,     kb: 'email-address', cap: 'none' },
              { id: 'spw',    label: 'Password',            ph: 'At least 8 characters',                val: password,  set: setPassword,  secure: true },
              { id: 'scon',   label: 'Confirm Password',    ph: 'Repeat your password',                  val: confirm,   set: setConfirm,   secure: true },
              { id: 'sprog',  label: 'Programme',           ph: 'e.g. BSc Computer Science (optional)', val: programme, set: setProgramme },
              { id: 'syear',  label: 'Year of Study',       ph: 'e.g. Year 3 (optional)',               val: year,      set: setYear },
            ].map((f) => (
              <View key={f.id} style={s.fieldGroup}>
                <Text style={s.fieldLabel}>{f.label}</Text>
                <View style={[s.inputWrap, focused === f.id && s.inputFocused]}>
                  <TextInput
                    style={s.input}
                    placeholder={f.ph}
                    placeholderTextColor={colors.textMuted}
                    value={f.val}
                    onChangeText={f.set}
                    onFocus={() => setFocused(f.id)}
                    onBlur={() => setFocused(null)}
                    secureTextEntry={f.secure && !showPw}
                    keyboardType={f.kb || 'default'}
                    autoCapitalize={f.cap || 'sentences'}
                    autoCorrect={false}
                  />
                  {f.secure && (
                    <TouchableOpacity onPress={() => setShowPw(!showPw)} style={s.eyeBtn}>
                      <Feather name={showPw ? 'eye-off' : 'eye'} size={15} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}

            <TouchableOpacity
              style={[s.btnPrimary, (!name || !email || !password || !confirm) && s.btnDisabled]}
              onPress={handleSignup}
              disabled={loading || !name || !email || !password || !confirm}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnPrimaryText}>Create Account</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex:      { flex: 1, backgroundColor: colors.bgPrimary },
  scroll:    { flex: 1 },
  container: { flexGrow: 1, padding: spacing.lg, paddingTop: 64, paddingBottom: 48 },
  logoRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 32 },
  logoIcon:  { width: 34, height: 34, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  logoText:  { fontSize: 17, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  title:     { fontSize: 28, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.7, marginBottom: 6 },
  sub:       { fontSize: 14, color: colors.textMuted, lineHeight: 20, marginBottom: 24 },
  modeRow:          { flexDirection: 'row', backgroundColor: colors.bgInput, borderRadius: radius.md, padding: 3, marginBottom: 24, borderWidth: 1, borderColor: colors.border, gap: 3 },
  modeTab:          { flex: 1, paddingVertical: 10, borderRadius: radius.sm + 2, alignItems: 'center' },
  modeTabActive:    { backgroundColor: colors.bgCard, ...shadow.card },
  modeTabText:      { fontSize: 13, fontWeight: '500', color: colors.textMuted },
  modeTabTextActive:{ color: colors.textPrimary, fontWeight: '700' },
  form:       { gap: 12 },
  fieldGroup: { gap: 5 },
  fieldLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase' },
  labelRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  forgot:     { fontSize: 12, color: colors.accent, fontWeight: '500' },
  inputWrap:    { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgInput, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13 },
  inputFocused: { borderColor: colors.accent, backgroundColor: colors.bgCard },
  inputIcon:    { marginRight: 9 },
  input:        { flex: 1, paddingVertical: 13, fontSize: 15, color: colors.textPrimary },
  eyeBtn:       { padding: 6 },
  btnPrimary:     { backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 6, ...shadow.card },
  btnDisabled:    { opacity: 0.45 },
  btnPrimaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  divRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 14 },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divText: { fontSize: 12, color: colors.textMuted },
  btnBiometric:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingVertical: 14 },
  btnBiometricText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
});