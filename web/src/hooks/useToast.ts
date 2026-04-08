"use client"

import { useCallback, useSyncExternalStore } from "react"

type ToastVariant = "default" | "success" | "destructive"

interface Toast {
  id: string
  title: string
  description?: string
  variant: ToastVariant
}

interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
}

const TOAST_LIMIT = 3
const TOAST_DISMISS_MS = 3000

let toasts: readonly Toast[] = []
const listeners: Set<() => void> = new Set()
let counter = 0

function emitChange() {
  for (const listener of listeners) {
    listener()
  }
}

function addToast(input: ToastInput): string {
  const id = String(++counter)
  const next: Toast = {
    id,
    title: input.title,
    description: input.description,
    variant: input.variant ?? "default",
  }

  toasts = [next, ...toasts].slice(0, TOAST_LIMIT)
  emitChange()

  setTimeout(() => {
    dismissToast(id)
  }, TOAST_DISMISS_MS)

  return id
}

function dismissToast(id: string) {
  const prev = toasts
  toasts = prev.filter((t) => t.id !== id)
  if (toasts !== prev) {
    emitChange()
  }
}

function getSnapshot(): readonly Toast[] {
  return toasts
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function useToast() {
  const currentToasts = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const toast = useCallback((input: ToastInput) => addToast(input), [])
  const dismiss = useCallback((id: string) => dismissToast(id), [])

  return { toast, toasts: currentToasts, dismiss } as const
}

export { useToast }
export type { Toast, ToastInput, ToastVariant }
