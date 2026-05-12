
import AsyncStorage from '@react-native-async-storage/async-storage';


export const BASE_URL = 'https://attendx-api-khmb.onrender.com/api';


export const saveToken  = (t)  => AsyncStorage.setItem('token', t);
export const getToken   = ()   => AsyncStorage.getItem('token');
export const saveUser   = (u)  => AsyncStorage.setItem('user', JSON.stringify(u));
export const getUser    = async () => { const u = await AsyncStorage.getItem('user'); return u ? JSON.parse(u) : null; };
export const clearSession = () => AsyncStorage.multiRemove(['token', 'user']);


async function request(method, path, body = null, token = null) {
  const headers = {
    'Content-Type':  'application/json',
    'Cache-Control': 'no-store',   
    'Pragma':        'no-cache',
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const res  = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed ${res.status}`);
  return data;
}

async function authRequest(method, path, body = null) {
  const token = await getToken();
  return request(method, path, body, token);
}


export async function signup(name, email, password, programme, year, deviceId) {
  const data = await request('POST', '/auth/signup', {
    name, email, password, programme, year, deviceId,
  });
  await saveToken(data.token);
  await saveUser(data.user);
  return data;
}


export async function login(emailOrId, password, deviceId, pushToken) {
  const isEmail = emailOrId.includes('@');
  const body = {
    password,
    deviceId,
    pushToken,
    ...(isEmail ? { email: emailOrId } : { studentId: emailOrId }),
  };
  const data = await request('POST', '/auth/login', body);
  await saveToken(data.token);
  await saveUser(data.user);
  return data;
}

export async function registerPushToken(pushToken) {
  return authRequest('POST', '/auth/push-token', { pushToken });
}

export async function logout() {
  await clearSession();
}

export async function getMe() {
  return authRequest('GET', '/auth/me');
}


export const getMyCourses        = ()           => authRequest('GET',  '/courses');
export const getCourse           = (id)         => authRequest('GET',  `/courses/${id}`);
export const createCourse        = (name, code) => authRequest('POST', '/courses', { name, code });
export const enrolStudent        = (cId, sId)   => authRequest('POST', `/courses/${cId}/enrol`, { studentId: sId });


export const getActiveSessions   = ()           => authRequest('GET',  '/sessions/active');
export const getSessionsByCourse = (courseId)   => authRequest('GET',  `/sessions?courseId=${courseId}`);
export const getSession          = (id)         => authRequest('GET',  `/sessions/${id}`);
export const createSession       = (data)       => authRequest('POST', '/sessions', data);
export const setSessionLocation  = (id, lat, lng, radius = 50) =>
  authRequest('PATCH', `/sessions/${id}/set-location`, { latitude: lat, longitude: lng, radiusMeters: radius });
export const closeSession        = (id)         => authRequest('PATCH', `/sessions/${id}/close`);


export const signAttendance      = (sessionId, gpsLat, gpsLng) =>
  authRequest('POST', '/attendance/sign', { sessionId, gpsLat, gpsLng });
export const getMyAttendance     = ()           => authRequest('GET', '/attendance/me');
export const getSessionAttendance= (id)         => authRequest('GET', `/attendance/session/${id}`);
export const getSessionReport    = (id)         => authRequest('GET', `/attendance/report/${id}`);


export const getNotifications         = ()    => authRequest('GET',   '/notifications');
export const markNotificationRead     = (id)  => authRequest('PATCH', `/notifications/${id}/read`);
export const markAllNotificationsRead = ()    => authRequest('PATCH', '/notifications/read-all');


export const assignClassRep = (studentId, courseId) =>
  authRequest('POST', '/users/assign-classrep', { studentId, courseId });
export const removeClassRep = (studentId, courseId) =>
  authRequest('POST', '/users/remove-classrep', { studentId, courseId });
export const getClassRep    = (courseId) =>
  authRequest('GET', `/users/classreps/${courseId}`);


export const updateProfile = (data) => authRequest('PUT', '/users/me', data);