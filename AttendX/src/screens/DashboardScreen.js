import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { colors, radius, spacing, shadow } from '../theme';
import { useAuth } from '../context/AuthContext';
import { getMyCourses, getActiveSessions, getMyAttendance, registerPushToken } from '../api';

export default function DashboardScreen({ navigation }) {
  const { user }                    = useAuth();
  const insets                      = useSafeAreaInsets();
  const [courses,    setCourses]    = useState([]);
  const [active,     setActive]     = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef(null);

  
  useEffect(() => {
    registerPush();

    
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      navigation.navigate('MarkAttendance', { forceRefresh: Date.now() });
    });
    return () => sub.remove();
  }, []);

  const registerPush = async () => {
    if (!Device.isDevice) return; 

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('attendance', {
        name:             'Attendance Alerts',
        importance:       Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor:       '#1A6AFF',
        sound:            'default',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ??
        Constants?.easConfig?.projectId;
      if (!projectId) return;
      const token = await Notifications.getExpoPushTokenAsync({ projectId });
      await registerPushToken(token.data);
    } catch (_) {}
  };

  
  const load = useCallback(async (silent = false) => {
    try {
      const [c, a, att] = await Promise.all([
        getMyCourses(),
        getActiveSessions(),
        getMyAttendance(),
      ]);
      setCourses(c.courses   || []);
      setActive(a.sessions   || []);
      setStats(att.overall   || null);
    } catch (_) {}
    finally {
      if (!silent) { setLoading(false); setRefreshing(false); }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    pollRef.current = setInterval(() => load(true), 10000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  const liveSession = active[0] || null;
  const topPad = insets.top + 12;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: topPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Top bar */}
        <View style={s.topBar}>
          <View style={s.userRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={s.userName}>{user?.name}</Text>
              <Text style={s.userId}>{user?.email || user?.studentId}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={s.notifBtn}
            onPress={() => navigation.navigate('MarkAttendance', { forceRefresh: Date.now() })}
          >
            <Feather name="bell" size={17} color={liveSession ? colors.accent : colors.textSecondary} />
            {liveSession && <View style={s.badge}><Text style={s.badgeText}>1</Text></View>}
          </TouchableOpacity>
        </View>

        {/* Live session card */}
        {liveSession ? (
          <TouchableOpacity
            style={s.activeCard}
            onPress={() => navigation.navigate('MarkAttendance', { forceRefresh: Date.now() })}
            activeOpacity={0.9}
          >
            <Text style={s.activeLabel}>ACTIVE — TAP TO SIGN ATTENDANCE</Text>
            <Text style={s.activeName}>{liveSession.course?.name}</Text>
            <View style={s.activeMetaRow}>
              <Feather name="calendar" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={s.activeMeta}>  Week {liveSession.weekNumber}  ·  {liveSession.sessionType}</Text>
            </View>
            <View style={s.gpsPill}>
              <View style={s.gpsDot} />
              <Text style={s.gpsText}>Attendance is open now</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={s.noActiveCard}>
            <Feather name="clock" size={18} color={colors.textMuted} />
            <Text style={s.noActiveText}>No active sessions right now</Text>
          </View>
        )}

        {/* Stats */}
        {stats && (
          <View style={s.statsRow}>
            {[
              { val: stats.percentage != null ? `${stats.percentage}%` : '—', label: 'Overall', color: stats.percentage >= 75 ? colors.green : stats.percentage != null ? colors.amber : colors.textPrimary },
              { val: stats.attended, label: 'Present', color: colors.green },
              { val: stats.absent,   label: 'Absent',  color: colors.red   },
            ].map((item, i) => (
              <View key={i} style={s.statChip}>
                <Text style={[s.statValue, { color: item.color }]}>{item.val}</Text>
                <Text style={s.statLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Courses */}
        <Text style={s.sectionLabel}>My Courses</Text>
        <View style={s.courseList}>
          {courses.map((course, i) => (
            <View key={course.id} style={s.courseRow}>
              <View style={[s.courseLine, { backgroundColor: i % 2 === 0 ? colors.accent : colors.green }]} />
              <View style={s.courseInfo}>
                <Text style={s.courseName}>{course.name}</Text>
                <Text style={s.courseCode}>{course.code}  ·  {course.lecturer?.name}</Text>
              </View>
              <Feather name="chevron-right" size={14} color={colors.textMuted} />
            </View>
          ))}
          {courses.length === 0 && (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>No courses enrolled yet.</Text>
            </View>
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgPrimary },
  content:   { paddingHorizontal: spacing.lg, paddingBottom: 16 },

  topBar:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  userRow:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar:    { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  avatarText:{ color: '#fff', fontWeight: '700', fontSize: 13 },
  userName:  { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  userId:    { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  notifBtn:  { width: 38, height: 38, backgroundColor: colors.bgCard, borderRadius: radius.sm + 2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', position: 'relative', ...shadow.card },
  badge:     { position: 'absolute', top: -4, right: -4, backgroundColor: colors.red, borderRadius: 10, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },

  activeCard:    { backgroundColor: colors.accent, borderRadius: radius.lg, padding: 18, marginBottom: 14, ...shadow.strong },
  activeLabel:   { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 6 },
  activeName:    { fontSize: 19, fontWeight: '700', color: '#fff', marginBottom: 8 },
  activeMetaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  activeMeta:    { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  gpsPill:       { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  gpsDot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6EFFC7' },
  gpsText:       { fontSize: 11, color: '#fff', fontWeight: '500' },

  noActiveCard: { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 10, ...shadow.card },
  noActiveText: { fontSize: 13, color: colors.textMuted },

  statsRow:  { flexDirection: 'row', gap: 8, marginBottom: 18 },
  statChip:  { flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border, ...shadow.card },
  statValue: { fontSize: 20, fontWeight: '700', lineHeight: 24 },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },
  courseList:   { gap: 7 },
  courseRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.borderSoft, ...shadow.card },
  courseLine:   { width: 3, height: 32, borderRadius: 2 },
  courseInfo:   { flex: 1 },
  courseName:   { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  courseCode:   { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  emptyCard:    { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  emptyText:    { fontSize: 13, color: colors.textMuted },
});