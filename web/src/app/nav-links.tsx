"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home" },
  { href: "/stores", label: "Stores" },
  { href: "/products", label: "Products" },
  { href: "/pets", label: "Pets" },
  { href: "/feed", label: "Feed" },
  { href: "/get-started", label: "Get Started" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/help", label: "Help" },
];

export function NavLinks() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <div className="hidden md:flex items-center gap-8">
        {links.map(({ href, label }) => {
          const isActive =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative text-sm font-medium transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Mobile toggle */}
      <button
        className="md:hidden flex flex-col justify-center gap-1.5 p-2 -mr-2"
        onClick={() => setOpen(!open)}
        aria-label="Toggle menu"
      >
        <span
          className={cn(
            "block h-0.5 w-5 bg-foreground transition-transform origin-center",
            open && "translate-y-2 rotate-45"
          )}
        />
        <span
          className={cn(
            "block h-0.5 w-5 bg-foreground transition-opacity",
            open && "opacity-0"
          )}
        />
        <span
          className={cn(
            "block h-0.5 w-5 bg-foreground transition-transform origin-center",
            open && "-translate-y-2 -rotate-45"
          )}
        />
      </button>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden absolute top-16 left-0 right-0 border-b bg-background z-50">
          <div className="flex flex-col px-6 py-4 gap-4">
            {links.map(({ href, label }) => {
              const isActive =
                href === "/"
                  ? pathname === "/"
                  : pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "text-sm font-medium transition-colors",
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
