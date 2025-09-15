// src/pages/Grok.jsx
import { useEffect, useRef, useState } from "react";
import API from "../services/api";
import Sidebar from "../components/Sidebar";
import RightSidebar from "../components/RightSidebar";

const isCancel = (e) =>
  e?.code === "ERR_CANCELED" ||
  e?.name === "CanceledError" ||
  String(e?.message || "").toLowerCase() === "canceled";

const asMessage = (e) =>
  e?.response?.data?.message ||
  e?.message ||
  "Something went wrong";

async function askGrok(q, signal) {
  // If API.defaults.baseURL === "/api", this hits /api/grok/ask
  const res = await API.post("/grok/ask", { q }, { signal });
  return res?.data;
}

export default function Grok() {
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const ctrlRef = useRef(null);

  useEffect(() => () => ctrlRef.current?.abort?.(), []);

  const onAsk = async (e) => {
    e?.preventDefault?.();
    const q = (query || "").trim();
    if (!q) return;

    ctrlRef.current?.abort?.();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    setLoading(true);
    setErr("");
    setAnswer("");

    try {
      const data = await askGrok(q, ctrl.signal);
      if (!data?.ok) {
        setErr(data?.message || "Request failed");
        return;
      }
      setAnswer(data.text || "");
    } catch (e1) {
      if (!isCancel(e1)) setErr(asMessage(e1));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />
      <main className="flex-1 border-x border-neutral-800 max-w-4xl mx-auto w-full">
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur p-4 border-b border-neutral-800">
          <h1 className="text-xl font-bold">Grok</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 p-4">
          <section>
            <form onSubmit={onAsk} className="mb-3">
              <div className="flex gap-2">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask something…"
                  className="flex-1 bg-neutral-900 text-white rounded-xl px-4 py-3 border border-gray-800 focus:outline-none focus:border-gray-600 caret-white"
                />
                <button
                  type="submit"
                  disabled={loading || !query.trim()}
                  className="px-5 py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 disabled:opacity-60"
                >
                  Ask
                </button>
              </div>
            </form>

            {loading && (
              <div className="p-4 text-sm text-gray-400 border border-neutral-800 rounded-xl">
                Thinking…
              </div>
            )}
            {!!err && (
              <div className="p-4 text-sm text-red-400 border border-red-900/50 bg-red-900/10 rounded-xl">
                {err}
              </div>
            )}
            {!!answer && !loading && !err && (
              <div className="p-4 text-sm border border-neutral-800 rounded-xl whitespace-pre-wrap">
                {answer}
              </div>
            )}
          </section>

          <RightSidebar />
        </div>
      </main>
    </div>
  );
}
