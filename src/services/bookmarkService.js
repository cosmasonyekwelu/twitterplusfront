import API from './api'
export const toggleBookmark = async (tweetId) => API.post(`/bookmarks/toggle/${tweetId}`)
export const getBookmarks = async () => {
  const { data } = await API.get('/bookmarks')
  return Array.isArray(data) ? data : (data?.items || [])
}
