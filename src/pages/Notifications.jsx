import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import RightSidebar from "../components/RightSidebar";
import {
  FaBell, FaHeart, FaRetweet, FaRegComment, FaUserPlus,
} from "react-icons/fa";

// Make relative media paths absolute (e.g. "/uploads/a.png" → "http://localhost:3000/uploads/a.png")
const toAbs = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, ""); // http://localhost:3000/api
  const origin = api.replace(/\/api$/i, "");                      // http://localhost:3000
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
};

const TypeIcon = ({ type }) => {
  const base = "w-4 h-4";
  switch (type) {
    case "like": return <FaHeart className={`${base} text-pink-400`} />;
    case "retweet": return <FaRetweet className={`${base} text-green-400`} />;
    case "reply": return <FaRegComment className={`${base} text-blue-400`} />;
    case "follow": return <FaUserPlus className={`${base} text-emerald-400`} />;
    default: return <FaBell className={`${base} text-yellow-400`} />;
  }
};

export default function Notifications() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [notifications, setNotifications] = useState([]);
  const [usersRight, setUsersRight] = useState([]);
  const [trends, setTrends] = useState([]);

  const abortRef = useRef(null);

  const loadAll = async () => {
    setLoading(true); setErr("");

    // cancel in-flight
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // notifications + right rail (parallel)
      const [nRes, uRes, trRes] = await Promise.allSettled([
        API.get("/notifications", { signal: controller.signal }),
        API.get("/users/random?limit=3", { signal: controller.signal }),
        API.get("/trends", { signal: controller.signal }),
      ]);

      if (nRes.status === "fulfilled") {
        const list = Array.isArray(nRes.value.data) ? nRes.value.data : (nRes.value.data?.notifications || []);
        // Normalize items
        const shaped = list.map((n) => {
          const fromUser = n.fromUser || n.actor || {};
          const fu = {
            _id: fromUser._id || fromUser.id,
            username: fromUser.username || "user",
            name: fromUser.name || fromUser.username || "User",
            avatar: toAbs(fromUser.avatar) || "/default-avatar.svg",
          };
          return {
            _id: n._id,
            type: n.type || "notify",
            message: n.message,
            createdAt: n.createdAt || n.timestamp,
            tweetId: typeof n.tweet === "string" ? n.tweet : n.tweet?._id,
            fromUser: fu,
          };
        });
        setNotifications(shaped);
      } else {
        setNotifications([]);
      }

      if (uRes.status === "fulfilled" && Array.isArray(uRes.value.data)) {
        setUsersRight(uRes.value.data.map((u) => ({ ...u, avatar: toAbs(u.avatar) || "/default-avatar.svg" })));
      } else setUsersRight([]);

      if (trRes.status === "fulfilled") {
        const raw = trRes.value.data;
        const arr = Array.isArray(raw) ? raw : raw?.trends || [];
        setTrends(arr);
      } else setTrends([]);
    } catch (e) {
      if (e?.name !== "CanceledError" && e?.message !== "canceled") {
        console.error("notifications load failed", e);
        setErr(e?.response?.data?.message || "Failed to load notifications");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    // auth guard (simple): redirect to signin if no token
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/signin");
      return;
    }
    loadAll();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empty = useMemo(() => !loading && !err && notifications.length === 0, [loading, err, notifications]);

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />
      <main className="flex-1 border-x border-gray-800 max-w-2xl">
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur p-4 border-b border-gray-800">
          <h1 className="font-bold text-xl">Notifications</h1>
        </div>

        {loading && <div className="p-6 text-gray-400">Loading…</div>}
        {err && <div className="p-6 text-red-400">{err}</div>}
        {empty && <div className="p-6 text-gray-500">You're all caught up 🎉</div>}

        {!loading && !err && notifications.length > 0 && (
          <ul>
            {notifications.map((n) => (
              <li key={n._id || `${n.type}-${n.createdAt}`} className="border-b border-gray-800 p-4 flex gap-3">
                <img
                  src={n.fromUser?.avatar || "/default-avatar.svg"}
                  onError={(e)=>{ e.currentTarget.onerror=null; e.currentTarget.src="/default-avatar.svg"; }}
                  alt=""
                  className="w-10 h-10 rounded-full"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <TypeIcon type={n.type} />
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                  </div>

                  <div className="mt-1">
                    <Link to={`/user/${n.fromUser?._id}`} className="font-bold hover:underline">
                      {n.fromUser?.name}
                    </Link>{" "}
                    {n.type === "follow" && <>followed you.</>}
                    {n.type === "like"   && <>liked your post.</>}
                    {n.type === "retweet"&& <>reposted your post.</>}
                    {n.type === "reply"  && <>replied to your post.</>}
                    {!["follow","like","retweet","reply"].includes(n.type) && (n.message || "sent you a notification.")}
                  </div>

                  {n.tweetId && (
                    <div className="mt-2">
                      <Link
                        to={`/tweet/${n.tweetId}`}
                        className="inline-block px-3 py-1.5 rounded-full border border-gray-700 hover:bg-gray-800 text-sm"
                      >
                        View post
                      </Link>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <RightSidebar users={usersRight} trends={trends} />
    </div>
  );
}
