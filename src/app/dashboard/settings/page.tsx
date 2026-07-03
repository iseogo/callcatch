import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const business = await prisma.business.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (!business) {
    return null;
  }

  const config =
    typeof business.calendarConfig === "object" && business.calendarConfig !== null
      ? business.calendarConfig as Record<string, unknown>
      : {};
  const calendarConnected =
    typeof config.refreshToken === "string" && config.refreshToken !== "mock_refresh";

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard" className="text-sm font-medium text-emerald-400 transition-colors hover:text-emerald-300">
          ← Back to dashboard
        </Link>
        <section className="mt-5 rounded-3xl border border-slate-800 bg-slate-900/75 p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-400">Settings</p>
          <h1 className="mt-3 text-2xl font-semibold">{business.name}</h1>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Timezone</p>
              <p className="mt-2 font-medium">{business.timezone}</p>
            </div>
            <div className="rounded-2xl bg-slate-950/70 p-4">
              <p className="text-xs uppercase tracking-wider text-slate-500">Trade</p>
              <p className="mt-2 font-medium capitalize">{business.trade.toLowerCase()}</p>
            </div>
          </div>
          <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/70 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">Google Calendar</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {calendarConnected ? "Calendar access is connected." : "Connect a calendar so CallCatch can offer and book real appointments."}
                </p>
              </div>
              <a href={`/api/auth/google/start?businessId=${business.id}`} className="cursor-pointer rounded-full bg-emerald-500 px-4 py-2 text-center text-sm font-semibold text-slate-950 transition-colors duration-200 hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300">
                {calendarConnected ? "Reconnect" : "Connect calendar"}
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
