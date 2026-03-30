import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Ricerca from './pages/Ricerca'
import Libreria from './pages/Libreria'
import Documento from './pages/Documento'
import AdminUtenti from './pages/admin/AdminUtenti'
import AdminUpload from './pages/admin/AdminUpload'
import AdminAI from './pages/admin/AdminAI'
import AdminStato from './pages/admin/AdminStato'
import AdminLog from './pages/admin/AdminLog'
import AdminBackup from './pages/admin/AdminBackup'

function PrivateRoute({ children, adminOnly = false }) {
  const { utente, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}><span className="spinner" /></div>
  if (!utente) return <Navigate to="/login" />
  if (adminOnly && utente.ruolo !== 'admin') return <Navigate to="/ricerca" />
  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { utente, loading } = useAuth()
  if (loading) return null
  return (
    <Routes>
      <Route path="/login" element={utente ? <Navigate to="/ricerca" /> : <Login />} />
      <Route path="/ricerca" element={<PrivateRoute><Ricerca /></PrivateRoute>} />
      <Route path="/libreria" element={<PrivateRoute><Libreria /></PrivateRoute>} />
      <Route path="/documento/:id" element={<PrivateRoute><Documento /></PrivateRoute>} />
      <Route path="/admin/utenti" element={<PrivateRoute adminOnly><AdminUtenti /></PrivateRoute>} />
      <Route path="/admin/upload" element={<PrivateRoute adminOnly><AdminUpload /></PrivateRoute>} />
      <Route path="/admin/ai" element={<PrivateRoute adminOnly><AdminAI /></PrivateRoute>} />
      <Route path="/admin/stato" element={<PrivateRoute adminOnly><AdminStato /></PrivateRoute>} />
      <Route path="/admin/log" element={<PrivateRoute adminOnly><AdminLog /></PrivateRoute>} />
      <Route path="/admin/backup" element={<PrivateRoute adminOnly><AdminBackup /></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/ricerca" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
