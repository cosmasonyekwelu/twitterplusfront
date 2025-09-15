import API from './api'
export const getRandomUsers = async (limit = 3) => {
  const { data } = await API.get(`/users/random?limit=${limit}`)
  return Array.isArray(data) ? data : (data?.items || [])
}
export const getProfile = async () => {
  const { data } = await API.get('/profile')
  return data
}
