import API from "../services/api";

export function toAbs(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, ""); // e.g. http://localhost:3000/api
  const origin = api.replace(/\/api$/i, "");                      // e.g. http://localhost:3000
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}

export function defaultAvatar(user) {
  // Prefer backend-provided avatar if present
  if (user?.avatar) return toAbs(user.avatar);
  // Otherwise hit the dynamic initials endpoint
  const api = (API?.defaults?.baseURL || "").replace(/\/+$/, "");
  return `${api.replace(/\/api$/i, "")}/api/defaults/avatar?username=${encodeURIComponent(user?.username || user?.email || "user")}`;
}

export function defaultCover(user) {
  if (user?.coverPhoto) return toAbs(user.coverPhoto);
  const origin = (API?.defaults?.baseURL || "").replace(/\/+$/, "").replace(/\/api$/i, "");
  // Use static cover by default (faster, cached)
  return `${origin}/assets/default-cover.svg`;
  // Or: return `${origin}/api/defaults/cover?username=${encodeURIComponent(user?.username || "user")}`;
}
