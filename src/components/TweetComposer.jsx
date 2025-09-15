// src/components/TweetComposer.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import API from "../services/api";

// Normalize relative → absolute (e.g. "/uploads/a.png" → "http://localhost:3000/uploads/a.png")
const toAbs = (path) => {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, "");
  const origin = api.replace(/\/api$/i, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
};

export default function TweetComposer({ onPost }) {
  const { auth } = useAuth();
  const me = auth?.user;

  // initial avatar (from auth)
  const initialAvatar = useMemo(
    () => (me?.avatar ? toAbs(me.avatar) : "/default-avatar.svg"),
    [me?.avatar]
  );

  const [avatarUrl, setAvatarUrl] = useState(initialAvatar);
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]); // File[]

  // If auth.user changes (e.g., after profile save), update immediately
  useEffect(() => {
    setAvatarUrl(initialAvatar);
  }, [initialAvatar]);

  // Also fetch from /profile once to guarantee freshest avatar
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data } = await API.get("/profile");
        const raw = data?.avatar ? toAbs(data.avatar) : "/default-avatar.svg";
        // cache-bust in case the filename is reused
        const fresh = raw ? `${raw}${raw.includes("?") ? "&" : "?"}v=${Date.now()}` : "/default-avatar.svg";
        if (mounted) setAvatarUrl(fresh);
      } catch {
        if (mounted) setAvatarUrl("/default-avatar.svg");
      }
    })();
    return () => { mounted = false; };
  }, []);

  const choose = (e) => {
    const picked = Array.from(e.target.files || []);
    // Filter to images only (defensive)
    const onlyImages = picked.filter(f => /^image\//i.test(f.type));
    const next = [...files, ...onlyImages].slice(0, 4);
    setFiles(next);
    e.target.value = ""; // allow re-pick of same file
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const canSubmit = Boolean(text.trim() || files.length > 0);

  const submit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    // Delegate to parent (should create FormData and NOT set Content-Type manually)
    onPost?.(text, files);
    setText("");
    setFiles([]);
    e.target.reset?.();
  };

  return (
    <form onSubmit={submit} className="border-b border-gray-800 p-4 flex gap-3">
      <img
        src={avatarUrl || "/default-avatar.svg"}
        alt="me"
        className="w-10 h-10 rounded-full object-cover"
        onError={(e) => {
          e.currentTarget.onerror = null;
          e.currentTarget.src = "/default-avatar.svg";
        }}
      />
      <div className="flex-1">
        <textarea
          className="w-full bg-black text-white resize-none min-h-[60px] outline-none placeholder-gray-500"
          placeholder="What is happening?!"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
        />

        <div className="mt-2 flex items-center justify-between">
          <label className="text-sm text-blue-400 hover:underline cursor-pointer">
            <input type="file" accept="image/*" multiple hidden onChange={choose} />
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
                    className="w-full h-28 object-cover"
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

        <div className="flex items-center justify-end mt-3">
          <button
            className="px-4 py-2 rounded-full bg-white text-black font-bold hover:bg-gray-200 disabled:opacity-60"
            type="submit"
            disabled={!canSubmit}
          >
            Post
          </button>
        </div>
      </div>
    </form>
  );
}
