// src/pages/Profile.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import TweetList from "../components/TweetList";
import ProfileEditModal from "../components/ProfileEditModal";
import RightSidebar from "../components/RightSidebar";
import {
  FaCalendarAlt,
  FaLink,
  FaMapMarkerAlt,
  FaCheckCircle,
  FaArrowLeft,
  FaBirthdayCake,
} from "react-icons/fa";

/* ------------------------- helpers ------------------------- */
function toAbs(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = api.replace(/\/api$/i, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}
const mapImages = (imgs) => (Array.isArray(imgs) ? imgs : imgs ? [imgs] : []).map(toAbs);
const isCancel = (e) =>
  e?.code === "ERR_CANCELED" ||
  e?.name === "CanceledError" ||
  String(e?.message || "").toLowerCase() === "canceled";

function shapeTweet(t) {
  const u = t?.user || {};
  return {
    ...t,
    images: mapImages(t?.images),
    user: { ...u, avatar: toAbs(u?.avatar) || "/default-avatar.svg" },
  };
}
const hasId = (x) => x !== undefined && x !== null && String(x) !== "undefined";

/* ------------------------- page ------------------------- */
export default function Profile() {
  // core data
  const [me, setMe] = useState(null);
  const [tweetsAuthored, setTweetsAuthored] = useState([]); // my tweets from /profile
  const [universeTweets, setUniverseTweets] = useState([]); // one feed we filter for likes/retweets

  // right sidebar
  const [users, setUsers] = useState([]);
  const [trends, setTrends] = useState([]);

  // ui state
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("posts"); // posts | replies | media | likes | retweets

  const bootAbort = useRef(null);

  // init tab from URL
  useEffect(() => {
    const url = new URL(window.location.href);
    const qTab = (url.searchParams.get("tab") || "").toLowerCase();
    if (["posts", "replies", "media", "likes", "retweets"].includes(qTab)) {
      setActiveTab(qTab);
    }
  }, []);

  // reflect tab to URL
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("tab") !== activeTab) {
      url.searchParams.set("tab", activeTab);
      window.history.replaceState({}, "", url.toString());
    }
  }, [activeTab]);

  /* ------------------------- bootstrap load ------------------------- */
  const load = async () => {
    bootAbort.current?.abort?.();
    const controller = new AbortController();
    bootAbort.current = controller;

    try {
      setLoading(true);
      setErr("");

      // 1) /profile (gives me + my authored tweets)
      const res = await API.get("/profile", { signal: controller.signal });
      const data = res.data || {};
      setMe({
        ...data,
        avatar: data.avatar ? toAbs(data.avatar) : "/default-avatar.svg",
        coverPhoto: data.coverPhoto ? toAbs(data.coverPhoto) : "/default-cover.svg",
      });
      const myList = Array.isArray(data.tweets) ? data.tweets : [];
      setTweetsAuthored(myList.map(shapeTweet));

      // 2) one universe feed to compute Likes/Retweets tabs (avoid probing unknown routes)
      try {
        // if your backend uses /feed or /timeline instead, change the line below to that single known endpoint
        const feed = await API.get("/tweets?limit=200", { signal: controller.signal });
        const raw = feed?.data || [];
        const arr = Array.isArray(raw?.tweets) ? raw.tweets : Array.isArray(raw) ? raw : [];
        setUniverseTweets(arr.map(shapeTweet));
      } catch (e) {
        if (!isCancel(e)) console.warn("Universe feed unavailable, Likes/Retweets tabs will be empty.");
        setUniverseTweets([]);
      }

      // right rail
      try {
        const uRes = await API.get("/users/random?limit=3", { signal: controller.signal });
        const arr = Array.isArray(uRes.data) ? uRes.data : [];
        setUsers(arr.map((u) => ({ ...u, avatar: toAbs(u.avatar) || "/default-avatar.svg" })));
      } catch (e) {
        if (!isCancel(e)) console.warn("users/random failed", e);
        setUsers([]);
      }

      try {
        const tRes = await API.get("/trends", { signal: controller.signal });
        const arr = Array.isArray(tRes.data) ? tRes.data : tRes.data?.trends || [];
        setTrends(arr);
      } catch (e) {
        if (!isCancel(e)) console.warn("trends failed", e);
        setTrends([]);
      }
    } catch (e) {
      if (!isCancel(e)) {
        console.error("profile load", e);
        setErr(e?.response?.data?.message || "Failed to load profile");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    return () => bootAbort.current?.abort?.();
  }, []);

  /* ------------------------- derived lists & counts ------------------------- */
  const myId = me?._id || me?.id;

  // compute liked/retweeted from the universe feed
  const likedTweets = useMemo(() => {
    if (!hasId(myId)) return [];
    return universeTweets.filter((t) => {
      const likes = Array.isArray(t.likes) ? t.likes.map(String) : [];
      return likes.includes(String(myId)) || likes.includes("me");
    });
  }, [universeTweets, myId]);

  const retweetedTweets = useMemo(() => {
    if (!hasId(myId)) return [];
    return universeTweets.filter((t) => {
      const rts = Array.isArray(t.retweets) ? t.retweets.map(String) : [];
      return rts.includes(String(myId)) || rts.includes("me");
    });
  }, [universeTweets, myId]);

  const currentTweets = useMemo(() => {
    if (activeTab === "likes") return likedTweets;
    if (activeTab === "retweets") return retweetedTweets;
    if (activeTab === "replies") return tweetsAuthored.filter((t) => !!t.replyTo);
    if (activeTab === "media")
      return tweetsAuthored.filter((t) => Array.isArray(t.images) && t.images.length > 0);
    return tweetsAuthored.filter((t) => !t.replyTo); // posts
  }, [activeTab, tweetsAuthored, likedTweets, retweetedTweets]);

  const counts = useMemo(() => {
    const replies = {};
    const likes = {};
    const rts = {};
    for (const t of currentTweets) {
      if (t.replyTo) replies[t.replyTo] = (replies[t.replyTo] || 0) + 1;
      likes[t._id] = Array.isArray(t.likes) ? t.likes.length : 0;
      rts[t._id] = Array.isArray(t.retweets) ? t.retweets.length : 0;
    }
    return { replies, likes, rts, bms: {} };
  }, [currentTweets]);

  /* ------------------------- actions ------------------------- */
  // After like/retweet, refresh both my authored list (for counts) and the universe
  const refreshData = async () => {
    try {
      const res = await API.get("/profile");
      const list = Array.isArray(res.data?.tweets) ? res.data.tweets : [];
      setTweetsAuthored(list.map(shapeTweet));
    } catch {}
    try {
      const feed = await API.get("/tweets?limit=200");
      const raw = feed?.data || [];
      const arr = Array.isArray(raw?.tweets) ? raw.tweets : Array.isArray(raw) ? raw : [];
      setUniverseTweets(arr.map(shapeTweet));
    } catch {}
  };

  const like = async (id) => { try { await API.post(`/tweets/like/${id}`); } catch {} await refreshData(); };
  const rt   = async (id) => { try { await API.post(`/tweets/retweet/${id}`); } catch {} await refreshData(); };
  const bm   = async (id) => { try { await API.post(`/tweets/bookmark/${id}`); } catch {} };
  const replyGo = (id) => { window.location.href = `/tweet/${id}`; };
  const share = (id) => {
    const url = `${window.location.origin}/tweet/${id}`;
    navigator.clipboard.writeText(url);
    alert("Link copied!");
  };

  /* ------------------------- formatters ------------------------- */
  const joinDate = useMemo(() => {
    const d = me?.dateRegistered || me?.createdAt;
    if (!d) return "";
    const dt = new Date(d);
    return dt.toLocaleString(undefined, { month: "long", year: "numeric" });
  }, [me]);

  const dobStr = useMemo(() => {
    const d = me?.dob;
    if (!d) return "";
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    return dt.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
  }, [me]);

  const authoredPostsCount = useMemo(
    () => tweetsAuthored.filter((t) => !t.replyTo).length,
    [tweetsAuthored]
  );

  /* ------------------------- render ------------------------- */
  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 border-x border-gray-800 max-w-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur p-4 border-b border-gray-800 flex items-center gap-4">
          <button onClick={() => window.history.back()} className="rounded-full p-2 hover:bg-gray-800" aria-label="Back">
            <FaArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="font-bold text-xl">{me?.name || me?.username || "Profile"}</div>
            <div className="text-gray-500 text-sm">{authoredPostsCount} Posts</div>
          </div>
        </div>

        {/* Cover + avatar */}
        <div className="relative">
          <div className="h-48 w-full bg-gray-800">
            <img
              src={me?.coverPhoto || "/default-cover.svg"}
              alt="cover"
              className="w-full h-48 object-cover"
              onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/default-cover.svg"; }}
            />
          </div>
          <div className="absolute -bottom-16 left-4">
            <div className="h-32 w-32 rounded-full border-4 border-black bg-gray-700 overflow-hidden">
              <img
                src={me?.avatar || "/default-avatar.svg"}
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = "/default-avatar.svg"; }}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </div>

        {/* Edit button */}
        <div className="flex justify-end p-4 mt-2">
          <button
            onClick={() => setEditOpen(true)}
            className="border border-gray-600 rounded-full px-4 py-1.5 font-bold hover:bg-gray-900"
          >
            Edit profile
          </button>
        </div>

        {/* Bio & meta */}
        <div className="px-4 pt-6 pb-3">
          <div className="flex items-center gap-1">
            <h1 className="text-xl font-bold">{me?.name || me?.username || "User"}</h1>
            {me?.isVerified && <FaCheckCircle className="text-blue-500" />}
          </div>
          <p className="text-gray-500">@{me?.username}</p>

          {me?.bio && <p className="my-3">{me.bio}</p>}

          <div className="flex flex-wrap gap-y-2 text-gray-500 text-sm">
            {me?.location && (
              <div className="flex items-center gap-1 mr-4">
                <FaMapMarkerAlt /><span>{me.location}</span>
              </div>
            )}
            {me?.website && (
              <div className="flex items-center gap-1 mr-4">
                <FaLink />
                <a
                  href={me.website.startsWith("http") ? me.website : `https://${me.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline"
                >
                  {me.website}
                </a>
              </div>
            )}
            {dobStr && (
              <div className="flex items-center gap-1 mr-4">
                <FaBirthdayCake />
                <span>Born {dobStr}</span>
              </div>
            )}
            <div className="flex items-center gap-1">
              <FaCalendarAlt />
              <span>Joined {joinDate}</span>
            </div>
          </div>

          <div className="flex gap-5 mt-3">
            <div className="flex items-center gap-1">
              <span className="font-bold">{me?.followingCount ?? me?.following?.length ?? 0}</span>
              <span className="text-gray-500">Following</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold">{me?.followersCount ?? me?.followers?.length ?? 0}</span>
              <span className="text-gray-500">Followers</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800">
          {[
            { key: "posts", label: "Posts" },
            { key: "replies", label: "Replies" },
            { key: "media", label: "Media" },
            { key: "likes", label: "Likes" },
            { key: "retweets", label: "Retweets" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 py-4 font-medium ${
                activeTab === t.key ? "border-b-4 border-blue-500" : "text-gray-500 hover:bg-gray-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tweets */}
        {loading && <div className="p-6 text-gray-400">Loading…</div>}
        {err && <div className="p-6 text-red-400">{err}</div>}
        {!loading && !err && (
          <>
            {currentTweets.length === 0 && (
              <div className="p-6 text-gray-500">Nothing to show here yet.</div>
            )}
            {currentTweets.length > 0 && (
              <TweetList
                tweets={currentTweets}
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

      <RightSidebar users={users} trends={trends} />

      {editOpen && me && (
        <ProfileEditModal
          initial={{
            name: me.name || "",
            bio: me.bio || "",
            location: me.location || "",
            website: me.website || "",
            dob: me.dob ? new Date(me.dob).toISOString().slice(0, 10) : "",
          }}
          onClose={() => setEditOpen(false)}
          onSaved={async () => {
            setEditOpen(false);
            await load();
          }}
        />
      )}
    </div>
  );
}
