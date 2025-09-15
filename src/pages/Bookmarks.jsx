// src/pages/Bookmarks.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import RightSidebar from "../components/RightSidebar";
import TweetList from "../components/TweetList";

// Turn "/uploads/a.png" → "http://localhost:3000/uploads/a.png"
const toAbs = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = api.replace(/\/api$/i, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
};
const mapImages = (imgs) => (Array.isArray(imgs) ? imgs : imgs ? [imgs] : []).map(toAbs);

export default function Bookmarks() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [tweets, setTweets] = useState([]);

  const [usersRight, setUsersRight] = useState([]);
  const [trends, setTrends] = useState([]);

  const abortRef = useRef(null);

  const normalizeTweets = (raw) => {
    // The backend might return:
    // 1) an array of Tweet documents
    // 2) an array of Bookmark docs with a populated `tweet` field
    // 3) { bookmarks: [...] } with either (1) or (2)
    const arr = Array.isArray(raw) ? raw : (raw?.bookmarks || raw?.tweets || []);
    const maybeTweets = arr.map((x) => (x.tweet ? x.tweet : x));
    return maybeTweets
      .filter(Boolean)
      .map((t) => ({
        ...t,
        images: mapImages(t.images),
        user: { ...(t.user || {}), avatar: toAbs(t.user?.avatar) || "/default-avatar.png" },
      }));
  };

  const loadAll = async () => {
    setLoading(true); setErr("");

    // cancel previous
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const [bRes, uRes, trRes] = await Promise.allSettled([
        API.get("/bookmarks", { signal: controller.signal }),
        API.get("/users/random?limit=3", { signal: controller.signal }),
        API.get("/trends", { signal: controller.signal }),
      ]);

      if (bRes.status === "fulfilled") {
        setTweets(normalizeTweets(bRes.value.data));
      } else {
        setTweets([]);
      }

      if (uRes.status === "fulfilled" && Array.isArray(uRes.value.data)) {
        setUsersRight(uRes.value.data.map((u) => ({ ...u, avatar: toAbs(u.avatar) || "/default-avatar.png" })));
      } else setUsersRight([]);

      if (trRes.status === "fulfilled") {
        const raw = trRes.value.data;
        const arr = Array.isArray(raw) ? raw : raw?.trends || [];
        setTrends(arr);
      } else setTrends([]);
    } catch (e) {
      if (e?.name !== "CanceledError" && e?.message !== "canceled") {
        console.error("bookmarks load failed", e);
        setErr(e?.response?.data?.message || "Failed to load bookmarks");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/signin");
      return;
    }
    loadAll();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // counts for TweetList
  const counts = useMemo(() => {
    const replies = {}, likes = {}, rts = {}, bms = {};
    for (const t of tweets) {
      if (t.replyTo) replies[t.replyTo] = (replies[t.replyTo] || 0) + 1;
      likes[t._id] = Array.isArray(t.likes) ? t.likes.length : 0;
      rts[t._id]   = Array.isArray(t.retweets) ? t.retweets.length : 0;
      bms[t._id]   = Array.isArray(t.bookmarks) ? t.bookmarks.length : 0;
    }
    return { replies, likes, rts, bms };
  }, [tweets]);

  // actions
  const reload = async () => loadAll();

  const handleReply = (tweetId) => navigate(`/compose?replyTo=${tweetId}`);
  const handleRetweet = async (tweetId) => { try { await API.post(`/tweets/retweet/${tweetId}`);} catch {} reload(); };
  const handleLike    = async (tweetId) => { try { await API.post(`/tweets/like/${tweetId}`);}    catch {} reload(); };
  const handleBookmark= async (tweetId) => { try { await API.post(`/tweets/bookmark/${tweetId}`);} catch {} reload(); };
  const handleShare   = (tweetId) => {
    navigator.clipboard.writeText(`${window.location.origin}/tweet/${tweetId}`);
    alert("Tweet URL copied to clipboard!");
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />
      <main className="flex-1 border-x border-gray-800 max-w-2xl">
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur p-4 border-b border-gray-800">
          <h1 className="font-bold text-xl">Bookmarks</h1>
        </div>

        {loading && <div className="p-6 text-gray-400">Loading…</div>}
        {err && <div className="p-6 text-red-400">{err}</div>}
        {!loading && !err && tweets.length === 0 && (
          <div className="p-6 text-gray-500">No bookmarks yet.</div>
        )}

        {!loading && !err && tweets.length > 0 && (
          <TweetList
            tweets={tweets}
            counts={counts}
            onRetweet={handleRetweet}
            onReply={handleReply}
            onLike={handleLike}
            onShare={handleShare}
            onBookmark={handleBookmark}
          />
        )}
      </main>

      <RightSidebar users={usersRight} trends={trends} />
    </div>
  );
}
