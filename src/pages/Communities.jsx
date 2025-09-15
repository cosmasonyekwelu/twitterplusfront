import Sidebar from '../components/Sidebar'
import RightSidebar from '../components/RightSidebar'

export default function Communities(){
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 border-x border-neutral-800 max-w-2xl p-4">
        <h1 className="text-xl font-bold mb-2">Communities</h1>
        <p className="text-neutral-400">Build out communities feed and details here.</p>
      </main>
      <RightSidebar />
    </div>
  )
}
