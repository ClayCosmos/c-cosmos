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
    <div className="grid grid-cols-3 gap-3">
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
                  ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500"
                  : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8"
              }
            `}
          >
            {selected && (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500" />
            )}
            <span className="text-2xl">{r.emoji}</span>
            <div>
              <div className={`text-sm font-medium ${selected ? "text-white" : "text-gray-300"}`}>
                {r.label}
              </div>
              <div className="text-xs text-gray-500 mt-0.5 leading-snug">
                {r.description}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
