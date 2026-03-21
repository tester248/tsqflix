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
  const { name, original_name } = await tmdb.tv.detail({
    id: params.id,
  })

  const displayTitle = name || original_name || "Untitled"

  return (
    <div className="space-y-6">
      <MediaWatchProviders id={params.id} type="tv" />
      <ShowboxStreamPanel title={displayTitle} tmdbId={params.id} type="tv" />
    </div>
  )
}
