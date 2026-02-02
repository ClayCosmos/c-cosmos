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
    <div className="flex items-center gap-1">
      {links.map(({ href, label }) => {
        const isActive =
          pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "relative rounded-sm px-2.5 py-1 text-[13px] font-medium transition-colors",
              isActive
                ? "text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            {isActive && (
              <span className="absolute inset-x-0 -bottom-[7px] h-0.5 bg-primary" />
            )}
          </Link>
        );
      })}
    </div>
  );
}
