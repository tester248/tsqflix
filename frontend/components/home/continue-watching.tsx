"use client"

import { useEffect, useState } from "react"
import { useAppStore } from "@/store/use-app-store"
import { TrendCarousel } from "@/components/trend/trend-carousel"
import { History } from "lucide-react"

export const ContinueWatchingSection = () => {
    const { history } = useAppStore()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !history || history.length === 0) return null

    // Map history to the format TrendCarousel expects
    const carouselItems = history.map(item => ({
        id: parseInt(item.id),
        title: item.title,
        poster_path: item.poster,
        media_type: item.type,
        release_date: "", // Not needed for carousel but type requires it
        vote_average: 0
    }))

    return (
        <TrendCarousel
            type="movie" // This acts as a generic type for the carousel logic
            title="Continue Watching"
            description="Jump back into your recently watched titles."
            icon={<History className="size-6 text-rose-500" />}
            link="/library"
            items={carouselItems as any}
        />
    )
}
