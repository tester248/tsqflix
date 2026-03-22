import { notFound } from "next/navigation"
import { tmdb } from "@/tmdb/api"
import { WithCredits, WithImages, WithVideos } from "@/tmdb/api/types"
import { format } from "@/tmdb/utils"

import { pad } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { MediaDetailView } from "@/components/media/media-detail-view"
import { MediaRating } from "@/components/media/media-rating"
import { TvEpisodeDetails } from "@/components/tv/tv-episode-details"
import { TvEpisodeNavigation } from "@/components/tv/tv-episode-navigation"
import { TvSeasonBreadcrumb } from "@/components/tv/tv-season-breadcrumb"
import { ShowboxStreamPanel } from "@/components/showbox/showbox-stream-panel"

interface DetailEpisodeProps {
  params: {
    id: string
    season: string
    episode: string
  }
}

export async function generateMetadata({ params }: DetailEpisodeProps) {
  const show = await tmdb.tv.detail({
    id: params.id,
  })

  const season = await tmdb.tvSeasons.details({
    id: params.id,
    season: Number(params.season),
  })

  const episode = await tmdb.tvEpisodes.details({
    id: params.id,
    season: Number(params.season),
    episode: Number(params.episode),
  })

  return {
    title: `${episode.name} - ${season.name} - ${show.name}`,
  }
}

export default async function DetailEpisode({
  params: { id, season: seasonNum, episode: episodeNum },
}: DetailEpisodeProps) {
  const season = Number(seasonNum)
  const episode = Number(episodeNum)

  const showDetails = await tmdb.tv.detail({
    id: id,
  })

  const seasonDetails = await tmdb.tvSeasons.details({
    id,
    season,
  })

  const episodeDetails = await tmdb.tvEpisodes.details<
    WithCredits & WithImages & WithVideos
  >({
    id,
    season,
    episode,
    append: "credits,images,videos",
  })

  if (!id) return notFound()

  return (
    <MediaDetailView.Root>
      <div className="container mb-8">
         <ShowboxStreamPanel 
           title={showDetails.name} 
           tmdbId={id} 
           type="tv" 
           season={season} 
           episode={episode} 
         />
      </div>

      <MediaDetailView.Hero>
        <div className="space-y-4 self-end">
          <TvSeasonBreadcrumb
            id={id}
            showDetails={showDetails}
            season={season}
            seasonDetails={seasonDetails}
            episodeDetails={episodeDetails}
          />

          <MediaDetailView.Genres className="items-center">
            <MediaRating
              average={episodeDetails.vote_average}
              count={episodeDetails.vote_count}
            />

            <Badge variant="outline">
              {format.date(episodeDetails.air_date)}
            </Badge>
          </MediaDetailView.Genres>

          <MediaDetailView.Title>
            {pad(episodeDetails.episode_number)}. {episodeDetails.name}
          </MediaDetailView.Title>

          <MediaDetailView.Overview
            dangerouslySetInnerHTML={{
              __html: format.content(episodeDetails.overview),
            }}
          />
        </div>
      </MediaDetailView.Hero>

      <MediaDetailView.Content className="space-y-4">
        <TvEpisodeDetails id={id} season={season} episode={episode} />
        <TvEpisodeNavigation
          id={id}
          season={season}
          episode={episode}
          episodes={seasonDetails.episodes}
        />
      </MediaDetailView.Content>
    </MediaDetailView.Root>
  )
}
