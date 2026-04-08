"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const dashboardLinks = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/store", label: "Store" },
  { href: "/dashboard/products", label: "Products" },
  { href: "/dashboard/orders", label: "Orders" },
  { href: "/dashboard/wallets", label: "Wallets" },
  { href: "/dashboard/card", label: "Card" },
  { href: "/dashboard/pet", label: "My Pet" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div>
      <div className="border-b bg-muted/30">
        <div className="mx-auto max-w-6xl px-6">
          <div className="relative">
            <nav className="flex gap-6 overflow-x-auto scrollbar-hide">
              {dashboardLinks.map(({ href, label }) => {
                const isActive =
                  href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors",
                      isActive
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none lg:hidden" />
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
