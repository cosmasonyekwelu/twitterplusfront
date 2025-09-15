import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { FaHome, FaHashtag, FaBell, FaEnvelope, FaBookmark, FaUser, FaEllipsisH, FaStar, FaUsers, FaCheckCircle } from 'react-icons/fa'

const item = "flex items-center gap-3 px-4 py-3 rounded-full hover:bg-neutral-900 transition";

export default function Sidebar() {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  const linkClass = ({ isActive }) => isActive ? "font-semibold " + item : item

  return (
    <aside className="w-64 min-h-screen px-2 py-4 sticky top-0">
      <nav className="space-y-1">
        <NavLink to="/home" className={linkClass}><FaHome /> Home</NavLink>
        <NavLink to="/explore" className={linkClass}><FaHashtag /> Explore</NavLink>
        <NavLink to="/notifications" className={linkClass}><FaBell /> Notifications</NavLink>
        <NavLink to="/messages" className={linkClass}><FaEnvelope /> Messages</NavLink>
        <NavLink to="/grok" className={linkClass}><FaStar /> Grok</NavLink>
        <NavLink to="/bookmarks" className={linkClass}><FaBookmark /> Bookmarks</NavLink>
        <NavLink to="/communities" className={linkClass}><FaUsers /> Communities</NavLink>
        <NavLink to="/premium" className={linkClass}><FaCheckCircle /> Premium</NavLink>
        <NavLink to="/verifiedOrgs" className={linkClass}><FaCheckCircle /> Verified Orgs</NavLink>
        <NavLink to="/profile" className={linkClass}><FaUser /> Profile</NavLink>
        <NavLink to="/more" className={linkClass}><FaEllipsisH /> More</NavLink>
      </nav>
      <div className="mt-8">
        <button className="btn w-full" onClick={() => navigate('/compose')}>Post</button>
      </div>
      <div className="mt-6 text-sm text-neutral-400">
        Logged in as <span className="text-white font-medium">@{user?.username || user?.handle || 'you'}</span>
      </div>
      <div className="mt-2">
        <button className="w-full border border-neutral-700 rounded-full px-4 py-2 hover:bg-neutral-900" onClick={signOut}>Sign out</button>
      </div>
    </aside>
  )
}
