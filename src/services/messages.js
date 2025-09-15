// src/services/messages.js
import API from "./api";

/** Make relative paths absolute using API baseURL’s origin */
export const toAbs = (p) => {
  if (!p) return "/default-avatar.svg";
  if (/^https?:\/\//i.test(p)) return p;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = api.replace(/\/api$/i, "");
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${origin}${path}`;
};

/** Conversations list */
export async function getConversations({ signal, limit = 20, cursor } = {}) {
  const res = await API.get("/messages/conversations", {
    signal,
    params: { limit, cursor },
  });
  const data = res.data || {};
  const rows = Array.isArray(data.conversations) ? data.conversations : [];

  // Normalize to [{ other, lastMessage, unreadCount, lastDate }]
  return {
    items: rows.map((r) => ({
      other: r.other
        ? {
            _id: r.other._id,
            username: r.other.username,
            name: r.other.name || r.other.username,
            avatar: toAbs(r.other.avatar),
          }
        : null,
      lastMessage: r.lastMessage
        ? {
            ...r.lastMessage,
            media: Array.isArray(r.lastMessage.media)
              ? r.lastMessage.media.map((m) => ({ ...m, url: toAbs(m.url) }))
              : [],
            voiceNote: r.lastMessage.voiceNote
              ? { ...r.lastMessage.voiceNote, url: toAbs(r.lastMessage.voiceNote.url) }
              : null,
          }
        : null,
      unreadCount: r.unreadCount || 0,
      lastDate: r.lastMessage?.createdAt,
    })),
    nextCursor: data.nextCursor || null,
  };
}

/** Fetch messages with a specific user (no “thread” concept on backend) */
export async function getMessagesWithUser(userId, { signal, limit = 40, before } = {}) {
  const res = await API.get(`/messages/with/${userId}`, {
    signal,
    params: { limit, before },
  });
  const data = res.data || {};
  const msgs = Array.isArray(data.messages) ? data.messages : [];
  return {
    other: data.other
      ? {
          _id: data.other._id,
          username: data.other.username,
          name: data.other.name || data.other.username,
          avatar: toAbs(data.other.avatar),
        }
      : null,
    messages: msgs.map((m) => ({
      ...m,
      media: Array.isArray(m.media) ? m.media.map((x) => ({ ...x, url: toAbs(x.url) })) : [],
      voiceNote: m.voiceNote ? { ...m.voiceNote, url: toAbs(m.voiceNote.url) } : null,
    })),
    nextBefore: data.nextBefore || null,
  };
}

/** Send a message: expects { recipient, text?, media?, voiceNote?, replyTo? } */
export async function sendMessage(body) {
  const res = await API.post("/messages", body);
  return res.data;
}

/** Mark messages from :userId → me as read */
export async function markRead(userId) {
  try {
    const res = await API.post(`/messages/read/${userId}`);
    return res.data;
  } catch {
    return { ok: false };
  }
}

/** Lightweight search (your server already handles these paths elsewhere) */
export async function searchUsers(q, signal) {
  if (!q) return [];
  const tryGet = async (url) => {
    try {
      const r = await API.get(url, { signal });
      return r.data;
    } catch (e) {
      if (e?.response?.status === 404) return null;
      throw e;
    }
  };
  let data =
    (await tryGet(`/search?q=${encodeURIComponent(q)}`)) ??
    (await tryGet(`/users/search?q=${encodeURIComponent(q)}`)) ??
    (await tryGet(`/users/find?q=${encodeURIComponent(q)}`));
  const hits = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
  return hits.slice(0, 8).map((u) => ({
    _id: u._id || u.id,
    username: u.username,
    name: u.name || u.username,
    avatar: toAbs(u.avatar),
  }));
}
