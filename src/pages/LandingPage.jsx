// src/pages/LandingPage.jsx
import { FaGoogle, FaApple, FaTwitter } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { loginWithGoogle, loginWithApple } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import React from "react";

export default function LandingPage() {
  const navigate = useNavigate();
  const { setAuth, setLoading } = useAuth();

  const handleGoogle = async () => {
    // TODO: implement OAuth flow (popup / redirect) and then exchange code at backend
    try {
      setLoading?.(true);
      const data = await loginWithGoogle(); // currently throws; implement it
      setAuth({ token: data.token, user: data.user });
      navigate("/");
    } catch (err) {
      console.error("Google login not configured:", err);
      // fallback: navigate to signup
      navigate("/signup");
    } finally {
      setLoading?.(false);
    }
  };

  const handleApple = async () => {
    try {
      setLoading?.(true);
      const data = await loginWithApple();
      setAuth({ token: data.token, user: data.user });
      navigate("/");
    } catch (err) {
      console.error("Apple login not configured:", err);
      navigate("/signup");
    } finally {
      setLoading?.(false);
    }
  };

  return (
    <div className="x-container">
      {/* Left Hero Section */}
      <div className="x-hero">
        <FaTwitter size={380} />
      </div>

      {/* Right Content Section */}
      <div className="x-content">
        <h1 className="x-title">Happening now</h1>
        <h2 className="x-subtitle">Join today.</h2>

        <div className="x-options">
          <button className="x-btn x-btn-google" onClick={handleGoogle}>
            <FaGoogle style={{ marginRight: "8px" }} />
            Sign up with Google
          </button>
          <button className="x-btn x-btn-apple" onClick={handleApple}>
            <FaApple style={{ marginRight: "8px" }} />
            Sign up with Apple
          </button>

          <div className="x-divider">
            <div className="x-divider-line"></div>
            <span className="x-divider-text">or</span>
            <div className="x-divider-line"></div>
          </div>

          <button
            className="x-btn x-btn-primary"
            onClick={() => navigate("/signup")}
          >
            Create account
          </button>

          <p className="x-terms">
            By signing up, you agree to the <a href="#">Terms of Service</a> and{" "}
            <a href="#">Privacy Policy</a>, including <a href="#">Cookie Use</a>
            .
          </p>
        </div>

        <div className="x-login">
          <h3 className="x-login-title">Already have an account?</h3>
          <button
            className="x-btn x-btn-login"
            onClick={() => navigate("/signin")}
          >
            Sign in
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="x-footer">
        <div className="x-footer-links">
          <a href="#" className="x-footer-link">
            About
          </a>
          <a href="#" className="x-footer-link">
            Download the X app
          </a>
          <a href="#" className="x-footer-link">
            Glock
          </a>
          <a href="#" className="x-footer-link">
            Help Center
          </a>
          <a href="#" className="x-footer-link">
            Terms of Service
          </a>
          <a href="#" className="x-footer-link">
            Privacy Policy
          </a>
          <a href="#" className="x-footer-link">
            Cookie Policy
          </a>
          <a href="#" className="x-footer-link">
            Accessibility
          </a>
          <a href="#" className="x-footer-link">
            Ads info
          </a>
          <a href="#" className="x-footer-link">
            Blog
          </a>
          <a href="#" className="x-footer-link">
            Careers
          </a>
          <a href="#" className="x-footer-link">
            Brand Resources
          </a>
          <a href="#" className="x-footer-link">
            Advertising
          </a>
          <a href="#" className="x-footer-link">
            Marketing
          </a>
          <a href="#" className="x-footer-link">
            X for Business
          </a>
          <a href="#" className="x-footer-link">
            Developers
          </a>
          <a href="#" className="x-footer-link">
            Directory
          </a>
          <a href="#" className="x-footer-link">
            Settings
          </a>
        </div>
        <div className="x-copyright">© 2025 Twitter Plus.</div>
      </footer>
    </div>
  );
}
