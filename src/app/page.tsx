import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Cloud,
  HardDrive,
  LifeBuoy,
  RefreshCw,
  Shield,
} from "lucide-react";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingChatAssistant } from "@/components/marketing/MarketingChatAssistant";
import { PortalLoginMenu } from "@/components/marketing/PortalLoginMenu";

const SERVICES = [
  {
    title: "Hardware Procurement & Lifecycle",
    problem: "Buy, deploy, warranty-track, and retire devices on a predictable schedule.",
    includes: "Laptops, servers, network gear, imaging, refresh planning",
    icon: HardDrive,
  },
  {
    title: "Software & Cloud Management",
    problem: "Keep Microsoft 365, identity, and cloud workspaces configured and supported.",
    includes: "License admin, mailbox support, identity hygiene",
    icon: Cloud,
  },
  {
    title: "Managed IT Support",
    problem: "Give employees a reliable service desk with clear SLA visibility.",
    includes: "Ticketing, remote support, escalation, billable overage tracking",
    icon: LifeBuoy,
  },
  {
    title: "Cybersecurity Monitoring",
    problem: "See endpoint, patch, backup, and firewall risk before it becomes an outage.",
    includes: "Alert triage, recommended remediations",
    icon: Shield,
  },
  {
    title: "AI Governance",
    problem: "Govern existing AI platforms for cost, policy, and risk — without building a chatbot.",
    includes: "Platform inventory, policies, compliance, unused-license insights",
    icon: Brain,
  },
  {
    title: "Deployment & Retirement",
    problem: "Run rollouts and end-of-life retirements without losing asset control.",
    includes: "Staging, deployment days, data wipe, retirement records",
    icon: RefreshCw,
  },
] as const;

