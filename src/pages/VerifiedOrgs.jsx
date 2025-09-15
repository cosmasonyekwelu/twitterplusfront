// src/pages/VerifiedOrgs.jsx
import { useEffect, useState } from "react";
import API from "../services/api";
import Sidebar from "../components/Sidebar";

export default function VerifiedOrgs() {
  const [orgs, setOrgs] = useState([]);       // always keep this an array
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        // Prefer going through our axios instance so baseURL + token headers apply
        const res = await API.get("/verifiedOrgs");
        const data = res?.data;

        // Normalize common shapes to an array
        const list =
          Array.isArray(data) ? data :
          Array.isArray(data?.items) ? data.items :
          Array.isArray(data?.orgs) ? data.orgs :
          [];

        if (mounted) setOrgs(list);
      } catch (e) {
        if (mounted) setError("Failed to load verified organizations.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />
      <main className="flex-1 border-x border-neutral-800 max-w-2xl p-4">
        <header className="sticky top-0 bg-black/70 backdrop-blur border-b border-neutral-800 p-4 mb-2">
          <h1 className="text-xl font-bold">Verified Organizations</h1>
        </header>

        {loading && <div className="p-4 text-neutral-400">Loading…</div>}
        {error && <div className="p-4 text-red-400">{error}</div>}

        {!loading && !error && (!Array.isArray(orgs) || orgs.length === 0) && (
          <div className="p-4 text-neutral-400">No verified organizations found.</div>
        )}

        {Array.isArray(orgs) && orgs.length > 0 && (
          <ul className="space-y-3">
            {orgs.map((org, i) => (
              <li key={org.id || org._id || i} className="p-4 border border-neutral-800 rounded-xl">
                <div className="flex items-center gap-3">
                  <img
                    src={org.logo || org.avatar || "/default-avatar.png"}
                    alt={org.name || "Org"}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="font-semibold">{org.name || org.handle || "Organization"}</div>
                    <div className="text-sm text-neutral-400">
                      {org.description || org.bio || "Verified organization"}
                    </div>
                  </div>
                  {org.website && (
                    <a
                      href={org.website.startsWith("http") ? org.website : `https://${org.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline text-sm"
                    >
                      Visit
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
