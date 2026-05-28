import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authService } from '../services/authService';
import { profileService } from '../services/profileService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('roommie-user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem('roommie-user');
      return null;
    }
  });
  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem('roommie-session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem('roommie-session');
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      let storedSession = null;
      try {
        storedSession = JSON.parse(localStorage.getItem('roommie-session') || 'null');
      } catch {
        storedSession = null;
      }
      if (!storedSession?.access_token) {
        localStorage.removeItem('roommie-session');
        localStorage.removeItem('roommie-user');
        if (isMounted) {
          setUser(null);
          setSession(null);
          setLoading(false);
        }
        return;
      }

      try {
        const freshUser = await profileService.getProfile();
        if (!isMounted) return;
        setSession(storedSession);
        setUser(freshUser);
        localStorage.setItem('roommie-user', JSON.stringify(freshUser));
      } catch {
        localStorage.removeItem('roommie-session');
        localStorage.removeItem('roommie-user');
        if (!isMounted) return;
        setUser(null);
        setSession(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    verifySession();
    return () => { isMounted = false; };
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await authService.login(credentials);
    setUser(response.user);
    setSession(response.session);
    localStorage.setItem('roommie-session', JSON.stringify(response.session));
    localStorage.setItem('roommie-user', JSON.stringify(response.user));
    return response;
  }, []);

  const register = useCallback(async (userData) => {
    const response = await authService.register(userData);
    setUser(response.user);
    setSession(response.session);
    localStorage.setItem('roommie-session', JSON.stringify(response.session));
    localStorage.setItem('roommie-user', JSON.stringify(response.user));
    return response;
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setSession(null);
  }, []);

  // Cập nhật user trong context + localStorage
  const updateUser = useCallback((newUserData) => {
    setUser(prev => {
      const merged = { ...prev, ...newUserData };
      localStorage.setItem('roommie-user', JSON.stringify(merged));
      return merged;
    });
  }, []);

  const isAdmin = user?.role === 'admin';
  const isLandlord = user?.role === 'landlord';
  const isBroker = user?.role === 'broker';
  const isTenant = user?.role === 'tenant';

  const value = {
    user,
    session,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user && !!session?.access_token,
    isAdmin,
    isLandlord,
    isBroker,
    isTenant,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
};
