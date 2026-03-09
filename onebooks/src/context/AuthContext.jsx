
import React, { createContext, useState, useContext, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  useEffect(() => {
    console.log('AuthProvider: Initializing...');
    
    const storedToken = localStorage.getItem('authToken');
    const storedUser = localStorage.getItem('user');
    const storedDemoMode = localStorage.getItem('demoMode');
    
    console.log('Stored values:', { storedToken, storedUser, storedDemoMode });
    
    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        setToken(storedToken);
        setIsDemoMode(storedDemoMode === 'true');
        console.log('Auth restored from localStorage');
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.clear();
      }
    }
    
    setLoading(false);
  }, []);

  const login = (userData, authToken, demoMode = false) => {
    console.log('Login called:', { userData, authToken, demoMode });
    
    setUser(userData);
    setToken(authToken);
    setIsDemoMode(demoMode);
    
    localStorage.setItem('authToken', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('demoMode', String(demoMode));
    
    console.log('Login complete, localStorage updated');
  };

  const logout = () => {
    console.log('Logout called');
    
    setUser(null);
    setToken(null);
    setIsDemoMode(false);
    
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('demoMode');
  };

  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!token,
    isDemoMode,
    loading,
  };

  console.log('AuthContext value:', { 
    hasUser: !!user, 
    hasToken: !!token, 
    isAuthenticated: !!token, 
    isDemoMode, 
    loading 
  });

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
