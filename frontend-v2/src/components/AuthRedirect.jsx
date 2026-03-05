import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function AuthRedirect({ children }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return children;

  if (!user.displayName) {
    return <Navigate to="/complete-profile" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}


