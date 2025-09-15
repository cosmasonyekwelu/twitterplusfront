// src/pages/Home.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import RightSidebar from "../components/RightSidebar";
import TweetList from "../components/TweetList";
import TweetComposer from "../components/TweetComposer";

// Turn "/uploads/a.png" → "http://localhost:3000/uploads/a.png"
function toAbs(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, ""); // e.g. http://localhost:3000/api
  const origin = api.replace(/\/api$/i, "");                      // http://localhost:3000
  const p = path?.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}
const mapImages = (imgs) =>
  (Array.isArray(imgs) ? imgs : imgs ? [imgs] : []).map(toAbs);

export default function Home() {
  const navigate = useNavigate();

  const [tweets, setTweets]   = useState([]);
  const [users, setUsers]     = useState([]);
  const [trends, setTrends]   = useState([]);
  const [loading, setLoading] = useState(true);

  // keep track of in-flight requests to cancel on rerender/unmount
  const abortRef = useRef(null);

  const normalizeTweet = (t) => ({
    ...t,
    images: mapImages(t.images),
    user: { ...(t.user || {}), avatar: toAbs(t.user?.avatar) || "/default-avatar.png" },
  });

  const loadAll = async () => {
    setLoading(true);

    // cancel previous if still running
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const [tRes, uRes, trRes] = await Promise.allSettled([
        API.get("/tweets", { signal: controller.signal }),
        API.get("/users/random?limit=3", { signal: controller.signal }),
        API.get("/trends", { signal: controller.signal }),
      ]);

      // Tweets
      if (tRes.status === "fulfilled" && Array.isArray(tRes.value.data)) {
        const list = tRes.value.data.map(normalizeTweet);
        setTweets(list);
      } else {
        setTweets([]);
      }

      // Who to follow
      if (uRes.status === "fulfilled" && Array.isArray(uRes.value.data)) {
        setUsers(
          uRes.value.data.map((u) => ({
            ...u,
            avatar: toAbs(u.avatar) || "/default-avatar.png",
          }))
        );
      } else {
        setUsers([]);
      }

      // Trends
      if (trRes.status === "fulfilled") {
        const raw = trRes.value.data;
        const arr = Array.isArray(raw) ? raw : raw?.trends || [];
        setTrends(arr);
      } else {
        setTrends([]);
      }
    } catch (e) {
      if (e?.name !== "CanceledError" && e?.message !== "canceled") {
        console.error("load feed failed", e);
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
  }, [navigate]);

  // ---------- Counts (Reply/RT/Like/Bookmark) ----------
  const counts = useMemo(() => {
    const replies = {};
    const likes   = {};
    const rts     = {};
    const bms     = {};
    for (const t of tweets) {
      if (t.replyTo) replies[t.replyTo] = (replies[t.replyTo] || 0) + 1;
      likes[t._id] = Array.isArray(t.likes) ? t.likes.length : 0;
      rts[t._id]   = Array.isArray(t.retweets) ? t.retweets.length : 0;
      bms[t._id]   = Array.isArray(t.bookmarks) ? t.bookmarks.length : 0;
    }
    return { replies, likes, rts, bms };
  }, [tweets]);

  // ---------- Composer: create tweet (with single or multiple images) ----------
  const handlePost = async (content, imageFileOrFiles) => {
    const hasText  = typeof content === "string" && content.trim().length > 0;
    const hasFiles = !!imageFileOrFiles && (Array.isArray(imageFileOrFiles) ? imageFileOrFiles.length : 1);
    if (!hasText && !hasFiles) return;

    const fd = new FormData();
    if (hasText) fd.append("content", content.trim());

    // Accept one or many; backend allows any media field name but "images" is standard
    const files = Array.isArray(imageFileOrFiles) ? imageFileOrFiles : [imageFileOrFiles];
    files.filter(Boolean).forEach((f) => fd.append("images", f));

    try {
      await API.post("/tweets", fd); // don't set Content-Type; Axios will set multipart boundary
      await loadAll();
    } catch (e) {
      console.error("post failed", e);
      alert(e?.response?.data?.message || "Failed to post");
    }
  };

  // ---------- Tweet actions (refetch only counts we need) ----------
  const handleReply = (tweetId) => navigate(`/compose?replyTo=${tweetId}`);

  const handleRetweet = async (tweetId) => {
    try { await API.post(`/tweets/retweet/${tweetId}`); }
    catch (e) { console.error("retweet failed", e); }
    finally { await loadAll(); }
  };

  const handleLike = async (tweetId) => {
    try { await API.post(`/tweets/like/${tweetId}`); }
    catch (e) { console.error("like failed", e); }
    finally { await loadAll(); }
  };

  const handleBookmark = async (tweetId) => {
    try { await API.post(`/tweets/bookmark/${tweetId}`); }
    catch (e) { console.error("bookmark failed", e); }
    // Bookmarks don't change the Home list; no refetch needed unless you display counts aggressively.
  };

  const handleShare = (tweetId) => {
    const url = `${window.location.origin}/tweet/${tweetId}`;
    navigator.clipboard.writeText(url);
    alert("Tweet URL copied to clipboard!");
  };

  // ----- Hooks from TweetList for Edit/Delete -----
  const handleUpdated = async (updated) => {
    // If backend returns the updated tweet, we can patch locally for snappier UX
    if (updated && updated._id) {
      setTweets((prev) =>
        prev.map((t) => (t._id === updated._id ? normalizeTweet(updated) : t))
      );
    } else {
      await loadAll();
    }
  };

  const handleDeleted = async (tweetId) => {
    setTweets((prev) => prev.filter((t) => t._id !== tweetId));
    // Optional: await loadAll(); // if you prefer server-source-of-truth after delete
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 border-x border-gray-800 max-w-2xl">
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-sm p-4 border-b border-gray-800">
          <h1 className="font-bold text-xl">Home</h1>
        </div>

        <div className="border-b border-gray-800">
          <TweetComposer onPost={handlePost} />
        </div>

        {loading ? (
          <div className="p-6 text-gray-400">Loading…</div>
        ) : (
          <TweetList
            tweets={tweets}
            counts={counts}
            onRetweet={handleRetweet}
            onReply={handleReply}
            onLike={handleLike}
            onShare={handleShare}
            onBookmark={handleBookmark}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        )}
      </main>

      <RightSidebar users={users} trends={trends} />
    </div>
  );
}
