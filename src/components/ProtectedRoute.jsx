// src/components/ProtectedRoute.jsx
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  const loc = useLocation();
  if (loading) return null;
  if (!token) return <Navigate to="/signin" replace state={{ from: loc }} />;
  return children;
}
