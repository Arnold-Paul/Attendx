import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Linking,
  Modal, TextInput, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { colors, radius, spacing, shadow } from '../theme';
import { useAuth } from '../context/AuthContext';
import {
  getMyCourses, getActiveSessions, getSessionAttendance,
  setSessionLocation, closeSession, getSessionReport,
  getSessionsByCourse, logout, getToken, assignClassRep,
  createSession,
} from '../api';
import { BASE_URL } from '../api';

const Tab = createBottomTabNavigator();

function TabIcon({ name, label, focused }) {
  return (
    <View style={ti.wrap}>
      <Feather name={name} size={20} color={focused ? colors.accent : colors.textMuted} />
      <Text style={[ti.label, focused && ti.active]} numberOfLines={1}>{label}</Text>
    </View>
  );
}
const ti = StyleSheet.create({
  wrap:  { alignItems: 'center', gap: 3, paddingTop: 6, width: 72 },
  label: { fontSize: 9, color: colors.textMuted, fontWeight: '500' },
  active:{ color: colors.accent, fontWeight: '700' },
});

function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function fmtTime(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }
function parseDateTime(dateStr, timeStr) {
  const [y, m, day] = dateStr.split('-').map(Number);
  const [h, min]    = timeStr.split(':').map(Number);
  return new Date(y, m - 1, day, h, min, 0, 0);
}
function friendlyDate(d) {
  const now  = new Date();
  const date = new Date(d);
  const diff = date.setHours(0,0,0,0) - now.setHours(0,0,0,0);
  if (diff === 0)  return 'Today';
  if (diff === 86400000) return 'Tomorrow';
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function timeRange(s) {
  const start = new Date(s.startTime);
  const end   = new Date(s.endTime);
  return `${start.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} – ${end.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
}

function CreateSessionModal({ visible, courses, onClose, onCreated }) {
  const [courseId,  setCourseId]  = useState('');
  const [date,      setDate]      = useState(fmtDate(new Date()));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime,   setEndTime]   = useState('10:00');
  const [weekNum,   setWeekNum]   = useState('');
  const [type,      setType]      = useState('Lecture');
  const [saving,    setSaving]    = useState(false);

  const TYPES = ['Lecture', 'Tutorial', 'Lab', 'Seminar'];

  const handleCreate = async () => {
    if (!courseId)   { Alert.alert('Required', 'Please select a course.'); return; }
    if (!weekNum)    { Alert.alert('Required', 'Please enter the week number.'); return; }
    const start = parseDateTime(date, startTime);
    const end   = parseDateTime(date, endTime);
    if (end <= start) { Alert.alert('Invalid Time', 'End time must be after start time.'); return; }
    setSaving(true);
    try {
      await createSession({
        courseId,
        weekNumber:  parseInt(weekNum),
        sessionType: type,
        startTime:   start.toISOString(),
        endTime:     end.toISOString(),
        radiusMeters: 50,
      });
      Alert.alert('Done', 'Session created successfully.');
      onCreated();
      onClose();
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={m.safe} edges={['top', 'bottom']}>
        <View style={m.header}>
          <Text style={m.title}>New Session</Text>
          <TouchableOpacity onPress={onClose} style={m.closeBtn}>
            <Feather name="x" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={m.body} keyboardShouldPersistTaps="handled">
          <Text style={m.label}>Course</Text>
          <View style={m.pickerWrap}>
            {courses.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={[m.courseChip, courseId === c.id && m.courseChipActive]}
                onPress={() => setCourseId(c.id)}
              >
                <Text style={[m.courseChipText, courseId === c.id && m.courseChipTextActive]}>{c.code}</Text>
                <Text style={[m.courseChipSub, courseId === c.id && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Session Type</Text>
          <View style={m.typeRow}>
            {TYPES.map((t) => (
              <TouchableOpacity key={t} style={[m.typeChip, type === t && m.typeChipActive]} onPress={() => setType(t)}>
                <Text style={[m.typeChipText, type === t && m.typeChipTextActive]}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={m.label}>Date</Text>
          <TextInput
            style={m.input}
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />

          <View style={m.row2}>
            <View style={{ flex: 1 }}>
              <Text style={m.label}>Start Time</Text>
              <TextInput style={m.input} value={startTime} onChangeText={setStartTime} placeholder="HH:MM" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={m.label}>End Time</Text>
              <TextInput style={m.input} value={endTime} onChangeText={setEndTime} placeholder="HH:MM" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
            </View>
          </View>

          <Text style={m.label}>Week Number</Text>
          <TextInput
            style={m.input}
            value={weekNum}
            onChangeText={setWeekNum}
            placeholder="e.g. 11"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />

          <TouchableOpacity style={m.submitBtn} onPress={handleCreate} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={m.submitBtnText}>Create Session</Text>}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const m = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bgPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  title:  { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  body:   { padding: spacing.lg, gap: 12 },
  label:  { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  input:  { backgroundColor: colors.bgInput, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: colors.textPrimary },
  row2:   { flexDirection: 'row', gap: 12 },
  pickerWrap: { gap: 8 },
  courseChip:         { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 12, borderWidth: 1.5, borderColor: colors.border },
  courseChipActive:   { backgroundColor: colors.accent, borderColor: colors.accent },
  courseChipText:     { fontSize: 13, fontWeight: '700', color: colors.textPrimary, width: 52 },
  courseChipTextActive:{ color: '#fff' },
  courseChipSub:      { fontSize: 12, color: colors.textMuted, flex: 1 },
  typeRow:  { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  typeChip:           { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border },
  typeChipActive:     { backgroundColor: colors.accent, borderColor: colors.accent },
  typeChipText:       { fontSize: 13, fontWeight: '500', color: colors.textMuted },
  typeChipTextActive: { color: '#fff', fontWeight: '700' },
  submitBtn:     { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', marginTop: 8 },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});

function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [sessions,    setSessions]    = useState([]);
  const [upcoming,    setUpcoming]    = useState([]);
  const [courses,     setCourses]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [settingLoc,  setSettingLoc]  = useState(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const pollRef = useRef(null);

  const load = useCallback(async (silent = false) => {
    try {
      const [a, c] = await Promise.all([getActiveSessions(), getMyCourses()]);
      const courseList = c.courses || [];
      setCourses(courseList);
      setSessions(a.sessions || []);

      const now   = new Date();
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end   = new Date(now); end.setHours(23, 59, 59, 999);
      const next7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const all = [];
      for (const course of courseList) {
        const { sessions: s } = await getSessionsByCourse(course.id);
        all.push(...(s || []).map((sess) => ({ ...sess, course })));
      }

      setUpcoming(
        all
          .filter((s) => {
            const st = new Date(s.startTime);
            return st > end && st <= next7;
          })
          .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
      );
    } catch (_) {}
    finally { if (!silent) { setLoading(false); setRefreshing(false); } }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    pollRef.current = setInterval(() => load(true), 12000);
    return () => clearInterval(pollRef.current);
  }, [load]));

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleSetLocation = async (sess) => {
    setSettingLoc(sess.id);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission Denied', 'Enable location in settings.'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const res = await setSessionLocation(sess.id, loc.coords.latitude, loc.coords.longitude);
      Alert.alert('Attendance Open', res.message);
      load();
    } catch (err) { Alert.alert('Error', err.message); }
    finally { setSettingLoc(null); }
  };

  const handleClose = (sess) => {
    Alert.alert('Close Attendance', `Stop sign-ins for ${sess.course?.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: async () => {
        try { await closeSession(sess.id); load(); }
        catch (err) { Alert.alert('Error', err.message); }
      }},
    ]);
  };

  if (loading) return <View style={sc.center}><ActivityIndicator color={colors.accent} /></View>;

  return (
    <>
      <ScrollView
        style={sc.tab}
        contentContainerStyle={[sc.tabContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        <View style={sc.screenHeadRow}>
          <View>
            <Text style={sc.screenTitle}>Sessions</Text>
            <Text style={sc.screenSub}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <TouchableOpacity style={sc.addBtn} onPress={() => setShowCreate(true)}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={sc.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        <Text style={sc.sectionLabel}>Today</Text>
        {sessions.length === 0 && (
          <View style={sc.emptyBox}>
            <Feather name="calendar" size={28} color={colors.textMuted} />
            <Text style={sc.emptyTitle}>No sessions today</Text>
            <Text style={sc.emptySub}>Tap Add to create one, or sessions appear here at their scheduled time.</Text>
          </View>
        )}
        {sessions.map((sess) => {
          const signed = sess._count?.attendanceLogs || 0;
          const isOpen = sess.isOpen;
          const hasLoc = sess.latitude != null;
          const isProc = settingLoc === sess.id;
          return (
            <View key={sess.id} style={[sc.card, isOpen && sc.cardLive]}>
              <View style={sc.cardHead}>
                <View style={sc.cardHeadLeft}>
                  <View style={[sc.statusBadge, isOpen ? sc.badgeGreen : sc.badgeAmber]}>
                    <View style={[sc.statusDot, { backgroundColor: isOpen ? colors.green : colors.amber }]} />
                    <Text style={[sc.statusText, { color: isOpen ? colors.green : colors.amber }]}>
                      {isOpen ? 'Open' : hasLoc ? 'Location Set' : 'Pending'}
                    </Text>
                  </View>
                  <Text style={sc.cardCode}>{sess.course?.code}</Text>
                </View>
                <View style={sc.signedWrap}>
                  <Text style={[sc.signedNum, { color: isOpen ? colors.green : colors.textPrimary }]}>{signed}</Text>
                  <Text style={sc.signedLabel}>signed</Text>
                </View>
              </View>
              <Text style={sc.cardTitle}>{sess.course?.name}</Text>
              <Text style={sc.cardMeta}>Week {sess.weekNumber}  ·  {sess.sessionType}  ·  {timeRange(sess)}</Text>
              <View style={sc.divider} />
              {!isOpen ? (
                <TouchableOpacity style={sc.btnPrimary} onPress={() => handleSetLocation(sess)} disabled={isProc} activeOpacity={0.85}>
                  {isProc
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <><Feather name="map-pin" size={15} color="#fff" /><Text style={sc.btnPrimaryText}>Set Location & Open</Text></>
                  }
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={sc.btnDanger} onPress={() => handleClose(sess)} activeOpacity={0.85}>
                  <Feather name="x-circle" size={15} color={colors.red} />
                  <Text style={sc.btnDangerText}>Close Attendance</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        {upcoming.length > 0 && (
          <>
            <Text style={[sc.sectionLabel, { marginTop: 8 }]}>Upcoming — Next 7 Days</Text>
            {upcoming.map((sess) => (
              <View key={sess.id} style={sc.upcomingCard}>
                <View style={[sc.upcomingAccent, { backgroundColor: colors.accent }]} />
                <View style={{ flex: 1 }}>
                  <View style={sc.upcomingHeadRow}>
                    <Text style={sc.upcomingCourse}>{sess.course?.name}</Text>
                    <View style={sc.upcomingDateBadge}>
                      <Text style={sc.upcomingDateText}>{friendlyDate(sess.startTime)}</Text>
                    </View>
                  </View>
                  <Text style={sc.upcomingMeta}>
                    {sess.course?.code}  ·  Week {sess.weekNumber}  ·  {timeRange(sess)}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <CreateSessionModal
        visible={showCreate}
        courses={courses}
        onClose={() => setShowCreate(false)}
        onCreated={() => load()}
      />
    </>
  );
}

function StudentsScreen() {
  const insets   = useSafeAreaInsets();
  const [sessions,    setSessions]    = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [students,    setStudents]    = useState([]);
  const [summary,     setSummary]     = useState(null);
  const [filter,      setFilter]      = useState('All');
  const [loading,     setLoading]     = useState(true);
  const [loadingStu,  setLoadingStu]  = useState(false);

  useFocusEffect(useCallback(() => {
    getActiveSessions()
      .then((d) => setSessions(d.sessions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []));

  const pickSession = async (sess) => {
    setSelected(sess);
    setLoadingStu(true);
    try {
      const res = await getSessionAttendance(sess.id);
      setStudents(res.students || []);
      setSummary(res.summary   || null);
    } catch (err) { Alert.alert('Error', err.message); }
    finally { setLoadingStu(false); }
  };

  if (loading) return <View style={sc.center}><ActivityIndicator color={colors.accent} /></View>;

  if (!selected) {
    return (
      <ScrollView style={sc.tab} contentContainerStyle={[sc.tabContent, { paddingTop: insets.top + 12 }]}>
        <Text style={sc.screenTitle}>Students</Text>
        <Text style={sc.screenSub}>Select an open session</Text>
        {sessions.length === 0 && (
          <View style={sc.emptyBox}>
            <Feather name="users" size={28} color={colors.textMuted} />
            <Text style={sc.emptyTitle}>No active sessions</Text>
            <Text style={sc.emptySub}>Open a session from Today tab first.</Text>
          </View>
        )}
        {sessions.map((sess) => (
          <TouchableOpacity key={sess.id} style={sc.card} onPress={() => pickSession(sess)} activeOpacity={0.8}>
            <View style={sc.cardHead}>
              <Text style={sc.cardCode}>{sess.course?.code}</Text>
              <View style={[sc.statusBadge, sc.badgeGreen]}>
                <View style={[sc.statusDot, { backgroundColor: colors.green }]} />
                <Text style={[sc.statusText, { color: colors.green }]}>Open</Text>
              </View>
            </View>
            <Text style={sc.cardTitle}>{sess.course?.name}</Text>
            <Text style={sc.cardMeta}>Week {sess.weekNumber}  ·  {sess._count?.attendanceLogs || 0} signed  ·  {timeRange(sess)}</Text>
            <View style={sc.divider} />
            <Text style={{ fontSize: 12, color: colors.accent, fontWeight: '600' }}>View student list →</Text>
          </TouchableOpacity>
        ))}
        <View style={{ height: 32 }} />
      </ScrollView>
    );
  }

  const filtered = students.filter((st) => {
    if (filter === 'Present') return st.signed;
    if (filter === 'Absent')  return st.status === 'ABSENT';
    if (filter === 'Pending') return st.status === 'PENDING';
    return true;
  });

  return (
    <ScrollView style={sc.tab} contentContainerStyle={[sc.tabContent, { paddingTop: insets.top + 12 }]}>
      <TouchableOpacity style={sc.backBtn} onPress={() => { setSelected(null); setStudents([]); setSummary(null); }}>
        <Feather name="arrow-left" size={14} color={colors.textMuted} />
        <Text style={sc.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={sc.screenTitle}>{selected.course?.name}</Text>
      <Text style={sc.screenSub}>Week {selected.weekNumber}  ·  {students.length} enrolled</Text>

      {summary && (
        <View style={sc.summaryStrip}>
          {[
            { val: summary.signed,   label: 'Present', color: colors.green },
            { val: summary.pending,  label: 'Pending', color: colors.amber },
            { val: summary.absent,   label: 'Absent',  color: colors.red   },
            { val: summary.enrolled, label: 'Total',   color: colors.textPrimary },
          ].map((item, i) => (
            <View key={i} style={sc.summaryChip}>
              <Text style={[sc.summaryNum, { color: item.color }]}>{item.val}</Text>
              <Text style={sc.summaryLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={sc.filterRow}>
        {['All', 'Present', 'Pending', 'Absent'].map((f) => (
          <TouchableOpacity key={f} style={[sc.filterTab, filter === f && sc.filterTabActive]} onPress={() => setFilter(f)}>
            <Text style={[sc.filterText, filter === f && sc.filterTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loadingStu
        ? <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        : (
          <View style={{ gap: 7 }}>
            {filtered.map((st, i) => {
              const sc2 = st.signed ? colors.green : st.status === 'ABSENT' ? colors.red : colors.amber;
              const sl  = st.signed ? 'Present' : st.status === 'ABSENT' ? 'Absent' : 'Pending';
              return (
                <View key={i} style={sc.studentRow}>
                  <View style={[sc.avatar, { backgroundColor: st.signed ? colors.green : colors.amber }]}>
                    <Text style={sc.avatarText}>{st.name?.split(' ').map((n) => n[0]).join('').slice(0,2).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={sc.studentName}>{st.name}</Text>
                    <Text style={sc.studentId}>{st.studentId}</Text>
                  </View>
                  <View style={[sc.statusPill, { backgroundColor: `${sc2}18` }]}>
                    <Text style={[sc.statusPillText, { color: sc2 }]}>{sl}</Text>
                  </View>
                </View>
              );
            })}
            {filtered.length === 0 && <Text style={sc.emptyTitle}>No students match this filter.</Text>}
          </View>
        )
      }
      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const DATE_RANGES = [
  { label: 'All Time',   value: 'all'    },
  { label: 'This Week',  value: 'week'   },
  { label: 'This Month', value: 'month'  },
  { label: 'Last Month', value: 'lmonth' },
];

function getDateRange(value) {
  const now = new Date();
  if (value === 'week') {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const from = new Date(now); from.setDate(now.getDate() - day); from.setHours(0,0,0,0);
    return { from, to: now };
  }
  if (value === 'month') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from, to: now };
  }
  if (value === 'lmonth') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { from, to };
  }
  return { from: null, to: null };
}

function ReportsScreen() {
  const insets = useSafeAreaInsets();
  const [allSessions,  setAllSessions]  = useState([]);
  const [courses,      setCourses]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const [selCourse,    setSelCourse]    = useState('all');
  const [dateRange,    setDateRange]    = useState('all');

  const load = async () => {
    try {
      const { courses: cl } = await getMyCourses();
      setCourses(cl || []);
      const all = [];
      for (const c of cl || []) {
        const { sessions: s } = await getSessionsByCourse(c.id);
        all.push(...(s || []).map((sess) => ({ ...sess, course: c })));
      }
      setAllSessions(all.sort((a, b) => new Date(b.startTime) - new Date(a.startTime)));
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = () => { setRefreshing(true); load(); };

  const { from, to } = getDateRange(dateRange);

  const filtered = allSessions.filter((s) => {
    const matchCourse = selCourse === 'all' || s.course?.id === selCourse;
    const d = new Date(s.startTime);
    const matchDate = !from || (d >= from && d <= to);
    return matchCourse && matchDate;
  });

  const showSummary = async (sess) => {
    try {
      const res = await getSessionReport(sess.id);
      const r   = res.report;
      Alert.alert(
        `${r.course} — Week ${sess.weekNumber}`,
        `Date: ${new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}\n\nPresent:  ${r.present}\n${r.sessionClosed ? `Absent:   ${r.absent}` : `Pending:  ${r.pending}`}\nTotal:    ${r.enrolled}\nRate:     ${r.percentage}%\n\n${r.sessionClosed ? 'Session closed.' : 'Session still open — absent count set after closing.'}`,
        [{ text: 'OK' }]
      );
    } catch (err) { Alert.alert('Error', err.message); }
  };

  const downloadCSV = async (sess) => {
    try {
      const token = await getToken();
      await Linking.openURL(`${BASE_URL}/attendance/report/${sess.id}/csv?token=${token}`);
    } catch (err) { Alert.alert('Error', err.message); }
  };

  if (loading) return <View style={sc.center}><ActivityIndicator color={colors.accent} /></View>;

  const presentTotal = filtered.reduce((a, s) => a + (s._count?.attendanceLogs || 0), 0);

  return (
    <ScrollView
      style={sc.tab}
      contentContainerStyle={[sc.tabContent, { paddingTop: insets.top + 12 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      <Text style={sc.screenTitle}>Reports</Text>
      <Text style={sc.screenSub}>Filter then generate or download</Text>

      <View style={sc.filterSection}>
        <Text style={sc.filterSectionLabel}>Course</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={sc.filterRow}>
            <TouchableOpacity style={[sc.filterTab, selCourse === 'all' && sc.filterTabActive]} onPress={() => setSelCourse('all')}>
              <Text style={[sc.filterText, selCourse === 'all' && sc.filterTextActive]}>All</Text>
            </TouchableOpacity>
            {courses.map((c) => (
              <TouchableOpacity key={c.id} style={[sc.filterTab, selCourse === c.id && sc.filterTabActive]} onPress={() => setSelCourse(c.id)}>
                <Text style={[sc.filterText, selCourse === c.id && sc.filterTextActive]}>{c.code}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <Text style={sc.filterSectionLabel}>Date Range</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={sc.filterRow}>
            {DATE_RANGES.map((r) => (
              <TouchableOpacity key={r.value} style={[sc.filterTab, dateRange === r.value && sc.filterTabActive]} onPress={() => setDateRange(r.value)}>
                <Text style={[sc.filterText, dateRange === r.value && sc.filterTextActive]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {filtered.length > 0 && (
        <View style={sc.reportSummaryCard}>
          <View style={sc.reportSummaryRow}>
            <Text style={sc.reportSummaryNum}>{filtered.length}</Text>
            <Text style={sc.reportSummaryLabel}>Sessions</Text>
          </View>
          <View style={sc.reportSummaryDivider} />
          <View style={sc.reportSummaryRow}>
            <Text style={[sc.reportSummaryNum, { color: colors.green }]}>{presentTotal}</Text>
            <Text style={sc.reportSummaryLabel}>Total Sign-ins</Text>
          </View>
          <View style={sc.reportSummaryDivider} />
          <View style={sc.reportSummaryRow}>
            <Text style={sc.reportSummaryNum}>{filtered.filter((s) => !s.isOpen && s.closedAt).length}</Text>
            <Text style={sc.reportSummaryLabel}>Closed</Text>
          </View>
        </View>
      )}

      {filtered.length === 0 && (
        <View style={sc.emptyBox}>
          <Feather name="file-text" size={28} color={colors.textMuted} />
          <Text style={sc.emptyTitle}>No sessions match</Text>
          <Text style={sc.emptySub}>Try changing the course or date range filter.</Text>
        </View>
      )}

      {filtered.map((sess, i) => {
        const count    = sess._count?.attendanceLogs || 0;
        const isClosed = !sess.isOpen && sess.closedAt != null;
        return (
          <View key={sess.id} style={sc.reportCard}>
            <View style={sc.reportCardInner}>
              <View style={[sc.reportAccent, { backgroundColor: isClosed ? colors.green : colors.amber }]} />
              <View style={{ flex: 1 }}>
                <Text style={sc.reportWeek}>{sess.course?.name}</Text>
                <Text style={sc.reportDate}>
                  Week {sess.weekNumber}  ·  {friendlyDate(sess.startTime)}  ·  {timeRange(sess)}
                </Text>
                <View style={sc.reportMetaRow}>
                  <View style={[sc.reportStatusBadge, { backgroundColor: isClosed ? colors.greenSoft : colors.amberSoft }]}>
                    <Text style={[sc.reportStatusText, { color: isClosed ? colors.green : colors.amber }]}>
                      {isClosed ? 'Closed' : 'Open'}
                    </Text>
                  </View>
                  <Text style={sc.reportCount}>{count} signed</Text>
                </View>
              </View>
              <View style={sc.reportActions}>
                <TouchableOpacity style={sc.reportIconBtn} onPress={() => showSummary(sess)}>
                  <Feather name="file-text" size={16} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity style={[sc.reportIconBtn, sc.reportIconBtnGreen]} onPress={() => downloadCSV(sess)}>
                  <Feather name="download" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}

      {filtered.length > 0 && (
        <View style={sc.infoBox}>
          <Feather name="info" size={13} color={colors.accent} />
          <Text style={sc.infoText}>Tap the file icon for a summary. Green icon downloads CSV. Absent count is only final after closing the session.</Text>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function LecturerProfileScreen() {
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => { await logout(); signOut(); } },
    ]);
  };

  const initials = user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '??';

  return (
    <ScrollView style={sc.tab} contentContainerStyle={[sc.tabContent, { paddingTop: insets.top + 12 }]}>
      <View style={[sc.card, { alignItems: 'center', paddingVertical: 28 }]}>
        <View style={sc.bigAvatar}><Text style={sc.bigAvatarText}>{initials}</Text></View>
        <Text style={[sc.cardTitle, { fontSize: 18, marginTop: 12 }]}>{user?.name}</Text>
        <Text style={sc.cardMeta}>{user?.studentId}</Text>
        <Text style={[sc.cardMeta, { marginTop: 2 }]}>{user?.email}</Text>
        <View style={sc.roleBadge}><Text style={sc.roleText}>{user?.role}</Text></View>
      </View>
      <View style={sc.card}>
        {[['Department', 'Computer Science'], ['Institution', 'JKUAT Juja']].map(([k, v], i, arr) => (
          <View key={k}>
            <View style={sc.infoRow}>
              <Text style={sc.infoKey}>{k}</Text>
              <Text style={sc.infoVal}>{v}</Text>
            </View>
            {i < arr.length - 1 && <View style={sc.divider} />}
          </View>
        ))}
      </View>
      <TouchableOpacity style={sc.logoutBtn} onPress={handleLogout}>
        <Feather name="log-out" size={15} color={colors.red} />
        <Text style={sc.logoutText}>Log Out</Text>
      </TouchableOpacity>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

export default function LecturerScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgPrimary }}>
      <Tab.Navigator
        screenOptions={{
          headerShown:     false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: colors.navBg,
            borderTopColor:  colors.border,
            borderTopWidth:  1,
            height:          54 + insets.bottom,
            paddingBottom:   insets.bottom,
          },
          tabBarItemStyle: { alignItems: 'center', justifyContent: 'center' },
        }}
      >
        <Tab.Screen name="Today"    component={TodayScreen}          options={{ tabBarIcon: ({ focused }) => <TabIcon name="calendar"    label="Today"    focused={focused} /> }} />
        <Tab.Screen name="Students" component={StudentsScreen}       options={{ tabBarIcon: ({ focused }) => <TabIcon name="users"       label="Students" focused={focused} /> }} />
        <Tab.Screen name="Reports"  component={ReportsScreen}        options={{ tabBarIcon: ({ focused }) => <TabIcon name="bar-chart-2" label="Reports"  focused={focused} /> }} />
        <Tab.Screen name="LecProf"  component={LecturerProfileScreen}options={{ tabBarIcon: ({ focused }) => <TabIcon name="user"        label="Profile"  focused={focused} /> }} />
      </Tab.Navigator>
    </View>
  );
}

const sc = StyleSheet.create({
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgPrimary },
  tab:        { flex: 1, backgroundColor: colors.bgPrimary },
  tabContent: { paddingHorizontal: spacing.lg, paddingBottom: 16 },

  screenHeadRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 },
  screenTitle:   { fontSize: 24, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  screenSub:     { fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 18 },
  addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 9, ...shadow.card },
  addBtnText:    { color: '#fff', fontSize: 13, fontWeight: '700' },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },

  card:     { backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardLive: { backgroundColor: colors.greenSoft, borderColor: 'rgba(18,160,92,0.22)' },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  cardHeadLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardCode:  { fontSize: 11, fontWeight: '600', color: colors.textMuted },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  cardMeta:  { fontSize: 12, color: colors.textMuted },
  divider:   { height: 1, backgroundColor: colors.borderSoft, marginVertical: 12 },

  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.full },
  badgeGreen:  { backgroundColor: colors.greenSoft },
  badgeAmber:  { backgroundColor: colors.amberSoft },
  statusDot:   { width: 5, height: 5, borderRadius: 3 },
  statusText:  { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  signedWrap:  { alignItems: 'center' },
  signedNum:   { fontSize: 26, fontWeight: '700', lineHeight: 30, letterSpacing: -0.5 },
  signedLabel: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  btnPrimary:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 13 },
  btnPrimaryText:  { color: '#fff', fontSize: 14, fontWeight: '700' },
  btnDanger:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.redSoft, borderRadius: radius.md, paddingVertical: 13, borderWidth: 1, borderColor: colors.red },
  btnDangerText:   { color: colors.red, fontSize: 14, fontWeight: '600' },

  upcomingCard:    { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 13, marginBottom: 8, borderWidth: 1, borderColor: colors.borderSoft, ...shadow.card },
  upcomingAccent:  { width: 3, height: 36, borderRadius: 2, flexShrink: 0 },
  upcomingHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  upcomingCourse:  { fontSize: 13, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 8 },
  upcomingDateBadge: { backgroundColor: colors.accentSoft, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  upcomingDateText:  { fontSize: 10, fontWeight: '600', color: colors.accent },
  upcomingMeta:    { fontSize: 11, color: colors.textMuted },

  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, alignSelf: 'flex-start' },
  backText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },

  summaryStrip: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  summaryChip:  { flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: colors.border, ...shadow.card },
  summaryNum:   { fontSize: 18, fontWeight: '700', lineHeight: 22 },
  summaryLabel: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },

  filterSection:      { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  filterSectionLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  filterRow:          { flexDirection: 'row', gap: 7 },
  filterTab:          { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border },
  filterTabActive:    { backgroundColor: colors.accent, borderColor: colors.accent },
  filterText:         { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  filterTextActive:   { color: '#fff', fontWeight: '700' },

  reportSummaryCard:    { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  reportSummaryRow:     { flex: 1, alignItems: 'center' },
  reportSummaryNum:     { fontSize: 22, fontWeight: '700', color: colors.textPrimary, lineHeight: 26 },
  reportSummaryLabel:   { fontSize: 10, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 3 },
  reportSummaryDivider: { width: 1, height: '100%', backgroundColor: colors.borderSoft, marginHorizontal: 8 },

  reportCard:       { backgroundColor: colors.bgCard, borderRadius: radius.md, marginBottom: 8, borderWidth: 1, borderColor: colors.borderSoft, overflow: 'hidden', ...shadow.card },
  reportCardInner:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  reportAccent:     { width: 4, height: 48, borderRadius: 2, flexShrink: 0 },
  reportWeek:       { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 3 },
  reportDate:       { fontSize: 11, color: colors.textMuted, marginBottom: 6 },
  reportMetaRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reportStatusBadge:{ borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  reportStatusText: { fontSize: 10, fontWeight: '700' },
  reportCount:      { fontSize: 11, color: colors.textMuted },
  reportActions:    { flexDirection: 'row', gap: 8, flexShrink: 0 },
  reportIconBtn:    { width: 38, height: 38, borderRadius: radius.sm + 2, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentMid, alignItems: 'center', justifyContent: 'center' },
  reportIconBtnGreen: { backgroundColor: colors.green, borderColor: colors.green },

  infoBox:  { flexDirection: 'row', gap: 10, backgroundColor: colors.accentSoft, borderRadius: radius.md, padding: 13, borderWidth: 1, borderColor: colors.accentMid, marginTop: 4, marginBottom: 8 },
  infoText: { flex: 1, fontSize: 12, color: colors.textSecondary, lineHeight: 18 },

  studentRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.borderSoft, ...shadow.card },
  avatar:      { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontWeight: '700', fontSize: 12 },
  studentName: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  studentId:   { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  statusPill:  { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontWeight: '700' },

  bigAvatar:     { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  bigAvatarText: { color: '#fff', fontWeight: '700', fontSize: 24 },
  roleBadge:     { backgroundColor: colors.accentSoft, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 5, marginTop: 10 },
  roleText:      { fontSize: 12, color: colors.accent, fontWeight: '600' },
  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  infoKey:       { fontSize: 12, color: colors.textMuted, fontWeight: '500' },
  infoVal:       { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  logoutBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.redSoft, borderWidth: 1, borderColor: colors.red, borderRadius: radius.md, paddingVertical: 14, marginTop: 8 },
  logoutText:    { color: colors.red, fontSize: 14, fontWeight: '700' },

  emptyBox:   { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  emptySub:   { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});