const LIFECYCLE = [
  "Customer need",
  "Proposed solution",
  "Contract",
  "Order & deploy",
  "Manage & support",
  "Bill & renew",
] as const;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      <MarketingHeader />

      {/* Hero — full-bleed visual plane */}
      <section className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden">
        <div className="nexus-hero-flow absolute inset-0 bg-[#0B1220]" aria-hidden="true">
          <div
            className="nexus-hero-flow__layer"
            style={{ backgroundImage: "url('/brand/nexus-hero-bg.png')" }}
          />
          <div
            className="nexus-hero-flow__layer nexus-hero-flow__layer--drift"
            style={{ backgroundImage: "url('/brand/nexus-hero-bg.png')" }}
          />
        </div>
        <div className="absolute inset-0 bg-[#0B1220]/45" aria-hidden="true" />
        <div
          className="absolute inset-0 bg-gradient-to-r from-[#0B1220]/75 via-[#0B1220]/35 to-transparent"
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-4 py-16 lg:px-8">
          <p className="font-display mb-4 text-sm uppercase tracking-[0.28em] text-[#5EEAD4]/90">
            Nexus Technology Solutions
          </p>
          <h1 className="font-display max-w-3xl text-4xl tracking-tight text-white sm:text-5xl lg:text-6xl">
            Technology that runs the business — managed end to end.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-slate-200">
            Plan, purchase, deploy, protect, support, and renew hardware,
            software, cloud, and AI platforms in one connected operations
            platform.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#services" className="btn btn-primary gap-2">
              Explore services
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
            <div className="sm:hidden">
              <PortalLoginMenu />
            </div>
            <span className="hidden text-sm text-slate-300 sm:inline">
              Or use Portal in the top-right to enter as Manager, Technician, or
              Client User.
            </span>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="scroll-mt-20 border-t border-base-300 bg-base-200 px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl tracking-tight">Products & services</h2>
          <p className="mt-3 max-w-2xl text-base-content/70">
            Nexus sells and manages technology services — not just products —
            so customers know what is included, what it costs, and how work gets
            delivered.
          </p>
          <div className="mt-10 grid gap-6 overflow-visible sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.title}
                  className="nexus-hover-card rounded-box border border-white/10 p-5 shadow-lg"
                >
                  <div
                    className="nexus-hover-card__bg"
                    style={{ backgroundImage: "url('/brand/nexus-section-bg.png')" }}
                    aria-hidden="true"
                  />
                  <div
                    className="absolute inset-0 bg-[#0B1220]/80"
                    aria-hidden="true"
                  />
                  <div className="relative z-10 flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-box border border-white/15 bg-white/10 text-[#5EEAD4] backdrop-blur-sm">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display-italic text-base leading-snug sm:text-lg">
                        {service.title}
                      </h3>
                      <p className="mt-2 text-sm font-medium text-white/95">
                        {service.problem}
                      </p>
                      <p className="mt-3 text-xs font-bold uppercase tracking-wide text-[#5EEAD4]">
                        What&apos;s included
                      </p>
                      <p className="mt-1 text-sm font-medium text-white/90">
                        {service.includes}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Lifecycle */}
      <section className="border-t border-base-300 px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl tracking-tight">How Nexus works</h2>
          <p className="mt-3 max-w-2xl text-base-content/70">
            One connected lifecycle from the first customer need through renewal
            or asset retirement.
          </p>
          <ol className="mt-10 grid gap-3 overflow-visible sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {LIFECYCLE.map((step, index) => (
              <li
                key={step}
                className="nexus-hover-card rounded-box border border-white/10 p-4 text-left shadow-lg"
              >
                <div
                  className="nexus-hover-card__bg"
                  style={{ backgroundImage: "url('/brand/nexus-section-bg.png')" }}
                  aria-hidden="true"
                />
                <div className="absolute inset-0 bg-[#0B1220]/80" aria-hidden="true" />
                <div className="relative z-10 flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-box border border-white/15 bg-white/10 text-xs font-bold text-[#5EEAD4]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="font-display-italic pt-2 text-sm leading-snug">
                    {step}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why Nexus */}
      <section className="border-t border-base-300 bg-base-200 px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-display text-3xl tracking-tight">Why businesses choose Nexus</h2>
          <p className="mt-3 max-w-2xl text-base-content/70">
            Leadership, service delivery, technicians, billing, and client users
            each see the views they need — with profitability and risk in the
            same system.
          </p>
          <div className="mt-10 grid gap-6 overflow-visible md:grid-cols-3">
            {(
              [
                {
                  title: "Operations clarity",
                  body: "Tickets, SLA status, deployments, and technician workload in one console for service managers.",
                  icon: LifeBuoy,
                },
                {
                  title: "AI & cyber oversight",
                  body: "Simulated monitoring for enterprise AI platforms and security posture — policies, risks, and recommendations without live AI APIs.",
                  icon: Shield,
                },
                {
                  title: "Profitability visibility",
                  body: "Contract fees, labor costs, invoices, and margins so teams can see whether each customer and service is profitable.",
                  icon: Brain,
                },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="nexus-hover-card rounded-box border border-white/10 p-5 shadow-lg"
                >
                  <div
                    className="nexus-hover-card__bg"
                    style={{ backgroundImage: "url('/brand/nexus-section-bg.png')" }}
                    aria-hidden="true"
                  />
                  <div className="absolute inset-0 bg-[#0B1220]/80" aria-hidden="true" />
                  <div className="relative z-10 flex items-start gap-4">
                    <div className="flex size-12 shrink-0 items-center justify-center rounded-box border border-white/15 bg-white/10 text-[#5EEAD4] backdrop-blur-sm">
                      <Icon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display-italic text-base leading-snug sm:text-lg">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm font-medium text-white/95">{item.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-base-300 px-4 py-16 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-box border border-base-300 bg-base-100 p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Enter the operations platform</h2>
            <p className="mt-2 max-w-xl text-base-content/70">
              Use the Portal menu for a one-click demo as Manager, Technician, or
              Client User — or sign in with email for other roles.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PortalLoginMenu />
            <Link href="/login" className="btn btn-outline">
              Email login
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-base-300 bg-base-200 px-4 py-10 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 text-sm text-base-content/70 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="font-semibold text-base-content">
              Nexus Technology Solutions
            </p>
            <p className="mt-1">
              Fictional mid-sized technology solutions & managed-services
              provider for coursework demos.
            </p>
          </div>
          <div>
            <p>100 Nexus Parkway, Suite 400</p>
            <p>Columbus, OH 43215</p>
            <p>hello@nexus-demo.example · (555) 014-6280</p>
          </div>
        </div>
      </footer>

      <MarketingChatAssistant />
    </div>
  );
}
