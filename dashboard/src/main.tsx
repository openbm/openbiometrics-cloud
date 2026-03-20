import './index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Login from './pages/Login'
import Signup from './pages/Signup'
import FaceVerify from './pages/FaceVerify'
import Dashboard from './pages/Dashboard'
import ApiKeys from './pages/ApiKeys'
import Usage from './pages/Usage'
import Billing from './pages/Billing'
import Layout from './components/Layout'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, faceVerified } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (!faceVerified) return <Navigate to="/face-verify" replace />
  return <>{children}</>
}

function FaceVerifyRoute({ children }: { children: React.ReactNode }) {
  const { token, faceVerified } = useAuth()
  if (!token) return <Navigate to="/login" replace />
  if (faceVerified) return <Navigate to="/" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  if (token) return <Navigate to="/" replace />
  return <>{children}</>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
          <Route path="/face-verify" element={<FaceVerifyRoute><FaceVerify /></FaceVerifyRoute>} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/api-keys" element={<ApiKeys />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/billing" element={<Billing />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
)
