import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Animated,
  TouchableOpacity, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { colors, radius, shadow } from '../theme';

const SLIDES = [
  {
    icon:     'map-pin',
    title:    'GPS-Powered\nAttendance',
    subtitle: "Sign attendance only when you're physically inside the classroom. No proxy, no shortcuts.",
    color:    colors.accent,
  },
  {
    icon:     'shield',
    title:    'Secure &\nProxy-Free',
    subtitle: 'Your identity is verified every session. One student, one sign-in. Always.',
    color:    colors.green,
  },
  {
    icon:     'bar-chart-2',
    title:    'Instant\nReports',
    subtitle: 'View your attendance per course and download reports any time.',
    color:    colors.amber,
  },
];

export default function SplashScreen({ navigation }) {
  const [current, setCurrent] = useState(0);
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const iconScale = useRef(new Animated.Value(0.88)).current;

  const animateIn = () => {
    fadeAnim.setValue(0);
    slideAnim.setValue(20);
    iconScale.setValue(0.88);
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 10,  useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 7,   useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => { animateIn(); }, [current]);

  useEffect(() => {
    const t = setInterval(() => {
      setCurrent((p) => (p < SLIDES.length - 1 ? p + 1 : p));
    }, 2800);
    return () => clearInterval(t);
  }, []);

  const goNext = () => {
    if (current < SLIDES.length - 1) setCurrent(current + 1);
    else navigation.replace('Login');
  };

  const slide = SLIDES[current];

  return (
    
    <SafeAreaView style={[s.safe, { backgroundColor: colors.bgPrimary }]} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bgPrimary} />

     
      <View style={s.outer}>

        {/* ── Top section: logo + skip ── */}
        <View style={s.topRow}>
          <View style={s.logoRow}>
            <View style={s.logoIcon}>
              <Feather name="map-pin" size={15} color="#fff" />
            </View>
            <Text style={s.logoText}>AttendX</Text>
          </View>
          {current < SLIDES.length - 1 && (
            <TouchableOpacity style={s.skipBtn} onPress={() => navigation.replace('Login')}>
              <Text style={s.skipText}>Skip</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Middle section: animated icon + text ── */}
        <Animated.View style={[s.middle, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          <Animated.View style={[s.iconWrap, { backgroundColor: slide.color, transform: [{ scale: iconScale }] }]}>
            <Feather name={slide.icon} size={48} color="#fff" />
          </Animated.View>
          <Text style={s.title}>{slide.title}</Text>
          <Text style={s.subtitle}>{slide.subtitle}</Text>
        </Animated.View>

        {/* ── Bottom section: dots + button ── */}
        <View style={s.bottom}>
          <View style={s.dots}>
            {SLIDES.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => setCurrent(i)}>
                <View style={[s.dot, i === current && { width: 22, backgroundColor: slide.color }]} />
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[s.btn, { backgroundColor: slide.color }]}
            onPress={goNext}
            activeOpacity={0.85}
          >
            <Text style={s.btnText}>{current === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
            <Feather
              name={current === SLIDES.length - 1 ? 'arrow-right' : 'chevron-right'}
              size={18} color="#fff"
            />
          </TouchableOpacity>
        </View>

      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:  { flex: 1 },
  outer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical:   20,
    justifyContent:    'space-between', 
  },

  // Top
  topRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  skipBtn:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  skipText: { fontSize: 13, color: colors.textMuted, fontWeight: '500' },

  // Middle
  middle:   { alignItems: 'center', paddingVertical: 16 },
  iconWrap: {
    width: 110, height: 110,
    borderRadius: 30,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28,
    ...shadow.strong,
  },
  title: {
    fontSize: 32, fontWeight: '700', color: colors.textPrimary,
    letterSpacing: -0.8, textAlign: 'center', lineHeight: 38, marginBottom: 14,
  },
  subtitle: {
    fontSize: 15, color: colors.textSecondary,
    textAlign: 'center', lineHeight: 23, maxWidth: 290,
  },

  // Bottom
  bottom: { gap: 16 },
  dots:   { flexDirection: 'row', justifyContent: 'center', gap: 7 },
  dot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.border },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: radius.md, paddingVertical: 15,
    ...shadow.card,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});