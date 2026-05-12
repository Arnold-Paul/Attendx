import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, SafeAreaView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, spacing, shadow } from '../theme';
import { getMyCourses, getSessionsByCourse } from '../api';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];

function getBadge(status) {
  switch (status) {
    case 'LIVE': return { bg: colors.greenSoft, text: colors.green,     label: 'LIVE' };
    case 'SOON': return { bg: colors.accentSoft,text: colors.accent,    label: 'SOON' };
    case 'DONE': return { bg: colors.bgInput,   text: colors.textMuted, label: 'DONE' };
    default:     return { bg: colors.accentSoft,text: colors.accent,    label: 'UPCOMING' };
  }
}

function sessionStatus(session) {
  const now   = new Date();
  const start = new Date(session.startTime);
  const end   = new Date(session.endTime);
  if (now > end)   return 'DONE';
  if (session.isOpen && now >= start && now <= end) return 'LIVE';
  if (now >= start && now <= end) return 'SOON';
  return 'UPCOMING';
}

export default function TimetableScreen({ navigation }) {
  const now     = new Date();
  const todayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1; // 0=Mon
  const [dayIdx,  setDayIdx]  = useState(Math.min(todayIdx, 4));
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  const load = async () => {
    try {
      const { courses } = await getMyCourses();
      const all = [];
      for (const course of courses) {
        const { sessions: s } = await getSessionsByCourse(course.id);
        all.push(...(s || []).map((sess) => ({ ...sess, course })));
      }
      setSessions(all);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
  startOfWeek.setHours(0, 0, 0, 0);

  const dayDate = new Date(startOfWeek);
  dayDate.setDate(startOfWeek.getDate() + dayIdx);
  const dayEnd = new Date(dayDate);
  dayEnd.setHours(23, 59, 59, 999);

  const daySessions = sessions
    .filter((s) => {
      const d = new Date(s.startTime);
      return d >= dayDate && d <= dayEnd;
    })
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const getDayDate = (i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return d.getDate();
  };

  if (loading) return <View style={s.center}><ActivityIndicator color={colors.accent} size="large" /></View>;

  return (
    <SafeAreaView style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Timetable</Text>
            <Text style={s.sub}>{now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</Text>
          </View>
        </View>

        {/* Day strip */}
        <View style={s.dayStrip}>
          {DAYS.map((day, i) => {
            const active = i === dayIdx;
            const isToday = i === Math.min(todayIdx, 4);
            return (
              <TouchableOpacity key={day} style={[s.dayChip, active && s.dayChipActive]} onPress={() => setDayIdx(i)} activeOpacity={0.75}>
                <Text style={[s.dayName, active && s.dayNameActive]}>{day}</Text>
                <Text style={[s.dayDate, active && s.dayDateActive]}>{getDayDate(i)}</Text>
                {isToday && <View style={[s.todayDot, active && s.todayDotActive]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Timeline */}
        <View style={s.timelineCard}>
          {daySessions.length === 0 ? (
            <View style={s.empty}>
              <Feather name="sun" size={28} color={colors.textMuted} />
              <Text style={s.emptyTitle}>No classes</Text>
              <Text style={s.emptySub}>Free day — enjoy!</Text>
            </View>
          ) : (
            daySessions.map((sess, i) => {
              const status = sessionStatus(sess);
              const b      = getBadge(status);
              const isLast = i === daySessions.length - 1;
              const isLive = status === 'LIVE';
              const isDone = status === 'DONE';
              const startStr = new Date(sess.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <TouchableOpacity
                  key={sess.id}
                  style={s.row}
                  onPress={() => isLive && navigation.navigate('MarkAttendance', { sessionId: sess.id })}
                  activeOpacity={isLive ? 0.8 : 1}
                >
                  {/* Time */}
                  <View style={s.timeCol}>
                    <Text style={[s.timeText, isLive && { color: colors.green, fontWeight: '700' }]}>{startStr}</Text>
                  </View>
                  {/* Spine */}
                  <View style={s.spine}>
                    <View style={s.spineTop} />
                    <View style={[s.spineDot, { backgroundColor: isDone ? colors.border : sess.course ? colors.accent : colors.textMuted }, isLive && s.spineDotLive]} />
                    {!isLast && <View style={s.spineBottom} />}
                  </View>
                  {/* Card */}
                  <View style={[s.cardCol, isLast && { paddingBottom: 0 }]}>
                    {isLive && (
                      <View style={s.nowRow}>
                        <Text style={s.nowText}>NOW</Text>
                        <View style={s.nowLine} />
                      </View>
                    )}
                    <View style={[s.card, isLive ? s.cardLive : isDone ? s.cardDone : s.cardDefault]}>
                      <View style={[s.cardBar, { backgroundColor: isDone ? colors.border : colors.accent }]} />
                      <View style={s.cardBody}>
                        <Text style={[s.cardName, isDone && { color: colors.textSecondary }]} numberOfLines={1}>{sess.course?.name}</Text>
                        <Text style={s.cardMeta}>
                          {new Date(sess.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(sess.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={s.cardLecturer}>{sess.course?.lecturer?.name || ''}</Text>
                        {isLive && (
                          <View style={s.gpsPill}>
                            <View style={s.gpsDot} />
                            <Text style={s.gpsText}>Tap to sign attendance</Text>
                          </View>
                        )}
                      </View>
                      <View style={[s.badgeWrap, { backgroundColor: b.bg }]}>
                        <Text style={[s.badgeText, { color: b.text }]}>{b.label}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgPrimary },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  title:     { fontSize: 24, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  sub:       { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  dayStrip:  { flexDirection: 'row', paddingHorizontal: spacing.lg, gap: 6, marginBottom: spacing.md },
  dayChip:   { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.md, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, gap: 2, ...shadow.card },
  dayChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayName:       { fontSize: 9, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.5 },
  dayNameActive: { color: 'rgba(255,255,255,0.75)' },
  dayDate:       { fontSize: 17, fontWeight: '700', color: colors.textSecondary, lineHeight: 21 },
  dayDateActive: { color: '#fff' },
  todayDot:      { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent, marginTop: 1 },
  todayDotActive:{ backgroundColor: 'rgba(255,255,255,0.85)' },
  timelineCard:  { marginHorizontal: spacing.lg, backgroundColor: colors.bgCard, borderRadius: radius.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  row:       { flexDirection: 'row', gap: 10, minHeight: 48 },
  timeCol:   { width: 42, alignItems: 'flex-end', paddingTop: 2 },
  timeText:  { fontSize: 10, fontWeight: '500', color: colors.textMuted },
  spine:     { alignItems: 'center', width: 16 },
  spineTop:  { width: 1, height: 8, backgroundColor: colors.borderSoft },
  spineDot:  { width: 9, height: 9, borderRadius: 5 },
  spineDotLive: { width: 11, height: 11, borderRadius: 6, shadowColor: colors.green, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 5, elevation: 3 },
  spineBottom:  { width: 1, flex: 1, minHeight: 36, backgroundColor: colors.borderSoft },
  cardCol:   { flex: 1, paddingBottom: 12 },
  nowRow:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  nowText:   { fontSize: 9, fontWeight: '700', color: colors.green, letterSpacing: 0.6 },
  nowLine:   { flex: 1, height: 1, backgroundColor: 'rgba(18,160,92,0.25)' },
  card:      { flexDirection: 'row', borderRadius: radius.md, paddingVertical: 10, paddingRight: 10, gap: 8, alignItems: 'center', overflow: 'hidden' },
  cardLive:  { backgroundColor: colors.greenSoft, borderWidth: 1.5, borderColor: 'rgba(18,160,92,0.22)' },
  cardDone:  { backgroundColor: '#F8F9FB', borderWidth: 1, borderColor: colors.borderSoft, opacity: 0.7 },
  cardDefault:{ backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  cardBar:   { width: 3, height: 38, borderRadius: 2, flexShrink: 0, marginLeft: 8 },
  cardBody:  { flex: 1, gap: 2 },
  cardName:  { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  cardMeta:  { fontSize: 10, color: colors.textMuted },
  cardLecturer: { fontSize: 10, color: colors.textSecondary },
  gpsPill:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(18,160,92,0.12)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  gpsDot:    { width: 5, height: 5, borderRadius: 3, backgroundColor: '#6EFFC7' },
  gpsText:   { fontSize: 9, color: colors.green, fontWeight: '500' },
  badgeWrap: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'center' },
  badgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  empty:     { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTitle:{ fontSize: 15, fontWeight: '700', color: colors.textSecondary },
  emptySub:  { fontSize: 13, color: colors.textMuted },
});