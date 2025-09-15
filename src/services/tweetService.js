// src/services/tweetService.js
import API from "./api";

/**
 * GET timeline (array of tweets)
 */
export const getTweets = async (params = {}) => {
  const { data } = await API.get("/tweets", { params });
  // backend returns an array directly
  return Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
};

/**
 * GET one tweet by id
 */
export const getTweetById = async (id) => {
  const { data } = await API.get(`/tweets/${id}`);
  return data;
};

/**
 * GET tweets for a user (by userId). Supports pagination via ?page=&limit=
 */
export const getUserTweets = async (userId, params = {}) => {
  const { data } = await API.get(`/tweets/user/${userId}`, { params });
  return Array.isArray(data) ? data : [];
};

/**
 * Create a tweet (supports multiple images).
 * @param {string} content
 * @param {File[]|FileList} files up to 4 images
 */
export const postTweet = async (content = "", files = []) => {
  const fd = new FormData();
  if (content?.trim()) fd.append("content", content.trim());

  const arr = Array.from(files || []).slice(0, 4);
  arr.forEach((f) => fd.append("images", f)); // field name "images" matches backend

  // DO NOT manually set Content-Type; axios will add proper multipart boundary
  const { data } = await API.post("/tweets", fd);
  return data;
};

/**
 * Reply to a tweet (supports images too).
 */
export const replyTweet = async (parentId, content = "", files = []) => {
  const fd = new FormData();
  if (content?.trim()) fd.append("content", content.trim());
  const arr = Array.from(files || []).slice(0, 4);
  arr.forEach((f) => fd.append("images", f));

  const { data } = await API.post(`/tweets/reply/${parentId}`, fd);
  return data;
};

/**
 * Edit tweet:
 * - To fully replace images, pass options.replaceImages = true and optionally options.keepImages = [url, ...]
 * - To remove some images without replacing, pass options.removeImages = [url, ...]
 * - You can also pass new files to append (or replace if replaceImages=true)
 */
export const editTweet = async (
  id,
  { content, files = [], replaceImages = false, keepImages = [], removeImages = [] } = {}
) => {
  const fd = new FormData();

  if (content !== undefined) fd.append("content", content);

  const fileArr = Array.from(files || []).slice(0, 4);
  fileArr.forEach((f) => fd.append("images", f));

  if (replaceImages) fd.append("replaceImages", "true");
  if (Array.isArray(keepImages) && keepImages.length)
    fd.append("keepImages", JSON.stringify(keepImages));
  if (Array.isArray(removeImages) && removeImages.length)
    fd.append("removeImages", JSON.stringify(removeImages));

  const { data } = await API.put(`/tweets/${id}`, fd);
  return data;
};

/**
 * Delete tweet
 */
export const deleteTweet = async (id) => {
  const { data } = await API.delete(`/tweets/${id}`);
  return data;
};

/**
 * Like / Unlike (backend: POST /tweets/like/:id)
 */
export const likeTweet = async (id) => {
  const { data } = await API.post(`/tweets/like/${id}`);
  return data;
};

/**
 * Retweet / Unretweet (backend: POST /tweets/retweet/:id)
 */
export const retweet = async (id) => {
  const { data } = await API.post(`/tweets/retweet/${id}`);
  return data;
};

/**
 * Bookmark / Unbookmark (backend: POST /tweets/bookmark/:id)
 */
export const toggleBookmark = async (id) => {
  const { data } = await API.post(`/tweets/bookmark/${id}`);
  return data;
};
