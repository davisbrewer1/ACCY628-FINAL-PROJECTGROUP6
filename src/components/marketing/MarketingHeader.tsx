"use client";

import Link from "next/link";
import { NexusLogo } from "@/components/brand/NexusLogo";
import { PortalLoginMenu } from "@/components/marketing/PortalLoginMenu";

export function MarketingHeader() {
  return (
    <header className="navbar sticky top-0 z-30 border-b border-base-300/60 bg-base-100/85 px-4 backdrop-blur-md lg:px-8">
      <div className="flex-1">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="Nexus Technology Solutions home"
        >
          <NexusLogo size="lg" decorative />
          <span className="font-display hidden text-sm leading-tight sm:block">
            Nexus Technology Solutions
          </span>
        </Link>
      </div>
      <div className="flex flex-none items-center gap-2 sm:gap-3">
        <a href="#services" className="btn btn-ghost btn-sm hidden sm:inline-flex">
          Services
        </a>
        <PortalLoginMenu />
      </div>
    </header>
  );
}
