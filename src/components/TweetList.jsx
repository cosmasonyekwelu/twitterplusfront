// src/components/TweetList.jsx
import { useState } from "react";
import {
  FaRegComment,
  FaRetweet,
  FaHeart,
  FaBookmark,
  FaShareSquare,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import API from "../services/api";
import { useAuth } from "../context/AuthContext";

// Make relative media paths absolute (e.g. "/uploads/a.png" → "http://localhost:3000/uploads/a.png")
const toAbs = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = api.replace(/\/api$/i, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
};

export default function TweetList({
  tweets = [],
  counts = {},
  onRetweet,
  onReply,
  onLike,
  onShare,
  onBookmark,
  onUpdated, // optional: parent patch/refetch on edit success
  onDeleted, // optional: parent patch/refetch on delete success
}) {
  const { user: authUser } = useAuth() || {};
  const myId = authUser?._id || authUser?.id;

  const rCount = counts.replies || {};
  const lCount = counts.likes || {};
  const rtCount = counts.rts || {};
  const bmCount = counts.bms || {};

  const safeLen = (arr) => (Array.isArray(arr) ? arr.length : 0);
  const normImages = (imgs) =>
    (Array.isArray(imgs) ? imgs : imgs ? [imgs] : [])
      .map(toAbs)
      .filter(Boolean);

  // UI state for per-tweet action menu & editing
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editState, setEditState] = useState({
    open: false,
    tweet: null,
    content: "",
    files: [],
    replace: false,
    busy: false,
  });

  const openMenu = (id) => setMenuOpenId((cur) => (cur === id ? null : id));
  const closeMenu = () => setMenuOpenId(null);

  // ----- Edit flow -----
  const startEdit = (t) => {
    setEditState({
      open: true,
      tweet: t,
      content: t.content || "",
      files: [],
      replace: false,
      busy: false,
    });
    closeMenu();
  };

  const cancelEdit = () =>
    setEditState({ open: false, tweet: null, content: "", files: [], replace: false, busy: false });

  const onPickEditFiles = (e) => {
    const picked = Array.from(e.target.files || []).filter((f) => /^image\//i.test(f.type));
    const next = [...editState.files, ...picked].slice(0, 4);
    setEditState((s) => ({ ...s, files: next }));
    e.target.value = "";
  };

  const removeEditFile = (idx) =>
    setEditState((s) => ({ ...s, files: s.files.filter((_, i) => i !== idx) }));

  const submitEdit = async (e) => {
    e?.preventDefault?.();
    if (!editState.tweet?._id) return;

    const fd = new FormData();
    fd.append("content", (editState.content || "").slice(0, 280));
    if (editState.replace) fd.append("replaceImages", "true");
    editState.files.forEach((f) => fd.append("images", f));

    try {
      setEditState((s) => ({ ...s, busy: true }));
      const { data } = await API.put(`/tweets/${editState.tweet._id}`, fd);
      const updated = data?.tweet || null;
      onUpdated?.(updated);
      cancelEdit();
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to update tweet");
      setEditState((s) => ({ ...s, busy: false }));
    }
  };

  // ----- Delete flow -----
  const doDelete = async (id) => {
    closeMenu();
    if (!window.confirm("Delete this tweet? This action cannot be undone.")) return;
    try {
      await API.delete(`/tweets/${id}`);
      onDeleted?.(id);
    } catch (err) {
      alert(err?.response?.data?.message || "Failed to delete tweet");
    }
  };

  return (
    <>
      <ul>
        {(Array.isArray(tweets) ? tweets : []).map((t) => {
          const u = t.user || {};
          const userId = u._id || u.id;
          const username = u.username || "user";
          const displayName = u.name || username;
          const id = t._id || t.id;

          // counts with fallbacks
          const repliesVal = rCount[id] ?? 0;
          const likesVal = lCount[id] ?? safeLen(t.likes);
          const rtsVal = rtCount[id] ?? safeLen(t.retweets);
          const bookmarksVal = bmCount[id] ?? safeLen(t.bookmarks);

          // normalize media + avatar
          const avatar = toAbs(u.avatar) || "/default-avatar.svg";
          const images = normImages(t.images);

          // ❗ KEY FIX: no hooks inside map; compute isMine as plain boolean
          const isMine = myId != null && String(myId) === String(userId);

          return (
            <li key={id} className="border-b border-gray-800 p-4">
              <div className="flex gap-3">
                <Link to={userId ? `/user/${userId}` : "#"}>
                  <img
                    src={avatar}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/default-avatar.svg";
                    }}
                    className="w-10 h-10 rounded-full object-cover"
                    alt=""
                  />
                </Link>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link to={userId ? `/user/${userId}` : "#"} className="font-bold hover:underline">
                      {displayName}
                    </Link>
                    <span className="text-gray-500">@{username}</span>
                    <span className="text-gray-600">·</span>

                    {/* Owner menu (⋯) */}
                    {isMine && (
                      <div className="ml-auto relative">
                        <button
                          aria-label="Tweet menu"
                          className="px-2 py-1 rounded-full hover:bg-gray-800"
                          onClick={() => openMenu(id)}
                        >
                          ⋯
                        </button>
                        {menuOpenId === id && (
                          <div
                            className="absolute right-0 mt-1 w-36 rounded-xl border border-gray-800 bg-black shadow-lg z-20"
                            onMouseLeave={closeMenu}
                          >
                            <button
                              className="w-full text-left px-3 py-2 hover:bg-gray-900"
                              onClick={() => startEdit(t)}
                            >
                              Edit
                            </button>
                            <button
                              className="w-full text-left px-3 py-2 text-red-400 hover:bg-gray-900"
                              onClick={() => doDelete(id)}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* reply hint */}
                  {t.replyTo && (
                    <div className="text-xs text-gray-500 mt-1">
                      Replying to{" "}
                      <Link to={`/tweet/${t.replyTo}`} className="text-blue-400">
                        @post
                      </Link>
                    </div>
                  )}

                  <div className="mt-1 whitespace-pre-wrap">{t.content || t.text || ""}</div>

                  {/* media */}
                  {images.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {images.map((src, i) => (
                        <img
                          key={`${id}-img-${i}`}
                          src={src}
                          alt=""
                          className="rounded-xl border border-gray-800 object-cover max-h-80"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between text-gray-500 text-sm mt-3">
                    <button
                      onClick={() => onReply?.(id)}
                      className="hover:text-blue-400 flex items-center gap-2"
                    >
                      <FaRegComment /> <span>{repliesVal}</span>
                    </button>
                    <button
                      onClick={() => onRetweet?.(id)}
                      className="hover:text-green-400 flex items-center gap-2"
                    >
                      <FaRetweet /> <span>{rtsVal}</span>
                    </button>
                    <button
                      onClick={() => onLike?.(id)}
                      className="hover:text-pink-400 flex items-center gap-2"
                    >
                      <FaHeart /> <span>{likesVal}</span>
                    </button>
                    <button
                      onClick={() => onBookmark?.(id)}
                      className="hover:text-yellow-400 flex items-center gap-2"
                    >
                      <FaBookmark /> <span>{bookmarksVal}</span>
                    </button>
                    <button
                      onClick={() => onShare?.(id)}
                      className="hover:text-blue-400 flex items-center gap-2"
                    >
                      <FaShareSquare /> <span>Share</span>
                    </button>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* Edit Modal */}
      {editState.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={editState.busy ? undefined : cancelEdit}
          />
          <form
            onSubmit={submitEdit}
            className="relative z-50 w-full max-w-lg bg-black border border-gray-800 rounded-2xl p-4"
          >
            <h2 className="text-lg font-bold mb-3">Edit Tweet</h2>

            <textarea
              className="w-full bg-black text-white border border-gray-800 rounded-lg p-3 min-h-[120px]"
              maxLength={280}
              value={editState.content}
              onChange={(e) => setEditState((s) => ({ ...s, content: e.target.value }))}
              disabled={editState.busy}
            />

            <div className="flex items-center justify-between mt-3">
              <label className="text-sm text-blue-400 hover:underline cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={onPickEditFiles}
                  disabled={editState.busy}
                />
                Add photos (up to 4)
              </label>

              <label className="text-sm flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editState.replace}
                  onChange={(e) => setEditState((s) => ({ ...s, replace: e.target.checked }))}
                  disabled={editState.busy}
                />
                Replace existing images
              </label>
            </div>

            {editState.files.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {editState.files.map((f, idx) => {
                  const url = URL.createObjectURL(f);
                  return (
                    <div
                      key={idx}
                      className="relative rounded-2xl overflow-hidden border border-gray-800"
                    >
                      <img
                        src={url}
                        alt={`upload-${idx}`}
                        className="w-full h-28 object-cover"
                        onLoad={() => URL.revokeObjectURL(url)}
                      />
                      <button
                        type="button"
                        onClick={() => removeEditFile(idx)}
                        className="absolute top-1 right-1 bg-black/70 rounded-full px-2 py-0.5 text-xs"
                        disabled={editState.busy}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={cancelEdit}
                className="px-4 py-2 rounded-full border border-gray-700 hover:bg-gray-900"
                disabled={editState.busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-full bg-white text-black font-bold hover:bg-gray-200 disabled:opacity-60"
                disabled={editState.busy}
              >
                {editState.busy ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
