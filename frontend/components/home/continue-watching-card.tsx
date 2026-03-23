"use client"

import React from "react"
import Link from "next/link"
import { WatchItem } from "@/store/use-app-store"
import { MediaCard } from "@/components/media/media-card"
import { MediaPoster } from "@/components/media/media-poster"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface ContinueWatchingCardProps {
  item: WatchItem
}

export const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({ item }) => {
  const { id, title, poster, type, timestamp, duration, season, episode, episodeTitle } = item
  
  // Calculate progress percentage
  const progress = duration > 0 ? (timestamp / duration) * 100 : 0
  
  // Construct the correct link
  const href = type === "tv" && season && episode 
    ? `/tv/${id}/seasons/${season}/episodes/${episode}`
    : `/movie/${id}/watch`

  return (
    <Link href={href} className="group block">
      <MediaCard.Root className="transition-transform duration-300 group-hover:scale-[1.02]">
        <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl border border-white/10 bg-zinc-900 shadow-lg">
          <MediaPoster image={poster} alt={title} className="transition-opacity group-hover:opacity-80" />
          
          {/* Progress Bar Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent pt-8">
            <Progress value={progress} className="h-1 bg-white/20" />
          </div>

          {/* TV Episode Badge */}
          {type === "tv" && season && episode && (
            <div className="absolute top-2 right-2 rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-lg">
              S{season} E{episode}
            </div>
          )}
        </div>

        <MediaCard.Content className="mt-2 text-left">
          <MediaCard.Title className="line-clamp-1">{title}</MediaCard.Title>
          <MediaCard.Excerpt className="line-clamp-1">
            {type === "tv" && episodeTitle ? `${episodeTitle}` : "Resume watching"}
          </MediaCard.Excerpt>
        </MediaCard.Content>
      </MediaCard.Root>
    </Link>
  )
}
