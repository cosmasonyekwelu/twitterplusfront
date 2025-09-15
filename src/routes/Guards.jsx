// src/routes/Guards.jsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function RequireAuth() {
  const { token, loading } = useAuth();
  const loc = useLocation();
  if (loading) return null;                  // show a spinner if you like
  if (!token) return <Navigate to="/signin" replace state={{ from: loc }} />;
  return <Outlet />;
}

export function OnlyGuests() {
  const { token, loading } = useAuth();
  if (loading) return null;
  return token ? <Navigate to="/home" replace /> : <Outlet />;
}
