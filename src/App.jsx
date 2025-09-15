// src/App.jsx
import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import Home from "./pages/Home";
import Tweet from "./pages/Tweet";
import Compose from "./pages/Compose";
import UserPage from "./pages/User";
import NotFound from "./pages/NotFound";
import Explore from "./pages/Explore";
import Notifications from "./pages/Notifications";
import Messages from "./pages/Messages";
import Grok from "./pages/Grok";
import Bookmarks from "./pages/Bookmarks";
import Communities from "./pages/Communities";
import Premium from "./pages/Premium";
import VerifiedOrgs from "./pages/VerifiedOrgs";
import Profile from "./pages/Profile";
import More from "./pages/More";

import { AuthProvider } from "./context/AuthContext";
import { OnlyGuests, RequireAuth } from "./routes/Guards.jsx"; // <-- new guards

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./App.css";

export default function App() {
  return (
    <AuthProvider>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />

      <Routes>
        {/* Public-only: if logged in → redirect to /home */}
        <Route element={<OnlyGuests />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/signin" element={<SignIn />} />
        </Route>

        {/* Private: requires auth */}
        <Route element={<RequireAuth />}>
          <Route path="/home" element={<Home />} />
          <Route path="/tweet/:id" element={<Tweet />} />
          <Route path="/compose" element={<Compose />} />
          <Route path="/user/:id" element={<UserPage />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/grok" element={<Grok />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="/communities" element={<Communities />} />
          <Route path="/premium" element={<Premium />} />
          <Route path="/verifiedOrgs" element={<VerifiedOrgs />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/more" element={<More />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}
