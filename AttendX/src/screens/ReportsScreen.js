import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Linking, Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, shadow } from '../theme';
import { getMyAttendance, getMyCourses, getToken } from '../api';
import { BASE_URL } from '../api';


const DATE_RANGES = [
  { label: 'All Time',    value: 'all'   },
  { label: 'This Week',   value: 'week'  },
  { label: 'This Month',  value: 'month' },
  { label: 'Last Month',  value: 'lmonth'},
];

function getDateRange(value) {
  const now   = new Date();
  const start = new Date();
  if (value === 'week') {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return { from: start, to: now };
  }
  if (value === 'month') {
    start.setDate(1); start.setHours(0, 0, 0, 0);
    return { from: start, to: now };
  }
  if (value === 'lmonth') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    return { from, to };
  }
  return { from: null, to: null };
}

export default function ReportsScreen() {
  const insets = useSafeAreaInsets();

  
  const [data,       setData]       = useState(null);
  const [courses,    setCourses]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  
  const [selectedCourse, setSelectedCourse] = useState('all');  
  const [dateRange,      setDateRange]      = useState('all');

  
  const allLogs    = data?.logs        || [];
  const courseStats= data?.courseStats || [];
  const overall    = data?.overall     || { percentage: null, attended: 0, absent: 0, totalSessions: 0 };

  const { from, to } = getDateRange(dateRange);

  const filteredLogs = allLogs.filter((log) => {
    const matchCourse = selectedCourse === 'all' || log.session?.course?.code === selectedCourse;
    const d = new Date(log.signedAt);
    const matchDate = !from || (d >= from && d <= to);
    return matchCourse && matchDate;
  });

  const filteredStats = selectedCourse === 'all'
    ? courseStats
    : courseStats.filter((c) => c.courseCode === selectedCourse);

 
  const load = async () => {
    try {
      const [rep, c] = await Promise.all([getMyAttendance(), getMyCourses()]);
      setData(rep);
      setCourses(c.courses || []);
    } catch (_) {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  const onRefresh = () => { setRefreshing(true); load(); };

  
  const downloadCSV = async () => {
    try {
      const token  = await getToken();
      let url      = `${BASE_URL}/attendance/me/csv?token=${token}`;
      if (selectedCourse !== 'all') url += `&courseCode=${selectedCourse}`;
      if (from) url += `&from=${from.toISOString()}`;
      if (to)   url += `&to=${to.toISOString()}`;
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Download Failed', err.message);
    }
  };

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>;
  }

  
  const presentCount = filteredLogs.filter((l) => l.status === 'PRESENT').length;
  const pct = filteredLogs.length > 0 ? Math.round((presentCount / filteredLogs.length) * 100) : null;

  const topPad = insets.top + 12;

  return (
    <View style={s.container}>
      <ScrollView
        contentContainerStyle={[s.content, { paddingTop: topPad }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
      >
        {/* Header */}
        <View style={s.headerRow}>
          <Text style={s.title}>Reports</Text>
          <TouchableOpacity style={s.downloadBtn} onPress={downloadCSV}>
            <Feather name="download" size={13} color={colors.accent} />
            <Text style={s.downloadText}>CSV</Text>
          </TouchableOpacity>
        </View>

        {/* ── FILTERS ── */}
        <View style={s.filterSection}>
          <Text style={s.filterSectionLabel}>Course</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            <View style={s.filterRow}>
              <TouchableOpacity
                style={[s.chip, selectedCourse === 'all' && s.chipActive]}
                onPress={() => setSelectedCourse('all')}
              >
                <Text style={[s.chipText, selectedCourse === 'all' && s.chipTextActive]}>All Courses</Text>
              </TouchableOpacity>
              {courses.map((c) => (
                <TouchableOpacity
                  key={c.code}
                  style={[s.chip, selectedCourse === c.code && s.chipActive]}
                  onPress={() => setSelectedCourse(c.code)}
                >
                  <Text style={[s.chipText, selectedCourse === c.code && s.chipTextActive]}>{c.code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <Text style={s.filterSectionLabel}>Date Range</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.filterRow}>
              {DATE_RANGES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[s.chip, dateRange === r.value && s.chipActive]}
                  onPress={() => setDateRange(r.value)}
                >
                  <Text style={[s.chipText, dateRange === r.value && s.chipTextActive]}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* ── OVERALL CARD (based on filters) ── */}
        <View style={s.overallCard}>
          <View style={s.overallTop}>
            <View>
              <Text style={s.overallLabel}>
                {selectedCourse === 'all' ? 'Overall' : courses.find((c) => c.code === selectedCourse)?.name || selectedCourse}
                {dateRange !== 'all' ? `  ·  ${DATE_RANGES.find((r) => r.value === dateRange)?.label}` : ''}
              </Text>
              <Text style={s.overallPct}>{pct != null ? `${pct}%` : '—'}</Text>
            </View>
            <View style={s.overallMeta}>
              <Text style={s.overallMetaText}>{presentCount} Present</Text>
              <Text style={s.overallMetaText}>{filteredLogs.length - presentCount} Other</Text>
              <Text style={s.overallMetaText}>{filteredLogs.length} Records</Text>
            </View>
          </View>
          <View style={s.progTrack}>
            <View style={[s.progFill, {
              width:           `${pct || 0}%`,
              backgroundColor: pct == null ? colors.border : pct >= 75 ? colors.green : pct >= 50 ? colors.amber : colors.red,
            }]} />
          </View>
          {pct != null && pct < 75 && (
            <Text style={s.warnText}>
              Below 75% threshold — attend more sessions to improve.
            </Text>
          )}
        </View>

        {/* ── COURSE BREAKDOWN (only when all courses selected) ── */}
        {selectedCourse === 'all' && filteredStats.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Per-Course Breakdown</Text>
            <View style={s.breakdownCard}>
              {filteredStats.map((c, i) => {
                const color = c.percentage == null ? colors.textMuted : c.percentage >= 75 ? colors.green : c.percentage >= 50 ? colors.amber : colors.red;
                const displayPct = c.percentage != null ? `${c.percentage}%` : 'N/A';
                return (
                  <View key={c.courseId}>
                    <TouchableOpacity
                      style={s.bkRow}
                      onPress={() => setSelectedCourse(c.courseCode)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.bkLine, { backgroundColor: color }]} />
                      <View style={s.bkNameWrap}>
                        <Text style={s.bkName} numberOfLines={1}>{c.course}</Text>
                        <Text style={s.bkCode}>{c.courseCode}</Text>
                      </View>
                      <View style={s.bkTrack}>
                        <View style={[s.bkFill, { width: `${c.percentage || 0}%`, backgroundColor: color }]} />
                      </View>
                      <Text style={[s.bkPct, { color }]}>{displayPct}</Text>
                      <Feather name="chevron-right" size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                    <Text style={s.bkDetail}>{c.attended} / {c.closedSessions} closed sessions attended</Text>
                    {i < filteredStats.length - 1 && <View style={s.bkDivider} />}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {/* ── ATTENDANCE LOG ── */}
        {filteredLogs.length > 0 ? (
          <>
            <Text style={s.sectionLabel}>
              Attendance Log
              {filteredLogs.length !== allLogs.length && ` (${filteredLogs.length} of ${allLogs.length})`}
            </Text>
            <View style={s.logList}>
              {filteredLogs.slice(0, 30).map((log) => (
                <View key={log.id} style={s.logItem}>
                  <View style={[s.logLine, { backgroundColor: log.status === 'PRESENT' ? colors.green : colors.red }]} />
                  <View style={s.logInfo}>
                    <Text style={s.logCourse}>{log.session?.course?.name}</Text>
                    <Text style={s.logTime}>
                      {new Date(log.signedAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      {'  ·  '}
                      {new Date(log.signedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {log.distanceM != null ? `  ·  ${Math.round(log.distanceM)}m` : ''}
                    </Text>
                  </View>
                  <View style={[s.logBadge, log.status === 'PRESENT' ? s.badgePresent : s.badgeAbsent]}>
                    <Text style={[s.logBadgeText, { color: log.status === 'PRESENT' ? colors.green : colors.red }]}>
                      {log.status === 'PRESENT' ? 'Present' : 'Absent'}
                    </Text>
                  </View>
                </View>
              ))}
              {filteredLogs.length > 30 && (
                <Text style={s.moreText}>Showing 30 of {filteredLogs.length} records. Download CSV for the full report.</Text>
              )}
            </View>
          </>
        ) : (
          <View style={s.emptyState}>
            <Feather name="bar-chart-2" size={36} color={colors.textMuted} />
            <Text style={s.emptyTitle}>
              {allLogs.length === 0 ? 'No attendance records yet' : 'No records match this filter'}
            </Text>
            <Text style={s.emptySub}>
              {allLogs.length === 0 ? 'Sign your first attendance to see data here.' : 'Try a different course or date range.'}
            </Text>
            {allLogs.length > 0 && (
              <TouchableOpacity style={s.clearBtn} onPress={() => { setSelectedCourse('all'); setDateRange('all'); }}>
                <Text style={s.clearBtnText}>Clear Filters</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgPrimary },
  content:   { paddingHorizontal: spacing.lg, paddingBottom: 16 },

  headerRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title:        { fontSize: 24, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  downloadBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentMid, borderRadius: radius.sm + 2, paddingHorizontal: 12, paddingVertical: 8 },
  downloadText: { fontSize: 12, fontWeight: '600', color: colors.accent },

  // Filters
  filterSection:      { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  filterSectionLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  filterRow:          { flexDirection: 'row', gap: 7 },
  chip:               { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border },
  chipActive:         { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText:           { fontSize: 12, fontWeight: '500', color: colors.textMuted },
  chipTextActive:     { color: '#fff', fontWeight: '700' },

  // Overall
  overallCard:     { backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: 16, marginBottom: 18, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  overallTop:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  overallLabel:    { fontSize: 11, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  overallPct:      { fontSize: 38, fontWeight: '700', color: colors.textPrimary, letterSpacing: -1.2, lineHeight: 42 },
  overallMeta:     { gap: 3, alignItems: 'flex-end' },
  overallMetaText: { fontSize: 12, color: colors.textMuted },
  progTrack:       { height: 5, backgroundColor: colors.bgInput, borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  progFill:        { height: '100%', borderRadius: 3 },
  warnText:        { fontSize: 11, color: colors.amber, fontWeight: '500' },

  sectionLabel: { fontSize: 11, fontWeight: '600', color: colors.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 },

  // Breakdown
  breakdownCard: { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  bkRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 8 },
  bkLine:        { width: 3, height: 28, borderRadius: 2 },
  bkNameWrap:    { width: 96 },
  bkName:        { fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  bkCode:        { fontSize: 10, color: colors.textMuted },
  bkTrack:       { flex: 1, height: 4, backgroundColor: colors.bgInput, borderRadius: 2, overflow: 'hidden' },
  bkFill:        { height: '100%', borderRadius: 2 },
  bkPct:         { fontSize: 12, fontWeight: '700', width: 38, textAlign: 'right' },
  bkDetail:      { fontSize: 10, color: colors.textMuted, marginLeft: 11, paddingBottom: 8, marginTop: 2 },
  bkDivider:     { height: 1, backgroundColor: colors.borderSoft },

  // Logs
  logList:  { gap: 7 },
  logItem:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.borderSoft, ...shadow.card },
  logLine:  { width: 3, height: 32, borderRadius: 2 },
  logInfo:  { flex: 1 },
  logCourse:{ fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  logTime:  { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  logBadge: { borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3 },
  badgePresent: { backgroundColor: colors.greenSoft },
  badgeAbsent:  { backgroundColor: colors.redSoft },
  logBadgeText: { fontSize: 11, fontWeight: '600' },
  moreText:     { fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingTop: 10 },

  emptyState: { alignItems: 'center', paddingVertical: 56, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textSecondary },
  emptySub:   { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  clearBtn:   { marginTop: 8, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 20 },
  clearBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
});