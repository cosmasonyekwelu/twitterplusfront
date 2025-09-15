import API from './api'

export const getNotifications = async () => {
  const r = await API.get('/notifications')
  return Array.isArray(r.data?.items) ? r.data.items : (Array.isArray(r.data) ? r.data : [])
}
export const markNotificationRead = async (id) => API.patch(`/notifications/${id}/read`)
export const markAllNotificationsRead = async () => API.patch(`/notifications/mark-all-read`)
export const clearNotifications = async () => API.delete(`/notifications/clear`)
