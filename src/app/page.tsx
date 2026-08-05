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
    includes: "Health scores, alert triage, recommended remediations",
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
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950" />
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.4) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
        <div className="absolute -left-20 top-24 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] rounded-full bg-sky-600/15 blur-3xl" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(ellipse at 70% 40%, rgba(8,145,178,0.35), transparent 55%), url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2394a3b8' fill-opacity='0.15'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
        />

        <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-4 py-16 lg:px-8">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200/90">
            Nexus Technology Solutions
          </p>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
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
          <h2 className="text-3xl font-bold tracking-tight">Products & services</h2>
          <p className="mt-3 max-w-2xl text-base-content/70">
            Nexus sells and manages technology services — not just products —
            so customers know what is included, what it costs, and how work gets
            delivered.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => {
              const Icon = service.icon;
              return (
                <article
                  key={service.title}
                  className="rounded-box border border-base-300 bg-base-100 p-6 shadow-sm"
                >
                  <div className="mb-4 flex size-11 items-center justify-center rounded-box bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold">{service.title}</h3>
                  <p className="mt-2 text-sm text-base-content/70">{service.problem}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-base-content/50">
                    What&apos;s included
                  </p>
                  <p className="mt-1 text-sm">{service.includes}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Lifecycle */}
      <section className="border-t border-base-300 px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold tracking-tight">How Nexus works</h2>
          <p className="mt-3 max-w-2xl text-base-content/70">
            One connected lifecycle from the first customer need through renewal
            or asset retirement.
          </p>
          <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {LIFECYCLE.map((step, index) => (
              <li
                key={step}
                className="rounded-box border border-base-300 bg-base-100 p-4 text-center"
              >
                <span className="text-xs font-bold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-2 text-sm font-semibold">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why Nexus */}
      <section className="border-t border-base-300 bg-base-200 px-4 py-16 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold tracking-tight">Why businesses choose Nexus</h2>
          <p className="mt-3 max-w-2xl text-base-content/70">
            Leadership, service delivery, technicians, billing, and client users
            each see the views they need — with profitability and risk in the
            same system.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <div className="rounded-box border border-base-300 bg-base-100 p-6">
              <h3 className="font-semibold">Operations clarity</h3>
              <p className="mt-2 text-sm text-base-content/70">
                Tickets, SLA status, deployments, and technician workload in one
                console for service managers.
              </p>
            </div>
            <div className="rounded-box border border-base-300 bg-base-100 p-6">
              <h3 className="font-semibold">AI & cyber oversight</h3>
              <p className="mt-2 text-sm text-base-content/70">
                Simulated monitoring for enterprise AI platforms and security
                posture — policies, risks, and recommendations without live AI
                APIs.
              </p>
            </div>
            <div className="rounded-box border border-base-300 bg-base-100 p-6">
              <h3 className="font-semibold">Profitability visibility</h3>
              <p className="mt-2 text-sm text-base-content/70">
                Contract fees, labor costs, invoices, and margins so teams can
                see whether each customer and service is profitable.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-base-300 px-4 py-16 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 rounded-box border border-base-300 bg-base-100 p-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Enter the operations platform</h2>
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
