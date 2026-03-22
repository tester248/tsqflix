"use client"

import Link from "next/link"
import { Bookmark, Clock, Play, Trash2 } from "lucide-react"
import { useAppStore } from "@/store/use-app-store"
import { MediaPoster } from "@/components/media/media-poster"
import { pages } from "@/config"

export default function LibraryPage() {
  const { history, bookmarks, removeHistory, removeBookmark } = useAppStore()

  return (
    <div className="container py-8 space-y-12">
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Clock className="size-6 text-rose-500" />
          <h2 className="text-2xl font-bold uppercase tracking-widest">Continue Watching</h2>
        </div>
        
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 rounded-3xl border border-dashed text-zinc-500">
            <p className="text-sm">Movies you watch will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {history.map((item: any) => (
              <div key={item.id} className="group relative space-y-2">
                <Link href={`${(pages as any)[item.type].root.link}/${item.id}`}>
                  <div className="aspect-poster overflow-hidden rounded-xl bg-zinc-900 shadow-xl transition-transform duration-300 group-hover:scale-95 ring-1 ring-white/10">
                    <MediaPoster image={item.poster} alt={item.title} size="w342" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 bg-black/40 backdrop-blur-sm">
                      <Play className="size-10 text-white fill-white" />
                    </div>
                  </div>
                </Link>
                <div className="flex justify-between items-start">
                   <div className="min-w-0 flex-1 pr-2">
                      <p className="line-clamp-1 text-sm font-bold">{item.title}</p>
                      <p className="text-[10px] text-rose-500 font-bold uppercase">{item.type}</p>
                   </div>
                   <button 
                     onClick={() => removeHistory(item.id)}
                     className="text-zinc-600 hover:text-rose-500 transition-colors"
                   >
                     <Trash2 className="size-3.5" />
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <Bookmark className="size-6 text-emerald-500 fill-emerald-500" />
          <h2 className="text-2xl font-bold uppercase tracking-widest">My List</h2>
        </div>
        
        {bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 rounded-3xl border border-dashed text-zinc-500">
             <p className="text-sm">Your bookmarked titles will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {bookmarks.map((item: any) => (
              <div key={item.id} className="group relative space-y-2">
                <Link href={`${(pages as any)[item.type].root.link}/${item.id}`}>
                  <div className="aspect-poster overflow-hidden rounded-xl bg-zinc-900 shadow-xl transition-transform duration-300 group-hover:scale-95 ring-1 ring-white/10">
                    <MediaPoster image={item.poster} alt={item.title} size="w342" />
                  </div>
                </Link>
                <div className="flex justify-between items-start">
                   <div className="min-w-0 flex-1 pr-2">
                      <p className="line-clamp-1 text-sm font-bold">{item.title}</p>
                      <p className="text-[10px] text-emerald-500 font-bold uppercase">{item.type}</p>
                   </div>
                   <button 
                     onClick={() => removeBookmark(item.id)}
                     className="text-zinc-600 hover:text-emerald-500 transition-colors"
                   >
                     <Trash2 className="size-3.5" />
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
