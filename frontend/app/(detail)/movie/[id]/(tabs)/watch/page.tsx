import { MediaWatchProviders } from "@/components/media/media-watch-providers"
import { ShowboxStreamPanel } from "@/components/showbox/showbox-stream-panel"
import { tmdb } from "@/tmdb/api"

interface DetailWatchProps {
  params: {
    id: string
  }
}

export const metadata = {
  title: "Watch",
}

export default async function DetailWatch({ params }: DetailWatchProps) {
  const { title, original_title } = await tmdb.movie.detail({
    id: params.id,
  })

  const displayTitle = title || original_title || "Untitled"

  return (
    <div className="space-y-6">
      <MediaWatchProviders id={params.id} type="movie" />
      <ShowboxStreamPanel title={displayTitle} tmdbId={params.id} type="movie" />
    </div>
  )
}
