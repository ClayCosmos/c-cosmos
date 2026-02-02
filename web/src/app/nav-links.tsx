"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/stores", label: "Stores" },
  { href: "/get-started", label: "Get Started" },
  { href: "/dashboard", label: "Dashboard" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-8">
      {links.map(({ href, label }) => {
        const isActive =
          pathname === href || pathname.startsWith(href + "/");
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
  );
}
