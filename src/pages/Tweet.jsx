// src/pages/Tweet.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import TweetList from "../components/TweetList";

// ----- helpers -----
const toAbs = (p) => {
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = api.replace(/\/api$/i, "");
  const path = p.startsWith("/") ? p : `/${p}`;
  return `${origin}${path}`;
};
const mapImages = (imgs) =>
  (Array.isArray(imgs) ? imgs : imgs ? [imgs] : []).map(toAbs);

export default function Tweet() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [tweets, setTweets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [error, setError] = useState("");

  // ===== current user avatar for the reply box (triple fallback + logs) =====
  const [myAvatar, setMyAvatar] = useState("/default-avatar.svg");

  useEffect(() => {
    let mounted = true;

    const pickFromLocal = () => {
      try {
        const raw = localStorage.getItem("me");
        const me = raw ? JSON.parse(raw) : null;
        const loc = me?.avatar ? toAbs(me.avatar) : "/default-avatar.svg";
        console.log("[Tweet] avatar from localStorage:", loc);
        return loc;
      } catch {
        return "/default-avatar.svg";
      }
    };

    (async () => {
      // 1) try /profile (freshest)
      try {
        const { data } = await API.get("/profile");
        const fromProfile = data?.avatar ? toAbs(data.avatar) : "/default-avatar.svg";
        if (mounted) setMyAvatar(fromProfile);
        console.log("[Tweet] avatar from /profile:", fromProfile);
        return;
      } catch (e) {
        console.warn("[Tweet] /profile avatar fetch failed → fallback. Reason:", e?.response?.status || e?.message);
      }

      // 2) try localStorage 'me'
      const fromLocal = pickFromLocal();
      if (mounted) setMyAvatar(fromLocal);

      // 3) default already set in state
    })();

    return () => { mounted = false; };
  }, []);

  // ===== load tweets =====
  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await API.get("/tweets");
      const list = Array.isArray(res.data) ? res.data : [];

      const normalized = list.map((t) => ({
        ...t,
        images: mapImages(t.images),
        user: {
          ...(t.user || {}),
          avatar: t?.user?.avatar ? toAbs(t.user.avatar) : "/default-avatar.svg",
        },
      }));

      // TEMP: debug what we actually got back
      if (normalized.length) console.log("SAMPLE TWEET", normalized[0]);

      setTweets(normalized);
    } catch {
      setError("Failed to load tweet");
      setTweets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const tweet = useMemo(() => tweets.find((t) => String(t._id) === String(id)), [tweets, id]);
  const replies = useMemo(() => tweets.filter((t) => String(t.replyTo) === String(id)), [tweets, id]);

  // counts for this view
  const counts = useMemo(() => {
    const replyMap = {};
    const likeMap = {};
    const rtMap = {};
    const bmMap = {};
    for (const t of tweets) {
      if (t.replyTo) replyMap[t.replyTo] = (replyMap[t.replyTo] || 0) + 1;
      likeMap[t._id] = Array.isArray(t.likes) ? t.likes.length : 0;
      rtMap[t._id]   = Array.isArray(t.retweets) ? t.retweets.length : 0;
      bmMap[t._id]   = Array.isArray(t.bookmarks) ? t.bookmarks.length : 0;
    }
    return { replies: replyMap, likes: likeMap, rts: rtMap, bms: bmMap };
  }, [tweets]);

  // actions
  const sendReply = async () => {
    if (!replyText.trim()) return;
    try {
      await API.post(`/tweets/reply/${id}`, { content: replyText });
      setReplyText("");
      await load();
    } catch {
      alert("Failed to reply");
    }
  };
  const actionRefresh = async () => load();
  const like    = async (tid) => { await API.post(`/tweets/like/${tid}`).catch(()=>{});    await actionRefresh(); };
  const rt      = async (tid) => { await API.post(`/tweets/retweet/${tid}`).catch(()=>{}); await actionRefresh(); };
  const bm      = async (tid) => { await API.post(`/tweets/bookmark/${tid}`).catch(()=>{}); };
  const replyGo = () => {}; // already here

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />
      <main className="flex-1 border-x border-gray-800 max-w-2xl">
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur p-4 border-b border-gray-800 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-gray-800" aria-label="Back">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          </button>
          <h1 className="font-bold">Post</h1>
        </div>

        {loading && <div className="p-6 text-gray-400">Loading…</div>}
        {error && <div className="p-6 text-red-400">{error}</div>}
        {!loading && !tweet && !error && <div className="p-6 text-gray-400">Post not found.</div>}

        {tweet && (
          <>
            <TweetList
              tweets={[tweet]}
              counts={counts}
              onLike={like}
              onRetweet={rt}
              onBookmark={bm}
              onReply={replyGo}
              onShare={(tid) => {
                const url = `${window.location.origin}/tweet/${tid}`;
                navigator.clipboard.writeText(url);
                alert("Link copied!");
              }}
            />

            {/* Reply composer with robust avatar */}
            <div className="border-y border-gray-800 p-4 flex gap-3 items-start">
              <img
                src={myAvatar || "/default-avatar.svg"}
                width={40}
                height={40}
                alt="me"
                className="w-10 h-10 min-w-10 min-h-10 rounded-full object-cover bg-neutral-800"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = "/default-avatar.svg";
                }}
              />
              <div className="flex-1">
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Post your reply"
                  className="w-full bg-black border border-gray-800 rounded-lg p-3"
                />
                <div className="flex justify-end mt-2">
                  <button onClick={sendReply} className="x-btn x-btn-primary">Reply</button>
                </div>
              </div>
            </div>

            <TweetList
              tweets={replies}
              counts={counts}
              onLike={like}
              onRetweet={rt}
              onBookmark={bm}
              onReply={replyGo}
              onShare={(tid) => {
                const url = `${window.location.origin}/tweet/${tid}`;
                navigator.clipboard.writeText(url);
                alert("Link copied!");
              }}
            />
          </>
        )}
      </main>
    </div>
  );
}
