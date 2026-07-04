import Link from "next/link";
import type { Intent, Outcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type IconProps = { className?: string };

function LogoMark({ className = "h-8 w-8" }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={className}>
      <rect width="32" height="32" rx="10" fill="currentColor" />
      <path
        d="M20.8 10.7a7 7 0 1 0 0 10.6M12.7 16h7.8"
        stroke="#03110D"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PhoneIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M7.2 3.5 9.4 8l-2.1 1.7a15.3 15.3 0 0 0 7 7l1.7-2.1 4.5 2.2-.8 3.2c-.2.8-.9 1.4-1.8 1.4C9.5 21.4 2.6 14.5 2.6 6c0-.8.6-1.6 1.4-1.8l3.2-.7Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M7 3v3m10-3v3M4.5 9h15M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChartIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M5 19V9m7 10V5m7 14v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CurrencyIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 3v18m4-14.5c-.8-.9-2-1.5-4-1.5-2.2 0-4 1.2-4 3s1.5 2.6 4 3c2.5.4 4 1.2 4 3s-1.8 3-4 3c-2 0-3.5-.6-4.5-1.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="m19.4 15 .1 2.1-2.4 2.4-2.1-.1-1.5 1.5h-3L9 19.4l-2.1.1-2.4-2.4.1-2.1L3.1 13.5v-3L4.6 9l-.1-2.1 2.4-2.4L9 4.6l1.5-1.5h3L15 4.6l2.1-.1 2.4 2.4-.1 2.1 1.5 1.5v3L19.4 15Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M5 12h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatPhone(value: string | null) {
  if (!value) return "Not connected";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return value;
}

function label(value: Intent | Outcome | null) {
  return value ? value.replaceAll("_", " ").toLowerCase() : "pending";
}

function outcomeClass(outcome: Outcome | null) {
  if (outcome === "BOOKED") return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  if (outcome === "TRANSFERRED") return "border-sky-400/20 bg-sky-400/10 text-sky-300";
  return "border-slate-700 bg-slate-800 text-slate-300";
}

export default async function DashboardPage() {
  const business = await prisma.business.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!business) {
    return (
      <main className="grid min-h-screen place-items-center px-5">
        <section className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-2xl shadow-black/30">
          <LogoMark className="h-10 w-10 text-emerald-400" />
          <h1 className="mt-6 text-2xl font-semibold">No business is provisioned yet</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Create the first business through the protected provisioning API, then refresh this page.</p>
        </section>
      </main>
    );
  }

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60_000);

  const [callsToday, callsThisWeek, bookedThisWeek, pipeline, recentCalls, upcomingBookings] =
    await Promise.all([
      prisma.call.count({ where: { businessId: business.id, startedAt: { gte: startOfToday } } }),
      prisma.call.count({ where: { businessId: business.id, startedAt: { gte: sevenDaysAgo } } }),
      prisma.call.count({ where: { businessId: business.id, startedAt: { gte: sevenDaysAgo }, outcome: "BOOKED" } }),
      prisma.call.aggregate({ where: { businessId: business.id, startedAt: { gte: sevenDaysAgo } }, _sum: { jobValueEstimate: true } }),
      prisma.call.findMany({ where: { businessId: business.id }, orderBy: { startedAt: "desc" }, take: 8 }),
      prisma.booking.findMany({ where: { businessId: business.id, scheduledAt: { gte: now } }, orderBy: { scheduledAt: "asc" }, take: 6 }),
    ]);

  const conversion = callsThisWeek > 0 ? Math.round((bookedThisWeek / callsThisWeek) * 100) : 0;
  const calendarConfig =
    typeof business.calendarConfig === "object" && business.calendarConfig !== null
      ? business.calendarConfig as Record<string, unknown>
      : {};
  const calendarConnected =
    typeof calendarConfig.refreshToken === "string" &&
    calendarConfig.refreshToken !== "mock_refresh";
  const retellConnected =
    Boolean(business.retellAgentId) &&
    !business.retellAgentId?.includes("_mock_");
  const statusLive = business.status === "ACTIVE" && retellConnected;

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  const metrics = [
    { title: "Calls today", value: callsToday.toString(), detail: `${callsThisWeek} this week`, icon: <PhoneIcon /> },
    { title: "Jobs booked", value: bookedThisWeek.toString(), detail: "Last 7 days", icon: <CalendarIcon /> },
    { title: "Booking rate", value: `${conversion}%`, detail: "Call conversion", icon: <ChartIcon /> },
    { title: "Pipeline", value: money.format(pipeline._sum.jobValueEstimate ?? 0), detail: "Estimated value", icon: <CurrencyIcon /> },
  ];

  return (
    <main className="min-h-screen bg-[#070b14] text-slate-100">
      <header className="border-b border-white/[0.07] bg-[#0a0f1b]/95">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-9 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold tracking-tight text-white">CallCatch</p>
              <p className="text-[11px] text-slate-500">Owner dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`hidden items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium sm:inline-flex ${statusLive ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300" : "border-amber-400/20 bg-amber-400/[0.08] text-amber-300"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusLive ? "bg-emerald-400" : "bg-amber-400"}`} />
              {statusLive ? "System operational" : "Needs attention"}
            </span>
            <Link href="/dashboard/settings" aria-label="Open settings" className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-slate-700/80 bg-slate-800/70 text-slate-300 transition-colors duration-200 hover:border-slate-600 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <SettingsIcon />
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-emerald-400">Business overview</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">{business.name}</h1>
            <p className="mt-1 text-sm text-slate-400">
              {now.toLocaleDateString("en-US", { timeZone: business.timezone, weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Answering calls on <span className="font-medium text-slate-200">{formatPhone(business.phoneNumber)}</span>
          </div>
        </section>

        <section aria-label="Performance summary" className="mt-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <article key={metric.title} className="rounded-2xl border border-white/[0.07] bg-[#0d1321] p-4 shadow-sm shadow-black/20 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-xs font-medium text-slate-400 sm:text-sm">{metric.title}</p>
                <span className="text-emerald-400">{metric.icon}</span>
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight text-white tabular-nums sm:text-3xl">{metric.value}</p>
              <p className="mt-1 text-xs text-slate-500">{metric.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
          <article className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0d1321] shadow-sm shadow-black/20">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-4 sm:px-5">
              <div>
                <h2 className="text-sm font-semibold text-white">Recent calls</h2>
                <p className="mt-1 text-xs text-slate-500">Latest activity across your business line</p>
              </div>
              <span className="rounded-lg bg-slate-800/80 px-2.5 py-1.5 text-xs font-medium text-slate-400">{recentCalls.length} records</span>
            </div>
            <div className="divide-y divide-white/[0.06]">
              {recentCalls.length === 0 ? (
                <div className="flex flex-col items-center px-5 py-14 text-center">
                  <span className="rounded-xl bg-slate-800/70 p-3 text-slate-400"><PhoneIcon /></span>
                  <p className="mt-4 text-sm font-medium text-slate-300">No calls yet</p>
                  <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">New calls and AI summaries will appear here automatically.</p>
                </div>
              ) : recentCalls.map((call) => (
                <div key={call.id} className="grid gap-3 px-4 py-4 transition-colors duration-200 hover:bg-white/[0.025] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-slate-100">{formatPhone(call.callerPhone)}</p>
                      <span className="rounded-md bg-slate-800 px-2 py-1 text-[10px] font-medium capitalize text-slate-400">{label(call.intent)}</span>
                    </div>
                    <p className="mt-1.5 truncate text-xs text-slate-500">{call.summary ?? "Analysis pending"}</p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:block sm:text-right">
                    <span className={`inline-flex rounded-md border px-2 py-1 text-[10px] font-semibold capitalize ${outcomeClass(call.outcome)}`}>{label(call.outcome)}</span>
                    <p className="text-[11px] text-slate-500 sm:mt-1.5">{call.startedAt.toLocaleString("en-US", { timeZone: business.timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <div className="grid content-start gap-5">
            <article className="rounded-2xl border border-white/[0.07] bg-[#0d1321] p-5 shadow-sm shadow-black/20">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Connections</h2>
                <Link href="/dashboard/settings" className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400">
                  Manage <ArrowIcon className="h-3.5 w-3.5" />
                </Link>
              </div>
              <dl className="mt-5 space-y-4 text-sm">
                {[
                  ["Business line", Boolean(business.phoneNumber), formatPhone(business.phoneNumber)],
                  ["Retell voice agent", retellConnected, retellConnected ? "Connected" : "Setup needed"],
                  ["Google Calendar", calendarConnected, calendarConnected ? "Connected" : "Setup needed"],
                ].map(([name, connected, value]) => (
                  <div key={String(name)} className="flex items-center justify-between gap-4">
                    <dt className="text-xs text-slate-500">{name}</dt>
                    <dd className="flex items-center gap-2 text-xs font-medium text-slate-200">
                      {name !== "Business line" && <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-amber-400"}`} />}
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>

            <article className="rounded-2xl border border-white/[0.07] bg-[#0d1321] p-5 shadow-sm shadow-black/20">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Upcoming jobs</h2>
                <span className="text-xs text-slate-500">{upcomingBookings.length} scheduled</span>
              </div>
              <div className="mt-4 space-y-3">
                {upcomingBookings.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700/80 px-4 py-7 text-center">
                    <p className="text-xs text-slate-500">No upcoming bookings.</p>
                  </div>
                ) : upcomingBookings.map((booking) => (
                  <div key={booking.id} className="rounded-xl border border-white/[0.06] bg-slate-950/35 p-3.5">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-lg bg-emerald-400/10 p-2 text-emerald-400"><CalendarIcon className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-200">{booking.customerName}</p>
                        <p className="mt-1 truncate text-xs text-slate-500">{booking.issue}</p>
                        <p className="mt-2 text-[11px] font-medium text-emerald-300">{booking.scheduledAt.toLocaleString("en-US", { timeZone: business.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
