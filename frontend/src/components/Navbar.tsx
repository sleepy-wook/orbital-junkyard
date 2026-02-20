"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

const NAV_ITEMS = [
  { href: "/", labelKey: "nav.globe" },
  { href: "/dashboard", labelKey: "nav.dashboard" },
  { href: "/countries", labelKey: "nav.countries" },
  { href: "/constellations", labelKey: "nav.constellations" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { t, language, setLanguage } = useTranslation();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-card-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-accent">Orbital</span>
          <span className="text-foreground/80">Junkyard</span>
        </Link>

        <div className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-accent/20 text-accent"
                    : "text-foreground/60 hover:text-foreground hover:bg-card"
                }`}
              >
                {t(item.labelKey)}
              </Link>
            );
          })}

          <button
            onClick={() => setLanguage(language === "en" ? "ko" : "en")}
            className="ml-3 px-2.5 py-1.5 rounded-md text-xs font-bold border border-card-border hover:bg-card transition-colors"
            title={language === "en" ? "한국어로 전환" : "Switch to English"}
          >
            {language === "en" ? "KO" : "EN"}
          </button>
        </div>
      </div>
    </nav>
  );
}
