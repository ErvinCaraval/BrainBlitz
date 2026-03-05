import React, { Suspense, lazy } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { motion } from 'framer-motion'

// Lazy load all page components for better code splitting
const HomePage = lazy(() => import('./pages/HomePage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const GameLobbyPage = lazy(() => import('./pages/GameLobbyPage'))
const GamePage = lazy(() => import('./pages/GamePage'))
const GameSummaryPage = lazy(() => import('./pages/GameSummaryPage'))
const AdminPage = lazy(() => import('./pages/AdminPage'))
const CompleteProfilePage = lazy(() => import('./pages/CompleteProfilePage'))
const VoiceTestPage = lazy(() => import('./pages/VoiceTestPage'))
const FaceRegister = lazy(() => import('./pages/FaceRegister'))
const FaceLogin = lazy(() => import('./pages/FaceLogin'))
const ProtectedRoute = lazy(() => import('./components/ProtectedRoute'))
const AuthRedirect = lazy(() => import('./components/AuthRedirect'))

// Loading fallback component
function LoadingFallback() {
  return (
    <motion.div
      className="min-h-screen flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="flex flex-col items-center gap-4"
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <div className="text-5xl font-bold bg-gradient-to-r from-bb-primary via-bb-secondary to-bb-accent bg-clip-text text-transparent">
          ⚡
        </div>
        <p className="text-white/60 text-lg font-medium">Cargando...</p>
      </motion.div>
    </motion.div>
  )
}

export default function AppRoutes() {
  return (
    <Router>
      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/register" element={<AuthRedirect><RegisterPage /></AuthRedirect>} />
          <Route path="/login" element={<AuthRedirect><LoginPage /></AuthRedirect>} />
          <Route path="/reset" element={<PasswordResetPage />} />
          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfilePage /></ProtectedRoute>} />
          <Route path="/lobby/:gameId" element={<ProtectedRoute><GameLobbyPage /></ProtectedRoute>} />
          <Route path="/game/:gameId" element={<ProtectedRoute><GamePage /></ProtectedRoute>} />
          <Route path="/summary/:gameId" element={<ProtectedRoute><GameSummaryPage /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly={true}><AdminPage /></ProtectedRoute>} />
          <Route path="/voice-test" element={<VoiceTestPage />} />
          <Route path="/face-register" element={<ProtectedRoute><FaceRegister /></ProtectedRoute>} />
          <Route path="/face-login" element={<FaceLogin />} />
        </Routes>
      </Suspense>
    </Router>
  )
}