// App.js
import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';

import { AuthProvider, useAuth } from './src/context/AuthContext';

import SplashScreen         from './src/screens/SplashScreen';
import LoginScreen          from './src/screens/LoginScreen';
import DashboardScreen      from './src/screens/DashboardScreen';
import MarkAttendanceScreen from './src/screens/MarkAttendanceScreen';
import ReportsScreen        from './src/screens/ReportsScreen';
import ProfileScreen        from './src/screens/ProfileScreen';
import LecturerScreen       from './src/screens/LecturerScreen';
import TimetableScreen      from './src/screens/TimetableScreen';

import { colors } from './src/theme';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

function TabIcon({ featherName, label, focused }) {
  return (
    <View style={ts.wrap}>
      <Feather name={featherName} size={20} color={focused ? colors.accent : colors.textMuted} />
      <Text style={[ts.label, focused && ts.labelActive]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </View>
  );
}

const ts = StyleSheet.create({
  wrap:        { alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 6, width: 72 },
  label:       { fontSize: 9, color: colors.textMuted, fontWeight: '500', textAlign: 'center' },
  labelActive: { color: colors.accent, fontWeight: '700' },
});


function StudentTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown:     false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.navBg,
          borderTopColor:  colors.border,
          borderTopWidth:  1,
          // Correctly accounts for home-indicator on notched/long phones
          height:          54 + insets.bottom,
          paddingBottom:   insets.bottom,
          paddingTop:      0,
        },
        tabBarItemStyle: { alignItems: 'center', justifyContent: 'center' },
      }}
    >
      <Tab.Screen name="Home"           component={DashboardScreen}      options={{ tabBarIcon: ({ focused }) => <TabIcon featherName="home"        label="Home"       focused={focused} /> }} />
      <Tab.Screen name="MarkAttendance" component={MarkAttendanceScreen} options={{ tabBarIcon: ({ focused }) => <TabIcon featherName="map-pin"     label="Attendance" focused={focused} /> }} />
      <Tab.Screen name="Timetable"      component={TimetableScreen}      options={{ tabBarIcon: ({ focused }) => <TabIcon featherName="calendar"    label="Timetable"  focused={focused} /> }} />
      <Tab.Screen name="Reports"        component={ReportsScreen}        options={{ tabBarIcon: ({ focused }) => <TabIcon featherName="bar-chart-2" label="Reports"    focused={focused} /> }} />
      <Tab.Screen name="Profile"        component={ProfileScreen}        options={{ tabBarIcon: ({ focused }) => <TabIcon featherName="user"        label="Profile"    focused={focused} /> }} />
    </Tab.Navigator>
  );
}


function RootNavigator() {
  const { user, loading } = useAuth();
  const navigationRef    = useRef(null);

  // Handle notification taps — navigate to attendance screen
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const sessionId = response.notification.request.content.data?.sessionId;
      if (sessionId && navigationRef.current) {
        
        navigationRef.current.navigate('Main', {
          screen:        'MarkAttendance',
          params:        { sessionId },
          merge:         true,
        });
      }
    });
    return () => sub.remove();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgPrimary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!user ? (
          <>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Login"  component={LoginScreen}  />
          </>
        ) : user.role === 'LECTURER' || user.role === 'ADMIN' ? (
          <Stack.Screen name="Lecturer" component={LecturerScreen} />
        ) : (
          <Stack.Screen name="Main" component={StudentTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}