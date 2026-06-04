// frontend/src/components/ProtectedRoute.jsx
import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const ProtectedRoute = ({ children, isAdminRequired = false }) => {
  const { userInfo } = useContext(AuthContext);
  const location = useLocation();

  // If the user is not signed in, redirect them back to the sign-in screen
  if (!userInfo) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If an admin role is required but user account is standard, return back to main catalog page
  if (isAdminRequired && !userInfo.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;