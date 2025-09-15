import { createContext, useContext, useEffect, useState } from 'react'
import { me } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const s = localStorage.getItem('user'); return s ? JSON.parse(s) : null
  })
  const [token, setToken] = useState(() => localStorage.getItem('token'))
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (token && !user) {
      me().then(u => {
        setUser(u); localStorage.setItem('user', JSON.stringify(u))
      }).catch(() => {
        setUser(null)
      })
    }
  }, [token])

  const setAuth = ({ token, user }) => {
    if (token) { localStorage.setItem('token', token); setToken(token) }
    if (user) { localStorage.setItem('user', JSON.stringify(user)); setUser(user) }
  }

  const signOut = () => {
    localStorage.removeItem('token'); localStorage.removeItem('user')
    setToken(null); setUser(null)
  }

  return <AuthContext.Provider value={{ user, token, setAuth, signOut, loading, setLoading }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
