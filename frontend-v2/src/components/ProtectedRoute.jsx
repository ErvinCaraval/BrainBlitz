import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function ProtectedRoute({ children, adminOnly }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  
  // Redirect to complete profile if user doesn't have displayName
  if (!user.displayName && window.location.pathname !== '/complete-profile') {
    return <Navigate to="/complete-profile" replace />;
  }
  
  if (adminOnly && user.email !== 'admin@example.com') return <Navigate to="/dashboard" replace />;
  return children;
}