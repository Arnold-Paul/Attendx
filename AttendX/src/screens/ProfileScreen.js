import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, shadow } from '../theme';
import { useAuth } from '../context/AuthContext';
import { logout, updateProfile } from '../api';

export default function ProfileScreen() {
  const { user, signOut, signIn } = useAuth();
  const insets = useSafeAreaInsets();

  const [editing, setEditing]       = useState(false);
  const [name,    setName]          = useState(user?.name        || '');
  const [prog,    setProg]          = useState(user?.programme   || '');
  const [year,    setYear]          = useState(user?.year        || '');
  const [saving,  setSaving]        = useState(false);

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '??';
  const topPad   = insets.top + 12;

  const handleSave = async () => {
    if (!name.trim()) { Alert.alert('Name required', 'Please enter your full name.'); return; }
    setSaving(true);
    try {
      const res = await updateProfile({ name: name.trim(), programme: prog.trim(), year: year.trim() });
      // Update auth context with new user data
      signIn(res.user, await import('../api').then((m) => m.getToken()));
      setEditing(false);
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => { await logout(); signOut(); } },
    ]);
  };

  const SETTINGS_MENU = [
    { icon: 'bell',        label: 'Notifications',  sub: 'Manage push notification preferences' },
    { icon: 'lock',        label: 'Change Password', sub: 'Update your login credentials' },
    { icon: 'help-circle', label: 'Help & Support',  sub: 'Contact the support team' },
  ];

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: topPad }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Avatar card ── */}
        <View style={s.avatarCard}>
          <View style={s.avatarCircle}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          {!editing ? (
            <>
              <Text style={s.userName}>{user?.name}</Text>
              <Text style={s.userId}>{user?.studentId}</Text>
              <Text style={s.userEmail}>{user?.email}</Text>
              <View style={s.roleBadge}>
                <Text style={s.roleText}>{user?.role}</Text>
              </View>
              <TouchableOpacity style={s.editBtn} onPress={() => setEditing(true)}>
                <Feather name="edit-2" size={13} color={colors.accent} />
                <Text style={s.editBtnText}>Edit Profile</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Edit mode */
            <View style={s.editForm}>
              <Text style={s.editLabel}>Full Name</Text>
              <TextInput
                style={s.editInput}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={s.editLabel}>Programme</Text>
              <TextInput
                style={s.editInput}
                value={prog}
                onChangeText={setProg}
                placeholder="e.g. BSc Computer Science"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={s.editLabel}>Year of Study</Text>
              <TextInput
                style={s.editInput}
                value={year}
                onChangeText={setYear}
                placeholder="e.g. Year 3"
                placeholderTextColor={colors.textMuted}
              />
              <View style={s.editActions}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => { setEditing(false); setName(user?.name || ''); setProg(user?.programme || ''); setYear(user?.year || ''); }}>
                  <Text style={s.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* ── Info rows ── */}
        {!editing && (
          <View style={s.infoCard}>
            {[
              ['Student ID',  user?.studentId],
              ['Programme',   user?.programme || '—'],
              ['Year',        user?.year      || '—'],
              ['Email',       user?.email],
            ].map(([k, v], i, arr) => (
              <View key={k}>
                <View style={s.infoRow}>
                  <Text style={s.infoKey}>{k}</Text>
                  <Text style={s.infoVal} numberOfLines={1}>{v}</Text>
                </View>
                {i < arr.length - 1 && <View style={s.infoDivider} />}
              </View>
            ))}
          </View>
        )}

        {/* ── Settings menu  ── */}
        {!editing && (
          <>
            <Text style={s.sectionLabel}>Settings</Text>
            <View style={s.menuCard}>
              {SETTINGS_MENU.map((item, i) => (
                <View key={i}>
                  <TouchableOpacity style={s.menuRow} activeOpacity={0.6}>
                    <View style={s.menuIconWrap}>
                      <Feather name={item.icon} size={14} color={colors.accent} />
                    </View>
                    <View style={s.menuText}>
                      <Text style={s.menuLabel}>{item.label}</Text>
                      <Text style={s.menuSub}>{item.sub}</Text>
                    </View>
                    <Feather name="chevron-right" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                  {i < SETTINGS_MENU.length - 1 && <View style={s.menuDivider} />}
                </View>
              ))}
            </View>

            <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
              <Feather name="log-out" size={15} color={colors.red} />
              <Text style={s.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  content:   { paddingHorizontal: spacing.lg, paddingBottom: 16 },

  avatarCard:   { backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: 24, alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  avatarText:   { color: '#fff', fontWeight: '700', fontSize: 24 },
  userName:     { fontSize: 18, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.3, marginBottom: 3 },
  userId:       { fontSize: 13, color: colors.textSecondary, fontWeight: '500', marginBottom: 2 },
  userEmail:    { fontSize: 12, color: colors.textMuted, marginBottom: 10 },
  roleBadge:    { backgroundColor: colors.accentSoft, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 5, marginBottom: 14 },
  roleText:     { fontSize: 12, color: colors.accent, fontWeight: '600' },
  editBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.accent },
  editBtnText:  { fontSize: 13, color: colors.accent, fontWeight: '600' },

  // Edit form
  editForm:    { width: '100%', marginTop: 8, gap: 8 },
  editLabel:   { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  editInput:   { backgroundColor: colors.bgInput, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 13, paddingVertical: 11, fontSize: 14, color: colors.textPrimary },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cancelBtn:   { flex: 1, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  cancelBtnText:{ fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  saveBtn:     { flex: 1, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center' },
  saveBtnText: { fontSize: 14, color: '#fff', fontWeight: '700' },

  // Info
  infoCard:    { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  infoKey:     { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  infoVal:     { fontSize: 13, color: colors.textPrimary, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  infoDivider: { height: 1, backgroundColor: colors.borderSoft },

  // Settings menu
  sectionLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  menuCard:     { backgroundColor: colors.bgCard, borderRadius: radius.md, marginBottom: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  menuRow:      { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  menuIconWrap: { width: 30, height: 30, borderRadius: 9, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  menuText:     { flex: 1 },
  menuLabel:    { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  menuSub:      { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  menuDivider:  { height: 1, backgroundColor: colors.borderSoft, marginLeft: 56 },

  logoutBtn:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.redSoft, borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, paddingVertical: 14 },
  logoutText: { color: colors.red, fontSize: 14, fontWeight: '700' },
});