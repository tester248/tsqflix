"use client"

import dynamic from "next/dynamic"

interface VideoPlayerProps {
  url: string
  title?: string
  poster?: string
}

const ReactPlayer = dynamic(() => import("react-player/lazy"), {
  ssr: false,
})

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ url, title, poster }) => {
  if (!url) return null

  return (
    <div className="overflow-hidden rounded-2xl border bg-black">
      <ReactPlayer
        url={url}
        controls
        width="100%"
        height="100%"
        playing={false}
        config={{ file: { attributes: { poster } } }}
      />
      {title && (
        <p className="px-4 py-2 text-sm text-muted-foreground">Playing {title}</p>
      )}
    </div>
  )
}