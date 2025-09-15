// src/services/search.js
import API from "./api";

/** Build querystring safely */
const qs = (q) => `q=${encodeURIComponent((q || "").trim())}`;

/** Core: call your existing /search and normalize the shape. */
async function fetchSearch(q, { signal } = {}) {
  const query = (q || "").trim();
  if (!query) return { users: [], tweets: [], hashtags: [] };

  try {
    const res = await API.get(`/search?${qs(query)}`, { signal });
    const data = res?.data || {};
    return {
      users: Array.isArray(data.users) ? data.users : [],
      tweets: Array.isArray(data.tweets) ? data.tweets : [],
      hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
    };
  } catch (err) {
    // Your backend returns 404 when there are no matches – treat as empty.
    if (err?.response?.status === 404) {
      return { users: [], tweets: [], hashtags: [] };
    }
    throw err;
  }
}

/** Public API: full search (users + tweets + hashtags) */
export async function searchAll(q, opts = {}) {
  return fetchSearch(q, opts);
}

/** Users typeahead (built from /search only) */
export async function suggestUsers(q, { limit = 8, signal } = {}) {
  const { users } = await fetchSearch(q, { signal });
  return users.slice(0, limit);
}

/** Hashtags typeahead (built from /search only) */
export async function suggestHashtags(q, { limit = 8, signal } = {}) {
  const { hashtags } = await fetchSearch(q, { signal });
  // Normalize: ensure leading '#'
  const normalized = hashtags.map((h) =>
    typeof h === "string"
      ? { tag: h.startsWith("#") ? h : `#${h}`, count: undefined }
      : {
          tag: (h.tag || h._id || "").toString().replace(/^#?/, "#"),
          count: h.count,
        }
  );
  return normalized.slice(0, limit);
}
