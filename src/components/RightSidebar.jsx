// src/components/RightSidebar.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaSearch, FaHashtag } from "react-icons/fa";
import API from "../services/api";
import { suggestUsers, suggestHashtags } from "../services/search";

const toAbs = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, ""); // e.g. http://localhost:3000/api
  const origin = api.replace(/\/api$/i, ""); // e.g. http://localhost:3000
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
};

// Small debounce hook
function useDebouncedValue(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export default function RightSidebar({
  users: usersProp = [],
  trends: trendsProp = [],
}) {
  const navigate = useNavigate();

  // ---------- Search box + typeahead ----------
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 300);
  const [openSuggest, setOpenSuggest] = useState(false);
  const [userSugs, setUserSugs] = useState([]);
  const [tagSugs, setTagSugs] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0); // keyboard selection across combined list
  const suggestAbort = useRef(null);

  // Combined suggestions for keyboard nav (users first, then tags)
  const combined = useMemo(() => {
    const users = (userSugs || []).map((u) => ({ type: "user", value: u }));
    const tags = (tagSugs || []).map((t) => ({ type: "tag", value: t }));
    return [...users, ...tags];
  }, [userSugs, tagSugs]);

  useEffect(() => {
    const q = debounced.trim();
    // Close dropdown if short query
    if (!q || q.length < 2) {
      setOpenSuggest(false);
      setUserSugs([]);
      setTagSugs([]);
      return;
    }

    suggestAbort.current?.abort?.();
    const controller = new AbortController();
    suggestAbort.current = controller;

    (async () => {
      try {
        const [users, tags] = await Promise.all([
          suggestUsers(q, { signal: controller.signal, limit: 6 }),
          suggestHashtags(q, { signal: controller.signal, limit: 6 }),
        ]);
        setUserSugs(
          (users || []).map((u) => ({
            ...u,
            avatar: toAbs(u.avatar) || "/default-avatar.svg",
          }))
        );
        setTagSugs(
          (tags || []).map((t) => ({
            tag: t.tag?.startsWith("#") ? t.tag : `#${t.tag}`,
            count: t.count,
          }))
        );
        setActiveIdx(0);
        setOpenSuggest(true);
      } catch {
        // swallow cancels / errors for typeahead
        setOpenSuggest(false);
        setUserSugs([]);
        setTagSugs([]);
      }
    })();

    return () => controller.abort();
  }, [debounced]);

  const onKeyDown = (e) => {
    if (!openSuggest || combined.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % combined.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + combined.length) % combined.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = combined[activeIdx];
      if (!item) return;
      if (item.type === "user") {
        const id = item.value?._id || item.value?.id;
        if (id) navigate(`/user/${id}`);
        setOpenSuggest(false);
      } else if (item.type === "tag") {
        navigate(`/explore?q=${encodeURIComponent(item.value.tag)}`);
        setOpenSuggest(false);
      }
    } else if (e.key === "Escape") {
      setOpenSuggest(false);
    }
  };

  const submitSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/explore?q=${encodeURIComponent(q)}`);
    setOpenSuggest(false);
  };

  // ---------- Who to follow ----------
  const [busyMap, setBusyMap] = useState({});
  const [followed, setFollowed] = useState({});
  const [usersLocal, setUsersLocal] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const usersFetchedRef = useRef(false);
  const usersAbort = useRef(null);

  useEffect(() => {
    if (usersProp?.length) {
      setUsersLocal(
        usersProp.map((u) => ({
          ...u,
          avatar: toAbs(u.avatar) || "/default-avatar.svg",
        }))
      );
      usersFetchedRef.current = true;
      return;
    }
    if (usersFetchedRef.current) return;

    usersFetchedRef.current = true;
    usersAbort.current?.abort();
    usersAbort.current = new AbortController();

    (async () => {
      try {
        setLoadingUsers(true);
        const res = await API.get("/users/random?limit=3", {
          signal: usersAbort.current.signal,
        });
        const list = Array.isArray(res.data) ? res.data : [];
        setUsersLocal(
          list
            .filter(Boolean)
            .map((u) => ({
              ...u,
              avatar: toAbs(u.avatar) || "/default-avatar.svg",
            }))
        );
      } catch {
        setUsersLocal([]);
      } finally {
        setLoadingUsers(false);
      }
    })();

    return () => usersAbort.current?.abort();
  }, [usersProp]);

  // ---------- Trends ----------
  const [trendsLocal, setTrendsLocal] = useState([]);
  const [loadingTrends, setLoadingTrends] = useState(false);
  const trendsFetchedRef = useRef(false);
  const trendsAbort = useRef(null);

  useEffect(() => {
    if (trendsProp?.length) {
      setTrendsLocal(trendsProp);
      trendsFetchedRef.current = true;
      return;
    }
    if (trendsFetchedRef.current) return;

    trendsFetchedRef.current = true;
    trendsAbort.current?.abort();
    trendsAbort.current = new AbortController();

    (async () => {
      try {
        setLoadingTrends(true);
        const res = await API.get("/trends", {
          signal: trendsAbort.current.signal,
        });
        const arr = Array.isArray(res.data) ? res.data : res.data?.trends || [];
        setTrendsLocal(arr);
      } catch {
        setTrendsLocal([]);
      } finally {
        setLoadingTrends(false);
      }
    })();

    return () => trendsAbort.current?.abort();
  }, [trendsProp]);

  // ---------- Derived UI data ----------
  const users = useMemo(() => usersLocal || [], [usersLocal]);

  const trends = useMemo(() => {
    if (trendsLocal?.length) return trendsLocal;
    return [
      { name: "#React", tweets: "120K" },
      { name: "#JavaScript", tweets: "85K" },
      { name: "Tailwind", tweets: "22K" },
    ];
  }, [trendsLocal]);

  // ---------- Actions ----------
  const toggleFollow = async (userId) => {
    if (!userId) return;
    setBusyMap((m) => ({ ...m, [userId]: true }));
    setFollowed((f) => ({ ...f, [userId]: !f[userId] }));

    try {
      const res = await API.post(`/users/${userId}/follow`);
      const isNowFollowing = !!res?.data?.following;
      setFollowed((f) => ({ ...f, [userId]: isNowFollowing }));
    } catch (e) {
      console.error("follow failed", e);
      setFollowed((f) => ({ ...f, [userId]: !f[userId] }));
      alert(e?.response?.data?.message || "Follow failed");
    } finally {
      setBusyMap((m) => ({ ...m, [userId]: false }));
    }
  };

  return (
    <aside
      className="hidden md:block w-full md:w-[350px] px-4 py-3 sticky top-0 max-h-screen overflow-y-auto"
      role="complementary"
      aria-label="Right sidebar"
    >
      {/* Search + Typeahead */}
      <form onSubmit={submitSearch} className="mb-4 relative">
        <div className="relative">
          <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenSuggest(true);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search"
            className="w-full bg-neutral-900 text-white rounded-full pl-10 pr-4 py-2 border border-gray-800 focus:outline-none focus:border-gray-600"
          />
        </div>

        {/* Suggestion dropdown */}
        {openSuggest && (userSugs.length > 0 || tagSugs.length > 0) && (
          <div className="absolute z-20 mt-2 w-full bg-black border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
            {/* Users */}
            {userSugs.length > 0 && (
              <div className="p-2">
                <div className="px-2 pb-1 text-sm text-gray-500">Users</div>
                {userSugs.map((u, idx) => {
                  const id = u._id || u.id;
                  const name = u.name || u.username || "User";
                  const selected = idx === activeIdx; // first segment of combined
                  return (
                    <button
                      type="button"
                      key={id || name}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => {
                        if (id) navigate(`/user/${id}`);
                        setOpenSuggest(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-neutral-900 ${
                        selected ? "bg-neutral-900" : ""
                      }`}
                    >
                      <img
                        src={u.avatar || "/default-avatar.svg"}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/default-avatar.svg";
                        }}
                        className="w-8 h-8 rounded-full"
                        alt={`${name} avatar`}
                      />
                      <div>
                        <div className="font-semibold leading-tight">{name}</div>
                        <div className="text-sm text-gray-500">@{u.username || "user"}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Hashtags */}
            {tagSugs.length > 0 && (
              <div className="p-2 border-t border-neutral-800">
                <div className="px-2 pb-1 text-sm text-gray-500">Hashtags</div>
                {tagSugs.map((t, i) => {
                  const idx = (userSugs?.length || 0) + i;
                  const selected = idx === activeIdx;
                  return (
                    <button
                      type="button"
                      key={t.tag}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onClick={() => {
                        navigate(`/explore?q=${encodeURIComponent(t.tag)}`);
                        setOpenSuggest(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-neutral-900 ${
                        selected ? "bg-neutral-900" : ""
                      }`}
                    >
                      <FaHashtag className="text-gray-400" />
                      <div className="flex-1">
                        <div className="font-semibold leading-tight">{t.tag}</div>
                        {t.count ? (
                          <div className="text-sm text-gray-500">{t.count} posts</div>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </form>

      {/* Trends */}
      <div className="border border-gray-800 rounded-2xl p-4 mb-4">
        <h3 className="font-bold text-xl mb-3">Trends for you</h3>
        {loadingTrends ? (
          <ul className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <li key={i} className="animate-pulse">
                <div className="h-3 w-24 bg-neutral-800 rounded mb-2" />
                <div className="h-4 w-40 bg-neutral-800 rounded mb-1" />
                <div className="h-3 w-16 bg-neutral-800 rounded" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            {trends.map((t, i) => (
              <li key={`${t.name}-${i}`} className="hover:bg-neutral-900 rounded-xl p-2">
                <div className="text-sm text-gray-400">Trending</div>
                <div className="font-semibold">{t.name}</div>
                {t.tweets && <div className="text-sm text-gray-500">{t.tweets} posts</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Who to follow */}
      <div className="border border-gray-800 rounded-2xl p-4">
        <h3 className="font-bold text-xl mb-3">Who to follow</h3>

        {loadingUsers ? (
          <ul className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <li key={i} className="flex items-center justify-between gap-3 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-neutral-800" />
                  <div>
                    <div className="h-4 w-28 bg-neutral-800 rounded mb-1" />
                    <div className="h-3 w-16 bg-neutral-800 rounded" />
                  </div>
                </div>
                <div className="h-7 w-20 bg-neutral-800 rounded-full" />
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            {users.map((u) => {
              const id = u._id || u.id;
              const name = u.name || u.username || "User";
              const avatar = toAbs(u.avatar) || "/default-avatar.svg";
              const followingNow = !!followed[id];

              return (
                <li key={id || name} className="flex items-center justify-between gap-3">
                  <Link to={id ? `/user/${id}` : "#"} className="flex items-center gap-3">
                    <img
                      src={avatar}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/default-avatar.svg";
                      }}
                      className="w-10 h-10 rounded-full"
                      alt={`${name} avatar`}
                    />
                    <div>
                      <div className="font-semibold leading-tight">{name}</div>
                      <div className="text-sm text-gray-500">@{u.username || "user"}</div>
                    </div>
                  </Link>

                  {id && (
                    <button
                      onClick={() => toggleFollow(id)}
                      disabled={!!busyMap[id]}
                      className={`px-3 py-1.5 rounded-full text-sm font-bold transition ${
                        followingNow ? "bg-gray-200 text-black" : "bg-white text-black"
                      } disabled:opacity-60`}
                    >
                      {busyMap[id] ? "…" : followingNow ? "Following" : "Follow"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {/* Footer links */}
        <div className="mt-6 pt-4 border-t border-gray-800 text-xs text-gray-500">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <a href="#" className="hover:underline">Terms of Service</a>
            <span>|</span>
            <a href="#" className="hover:underline">Privacy Policy</a>
            <span>|</span>
            <a href="#" className="hover:underline">Cookie Policy</a>
            <span>|</span>
            <a href="#" className="hover:underline">Accessibility</a>
            <span>|</span>
            <a href="#" className="hover:underline">Ads info</a>
          </div>
          <div className="mt-2">© 2025 Twitter Plus.</div>
        </div>
      </div>
    </aside>
  );
}
