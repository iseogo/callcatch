import Link from "next/link";
import type { Intent, Outcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path d="M7.2 3.5 9.4 8l-2.1 1.7a15.3 15.3 0 0 0 7 7l1.7-2.1 4.5 2.2-.8 3.2c-.2.8-.9 1.4-1.8 1.4C9.5 21.4 2.6 14.5 2.6 6c0-.8.6-1.6 1.4-1.8l3.2-.7Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path d="M7 3v3m10-3v3M4.5 9h15M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CurrencyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5">
      <path d="M12 3v18m4-14.5c-.8-.9-2-1.5-4-1.5-2.2 0-4 1.2-4 3s1.5 2.6 4 3c2.5.4 4 1.2 4 3s-1.8 3-4 3c-2 0-3.5-.6-4.5-1.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
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

export default async function DashboardPage() {
  const business = await prisma.business.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!business) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
        <section className="w-full rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl shadow-black/30">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-400">CallCatch</p>
          <h1 className="mt-4 text-3xl font-semibold">No business is provisioned yet</h1>
          <p className="mt-3 text-slate-400">Create the first business through the protected provisioning API, then refresh this page.</p>
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

  const metrics = [
    { title: "Calls today", value: callsToday.toString(), detail: `${callsThisWeek} in the last 7 days`, icon: <PhoneIcon /> },
    { title: "Jobs booked", value: bookedThisWeek.toString(), detail: `${conversion}% booking rate`, icon: <CalendarIcon /> },
    { title: "Pipeline value", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(pipeline._sum.jobValueEstimate ?? 0), detail: "Estimated this week", icon: <CurrencyIcon /> },
  ];

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-3xl border border-slate-800 bg-slate-900/75 p-5 shadow-2xl shadow-black/20 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400">CallCatch owner console</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{business.name}</h1>
            <p className="mt-2 text-sm text-slate-400">Never lose a job to voicemail again.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-300">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {business.status.toLowerCase()}
            </span>
            <Link href="/dashboard/settings" className="cursor-pointer rounded-full border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors duration-200 hover:border-slate-600 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-400">
              Settings
            </Link>
          </div>
        </header>

        <section aria-label="Performance summary" className="mt-5 grid gap-4 md:grid-cols-3">
          {metrics.map((metric) => (
            <article key={metric.title} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between text-slate-400">
                <p className="text-sm font-medium">{metric.title}</p>
                <span className="rounded-xl bg-slate-800 p-2 text-emerald-400">{metric.icon}</span>
              </div>
              <p className="mt-5 text-3xl font-semibold tracking-tight text-white">{metric.value}</p>
              <p className="mt-1 text-sm text-slate-500">{metric.detail}</p>
            </article>
          ))}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <article className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900/70">
            <div className="border-b border-slate-800 px-5 py-4">
              <h2 className="font-semibold">Recent calls</h2>
              <p className="mt-1 text-sm text-slate-500">Latest caller outcomes and estimated value</p>
            </div>
            <div className="divide-y divide-slate-800">
              {recentCalls.length === 0 ? (
                <p className="px-5 py-10 text-center text-sm text-slate-500">No calls yet.</p>
              ) : recentCalls.map((call) => (
                <div key={call.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{formatPhone(call.callerPhone)}</p>
                      <span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-medium capitalize text-slate-300">{label(call.intent)}</span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500">{call.summary ?? "Analysis pending"}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-medium capitalize text-emerald-300">{label(call.outcome)}</p>
                    <p className="mt-1 text-xs text-slate-500">{call.startedAt.toLocaleString("en-US", { timeZone: business.timezone, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <div className="grid gap-5">
            <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="font-semibold">Live connections</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">CallCatch line</dt>
                  <dd className="font-medium text-slate-200">{formatPhone(business.phoneNumber)}</dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Retell agent</dt>
                  <dd className={business.retellAgentId && !business.retellAgentId.includes("_mock_") ? "text-emerald-300" : "text-amber-300"}>
                    {business.retellAgentId && !business.retellAgentId.includes("_mock_") ? "Connected" : "Mock mode"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-slate-500">Google Calendar</dt>
                  <dd className={calendarConnected ? "text-emerald-300" : "text-amber-300"}>{calendarConnected ? "Connected" : "Setup needed"}</dd>
                </div>
              </dl>
            </article>

            <article className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <h2 className="font-semibold">Upcoming jobs</h2>
              <div className="mt-4 space-y-4">
                {upcomingBookings.length === 0 ? (
                  <p className="text-sm text-slate-500">No upcoming bookings.</p>
                ) : upcomingBookings.map((booking) => (
                  <div key={booking.id} className="border-l-2 border-emerald-500 pl-3">
                    <p className="text-sm font-medium">{booking.customerName}</p>
                    <p className="mt-1 text-xs text-slate-500">{booking.issue}</p>
                    <p className="mt-1 text-xs text-slate-400">{booking.scheduledAt.toLocaleString("en-US", { timeZone: business.timezone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
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
