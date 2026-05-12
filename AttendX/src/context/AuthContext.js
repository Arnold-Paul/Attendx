

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUser, getToken, clearSession } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(null);
  const [loading, setLoading] = useState(true);

  // load saved session from AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const [savedUser, savedToken] = await Promise.all([getUser(), getToken()]);
        if (savedUser && savedToken) {
          setUser(savedUser);
          setToken(savedToken);
        }
      } catch (_) {}
      setLoading(false);
    })();
  }, []);

  const signIn = (userData, tokenData) => {
    setUser(userData);
    setToken(tokenData);
  };

  const signOut = async () => {
    await clearSession();
    setUser(null);
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}