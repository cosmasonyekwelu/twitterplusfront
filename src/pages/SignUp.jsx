// src/pages/SignUp.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signup } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";

export default function SignUp() {
  const navigate = useNavigate();
  const { setAuth } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState(null);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await signup(form); // expect { token, user }
      setAuth({ token: data.token, user: data.user });
      toast.success("🎉 Account created successfully!");
      navigate("/home");
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || "Signup failed";
      setError(msg);
      toast.error(`❌ ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="w-full max-w-md border border-neutral-800 rounded-2xl p-6">
        <h1 className="text-2xl font-bold mb-6">Join Twitter Plus today</h1>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <input
            name="username"
            placeholder="Username"
            value={form.username}
            onChange={onChange}
            required
            className="w-full bg-neutral-900 text-white rounded-xl px-4 py-2 border border-neutral-800 focus:outline-none focus:border-gray-400 caret-white"
          />
          <input
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={onChange}
            required
            type="email"
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
          <button
            className="x-btn x-btn-primary w-full"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing up..." : "Sign up"}
          </button>
          <p className="text-xs text-neutral-500">
            By signing up, you agree to the <a href="#" className="hover:underline">Terms of Service</a> and{" "}
            <a href="#" className="hover:underline">Privacy Policy</a>, including{" "}
            <a href="#" className="hover:underline">Cookie Use</a>.
          </p>
          {error && <div className="text-sm text-red-400">{error}</div>}
        </form>

        <div className="text-sm text-neutral-400 mt-4">
          Already have an account? <a className="text-blue-400 hover:underline" href="/signin">Sign in</a>
        </div>
      </div>
    </div>
  );
}
