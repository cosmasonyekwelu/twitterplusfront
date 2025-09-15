// src/pages/SignIn.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

export default function SignIn() {
  const navigate = useNavigate();
  const { setAuth, setLoading } = useAuth();
  const [form, setForm] = useState({ identifier: "", password: "" }); // identifier = email or username
  const [error, setError] = useState(null);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading?.(true);

    try {
      const data = await login(form); // form = { identifier, password }
      setAuth({ token: data.token, user: data.user });
      toast.success("✅ Login successful!");
      navigate("/home");
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || "Login failed";
      setError(msg);
      toast.error(`❌ ${msg}`);
    } finally {
      setLoading?.(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="w-full max-w-md border border-neutral-800 rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-6">Sign in to Twitter Plus</h1>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <input
            name="identifier"
            placeholder="Username or Email"
            value={form.identifier}
            onChange={onChange}
            required
            className="w-full bg-neutral-900 text-white rounded-xl px-4 py-2 border border-neutral-800 focus:outline-none focus:border-gray-400 caret-white"
          />
          <input
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={onChange}
            required
            type="password"
            className="w-full bg-neutral-900 text-white rounded-xl px-4 py-2 border border-neutral-800 focus:outline-none focus:border-gray-400 caret-white"
          />
          <button className="x-btn x-btn-primary w-full" type="submit">
            Sign in
          </button>
          {error && <div className="text-sm text-red-400">{error}</div>}
        </form>

        <div className="text-sm text-neutral-400 mt-4">
          Don't have an account? <a className="text-blue-400 hover:underline" href="/signup">Create one</a>
        </div>
      </div>
    </div>
  );
}
