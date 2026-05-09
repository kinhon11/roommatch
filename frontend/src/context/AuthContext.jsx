import { createContext, useContext, useState, useCallback } from 'react';
import { authService } from '../services/authService';

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
  const [loading] = useState(false);

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
  const isTenant = user?.role === 'tenant';

  const value = {
    user,
    session,
    loading,
    login,
    register,
    logout,
    updateUser,
    isAuthenticated: !!user,
    isAdmin,
    isLandlord,
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
