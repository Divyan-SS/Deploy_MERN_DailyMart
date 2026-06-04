// frontend/src/context/AuthContext.jsx
import React, { createContext, useState, useEffect } from 'react';
import axios from 'axios';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [userInfo, setUserInfo] = useState(
    localStorage.getItem('userInfo') ? JSON.parse(localStorage.getItem('userInfo')) : null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError(null);
      const config = { headers: { 'Content-Type': 'application/json' } };
      
      const { data } = await axios.post('/api/users/login', { email, password }, config);
      
      setUserInfo(data);
      localStorage.setItem('userInfo', JSON.stringify(data));
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      const msg = err.response && err.response.data.message ? err.response.data.message : err.message;
      setError(msg);
      throw new Error(msg);
    }
  };

  const googleLogin = async (accessToken) => {
    try {
      setLoading(true);
      setError(null);
      const config = { headers: { 'Content-Type': 'application/json' } };
      
      const { data } = await axios.post('/api/users/google-login', { token: accessToken }, config);
      
      setUserInfo(data);
      localStorage.setItem('userInfo', JSON.stringify(data));
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      const msg = err.response && err.response.data.message ? err.response.data.message : err.message;
      setError(msg);
      throw new Error(msg);
    }
  };

  const register = async (name, email, password) => {
    try {
      setLoading(true);
      setError(null);
      const config = { headers: { 'Content-Type': 'application/json' } };
      
      const { data } = await axios.post('/api/users/register', { name, email, password }, config);
      
      setUserInfo(data);
      localStorage.setItem('userInfo', JSON.stringify(data));
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      const msg = err.response && err.response.data.message ? err.response.data.message : err.message;
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = () => {
    setUserInfo(null);
    localStorage.removeItem('userInfo');
    localStorage.removeItem('cartItems');
    localStorage.removeItem('shippingAddress');
    localStorage.removeItem('deliveryLocation');
    // Security Compliance: Dispatches a synthetic event signaling the Cart Context to drop active sessions
    window.dispatchEvent(new Event('userLogout'));
  };

  const updateProfile = async (user) => {
    try {
      setLoading(true);
      setError(null);
      const config = {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userInfo.token}`,
        },
      };
      
      const { data } = await axios.put('/api/users/profile', user, config);
      
      setUserInfo(data);
      localStorage.setItem('userInfo', JSON.stringify(data));
      setLoading(false);
      return data;
    } catch (err) {
      setLoading(false);
      const msg = err.response && err.response.data.message ? err.response.data.message : err.message;
      setError(msg);
      throw new Error(msg);
    }
  };

  return (
    <AuthContext.Provider value={{ userInfo, loading, error, login, register, logout, updateProfile, googleLogin }}>
      {children}
    </AuthContext.Provider>
  );
};