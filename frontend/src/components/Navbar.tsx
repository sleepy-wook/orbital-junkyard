"use client";

import { useState } from "react";
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
  const [open, setOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-card-border">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-accent">Orbital</span>
          <span className="text-foreground/80">Junkyard</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
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

        {/* Mobile: language toggle + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <button
            onClick={() => setLanguage(language === "en" ? "ko" : "en")}
            className="px-2.5 py-1.5 rounded-md text-xs font-bold border border-card-border hover:bg-card transition-colors"
          >
            {language === "en" ? "KO" : "EN"}
          </button>
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-2 rounded-md hover:bg-card transition-colors"
            aria-label="Toggle menu"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" className="text-foreground/70">
              {open ? (
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden border-t border-card-border bg-background/95 backdrop-blur-md">
          <div className="px-4 py-3 flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`px-3 py-2.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-accent/20 text-accent"
                      : "text-foreground/60 hover:text-foreground hover:bg-card"
                  }`}
                >
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
