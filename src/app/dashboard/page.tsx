import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { Intent, Outcome } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type IconName =
  | "grid"
  | "phone"
  | "calendar"
  | "message"
  | "users"
  | "chart"
  | "settings"
  | "bolt"
  | "arrow"
  | "dollar";

function Icon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    phone: <path d="M7.2 3.5 9.4 8l-2.1 1.7a15.3 15.3 0 0 0 7 7l1.7-2.1 4.5 2.2-.8 3.2c-.2.8-.9 1.4-1.8 1.4C9.5 21.4 2.6 14.5 2.6 6c0-.8.6-1.6 1.4-1.8l3.2-.7Z" />,
    calendar: <path d="M7 3v3m10-3v3M4.5 9h15M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" />,
    message: <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4v-4.5A2 2 0 0 1 3 15V7a2 2 0 0 1 2-2Zm3 6h.01M12 11h.01M16 11h.01" />,
    users: <path d="M16 20v-1.5a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4V20m6.5-9A3.5 3.5 0 1 0 9.5 4a3.5 3.5 0 0 0 0 7Zm7.5-6.7a3.5 3.5 0 0 1 0 6.8m4 8.9v-1.5a4 4 0 0 0-3-3.9" />,
    chart: <path d="M4 19V9m6 10V5m6 14v-7m4 7V8" />,
    settings: <><circle cx="12" cy="12" r="3.2" /><path d="m19.4 15 .1 2.1-2.4 2.4-2.1-.1-1.5 1.5h-3L9 19.4l-2.1.1-2.4-2.4.1-2.1L3.1 13.5v-3L4.6 9l-.1-2.1 2.4-2.4L9 4.6l1.5-1.5h3L15 4.6l2.1-.1 2.4 2.4-.1 2.1 1.5 1.5v3L19.4 15Z" /></>,
    bolt: <path d="m13 2-8 12h7l-1 8 8-12h-7l1-8Z" />,
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    dollar: <path d="M12 3v18m4-14.5c-.8-.9-2-1.5-4-1.5-2.2 0-4 1.2-4 3s1.5 2.6 4 3c2.5.4 4 1.2 4 3s-1.8 3-4 3c-2 0-3.5-.6-4.5-1.7" />,
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {paths[name]}
      </g>
    </svg>
  );
}

function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" className={className}>
      <circle cx="18" cy="18" r="15" stroke="#22d3a6" strokeWidth="2.5" />
      <circle cx="18" cy="18" r="11" stroke="#38bdf8" strokeWidth="2" opacity=".65" />
      <path d="M23.5 12.5a8 8 0 1 0 0 11M14 18h9" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
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

