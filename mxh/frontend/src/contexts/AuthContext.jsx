import { createContext, useState, useEffect, useCallback } from 'react';
import { getMe, login as loginApi, register as registerApi, logout as logoutApi, googleLogin as googleLoginApi } from '../services/auth';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const userData = await getMe();
      setUser(userData);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email, password) => {
    const data = await loginApi(email, password);
    await fetchUser();
    return data;
  };

  const register = async (username, email, password, birthday = null, gender = null) => {
    const data = await registerApi(username, email, password, birthday, gender);
    await fetchUser();
    return data;
  };

  const loginWithGoogle = async (credential, birthday = null, gender = null) => {
    const data = await googleLoginApi(credential, birthday, gender);
    if (data.needs_profile) {
      return data; // caller handles the profile form
    }
    await fetchUser();
    return data;
  };

  const logout = async () => {
    await logoutApi();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, logout, refreshUser: fetchUser }}>
      {children}
    </AuthContext.Provider>
  );
}
