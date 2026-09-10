import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('wms_token') || null);
  const [activeWarehouse, setActiveWarehouse] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Set default axios header
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  useEffect(() => {
    if (token) {
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get('/api/auth/me', {
        headers: activeWarehouse ? { 'x-warehouse-id': activeWarehouse.id } : {}
      });
      setUser(res.data.user);
      setActiveWarehouse(res.data.activeWarehouse);
      setWarehouses(res.data.warehouses || []);
    } catch (err) {
      console.error('Failed to load user profile:', err);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const res = await axios.post('/api/auth/login', { username, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('wms_token', newToken);
    axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
    setToken(newToken);
    setUser(userData);
    setActiveWarehouse(userData.warehouse);
    return userData;
  };

  const isSuperAdmin = Boolean(
    user && (
      ['Super Admin', 'SUPER_ADMIN', 'SuperAdmin'].includes(user.role) ||
      (user.username && user.username.toLowerCase() === 'admin')
    )
  );

  const switchWarehouse = async (warehouseId) => {
    if (!isSuperAdmin) return;
    const wh = warehouses.find(w => w.id === parseInt(warehouseId, 10));
    if (wh) {
      setActiveWarehouse(wh);
      axios.defaults.headers.common['x-warehouse-id'] = wh.id;
      try {
        await axios.post('/api/auth/switch-warehouse', { warehouse_id: wh.id });
      } catch (e) {}
    }
  };

  const logout = () => {
    localStorage.removeItem('wms_token');
    delete axios.defaults.headers.common['Authorization'];
    delete axios.defaults.headers.common['x-warehouse-id'];
    setToken(null);
    setUser(null);
    setActiveWarehouse(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isSuperAdmin,
      activeWarehouse,
      warehouses,
      loading,
      login,
      logout,
      switchWarehouse,
      fetchProfile
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