function localDateKey(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function pointsFor(values: number[], width: number, height: number, pad = 8) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const spread = Math.max(max - min, 1);
  return values.map((value, index) => {
    const x = pad + (index / Math.max(values.length - 1, 1)) * (width - pad * 2);
    const y = height - pad - ((value - min) / spread) * (height - pad * 2);
    return { x, y };
  });
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const points = pointsFor(values, 116, 42, 3);
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const area = `${line} L${points.at(-1)?.x ?? 113},42 L${points[0]?.x ?? 3},42 Z`;

  return (
    <svg viewBox="0 0 116 42" className="h-10 w-28" aria-hidden="true">
      <defs>
        <linearGradient id={`spark-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity=".32" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${color.replace("#", "")})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({
  title,
  value,
  detail,
  icon,
  values,
  color,
  className = "",
}: {
  title: string;
  value: string;
  detail: string;
  icon: IconName;
  values: number[];
  color: string;
  className?: string;
}) {
  return (
    <article className={`min-w-0 rounded-xl border border-white/[0.07] bg-[#0c1725] p-4 shadow-sm shadow-black/20 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
        <span style={{ color }}><Icon name={icon} className="h-4 w-4" /></span>
        {title}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold tracking-tight text-white tabular-nums">{value}</p>
          <p className="mt-1.5 text-[11px] text-slate-400">{detail}</p>
        </div>
        <Sparkline values={values} color={color} />
      </div>
    </article>
  );
}

function outcomeClass(outcome: Outcome | null) {
  if (outcome === "BOOKED") return "bg-emerald-400/10 text-emerald-300";
  if (outcome === "TRANSFERRED") return "bg-sky-400/10 text-sky-300";
  if (outcome === "MESSAGE_TAKEN") return "bg-violet-400/10 text-violet-300";
  return "bg-slate-700/60 text-slate-300";
}

export default async function DashboardPage() {
  const business = await prisma.business.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!business) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#07101c] px-5">
        <section className="w-full max-w-lg rounded-2xl border border-white/[0.08] bg-[#0c1725] p-8 shadow-2xl shadow-black/30">
          <LogoMark />
          <h1 className="mt-6 text-2xl font-semibold">No business is provisioned yet</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">Create the first business through the protected provisioning API, then refresh this page.</p>
        </section>
      </main>
    );
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60_000);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [calls, recentCalls, upcomingBookings, smsThreads] = await Promise.all([
    prisma.call.findMany({
      where: { businessId: business.id, startedAt: { gte: sevenDaysAgo } },
      orderBy: { startedAt: "asc" },
    }),
    prisma.call.findMany({
      where: { businessId: business.id },
      orderBy: { startedAt: "desc" },
      take: 5,
    }),
    prisma.booking.findMany({
      where: { businessId: business.id, scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
    prisma.smsThread.count({ where: { businessId: business.id } }),
  ]);

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now.getTime() - (6 - index) * 24 * 60 * 60_000);
    return {
      key: localDateKey(date, business.timezone),
      label: date.toLocaleDateString("en-US", { timeZone: business.timezone, month: "short", day: "numeric" }),
    };
  });
  const dailyCalls = days.map((day) => calls.filter((call) => localDateKey(call.startedAt, business.timezone) === day.key).length);
  const dailyBookings = days.map((day) => calls.filter((call) => localDateKey(call.startedAt, business.timezone) === day.key && call.outcome === "BOOKED").length);
  const dailyMessages = days.map((_, index) => index === 6 ? smsThreads : 0);
  const bookedCalls = calls.filter((call) => call.outcome === "BOOKED").length;
  const uniqueCallers = new Set(calls.map((call) => call.callerPhone)).size;
  const conversion = calls.length > 0 ? Math.round((bookedCalls / calls.length) * 100) : 0;
  const pipeline = calls.reduce((total, call) => total + (call.jobValueEstimate ?? 0), 0);
  const answeredCalls = calls.filter((call) => Boolean(call.outcome)).length;
  const answerRate = calls.length > 0 ? Math.round((answeredCalls / calls.length) * 100) : 0;
  const ownerName = business.name.includes("'") ? business.name.split("'")[0] : "Owner";

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

  const chartWidth = 700;
  const chartHeight = 190;
  const chartPoints = pointsFor(dailyCalls, chartWidth, chartHeight, 14);
  const chartLine = chartPoints.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const chartArea = `${chartLine} L${chartPoints.at(-1)?.x ?? chartWidth - 14},${chartHeight} L${chartPoints[0]?.x ?? 14},${chartHeight} Z`;

  const outcomeData = [
    { name: "Booked", count: calls.filter((call) => call.outcome === "BOOKED").length, color: "#10b981" },
    { name: "Transferred", count: calls.filter((call) => call.outcome === "TRANSFERRED").length, color: "#0ea5e9" },
    { name: "Message", count: calls.filter((call) => call.outcome === "MESSAGE_TAKEN").length, color: "#8b5cf6" },
    { name: "Pending", count: calls.filter((call) => !call.outcome || call.outcome === "MISSED_INFO").length, color: "#64748b" },
  ];
  const outcomeTotal = Math.max(calls.length, 1);
  let stop = 0;
  const donutParts = outcomeData.map((item) => {
    const start = stop;
    stop += (item.count / outcomeTotal) * 100;
    return `${item.color} ${start}% ${stop}%`;
  });
  if (calls.length === 0) donutParts.push("#334155 0% 100%");
  const donutStyle = { background: `conic-gradient(${donutParts.join(", ")})` } as CSSProperties;

  const navItems: Array<{ name: string; icon: IconName; href: string }> = [
    { name: "Dashboard", icon: "grid", href: "/dashboard" },
    { name: "Calls", icon: "phone", href: "#calls" },
    { name: "Appointments", icon: "calendar", href: "#appointments" },
    { name: "Messages", icon: "message", href: "#activity" },
    { name: "Analytics", icon: "chart", href: "#analytics" },
    { name: "Settings", icon: "settings", href: "/dashboard/settings" },
  ];

  return (
    <main className="min-h-screen bg-[#07101c] text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-white/[0.07] bg-[#07111e] lg:flex">
        <div className="flex h-[74px] items-center gap-2.5 border-b border-white/[0.06] px-6">
          <LogoMark className="h-9 w-9" />
          <span className="text-xl font-semibold tracking-tight text-white">CallCatch</span>
        </div>

        <nav aria-label="Main navigation" className="space-y-1 px-4 py-5">
          {navItems.map((item, index) => (
            <Link key={item.name} href={item.href} className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 ${index === 0 ? "border border-emerald-400/10 bg-emerald-400/10 text-emerald-300" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"}`}>
              <Icon name={item.icon} className="h-[18px] w-[18px]" />
              {item.name}
            </Link>
          ))}
        </nav>

        <div className="mt-auto p-4">
          <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/[0.05] p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
              <Icon name="bolt" className="h-4 w-4" />
              AI receptionist
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              {retellConnected ? "Your line is active and ready to answer calls." : "Voice setup needs attention."}
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-slate-300">
              <span className={`h-2 w-2 rounded-full ${retellConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
              {retellConnected ? "Operational" : "Setup needed"}
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3 border-t border-white/[0.06] px-1 pt-4">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-600 text-xs font-semibold text-white">{ownerName.slice(0, 1)}P</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-200">{business.name}</p>
              <p className="text-[11px] text-slate-500">Owner</p>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="border-b border-white/[0.06] bg-[#091321]/95">
          <div className="flex min-h-[74px] items-center justify-between gap-4 px-4 py-4 sm:px-7 lg:px-10">
            <div className="flex items-center gap-3">
              <LogoMark className="h-9 w-9 lg:hidden" />
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Welcome back, {ownerName}</h1>
                <p className="mt-1 text-xs text-slate-400 sm:text-sm">Here&apos;s what&apos;s happening with your business today.</p>
              </div>
            </div>
            <div className="hidden items-center gap-3 sm:flex">
              <span className="rounded-lg border border-white/[0.08] bg-[#0c1725] px-3 py-2 text-xs text-slate-300">
                {days[0]?.label} – {days[6]?.label}
              </span>
              <Link href="/dashboard/settings" aria-label="Open settings" className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-white/[0.08] bg-[#0c1725] text-slate-400 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <Icon name="settings" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-7 lg:px-8">
          <section aria-label="Performance summary" className="grid gap-3 min-[480px]:grid-cols-2 xl:grid-cols-5">
            <StatCard title="Total Calls" value={calls.length.toString()} detail={`${uniqueCallers} unique callers`} icon="phone" values={dailyCalls} color="#34d399" />
            <StatCard title="New Callers" value={uniqueCallers.toString()} detail="Last 7 days" icon="users" values={dailyCalls} color="#22d3a6" />
            <StatCard title="Appointments" value={bookedCalls.toString()} detail={`${upcomingBookings.length} upcoming`} icon="calendar" values={dailyBookings} color="#38bdf8" />
            <StatCard title="Messages" value={smsThreads.toString()} detail="SMS conversations" icon="message" values={dailyMessages} color="#a78bfa" />
            <StatCard title="Conversion Rate" value={`${conversion}%`} detail={`${bookedCalls} calls booked`} icon="chart" values={dailyBookings} color="#f59e0b" className="min-[480px]:col-span-2 xl:col-span-1" />
          </section>

          <section id="analytics" className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
            <article id="calls" className="rounded-xl border border-white/[0.07] bg-[#0c1725] p-4 shadow-sm shadow-black/20 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                  <Icon name="phone" className="h-4 w-4 text-emerald-400" />
                  Calls overview
                </h2>
                <span className="rounded-md border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-slate-400">Last 7 days</span>
              </div>

              <div className="mt-5 overflow-hidden">
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight + 34}`} className="w-full" role="img" aria-label={`Calls over seven days: ${dailyCalls.join(", ")}`}>
                  <defs>
                    <linearGradient id="calls-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#34d399" stopOpacity=".28" />
                      <stop offset="1" stopColor="#34d399" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[0, 1, 2, 3].map((line) => (
                    <line key={line} x1="14" x2={chartWidth - 14} y1={20 + line * 45} y2={20 + line * 45} stroke="#334155" strokeOpacity=".32" />
                  ))}
                  <path d={chartArea} fill="url(#calls-area)" />
                  <path d={chartLine} fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  {chartPoints.map((point, index) => (
                    <circle key={days[index]?.key} cx={point.x} cy={point.y} r="4" fill="#07101c" stroke="#6ee7b7" strokeWidth="2" />
                  ))}
                  {days.map((day, index) => (
                    <text key={day.key} x={chartPoints[index]?.x} y={chartHeight + 26} textAnchor="middle" fill="#64748b" fontSize="11">{day.label}</text>
                  ))}
                </svg>
              </div>

              <div className="mt-2 grid grid-cols-2 divide-x divide-white/[0.07] border-t border-white/[0.07] pt-4 sm:grid-cols-4">
                {[
                  [calls.length, "Total calls"],
                  [answeredCalls, "Answered"],
                  [bookedCalls, "Booked"],
                  [`${answerRate}%`, "Answer rate"],
                ].map(([value, text]) => (
                  <div key={String(text)} className="px-3 text-center first:pl-0 last:pr-0">
                    <p className="text-lg font-semibold text-white tabular-nums">{value}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{text}</p>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-white/[0.07] bg-[#0c1725] p-4 shadow-sm shadow-black/20 sm:p-5">
              <h2 className="text-base font-semibold text-white">Call outcomes</h2>
              <div className="mt-7 grid items-center gap-7 sm:grid-cols-[190px_1fr] xl:grid-cols-1 2xl:grid-cols-[190px_1fr]">
                <div className="relative mx-auto h-44 w-44 rounded-full" style={donutStyle}>
                  <div className="absolute inset-[25px] grid place-items-center rounded-full bg-[#0c1725] text-center">
                    <div>
                      <p className="text-2xl font-semibold text-white">{calls.length}</p>
                      <p className="text-xs text-slate-500">Total calls</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  {outcomeData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-4 text-sm">
                      <span className="flex items-center gap-2 text-slate-300">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        {item.name}
                      </span>
                      <span className="font-semibold text-white">{calls.length ? Math.round((item.count / calls.length) * 100) : 0}%</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-6 border-t border-white/[0.07] pt-4 text-center">
                <p className="text-xs text-slate-400">
                  Estimated pipeline <span className="ml-1 font-semibold text-emerald-300">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(pipeline)}</span>
                </p>
              </div>
            </article>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_1.05fr_1fr]">
            <article id="activity" className="overflow-hidden rounded-xl border border-white/[0.07] bg-[#0c1725] p-4 shadow-sm shadow-black/20">
              <h2 className="text-base font-semibold text-white">Recent activity</h2>
              <div className="mt-4 divide-y divide-white/[0.06]">
                {recentCalls.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">No call activity yet.</p>
                ) : recentCalls.slice(0, 4).map((call) => (
                  <div key={call.id} className="flex items-center gap-3 py-3 first:pt-0">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-800 text-slate-400">
                      <Icon name="phone" className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-200">{formatPhone(call.callerPhone)}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{call.summary ?? "Call analysis pending"}</p>
                    </div>
                    <div className="text-right">
                      <span className={`rounded px-2 py-1 text-[10px] font-medium capitalize ${outcomeClass(call.outcome)}`}>{label(call.outcome)}</span>
                      <p className="mt-1 text-[10px] text-slate-600">{call.startedAt.toLocaleDateString("en-US", { timeZone: business.timezone, month: "short", day: "numeric" })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article id="appointments" className="rounded-xl border border-white/[0.07] bg-[#0c1725] p-4 shadow-sm shadow-black/20">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-white">Upcoming appointments</h2>
                <Link href="/dashboard/settings" className="text-[11px] font-medium text-sky-400 hover:text-sky-300">View calendar</Link>
              </div>
              <div className="mt-4 divide-y divide-white/[0.06]">
                {upcomingBookings.length === 0 ? (
                  <p className="py-10 text-center text-sm text-slate-500">No upcoming appointments.</p>
                ) : upcomingBookings.slice(0, 4).map((booking) => (
                  <div key={booking.id} className="flex items-center gap-3 py-3 first:pt-0">
                    <div className="w-11 shrink-0 rounded-lg bg-slate-800/80 py-1.5 text-center">
                      <p className="text-[9px] font-semibold uppercase text-emerald-400">{booking.scheduledAt.toLocaleDateString("en-US", { timeZone: business.timezone, month: "short" })}</p>
                      <p className="text-base font-semibold text-white">{booking.scheduledAt.toLocaleDateString("en-US", { timeZone: business.timezone, day: "2-digit" })}</p>
                    </div>
                    <p className="w-16 shrink-0 text-xs text-slate-300">{booking.scheduledAt.toLocaleTimeString("en-US", { timeZone: business.timezone, hour: "numeric", minute: "2-digit" })}</p>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-200">{booking.customerName}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{booking.issue}</p>
                    </div>
                    <span className="hidden rounded bg-emerald-400/10 px-2 py-1 text-[10px] font-medium text-emerald-300 sm:inline">Confirmed</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-xl border border-white/[0.07] bg-[#0c1725] p-4 shadow-sm shadow-black/20">
              <h2 className="text-base font-semibold text-white">Quick actions</h2>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {([
                  ["View calls", "phone", "#calls"],
                  ["Appointments", "calendar", "#appointments"],
                  ["Messages", "message", "#activity"],
                  ["Settings", "settings", "/dashboard/settings"],
                ] satisfies Array<[string, IconName, string]>).map(([text, icon, href]) => (
                  <Link key={text} href={href} className="group flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-white/[0.05] bg-[#101d2d] px-3 text-center transition-colors duration-200 hover:border-emerald-400/20 hover:bg-emerald-400/[0.05] focus:outline-none focus:ring-2 focus:ring-emerald-400">
                    <Icon name={icon} className="h-6 w-6 text-emerald-400" />
                    <span className="mt-2 text-xs font-medium text-slate-200 group-hover:text-white">{text}</span>
                  </Link>
                ))}
              </div>
              <div className="mt-3 rounded-lg border border-white/[0.05] bg-[#101d2d] p-3">
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Business line</p>
                <p className="mt-1 text-sm font-semibold text-white">{formatPhone(business.phoneNumber)}</p>
                <p className="mt-2 flex items-center gap-2 text-[11px] text-slate-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${retellConnected && calendarConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
                  {retellConnected && calendarConnected ? "Voice and calendar connected" : "Connection needs attention"}
                </p>
              </div>
            </article>
          </section>
        </div>
      </div>
    </main>
  );
}
