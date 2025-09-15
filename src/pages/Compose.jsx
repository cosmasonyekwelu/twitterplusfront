import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";

// Normalize relative → absolute (e.g. "/uploads/a.png" → "http://localhost:3000/uploads/a.png")
const toAbs = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = api.replace(/\/api$/i, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
};

export default function Compose() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const replyTo = sp.get("replyTo"); // /compose?replyTo=<tweetId>
  const mode = useMemo(() => (replyTo ? "reply" : "post"), [replyTo]);

  const { auth } = useAuth();
  const me = auth?.user;

  // Avatar that always reflects the latest profile
  const [avatarUrl, setAvatarUrl] = useState(
    me?.avatar ? toAbs(me.avatar) : "/default-avatar.svg"
  );

  const [text, setText] = useState("");
  const [files, setFiles] = useState([]); // File[]
  const [busy, setBusy] = useState(false);

  // Optional: tweet you’re replying to
  const [contextTweet, setContextTweet] = useState(null);

  // Fetch latest avatar from /profile on mount and whenever we open composer,
  // so a newly-updated avatar shows up immediately.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await API.get("/profile");
        const fresh = data?.avatar ? toAbs(data.avatar) : "/default-avatar.svg";
        if (mounted) setAvatarUrl(fresh);
      } catch {
        if (mounted) setAvatarUrl("/default-avatar.svg");
      }
    })();
    return () => { mounted = false; };
  }, []); // run once when composer opens

  // Load reply context (best-effort)
  useEffect(() => {
    if (!replyTo) return;
    (async () => {
      try {
        const res = await API.get("/tweets");
        const list = Array.isArray(res.data) ? res.data : [];
        setContextTweet(list.find((t) => String(t._id) === String(replyTo)) || null);
      } catch (err) {
        console.error("Failed to load context tweet", err);
      }
    })();
  }, [replyTo]);

  const onChoose = (e) => {
    const picked = Array.from(e.target.files || []);
    const next = [...files, ...picked].slice(0, 4);
    setFiles(next);
    e.target.value = "";
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const canSubmit =
    mode === "reply" ? Boolean(text.trim()) : Boolean(text.trim() || files.length > 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      setBusy(true);

      if (mode === "reply") {
        await API.post(`/tweets/reply/${replyTo}`, { content: text.trim() });
        navigate(`/home`);
      } else {
        const fd = new FormData();
        if (text.trim()) fd.append("content", text.trim());
        files.forEach((f) => fd.append("images", f)); // key must be "images"
        await API.post("/tweets", fd, { headers: { "Content-Type": "multipart/form-data" } });
        navigate("/home");
      }
    } catch (err) {
      console.error("Compose failed", err);
      alert(err?.response?.data?.message || "Failed to publish");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 border-x border-gray-800 max-w-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur p-4 border-b border-gray-800 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="rounded-full px-3 py-1 hover:bg-gray-900">
            Cancel
          </button>
          <div className="font-bold">{mode === "reply" ? "Reply" : "Compose"}</div>
          <div style={{ width: 64 }} />
        </div>

        {/* Reply context */}
        {mode === "reply" && contextTweet && (
          <div className="p-4 border-b border-gray-800 text-sm text-gray-400">
            Replying to{" "}
            <span className="text-blue-400">@{contextTweet?.user?.username || "user"}</span>
            <div className="mt-2 text-white">{contextTweet?.content}</div>
          </div>
        )}

        {/* Composer */}
        <form onSubmit={submit} className="p-4 flex gap-3">
          <img
            src={avatarUrl}
            alt="me"
            className="w-10 h-10 rounded-full object-cover"
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/default-avatar.svg";
            }}
          />
          <div className="flex-1">
            <textarea
              className="w-full bg-black text-white resize-none min-h-[120px] outline-none placeholder-gray-500"
              placeholder={mode === "reply" ? "Post your reply" : "What is happening?!"}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            {/* Image picker & previews (posts only) */}
            {mode === "post" && (
              <>
                <div className="mt-2 flex items-center justify-between">
                  <label className="text-sm text-blue-400 hover:underline cursor-pointer">
                    <input type="file" accept="image/*" multiple hidden onChange={onChoose} />
                    Add photos (up to 4)
                  </label>
                  <div className="text-xs text-gray-500">{text.length}/280</div>
                </div>

                {files.length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {files.map((f, idx) => {
                      const url = URL.createObjectURL(f);
                      return (
                        <div key={idx} className="relative rounded-2xl overflow-hidden border border-gray-800">
                          <img
                            src={url}
                            alt={`upload-${idx}`}
                            className="w-full h-32 object-cover"
                            onLoad={() => URL.revokeObjectURL(url)}
                          />
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="absolute top-1 right-1 bg-black/70 rounded-full px-2 py-0.5 text-xs"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end mt-3">
              <button
                type="submit"
                disabled={busy || !canSubmit}
                className="px-4 py-2 rounded-full bg-white text-black font-bold hover:bg-gray-200 disabled:opacity-60"
              >
                {busy ? (mode === "reply" ? "Replying…" : "Posting…") : mode === "reply" ? "Reply" : "Post"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
