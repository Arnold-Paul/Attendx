
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Animated, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { colors, radius, spacing, shadow } from '../theme';
import { getActiveSessions, signAttendance } from '../api';


const SCREEN_WIDTH = Dimensions.get('window').width;
const H_PAD    = spacing.lg * 2;
const WRAP_W   = SCREEN_WIDTH - H_PAD;
const RING     = 170;
const RING_R   = RING / 2;
const PAD_V    = 16;
const WRAP_H   = RING + PAD_V * 2;
const DOT      = 11;
const ANG      = (45 * Math.PI) / 180;
const OX       = Math.cos(ANG) * RING_R;
const OY       = Math.sin(ANG) * RING_R;
const CX       = WRAP_W / 2;
const CY       = PAD_V + RING_R;
const DOT_L    = CX + OX - DOT / 2;
const DOT_T    = CY - OY - DOT / 2;

export default function MarkAttendanceScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();

  
  const forceRefresh = route?.params?.forceRefresh;

  const [sessions,  setSessions]  = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [location,  setLocation]  = useState(null);
  const [locError,  setLocError]  = useState(null);
  const [signed,    setSigned]    = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [fetching,  setFetching]  = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  
  useEffect(() => {
    setSigned(false);
    setSelected(null);
    setSessions([]);
    setFetching(true);
    loadSessions();
  }, [forceRefresh]);

  const loadSessions = async () => {
    setFetching(true);
    try {
      const data = await getActiveSessions();
      const list = data.sessions || [];
      setSessions(list);
      // Auto-select if exactly one open session
      if (list.length === 1) setSelected(list[0]);
    } catch {
      Alert.alert('Error', 'Could not load sessions. Check your connection.');
    } finally {
      setFetching(false);
    }
  };

  
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocError('Location permission denied. Please enable it in your phone settings.');
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(loc.coords);
      } catch {
        setLocError('Could not get your location. Move to an open area and try again.');
      }
    })();
  }, []);

  
  useEffect(() => {
    if (!selected) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.04, duration: 1400, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 1400, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [selected]);

  const handleSign = async () => {
    if (!location) {
      Alert.alert('No GPS', locError || 'Waiting for GPS. Move to an open area.');
      return;
    }
    setLoading(true);
    try {
      await signAttendance(selected.id, location.latitude, location.longitude);
      setSigned(true);
    } catch (err) {
      Alert.alert('Cannot Sign', err.message);
    } finally {
      setLoading(false);
    }
  };

  const topPad = insets.top + 12;

 
  if (fetching) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.accent} size="large" />
        <Text style={s.centerText}>Loading open sessions...</Text>
      </View>
    );
  }

  
  if (sessions.length === 0) {
    return (
      <View style={[s.center, { paddingTop: topPad }]}>
        <Feather name="clock" size={40} color={colors.textMuted} />
        <Text style={s.noTitle}>No Open Sessions</Text>
        <Text style={s.noSub}>
          Your lecturer hasn't opened attendance yet.{'\n'}You'll see a notification when they do.
        </Text>
        <TouchableOpacity style={s.retryBtn} onPress={loadSessions}>
          <Feather name="refresh-cw" size={14} color="#fff" />
          <Text style={s.retryText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    );
  }

  
  if (sessions.length > 1 && !selected) {
    return (
      <View style={s.container}>
        <ScrollView contentContainerStyle={[s.content, { paddingTop: topPad }]}>
          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={16} color={colors.textMuted} />
            <Text style={s.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={s.title}>Choose a Session</Text>
          <Text style={s.subtitle}>Multiple sessions are open right now</Text>
          <View style={{ gap: 9, marginTop: 16 }}>
            {sessions.map((sess) => (
              <TouchableOpacity key={sess.id} style={s.sessionPick} onPress={() => setSelected(sess)} activeOpacity={0.8}>
                <View style={[s.pickLine, { backgroundColor: colors.green }]} />
                <View style={{ flex: 1 }}>
                  <Text style={s.pickName}>{sess.course?.name}</Text>
                  <Text style={s.pickMeta}>Week {sess.weekNumber}  ·  {sess.sessionType}</Text>
                </View>
                <Feather name="chevron-right" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  
  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={[s.content, { paddingTop: topPad }]} showsVerticalScrollIndicator={false}>

        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={16} color={colors.textMuted} />
          <Text style={s.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={s.title}>Mark Attendance</Text>
        {selected && <Text style={s.subtitle}>{selected.course?.name}  ·  Week {selected.weekNumber}</Text>}

        {/* Geo rings */}
        <View style={s.geoWrap}>
          <Animated.View style={[s.ringOuter, { transform: [{ scale: pulseAnim }], borderColor: location ? colors.accentMid : colors.border }]}>
            <View style={[s.ringMid, { borderColor: location ? colors.accentMid : colors.border }]}>
              <View style={[s.ringInner, location
                ? { backgroundColor: colors.accentSoft, borderColor: colors.accent }
                : { backgroundColor: colors.bgInput, borderColor: colors.border }
              ]}>
                <View style={[s.geoCore, !location && { backgroundColor: colors.amber }]}>
                  <Feather name="map-pin" size={20} color="#fff" />
                </View>
              </View>
            </View>
          </Animated.View>
          {location && <View style={[s.studentDot, { top: DOT_T, left: DOT_L }]} />}
        </View>

        {/* Location status */}
        <View style={s.locationCard}>
          <View style={s.locationTop}>
            <Feather name="map-pin" size={14} color={colors.accent} />
            <Text style={s.locationName}>
              {location ? 'Location acquired' : locError ? 'Location error' : 'Getting your location...'}
            </Text>
          </View>
          {location && (
            <Text style={s.locationCoords}>
              {location.latitude.toFixed(5)}°, {location.longitude.toFixed(5)}°  ·  ±{Math.round(location.accuracy || 10)}m
            </Text>
          )}
          {locError && <Text style={[s.locationCoords, { color: colors.red }]}>{locError}</Text>}
          {!location && !locError && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={s.locationCoords}>Acquiring GPS signal...</Text>
            </View>
          )}
        </View>

        {/* Session details */}
        {selected && (
          <View style={s.sessionCard}>
            {[
              ['Course',   selected.course?.name],
              ['Lecturer', selected.course?.lecturer?.name || 'N/A'],
              ['Week',     `Week ${selected.weekNumber}`],
              ['Type',     selected.sessionType],
            ].map(([k, v], i, arr) => (
              <View key={k}>
                <View style={s.detailRow}>
                  <Text style={s.detailKey}>{k}</Text>
                  <Text style={s.detailVal}>{v}</Text>
                </View>
                {i < arr.length - 1 && <View style={s.divider} />}
              </View>
            ))}
          </View>
        )}

        {/* Sign button / success */}
        {signed ? (
          <View style={s.signedBanner}>
            <Feather name="check-circle" size={22} color={colors.green} />
            <View>
              <Text style={s.signedText}>Attendance Signed Successfully</Text>
              <Text style={s.signedSub}>Recorded at {new Date().toLocaleTimeString()}</Text>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[s.signBtn, (!location || loading || !selected) && s.signBtnOff]}
            onPress={handleSign}
            disabled={loading || !location || !selected}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Feather name={location ? 'check-circle' : 'loader'} size={18} color="#fff" />
                  <Text style={s.signBtnText}>{location ? 'Sign Attendance' : 'Waiting for GPS...'}</Text>
                </>
            }
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgPrimary },
  center:    { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgPrimary, padding: spacing.lg },
  content:   { paddingHorizontal: spacing.lg, paddingBottom: 16 },
  centerText:{ fontSize: 13, color: colors.textMuted, marginTop: 12 },

  noTitle: { fontSize: 20, fontWeight: '700', color: colors.textPrimary, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  noSub:   { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  retryBtn:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 24 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  backBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14, alignSelf: 'flex-start' },
  backText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  title:    { fontSize: 26, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.6, marginBottom: 3 },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginBottom: 6 },

  sessionPick: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  pickLine:    { width: 3, height: 32, borderRadius: 2 },
  pickName:    { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  pickMeta:    { fontSize: 12, color: colors.textMuted, marginTop: 2 },

  geoWrap:    { height: WRAP_H, alignItems: 'center', justifyContent: 'center', marginVertical: 8, position: 'relative' },
  ringOuter:  { width: RING, height: RING, borderRadius: RING_R, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ringMid:    { width: 122, height: 122, borderRadius: 61, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ringInner:  { width: 78,  height: 78,  borderRadius: 39, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  geoCore:    { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.strong },
  studentDot: { position: 'absolute', width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: colors.accent, borderWidth: 2.5, borderColor: colors.bgPrimary },

  locationCard:   { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 13, marginBottom: 11, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  locationTop:    { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  locationName:   { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  locationCoords: { fontSize: 11, color: colors.textMuted, marginLeft: 21 },

  sessionCard:  { backgroundColor: colors.bgCard, borderRadius: radius.md, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: colors.borderSoft, ...shadow.card },
  detailRow:    { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9 },
  detailKey:    { fontSize: 11, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '500' },
  detailVal:    { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  divider:      { height: 1, backgroundColor: colors.borderSoft },

  signBtn:      { backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8, ...shadow.card },
  signBtnOff:   { backgroundColor: colors.border },
  signBtnText:  { color: '#fff', fontSize: 15, fontWeight: '700' },

  signedBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: colors.green, borderRadius: radius.md, paddingVertical: 16, paddingHorizontal: 16 },
  signedText:   { fontSize: 14, fontWeight: '700', color: colors.green },
  signedSub:    { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});