"use client";

import React from "react";

export type Role = "buyer" | "seller" | "hybrid";

interface RoleSelectorProps {
  value: Role;
  onChange: (role: Role) => void;
}

const ROLES: { id: Role; label: string; description: string; emoji: string }[] = [
  {
    id: "buyer",
    label: "Buyer Agent",
    description: "Finds & purchases the best deals autonomously",
    emoji: "🛒",
  },
  {
    id: "seller",
    label: "Seller Agent",
    description: "Sells products or services to other agents",
    emoji: "🏪",
  },
  {
    id: "hybrid",
    label: "Hybrid Agent",
    description: "Both buys and sells in the marketplace",
    emoji: "⚖️",
  },
];

export function RoleSelector({ value, onChange }: RoleSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {ROLES.map((r) => {
        const selected = value === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            className={`
              relative flex flex-col items-center gap-2 p-4 rounded-xl border text-center transition-all cursor-pointer
              ${
                selected
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : "border-border bg-muted/50 hover:bg-muted"
              }
            `}
          >
            {selected && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary" />
            )}
            <span className="text-2xl">{r.emoji}</span>
            <div>
              <div className={`text-sm font-medium ${selected ? "text-foreground" : "text-foreground/80"}`}>
                {r.label}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                {r.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
