import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

function CardSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-12 rounded-full" />
      </div>
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="flex gap-3 py-4">
      <Skeleton className="w-12 h-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  )
}

function PetCardSkeleton() {
  return (
    <div className="flex flex-col items-center gap-2 p-4 rounded-xl border">
      <Skeleton className="w-16 h-16 rounded-full" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-12" />
    </div>
  )
}

export { Skeleton, CardSkeleton, FeedSkeleton, PetCardSkeleton }
