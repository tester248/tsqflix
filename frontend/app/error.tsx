'use client'

import { useEffect } from 'react'
import { RefreshCcw, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Automatically try to reset/retry after 10 seconds - DISABLED to prevent request spikes
    /*
    const timer = setTimeout(() => {
       reset()
    }, 10000)
    return () => clearTimeout(timer)
    */
  }, [reset])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center bg-zinc-950">
      <div className="relative mb-8">
        <div className="absolute inset-0 size-16 scale-150 animate-pulse rounded-full bg-rose-500/20 blur-2xl" />
        <WifiOff className="size-16 text-rose-500 relative z-10" />
      </div>
      
      <h2 className="text-3xl font-bold uppercase tracking-widest text-white mb-2">Connection Interrupted</h2>
      <p className="max-w-md text-zinc-400 mb-8 font-medium">
        TMDB or your local network is taking a moment to respond. We are automatically retrying to bring your content back online.
      </p>

      <div className="flex items-center gap-4">
        <Button
          variant="default"
          onClick={() => reset()}
          className="rounded-xl px-8 h-12 font-bold uppercase tracking-widest gap-2 bg-rose-600 hover:bg-rose-500"
        >
          <RefreshCcw className="size-4 animate-spin" />
          Retry Now
        </Button>
      </div>

      <p className="mt-8 text-[10px] text-zinc-600 font-mono">
        Error Log: {error.message}
      </p>
    </div>
  )
}
