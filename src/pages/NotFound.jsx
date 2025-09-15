import { Link } from 'react-router-dom'
export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center space-y-4">
      <h1 className="text-5xl font-extrabold">404</h1>
      <p className="text-neutral-400">This page doesn’t exist.</p>
      <Link to="/" className="btn">Go home</Link>
    </div>
  )
}
