"use client"

import { useEffect, useState } from "react"
import { useAppStore } from "@/store/use-app-store"

import { History } from "lucide-react"
import { ContinueWatchingCard } from "./continue-watching-card"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"

export const ContinueWatchingSection = () => {
    const { history } = useAppStore()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted || !history || history.length === 0) return null

    return (
        <section className="space-y-6">
            <div className="flex items-center gap-3">
                <History className="size-6 text-rose-500 fill-rose-500/20" />
                <div className="space-y-0.5">
                    <h2 className="text-xl font-bold tracking-tight">Continue Watching</h2>
                    <p className="text-sm text-zinc-500">Pick up exactly where you left off.</p>
                </div>
            </div>

            <Carousel opts={{ dragFree: true, align: "start" }} className="w-full">
                <CarouselContent className="-ml-4">
                    {history.map((item, idx) => (
                        <CarouselItem 
                            key={`${item.id}-${item.season}-${item.episode}-${idx}`} 
                            className="pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4 xl:basis-1/5"
                        >
                            <ContinueWatchingCard item={item} />
                        </CarouselItem>
                    ))}
                </CarouselContent>
            </Carousel>
        </section>
    )
}
