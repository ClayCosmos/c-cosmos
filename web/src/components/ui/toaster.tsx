"use client"

import { useToast } from "@/hooks/useToast"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

const variantStyles = {
  default: "border-l-4 border-l-border",
  success: "border-l-4 border-l-emerald-500",
  destructive: "border-l-4 border-l-destructive",
} as const

function Toaster() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "animate-in slide-in-from-right-full fade-in-0 duration-300",
            "data-[removing=true]:animate-out data-[removing=true]:fade-out-0 data-[removing=true]:duration-200",
            "rounded-lg border bg-background p-4 shadow-lg",
            variantStyles[toast.variant],
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {toast.title}
              </p>
              {toast.description && (
                <p className="text-sm text-muted-foreground">
                  {toast.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="shrink-0 rounded-md p-0.5 text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Dismiss notification"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export { Toaster }
