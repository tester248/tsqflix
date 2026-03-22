import { Play } from "lucide-react"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { ShowboxStreamPanel } from "@/components/showbox/showbox-stream-panel"

interface MediaPlayDialogProps {
  id: string
  title: string
  type: "movie" | "tv"
}

export const MediaPlayDialog: React.FC<MediaPlayDialogProps> = ({
  id,
  title,
  type,
}) => {
  return (
    <Dialog modal>
      <DialogTrigger className={cn(buttonVariants({ variant: "default" }))}>
        <Play className="mr-2 size-4" /> Play Movie
      </DialogTrigger>

      <DialogContent className="max-w-screen-xl bg-black rounded-xl p-0 overflow-hidden border-none max-h-[90vh] overflow-y-auto">
        <ShowboxStreamPanel title={title} tmdbId={id} type={type} />
      </DialogContent>
    </Dialog>
  )
}
