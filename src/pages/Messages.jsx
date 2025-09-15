// src/pages/Messages.jsx
import { useEffect, useMemo, useState } from "react";
import { FaSearch, FaPaperPlane } from "react-icons/fa";
import { useSearchParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import RightSidebar from "../components/RightSidebar";
import API from "../services/api";

/* ------------------------- helpers ------------------------- */
const DEFAULT_AVATAR = "/default-avatar.svg";

const getId = (v) => (v && typeof v === "object" ? v._id || v.id : v) || "";

// Only for avatars. Keeps frontend assets on the frontend origin,
// but prefixes backend uploads (/uploads/...) with the API origin.
const avatarSrc = (p) => {
  if (!p) return DEFAULT_AVATAR;
  if (/^https?:\/\//i.test(p)) return p; // already absolute
  if (p.startsWith("/uploads")) {
    const base = (API?.defaults?.baseURL || "").replace(/\/+$/, "").replace(/\/api$/i, "");
    return `${base}${p}`;
  }
  return p; // e.g. /default-avatar.svg
};

const linkify = (text = "") =>
  text.split(/(\s+)/).map((chunk, i) => {
    const isUrl = /^https?:\/\/\S+$/i.test(chunk);
    return isUrl ? (
      <a key={i} href={chunk} target="_blank" rel="noreferrer" className="underline hover:opacity-80" style={{ color: "inherit" }}>
        {chunk}
      </a>
    ) : (
      <span key={i} style={{ color: "inherit" }}>{chunk}</span>
    );
  });

// Normalize a user object (only the avatar needs special care)
const normUser = (u) =>
  u
    ? {
        _id: getId(u),
        username: u.username,
        name: u.name || u.username,
        avatar: avatarSrc(u.avatar),
      }
    : null;

const isCancel = (e) =>
  e?.code === "ERR_CANCELED" || e?.name === "CanceledError" || String(e?.message || "").toLowerCase() === "canceled";

const looksLikeMongoId = (s = "") => /^[0-9a-fA-F]{24}$/.test(s);

/* ------------------------- backend helpers ------------------------- */
async function fetchUserById(userId, signal) {
  try {
    const r = await API.get(`/users/${encodeURIComponent(userId)}`, { signal });
    return normUser(r?.data || null);
  } catch {
    return null;
  }
}

// Try common username endpoints used elsewhere in your app
async function fetchUserByUsername(username, signal) {
  const u = (username || "").replace(/^@/, "");
  const tryGet = async (url) => {
    try {
      const r = await API.get(url, { signal });
      return normUser(r?.data || null);
    } catch {
      return null;
    }
  };
  return (
    (await tryGet(`/users/by-username/${encodeURIComponent(u)}`)) ||
    (await tryGet(`/users/handle/${encodeURIComponent(u)}`)) ||
    (await tryGet(`/users/${encodeURIComponent(u)}`)) // some backends allow this
  );
}

async function svcGetConversations(signal) {
  const tryGet = async (url) => {
    try {
      const r = await API.get(url, { signal });
      return r?.data || null;
    } catch (e) {
      if (isCancel(e)) return "__CANCEL__";
      if (e?.response?.status === 404) return []; // 404 -> no conversations
      throw e;
    }
  };

  let payload = await tryGet("/messages/conversations");
  if (payload === "__CANCEL__") return "__CANCEL__";
  if (!payload || (Array.isArray(payload) && payload.length === 0)) {
    const alt = await tryGet("/dm/conversations");
    if (alt === "__CANCEL__") return "__CANCEL__";
    payload = alt || [];
  }

  const arr = Array.isArray(payload?.conversations)
    ? payload.conversations
    : Array.isArray(payload)
    ? payload
    : [];

  return arr.map((row) => {
    const other = normUser(row.other || row._id || {});
    return {
      other,
      lastMessage: row.lastMessage || null,
      lastDate: row.lastMessage?.createdAt || row.lastDate || row.updatedAt || row.createdAt,
      unreadCount: row.unreadCount || 0,
    };
  });
}

async function svcGetThreadWithUser(userId, signal) {
  const r = await API.get(`/messages/with/${encodeURIComponent(userId)}`, { signal });
  const data = r?.data || {};
  const other = normUser(data?.other);
  const messages = Array.isArray(data?.messages) ? data.messages : [];
  const shaped = messages.map((m) => ({
    ...m,
    sender: m.sender ? { ...m.sender, _id: getId(m.sender), avatar: avatarSrc(m.sender?.avatar) } : null,
    recipient: m.recipient ? { ...m.recipient, _id: getId(m.recipient), avatar: avatarSrc(m.recipient?.avatar) } : null,
  }));
  return { other, messages: shaped, nextBefore: data.nextBefore || null };
}

async function svcSendMessage({ recipient, text }) {
  const r = await API.post("/messages", { recipient, text });
  const m = r?.data || {};
  return {
    ...m,
    sender: m.sender ? { ...m.sender, _id: getId(m.sender), avatar: avatarSrc(m.sender?.avatar) } : null,
    recipient: m.recipient ? { ...m.recipient, _id: getId(m.recipient), avatar: avatarSrc(m.recipient?.avatar) } : null,
  };
}

async function svcSearchUsers(q, signal) {
  const tryGet = async (url) => {
    try {
      const r = await API.get(url, { signal });
      return r?.data || null;
    } catch (e) {
      if (isCancel(e)) return "__CANCEL__";
      return null;
    }
  };
  const data =
    (await tryGet(`/search?q=${encodeURIComponent(q)}`)) ||
    (await tryGet(`/users/search?q=${encodeURIComponent(q)}`)) ||
    (await tryGet(`/users/find?q=${encodeURIComponent(q)}`)) ||
    null;

  if (data === "__CANCEL__") return "__CANCEL__";

  const hits = Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [];
  return hits.slice(0, 8).map(normUser);
}

/* ------------------------- component ------------------------- */
export default function Messages() {
  const [searchParams] = useSearchParams();

  // conversations (left)
  const [convos, setConvos] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [convoErr, setConvoErr] = useState("");

  // active chat (right)
  const [activeUser, setActiveUser] = useState(null); // {_id, username, name, avatar}
  const [thread, setThread] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadErr, setThreadErr] = useState("");

  // composer
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // search new user
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState("");

  // my profile from storage (single source of truth for my avatar)
  const meFromStorage = useMemo(() => {
    try {
      const raw = localStorage.getItem("me");
      const me = raw ? JSON.parse(raw) : null;
      return me || null;
    } catch {
      return null;
    }
  }, []);
  const [me, setMe] = useState(meFromStorage ? normUser(meFromStorage) : null);
  const myId = getId(me);

  // refresh my avatar if we know myId
  useEffect(() => {
    if (!myId) return;
    const controller = new AbortController();
    (async () => {
      const fresh = await fetchUserById(myId, controller.signal);
      if (fresh) {
        setMe(fresh);
        localStorage.setItem("me", JSON.stringify(fresh));
      }
    })();
    return () => controller.abort();
  }, [myId]);

  // load conversations (ignore cancels)
  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoadingConvos(true);
      setConvoErr("");
      try {
        const items = await svcGetConversations(controller.signal);
        if (items === "__CANCEL__") return;
        setConvos(items);
      } catch (e) {
        if (isCancel(e)) return;
        setConvoErr(e?.response?.data?.message || e?.message || "Couldn't load conversations");
        setConvos([]);
      } finally {
        setLoadingConvos(false);
      }
    })();
    return () => controller.abort();
  }, []);

  // open a thread; refresh the other user's avatar and infer myId if missing
  const openThread = async (other) => {
    const otherId = getId(other);
    if (!otherId) return;

    setActiveUser(normUser(other));
    setLoadingThread(true);
    setThreadErr("");
    setThread([]);

    const controller = new AbortController();
    try {
      const { other: serverOther, messages } = await svcGetThreadWithUser(otherId, controller.signal);
      setThread(messages || []);

      const freshOther = (await fetchUserById(otherId, controller.signal)) || serverOther || other;
      setActiveUser(normUser(freshOther));

      if (!myId && messages?.length) {
        const f = messages[0];
        const s = getId(f.sender);
        const r = getId(f.recipient);
        const inferred = String(s) === String(getId(freshOther)) ? r : s;
        if (inferred) {
          const freshMe = await fetchUserById(inferred, controller.signal);
          if (freshMe) {
            setMe(freshMe);
            localStorage.setItem("me", JSON.stringify(freshMe));
          } else {
            setMe({ _id: inferred, username: "me", name: "Me", avatar: avatarSrc(null) });
          }
        }
      }
    } catch (e) {
      if (isCancel(e)) return;
      setThreadErr(e?.response?.data?.message || "Couldn't open this conversation");
      setThread([]);
    } finally {
      setLoadingThread(false);
    }
  };

  // AUTO-OPEN when arriving with ?to=<userId or @username>
  useEffect(() => {
    const to = (searchParams.get("to") || "").trim();
    if (!to) return;

    let cancelled = false;
    const controller = new AbortController();

    (async () => {
      const target =
        looksLikeMongoId(to)
          ? await fetchUserById(to, controller.signal)
          : await fetchUserByUsername(to, controller.signal);

      if (cancelled) return;

      if (!target?._id) {
        setConvoErr("User not found for messaging.");
        return;
      }

      await openThread(target);
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [searchParams]); // runs whenever the query string changes

  // send
  const onSend = async () => {
    const otherId = getId(activeUser);
    if (!otherId) return;
    const body = (text || "").trim();
    if (!body) return;

    try {
      setSending(true);

      const optimistic = {
        _id: `tmp-${Date.now()}`,
        text: body,
        createdAt: new Date().toISOString(),
        sender: { _id: myId || "me", username: me?.username, avatar: me?.avatar || DEFAULT_AVATAR },
        recipient: { _id: otherId, username: activeUser?.username, avatar: activeUser?.avatar || DEFAULT_AVATAR },
      };
      setThread((t) => [...t, optimistic]);

      const saved = await svcSendMessage({ recipient: otherId, text: body });
      setThread((t) => t.map((m) => (m._id === optimistic._id ? saved : m)));

      // bump convos
      setConvos((list) => {
        const updated = {
          other: activeUser,
          lastMessage: { text: body, createdAt: new Date().toISOString() },
          lastDate: new Date().toISOString(),
          unreadCount: 0,
        };
        const i = list.findIndex((c) => String(getId(c.other)) === String(otherId));
        if (i >= 0) {
          const copy = [...list];
          copy.splice(i, 1);
          return [updated, ...copy];
        }
        return [updated, ...list];
      });

      setText("");
    } catch (e) {
      alert(e?.response?.data?.message || "Failed to send message");
      setThread((t) => t.filter((m) => !String(m._id).startsWith("tmp-")));
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!sending && text.trim() && activeUser) onSend();
    }
  };

  // search users (ignore cancels)
  useEffect(() => {
    const q = query.trim();
    const controller = new AbortController();
    if (!q) {
      setResults([]);
      setSearchErr("");
      return () => controller.abort();
    }
    (async () => {
      setSearching(true);
      setSearchErr("");
      try {
        const hits = await svcSearchUsers(q, controller.signal);
        if (hits === "__CANCEL__") return;
        setResults(hits);
      } catch (e) {
        if (!isCancel(e)) {
          setSearchErr(e?.response?.data?.message || "Search failed");
          setResults([]);
        }
      } finally {
        setSearching(false);
      }
    })();
    return () => controller.abort();
  }, [query]);

  const orderedThread = useMemo(
    () => [...thread].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [thread]
  );

  const isMine = (m) => {
    const sid = getId(m?.sender);
    const rid = getId(m?.recipient);
    if (myId) return sid && String(sid) === String(myId);
    if (activeUser) return rid && String(rid) === String(getId(activeUser));
    return false;
  };

  const otherAvatar = avatarSrc(activeUser?.avatar) || DEFAULT_AVATAR;
  const myAvatar = avatarSrc(me?.avatar) || DEFAULT_AVATAR;

  const onImageError = (e) => {
    const img = e.currentTarget;
    if (img.dataset.fallback === "1") return;
    img.dataset.fallback = "1";
    img.src = DEFAULT_AVATAR;
  };

  /* ------------------------- UI ------------------------- */
  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 border-x border-neutral-800 max-w-4xl mx-auto w-full">
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur p-4 border-b border-neutral-800">
          <h1 className="text-xl font-bold">Messages</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[360px_1fr]">
          {/* LEFT: conversations + start new */}
          <section className="border-r border-neutral-800 min-h-[calc(100vh-64px)]">
            {/* Start new search */}
            <div className="p-3">
              <div className="relative">
                <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people to message"
                  className="w-full bg-neutral-900 text-white rounded-full pl-10 pr-4 py-2 border border-gray-800 focus:outline-none focus:border-gray-600 caret-white"
                />
              </div>

              {!!query && (
                <div className="mt-3 border border-neutral-800 rounded-xl overflow-hidden">
                  {searching && <div className="p-3 text-sm text-gray-400">Searching…</div>}
                  {searchErr && <div className="p-3 text-sm text-red-400">{searchErr}</div>}
                  {!searching && !searchErr && results.length === 0 && (
                    <div className="p-3 text-sm text-gray-500">No users found</div>
                  )}
                  {results.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => {
                        setQuery("");
                        setResults([]);
                        openThread(u);
                      }}
                      className="w-full text-left p-3 hover:bg-neutral-900 flex items-center gap-3"
                    >
                      <img
                        src={avatarSrc(u.avatar)}
                        onError={onImageError}
                        className="w-10 h-10 rounded-full ring-2 ring-neutral-400"
                        alt=""
                      />
                      <div>
                        <div className="font-semibold leading-tight">{u.name}</div>
                        <div className="text-sm text-gray-500">@{u.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Conversations list */}
            <div className="divide-y divide-neutral-800">
              {loadingConvos && <div className="p-4 text-gray-500">Loading conversations…</div>}
              {convoErr && <div className="p-4 text-red-400">{convoErr}</div>}
              {!loadingConvos && !convoErr && convos.length === 0 && (
                <div className="p-4 text-gray-500">No conversations yet</div>
              )}
              {convos.map((c) => {
                const u = c.other || {};
                const last = c.lastMessage?.text || "";
                const date = c.lastDate ? new Date(c.lastDate) : null;
                return (
                  <button
                    key={u._id}
                    onClick={() => openThread(u)}
                    className={`w-full text-left p-3 hover:bg-neutral-900 flex items-center gap-3 ${
                      activeUser?._id === u._id ? "bg-neutral-900/60" : ""
                    }`}
                  >
                    <img
                      src={avatarSrc(u.avatar)}
                      onError={onImageError}
                      className="w-12 h-12 rounded-full ring-2 ring-neutral-400"
                      alt=""
                    />
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-semibold truncate">{u.name}</div>
                        {date && (
                          <div className="text-xs text-gray-500 shrink-0">
                            {date.toLocaleDateString()}{" "}
                            {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-gray-400 truncate">{last}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* RIGHT: thread */}
          <section className="min-h-[calc(100vh-64px)] flex flex-col">
            {/* header */}
            <div className="p-3 border-b border-neutral-800 flex items-center gap-3">
              {activeUser ? (
                <>
                  <img
                    src={otherAvatar}
                    onError={onImageError}
                    className="w-10 h-10 rounded-full ring-2 ring-neutral-400"
                    alt=""
                  />
                  <div>
                    <div className="font-semibold leading-tight">
                      {activeUser.name || activeUser.username}
                    </div>
                    <div className="text-sm text-gray-500">@{activeUser.username}</div>
                  </div>
                </>
              ) : (
                <div className="text-gray-500">Select a conversation or start a new one</div>
              )}
            </div>

            {/* messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {loadingThread && activeUser && <div className="text-gray-500">Loading messages…</div>}
              {threadErr && <div className="text-red-400">{threadErr}</div>}

              {!loadingThread &&
                !threadErr &&
                orderedThread.map((m, idx) => {
                  const mine = isMine(m);
                  const prev = orderedThread[idx - 1];
                  const prevMine = prev ? isMine(prev) : null;
                  const showAvatar = !prev || prevMine !== mine;

                  const bubbleStyle = mine
                    ? { backgroundColor: "#2563eb", color: "#ffffff" }
                    : { backgroundColor: "#ffffff", color: "#111827", border: "1px solid #e5e7eb" };

                  const timeStyle = mine
                    ? { color: "rgba(255,255,255,0.7)" }
                    : { color: "rgba(17,24,39,0.6)" };

                  return (
                    <div key={m._id} className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                      {!mine && (
                        <img
                          src={otherAvatar}
                          onError={onImageError}
                          className={`${showAvatar ? "opacity-100" : "opacity-0"} w-8 h-8 rounded-full ring-2 ring-gray-300`}
                          alt=""
                        />
                      )}

                      <div className="max-w-[75%] px-4 py-2 rounded-2xl shadow" style={bubbleStyle}>
                        <div className="whitespace-pre-wrap break-words leading-relaxed" style={{ color: "inherit" }}>
                          {linkify(m.text || "")}
                        </div>
                        <div className="mt-1 text-[10px]" style={timeStyle}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>

                      {mine && (
                        <img
                          src={myAvatar}
                          onError={onImageError}
                          className={`${showAvatar ? "opacity-100" : "opacity-0"} w-8 h-8 rounded-full ring-2 ring-blue-500`}
                          alt=""
                        />
                      )}
                    </div>
                  );
                })}
            </div>

            {/* composer */}
            <div className="p-3 border-t border-neutral-800">
              <div className="flex gap-2">
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={!activeUser}
                  placeholder={activeUser ? `Message @${activeUser.username}` : "Select a conversation first"}
                  className="flex-1 bg-neutral-900 text-white rounded-full px-4 py-2 border border-gray-800 focus:outline-none focus:border-gray-600 caret-white"
                />
                <button
                  onClick={onSend}
                  disabled={!activeUser || sending || !text.trim()}
                  className="px-4 py-2 rounded-full bg-white text-black font-bold hover:bg-gray-200 disabled:opacity-60 flex items-center gap-2"
                >
                  <FaPaperPlane />
                  Send
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <RightSidebar />
    </div>
  );
}
