// src/pages/User.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import RightSidebar from "../components/RightSidebar";
import TweetList from "../components/TweetList";
import {
  FaCalendarAlt,
  FaLink,
  FaMapMarkerAlt,
  FaCheckCircle,
  FaArrowLeft,
  FaBirthdayCake,
  FaEnvelope,
} from "react-icons/fa";

// Make relative media paths absolute (e.g. "/uploads/a.png" → "http://localhost:3000/uploads/a.png")
const toAbs = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = api.replace(/\/api$/i, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
};
const mapImages = (imgs) => (Array.isArray(imgs) ? imgs : imgs ? [imgs] : []).map(toAbs);
const looksLikeMongoId = (s = "") => /^[0-9a-fA-F]{24}$/.test(s);

export default function User() {
  const { id: idOrHandleParam } = useParams();
  const navigate = useNavigate();
  const idOrHandle = (idOrHandleParam || "").trim().replace(/^@/, "");

  const [user, setUser] = useState(null);
  const [tweets, setTweets] = useState([]);
  const [usersRight, setUsersRight] = useState([]);
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);     // follow/block busy
  const [dmBusy, setDmBusy] = useState(false); // messaging busy

  // local flags to disambiguate blocking directions
  const [iBlocked, setIBlocked] = useState(false);      // I have blocked them
  const [isBlockedByThem, setIsBlockedByThem] = useState(false); // they have blocked me

  const abortRef = useRef(null);

  const fetchProfileById = (id, signal) => API.get(`/users/${id}`, { signal }).then((r) => r.data);
  const fetchProfileByUsername = (u, signal) =>
    API.get(`/users/by-username/${encodeURIComponent(u)}`, { signal }).then((r) => r.data);

  const loadAll = async () => {
    setLoading(true);
    setErr("");

    // cancel previous
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // 1) profile (id or username)
      let profile;
      if (looksLikeMongoId(idOrHandle)) {
        try {
          profile = await fetchProfileById(idOrHandle, controller.signal);
        } catch {
          profile = await fetchProfileByUsername(idOrHandle, controller.signal);
        }
      } else {
        profile = await fetchProfileByUsername(idOrHandle, controller.signal);
      }

      if (profile?.isOwnProfile) {
        navigate("/profile");
        return;
      }

      const target = {
        ...profile,
        avatar: toAbs(profile.avatar) || "/default-avatar.svg",
        coverPhoto: profile.coverPhoto ? toAbs(profile.coverPhoto) : "/default-cover.svg",
      };
      setUser(target);

      // remember: backend `isBlocked` means THEY have blocked ME
      setIsBlockedByThem(!!profile?.isBlocked);

      // 1b) check if I have blocked them by fetching /profile (my own)
      try {
        const meRes = await API.get("/profile", { signal: controller.signal });
        const me = meRes?.data || {};
        const myBlocked = Array.isArray(me.blockedUsers) ? me.blockedUsers.map(String) : [];
        setIBlocked(myBlocked.includes(String(target._id)));
      } catch {
        // best effort
      }

      // 2) tweets + right-rail in parallel
      const [tRes, uRes, trRes] = await Promise.allSettled([
        target?._id
          ? API.get(`/tweets/user/${target._id}?limit=50`, { signal: controller.signal })
          : Promise.resolve({ data: [] }),
        API.get("/users/random?limit=3", { signal: controller.signal }),
        API.get("/trends", { signal: controller.signal }),
      ]);

      // tweets
      if (tRes.status === "fulfilled" && Array.isArray(tRes.value.data)) {
        setTweets(
          tRes.value.data.map((t) => ({
            ...t,
            images: mapImages(t.images),
            user: { ...(t.user || {}), avatar: toAbs(t.user?.avatar) || "/default-avatar.svg" },
          }))
        );
      } else {
        setTweets([]);
      }

      // right users
      if (uRes.status === "fulfilled" && Array.isArray(uRes.value.data)) {
        setUsersRight(
          uRes.value.data.map((u) => ({ ...u, avatar: toAbs(u.avatar) || "/default-avatar.svg" }))
        );
      } else {
        setUsersRight([]);
      }

      // trends
      if (trRes.status === "fulfilled") {
        const raw = trRes.value.data;
        const arr = Array.isArray(raw) ? raw : raw?.trends || [];
        setTrends(arr);
      } else {
        setTrends([]);
      }
    } catch (e) {
      if (e?.name !== "CanceledError" && e?.message !== "canceled") {
        console.error("user page load", e);
        setErr(e?.response?.data?.message || "Failed to load user");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idOrHandle]);

  const joined = useMemo(() => {
    const d = user?.dateRegistered || user?.createdAt;
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [user]);

  const born = useMemo(() => {
    const d = user?.dob;
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }, [user]);

  const counts = useMemo(() => {
    const replies = {}, likes = {}, rts = {};
    for (const t of tweets) {
      if (t.replyTo) replies[t.replyTo] = (replies[t.replyTo] || 0) + 1;
      likes[t._id] = Array.isArray(t.likes) ? t.likes.length : 0;
      rts[t._id]   = Array.isArray(t.retweets) ? t.retweets.length : 0;
    }
    return { replies, likes, rts, bms: {} };
  }, [tweets]);

  // ---------- Actions ----------
  const toggleFollow = async () => {
    if (!user?._id || busy) return;

    if (iBlocked || isBlockedByThem) {
      alert("Follow unavailable due to a block.");
      return;
    }

    const id = user._id;
    const prev = user;
    const wantFollow = !user.isFollowing;

    // optimistic UI
    setBusy(true);
    setUser((u) => ({
      ...u,
      isFollowing: wantFollow,
      followersCount:
        typeof u.followersCount === "number"
          ? Math.max(0, u.followersCount + (wantFollow ? 1 : -1))
          : u.followersCount,
    }));

    try {
      const { data } = await API.post(`/users/${id}/follow`);
      const following = !!(data?.following ?? data?.isFollowing ?? wantFollow);

      // reconcile with a fresh read
      try {
        const r = await API.get(`/users/${id}`);
        const p = r.data;
        setUser((u) => ({
          ...u,
          isFollowing: !!p?.isFollowing,
          followersCount: typeof p?.followersCount === "number" ? p.followersCount : u.followersCount,
        }));
      } catch {
        setUser((u) => ({ ...u, isFollowing: following }));
      }
    } catch (e) {
      setUser(prev); // rollback
      alert(e?.response?.data?.message || "Follow/unfollow failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleBlock = async () => {
    if (!user?._id || busy) return;
    const id = user._id;

    const prevUser = user;
    const prevIBlocked = iBlocked;
    const nextIBlocked = !iBlocked;

    setBusy(true);
    setIBlocked(nextIBlocked);
    setUser((u) => ({
      ...u,
      isFollowing: nextIBlocked ? false : u.isFollowing,
    }));

    try {
      const { data } = await API.post(`/users/${id}/block`);
      const serverBlocked = !!(data?.blocked ?? nextIBlocked);

      try {
        const [targetRes, meRes] = await Promise.all([
          API.get(`/users/${id}`),
          API.get(`/profile`),
        ]);
        const p = targetRes.data;
        const me = meRes.data || {};
        const myBlocked = Array.isArray(me.blockedUsers) ? me.blockedUsers.map(String) : [];
        setIsBlockedByThem(!!p?.isBlocked);
        setIBlocked(myBlocked.includes(String(id)));
        setUser((u) => ({
          ...u,
          isFollowing: !!p?.isFollowing && !myBlocked.includes(String(id)),
        }));
      } catch {
        setIBlocked(serverBlocked);
      }
    } catch (e) {
      setIBlocked(prevIBlocked);
      setUser(prevUser);
      alert(e?.response?.data?.message || "Block/unblock failed");
    } finally {
      setBusy(false);
    }
  };

  // Start or open a DM thread with this user (no server calls here)
  const startDM = () => {
    if (!user?._id || dmBusy) return;

    if (iBlocked || isBlockedByThem) {
      alert("Messaging is unavailable due to a block.");
      return;
    }

    setDmBusy(true);
    try {
      navigate(`/messages?to=${encodeURIComponent(user._id)}`);
    } finally {
      setDmBusy(false);
    }
  };

  // tweet actions
  const like = async (id) => {
    setTweets((prev) =>
      prev.map((t) =>
        t._id === id
          ? {
              ...t,
              likes: t.likes?.includes("me")
                ? t.likes.filter((x) => x !== "me")
                : [...(t.likes || []), "me"],
            }
          : t
      )
    );
    try { await API.post(`/tweets/like/${id}`); } catch {
      setTweets((prev) =>
        prev.map((t) =>
          t._id === id
            ? {
                ...t,
                likes: t.likes?.includes("me")
                  ? t.likes.filter((x) => x !== "me")
                  : [...(t.likes || []), "me"],
              }
            : t
        )
      );
    }
  };

  const rt = async (id) => {
    setTweets((prev) =>
      prev.map((t) =>
        t._id === id
          ? {
              ...t,
              retweets: t.retweets?.includes("me")
                ? t.retweets.filter((x) => x !== "me")
                : [...(t.retweets || []), "me"],
            }
          : t
      )
    );
    try { await API.post(`/tweets/retweet/${id}`); } catch {
      setTweets((prev) =>
        prev.map((t) =>
          t._id === id
            ? {
                ...t,
                retweets: t.retweets?.includes("me")
                  ? t.retweets.filter((x) => x !== "me")
                  : [...(t.retweets || []), "me"],
              }
            : t
        )
      );
    }
  };

  const bm = async (id) => {
    try { await API.post(`/tweets/bookmark/${id}`); } catch {}
  };

  const replyGo = (id) => navigate(`/compose?replyTo=${id}`);
  const share = (id) => {
    navigator.clipboard.writeText(`${window.location.origin}/tweet/${id}`);
    alert("Link copied!");
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />
      <main className="flex-1 border-x border-gray-800 max-w-2xl">
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur p-4 border-b border-gray-800 flex items-center gap-4">
          <button onClick={() => window.history.back()} className="rounded-full p-2 hover:bg-gray-800" aria-label="Back">
            <FaArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="font-bold text-xl">{user?.name || user?.username || "Profile"}</div>
            <div className="text-gray-500 text-sm">{tweets.filter((t) => !t.replyTo).length} Posts</div>
          </div>
        </div>

        {/* Cover + avatar */}
        <div className="relative">
          <div className="h-48 w-full bg-gray-800">
            <img
              src={user?.coverPhoto || "/default-cover.svg"}
              alt="cover"
              className="w-full h-48 object-cover"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/default-cover.svg"; }}
            />
          </div>
          <div className="absolute -bottom-16 left-4">
            <div className="h-32 w-32 rounded-full border-4 border-black bg-gray-700 overflow-hidden">
              <img
                src={user?.avatar || "/default-avatar.svg"}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/default-avatar.svg"; }}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-end p-4 mt-2 gap-2">
          {/* Message */}
          <button
            onClick={startDM}
            disabled={dmBusy || iBlocked || isBlockedByThem}
            className={`rounded-full px-4 py-1.5 font-bold border border-gray-600 hover:bg-gray-800 flex items-center gap-2 ${
              dmBusy || iBlocked || isBlockedByThem ? "opacity-60 cursor-not-allowed" : ""
            }`}
            title={iBlocked || isBlockedByThem ? "Messaging unavailable due to a block." : "Send a direct message"}
            aria-disabled={dmBusy || iBlocked || isBlockedByThem}
          >
            {dmBusy ? "…" : (<><FaEnvelope className="inline-block" /> Message</>)}
          </button>

          {/* Block */}
          <button
            onClick={toggleBlock}
            disabled={busy}
            className={`border border-red-500 rounded-full px-4 py-1.5 font-bold hover:bg-red-900/30 ${
              iBlocked ? "text-red-400" : "text-red-500"
            }`}
            title={
              isBlockedByThem
                ? "This user has blocked you."
                : iBlocked
                ? "Unblock this user"
                : "Block this user"
            }
          >
            {busy ? "…" : iBlocked ? "Unblock" : "Block"}
          </button>

          {/* Hide follow if either side blocked */}
          {!iBlocked && !isBlockedByThem && (
            <button
              onClick={toggleFollow}
              disabled={busy}
              className={`rounded-full px-4 py-1.5 font-bold ${
                user?.isFollowing ? "bg-gray-200 text-black" : "bg-white text-black"
              }`}
            >
              {busy ? "…" : user?.isFollowing ? "Following" : "Follow"}
            </button>
          )}
        </div>

        {/* Bio & meta */}
        <div className="px-4 pt-2 pb-3">
          <div className="flex items-center gap-1">
            <h1 className="text-xl font-bold">{user?.name || user?.username || "User"}</h1>
            {user?.isVerifiedOrg && <FaCheckCircle className="text-blue-500" />}
          </div>
          <p className="text-gray-500">@{user?.username}</p>

          {!!user?.bio && <p className="my-3 whitespace-pre-wrap">{user.bio}</p>}

          <div className="flex flex-wrap gap-y-2 text-gray-500 text-sm">
            {user?.location && (
              <div className="flex items-center gap-1 mr-4">
                <FaMapMarkerAlt />
                <span>{user.location}</span>
              </div>
            )}
            {user?.website && (
              <div className="flex items-center gap-1 mr-4">
                <FaLink />
                <a
                  href={user.website.startsWith("http") ? user.website : `https://${user.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {user.website}
                </a>
              </div>
            )}
            {born && (
              <div className="flex items-center gap-1 mr-4">
                <FaBirthdayCake />
                <span>Born {born}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <FaCalendarAlt />
              <span>Joined {joined}</span>
            </div>
          </div>

          <div className="flex gap-5 mt-3">
            <div className="flex items-center gap-1">
              <span className="font-bold">
                {user?.followingCount ?? user?.following?.length ?? 0}
              </span>
              <span className="text-gray-500">Following</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold">
                {user?.followersCount ?? user?.followers?.length ?? 0}
              </span>
              <span className="text-gray-500">Followers</span>
            </div>
          </div>
        </div>

        {/* Tabs (single: Posts) */}
        <div className="flex border-b border-gray-800">
          <button className="flex-1 py-4 font-medium border-b-4 border-blue-500">Posts</button>
        </div>

        {loading && <div className="p-6 text-gray-400">Loading…</div>}
        {err && <div className="p-6 text-red-400">{err}</div>}
        {!loading && !err && (
          <TweetList
            tweets={tweets}
            counts={counts}
            onLike={like}
            onRetweet={rt}
            onBookmark={bm}
            onReply={replyGo}
            onShare={share}
          />
        )}
      </main>

      <RightSidebar users={usersRight} trends={trends} />
    </div>
  );
}
