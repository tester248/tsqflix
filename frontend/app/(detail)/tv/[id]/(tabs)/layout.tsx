import Link from "next/link"
import { notFound } from "next/navigation"
import { pages, siteConfig } from "@/config"
import { tmdb } from "@/tmdb/api"
import { WithVideos } from "@/tmdb/api/types"
import { format } from "@/tmdb/utils"

import { Tabs, TabsLink, TabsList } from "@/components/ui/tabs"
import { MediaBackdrop } from "@/components/media/media-backdrop"
import { MediaDetailView } from "@/components/media/media-detail-view"
import { MediaPoster } from "@/components/media/media-poster"
import { MediaRating } from "@/components/media/media-rating"
import { MediaTrailerDialog } from "@/components/media/media-trailer-dialog"
import { ScrollFixer } from "@/components/shared/scroll-fixer"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Play } from "lucide-react"

interface DetailLayoutProps {
  params: {
    id: string
  }
  children: React.ReactNode
}

export async function generateMetadata({ params }: DetailLayoutProps) {
  const { name } = await tmdb.tv.detail({
    id: params.id,
  })

  return {
    title: {
      default: name,
      template: `%s - ${name} - ${siteConfig.name}`,
    },
  }
}

export default async function DetailLayout({
  params,
  children,
}: DetailLayoutProps) {
  const {
    id,
    adult,
    name,
    overview,
    backdrop_path,
    poster_path,
    genres,
    vote_average,
    vote_count,
    tagline,
    videos,
  } = await tmdb.tv.detail<WithVideos>({
    id: params.id,
    append: "videos",
  })

  if (!id || adult) return notFound()

  return (
    <MediaDetailView.Root>
      <ScrollFixer />

      <MediaDetailView.Backdrop>
        <MediaBackdrop image={backdrop_path} alt={name} priority />
      </MediaDetailView.Backdrop>

      <MediaDetailView.Hero>
        <MediaDetailView.Poster>
          <MediaPoster image={poster_path} alt={name} size="w780" priority />
        </MediaDetailView.Poster>

        <div className="space-y-4">
          <MediaDetailView.Genres>
            <MediaRating average={vote_average} count={vote_count} />
            {genres?.map((genre) => (
              <Link
                key={genre.id}
                href={`${pages.tv.discover.link}?with_genres=${genre.id}`}
              >
                <MediaDetailView.Genre>{genre.name}</MediaDetailView.Genre>
              </Link>
            ))}
          </MediaDetailView.Genres>

          <MediaDetailView.Title>{name}</MediaDetailView.Title>

          {tagline && (
            <MediaDetailView.Overview>
              &quot;{tagline}&quot;
            </MediaDetailView.Overview>
          )}

          <MediaDetailView.Overview
            dangerouslySetInnerHTML={{ __html: format.content(overview) }}
          />

          <div className="flex gap-4 items-center">
            <Link
              href={`${pages.tv.root.link}/${id}/seasons/1/episodes/1`}
              className={cn(buttonVariants({ variant: "default" }), "gap-2")}
            >
              <Play className="size-4 fill-current" />
              <span>Start Watching</span>
            </Link>
            <MediaTrailerDialog videos={videos?.results} />
          </div>
        </div>
      </MediaDetailView.Hero>

      <MediaDetailView.Content>
        <Tabs className="mt-8 lg:mt-12" defaultValue="seasons">
          <div className="max-w-screen scrollbar-hidden -mx-8 overflow-x-scroll px-8 lg:m-0 lg:p-0">
            <TabsList>
              <TabsLink href={`${pages.tv.root.link}/${id}/seasons`}>
                Seasons
              </TabsLink>
              <TabsLink href={`${pages.tv.root.link}/${id}`}>Overview</TabsLink>
              <TabsLink
                className="gap-2"
                href={`${pages.tv.root.link}/${id}/credits`}
              >
                Credits
              </TabsLink>
              <TabsLink href={`${pages.tv.root.link}/${id}/reviews`}>
                Reviews
              </TabsLink>
              <TabsLink href={`${pages.tv.root.link}/${id}/images`}>
                Images
              </TabsLink>
              <TabsLink href={`${pages.tv.root.link}/${id}/videos`}>
                Videos
              </TabsLink>
              <TabsLink href={`${pages.tv.root.link}/${id}/recommendations`}>
                Recommendations
              </TabsLink>
              <TabsLink href={`${pages.tv.root.link}/${id}/similar`}>
                Similar
              </TabsLink>
            </TabsList>
          </div>
        </Tabs>
        <div className="mt-4">{children}</div>
      </MediaDetailView.Content>
    </MediaDetailView.Root>
  )
}
