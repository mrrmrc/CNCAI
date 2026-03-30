import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [utente, setUtente] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`
      api.get('/auth/me')
        .then(r => setUtente(r.data))
        .catch(() => { localStorage.removeItem('token'); delete api.defaults.headers.common['Authorization'] })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (username, password) => {
    const r = await api.post('/auth/login', { username, password })
    localStorage.setItem('token', r.data.token)
    api.defaults.headers.common['Authorization'] = `Bearer ${r.data.token}`
    setUtente({ username: r.data.username, ruolo: r.data.ruolo })
    return r.data
  }

  const logout = () => {
    localStorage.removeItem('token')
    delete api.defaults.headers.common['Authorization']
    setUtente(null)
  }

  return (
    <AuthContext.Provider value={{ utente, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
