// src/pages/Explore.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import RightSidebar from "../components/RightSidebar";
import TweetList from "../components/TweetList";

// ---------- utils ----------
const toAbs = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, ""); // http://localhost:3000/api
  const origin = api.replace(/\/api$/i, "");                      // http://localhost:3000
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
};
const mapImages = (imgs) => (Array.isArray(imgs) ? imgs : imgs ? [imgs] : []).map(toAbs);

// ---------- page ----------
export default function Explore() {
  const [sp, setSp] = useSearchParams();
  const initialQ = (sp.get("q") || "").trim();

  const navigate = useNavigate();

  // input & results
  const [query, setQuery] = useState(initialQ);
  const [tweets, setTweets] = useState([]);
  const [people, setPeople] = useState([]);
  const [trends, setTrends] = useState([]);

  // loading & error
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // tabs: Top | Latest | People
  const [tab, setTab] = useState("Top");

  // abort + debounce
  const abortRef = useRef(null);
  const debounceRef = useRef(null);

  // kick unauth users to signin (like Home.jsx)
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/signin");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep URL in sync when query changes through input
  useEffect(() => {
    const q = query.trim();
    const cur = sp.get("q") || "";
    if (q !== cur) {
      const next = new URLSearchParams(sp);
      if (q) next.set("q", q);
      else next.delete("q");
      setSp(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // fetch trends once (used when query is empty and also for RightSidebar)
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const r = await API.get("/trends");
        const arr = Array.isArray(r.data) ? r.data : r.data?.trends || [];
        if (!dead) setTrends(arr);
      } catch {
        if (!dead) setTrends([
          { name: "#React", tweets: "120K" },
          { name: "#JavaScript", tweets: "85K" },
          { name: "Tailwind", tweets: "22K" },
        ]);
      }
    })();
    return () => { dead = true; };
  }, []);

  // core search (debounced + abortable)
  const runSearch = (q) => {
    // cancel in-flight
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setErr("");
    setTweets([]);
    setPeople([]);

    (async () => {
      try {
        // Try common shapes:
        //   1) GET /api/search?q=... (preferred)
        //   2) GET /api/search?query=...
        // Your backend already mounts searchRouter at /api/search.
        const try1 = API.get(`/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        const try2 = API.get(`/search?query=${encodeURIComponent(q)}`, { signal: controller.signal });

        let data;
        try {
          const r1 = await try1;
          data = r1.data;
        } catch {
          const r2 = await try2;
          data = r2.data;
        }

        // Normalize results:
        // Supported shapes:
        //   A) { tweets: [...], users: [...] }
        //   B) { results: [...mixed...] }
        //   C) [...mixed...]
        // We’ll split into people vs tweets by presence of typical fields.
        let foundTweets = [];
        let foundUsers = [];

        if (Array.isArray(data)) {
          [foundUsers, foundTweets] = splitMixed(data);
        } else if (data && typeof data === "object") {
          if (Array.isArray(data.tweets) || Array.isArray(data.users)) {
            foundTweets = data.tweets || [];
            foundUsers  = data.users || [];
          } else if (Array.isArray(data.results)) {
            [foundUsers, foundTweets] = splitMixed(data.results);
          }
        }

        // map media to abs URLs
        const tweetsMapped = (foundTweets || []).map((t) => ({
          ...t,
          images: mapImages(t.images),
          user: { ...(t.user || {}), avatar: toAbs(t.user?.avatar) || "/default-avatar.png" },
        }));

        const usersMapped = (foundUsers || []).map((u) => ({
          ...u,
          avatar: toAbs(u.avatar) || "/default-avatar.png",
          coverPhoto: u.coverPhoto ? toAbs(u.coverPhoto) : "",
        }));

        setTweets(tweetsMapped);
        setPeople(usersMapped);
      } catch (e) {
        if (e?.name !== "CanceledError" && e?.message !== "canceled") {
          console.error("search failed", e);
          setErr(e?.response?.data?.message || "Search failed");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
  };

  // split helper (users vs tweets)
  function splitMixed(list) {
    const users = [];
    const tweets = [];
    for (const item of list) {
      if (looksLikeUser(item)) users.push(item);
      else tweets.push(item);
    }
    return [users, tweets];
  }
  function looksLikeUser(x) {
    // heuristic: users have username, may have followers/following; tweets have content/images/replyTo
    if (!x || typeof x !== "object") return false;
    if (x.content) return false;
    if (x.username) return true;
    // if it has followers/following arrays and no content, consider user
    if ((Array.isArray(x.followers) || Array.isArray(x.following)) && !x.content) return true;
    return false;
  }

  // run when URL ?q changes directly (back/forward navigation)
  useEffect(() => {
    const q = (sp.get("q") || "").trim();
    setQuery(q); // reflect in input
    if (!q) {
      // no query → show just trends; clear results
      setTweets([]);
      setPeople([]);
      setErr("");
      setLoading(false);
      abortRef.current?.abort();
      return;
    }
    // debounce
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 400);
    return () => clearTimeout(debounceRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  // counts for TweetList (client-side quick calc)
  const counts = useMemo(() => {
    const replies = {}, likes = {}, rts = {};
    for (const t of tweets) {
      if (t.replyTo) replies[t.replyTo] = (replies[t.replyTo] || 0) + 1;
      likes[t._id] = Array.isArray(t.likes) ? t.likes.length : 0;
      rts[t._id]   = Array.isArray(t.retweets) ? t.retweets.length : 0;
    }
    return { replies, likes, rts, bms: {} };
  }, [tweets]);

  // tweet actions
  const like = async (id) => { try { await API.post(`/tweets/like/${id}`);} catch {} runSearch(query); };
  const rt   = async (id) => { try { await API.post(`/tweets/retweet/${id}`);} catch {} runSearch(query); };
  const bm   = async (id) => { try { await API.post(`/tweets/bookmark/${id}`);} catch {} };
  const replyGo = (id) => { window.location.assign(`/compose?replyTo=${id}`); };
  const share = (id) => { navigator.clipboard.writeText(`${window.location.origin}/tweet/${id}`); alert("Link copied!"); };

  const hasQuery = !!query.trim();

  return (
    <div className="flex min-h-screen bg-black text-white">
      {/* Left sidebar */}
      <Sidebar />

      {/* Center */}
      <main className="flex-1 border-x border-gray-800 max-w-2xl">
        {/* Header + search input */}
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur-sm border-b border-gray-800">
          <div className="p-4">
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="w-full bg-neutral-900 text-white rounded-full px-4 py-2 border border-gray-800 focus:outline-none focus:border-gray-600"
              />
              {/* clear button */}
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex">
            {["Top", "Latest", "People"].map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-medium border-b-4 ${
                  tab === t ? "border-blue-500" : "border-transparent hover:bg-neutral-900"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {!hasQuery && (
          <section className="p-4">
            <h2 className="font-bold text-xl mb-3">Trends for you</h2>
            <ul className="space-y-3">
              {(trends?.length ? trends : [
                { name: "#React", tweets: "120K" },
                { name: "#JavaScript", tweets: "85K" },
                { name: "Tailwind", tweets: "22K" },
              ]).map((t, i) => (
                <li key={`${t.name}-${i}`} className="hover:bg-neutral-900 rounded-xl p-3 border border-gray-800">
                  <div className="text-sm text-gray-400">Trending</div>
                  <div className="font-semibold">{t.name}</div>
                  {t.tweets && <div className="text-sm text-gray-500">{t.tweets} posts</div>}
                </li>
              ))}
            </ul>
            <div className="text-gray-500 text-sm mt-6">
              Type something in the search box to discover posts and people.
            </div>
          </section>
        )}

        {hasQuery && err && <div className="p-6 text-red-400">{err}</div>}

        {hasQuery && loading && (
          <div className="p-6 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-4 bg-neutral-800 rounded w-1/3 mb-2" />
                <div className="h-3 bg-neutral-800 rounded w-2/3 mb-1" />
                <div className="h-3 bg-neutral-800 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}

        {hasQuery && !loading && !err && (
          <>
            {/* People tab */}
            {tab === "People" && (
              <section className="p-4">
                {people.length === 0 && <div className="text-gray-400">No people found.</div>}
                <ul className="space-y-4">
                  {people.map((u) => {
                    const id = u._id || u.id;
                    return (
                      <li key={id || u.username} className="flex items-center justify-between gap-3 border-b border-gray-800 pb-4">
                        <div className="flex items-center gap-3">
                          <a href={id ? `/user/${id}` : "#"} className="flex items-center gap-3">
                            <img
                              src={u.avatar || "/default-avatar.png"}
                              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/default-avatar.png"; }}
                              className="w-12 h-12 rounded-full"
                              alt=""
                            />
                            <div>
                              <div className="font-bold leading-tight">{u.name || u.username || "User"}</div>
                              <div className="text-sm text-gray-500">@{u.username || "user"}</div>
                              {!!u.bio && <div className="text-sm text-gray-400 line-clamp-2">{u.bio}</div>}
                            </div>
                          </a>
                        </div>
                        {id && (
                          <a
                            href={`/user/${id}`}
                            className="px-3 py-1.5 rounded-full text-sm font-bold bg-white text-black hover:bg-gray-200"
                          >
                            View
                          </a>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {/* Top / Latest tabs show tweets (Latest just sorts by date desc if not already) */}
            {(tab === "Top" || tab === "Latest") && (
              <TweetList
                tweets={
                  tab === "Latest"
                    ? [...tweets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    : tweets
                }
                counts={counts}
                onLike={like}
                onRetweet={rt}
                onBookmark={bm}
                onReply={replyGo}
                onShare={share}
              />
            )}
          </>
        )}
      </main>

      {/* Right rail */}
      <RightSidebar trends={trends} />
    </div>
  );
}
