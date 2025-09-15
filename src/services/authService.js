import API from './api'

export const login = async ({ identifier, password }) => {
  const { data } = await API.post('/auth/login', { identifier, password })
  return data
}

// Support both "register" and "signup" naming
export const register = async (payload) => {
  const { data } = await API.post('/auth/register', payload)
  return data
}
export const signup = async (payload) => {
  // If your backend uses /auth/signup instead, change below:
  try {
    const { data } = await API.post('/auth/signup', payload)
    return data
  } catch {
    const { data } = await API.post('/auth/register', payload)
    return data
  }
}

export const me = async () => {
  const { data } = await API.get('/auth/me')
  return data
}

// Social login placeholders — replace routes with your actual OAuth endpoints
export const loginWithGoogle = async () => {
  const { data } = await API.post('/auth/google')
  return data
}
export const loginWithApple = async () => {
  const { data } = await API.post('/auth/apple')
  return data
}

export function logout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
}
