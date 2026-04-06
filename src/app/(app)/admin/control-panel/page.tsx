export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { getAppSetting } from "@/lib/db/settings";
import TallyModelPicker from "@/components/TallyModelPicker";

// ─── types ────────────────────────────────────────────────────────────────────

interface TableStat { tablename: string; rows: number; size: string; }
interface DbSize    { db_size: string; db_bytes: number; }
interface Metric    { label: string; value: string; sub?: string; warn?: boolean; }

// ─── data fetchers ────────────────────────────────────────────────────────────

async function sbQuery<T>(sql: string): Promise<T[]> {
  const token   = process.env.SUPABASE_MGMT_TOKEN!;
  const project = process.env.SUPABASE_PROJECT_ID!;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${project}/database/query`,
    { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) }
  );
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error(data.message ?? "Supabase query failed");
  return data as T[];
}

async function getSupabaseMetrics() {
  const [sizes, dbSizeRows, authRows] = await Promise.all([
    sbQuery<TableStat>(
      "SELECT relname AS tablename, n_live_tup AS rows, pg_size_pretty(pg_total_relation_size(relid)) AS size " +
      "FROM pg_stat_user_tables ORDER BY n_live_tup DESC"
    ),
    sbQuery<DbSize>("SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size, pg_database_size(current_database()) AS db_bytes"),
    sbQuery<{ total: number }>("SELECT count(*)::int AS total FROM auth.users"),
  ]);

  const appTables = ["players", "sessions", "matches", "session_players", "proposed_matches", "seasons", "session_tally"];
  const tableMap  = Object.fromEntries(sizes.map(r => [r.tablename, r]));

  const dbBytes  = dbSizeRows[0]?.db_bytes ?? 0;
  const dbSize   = dbSizeRows[0]?.db_size  ?? "?";
  const freeTierMb = 500;
  const usedMb   = Math.round(dbBytes / 1024 / 1024);
  const pct      = Math.round((usedMb / freeTierMb) * 100);

  return { tableMap, appTables, dbSize, usedMb, freeTierMb, pct, authUsers: authRows[0]?.total ?? 0 };
}

async function getVercelMetrics() {
  const token     = process.env.VERCEL_API_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token) return null;

  // Account info
  const userRes  = await fetch("https://api.vercel.com/v2/user", { headers: { Authorization: `Bearer ${token}` } });
  const userData = await userRes.json();
  const plan     = userData?.user?.billing?.plan ?? "unknown";

  // Latest deployments (doesn't need project ID)
  const deplRes  = await fetch(`https://api.vercel.com/v6/deployments?limit=5${projectId ? `&projectId=${projectId}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const deplData = await deplRes.json();
  const deployments: { uid: string; name: string; state: string; created: number; url: string }[] =
    deplData?.deployments ?? [];

  return { plan, deployments, projectId };
}

// ─── UI primitives ────────────────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</h2>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

function MetricRow({ label, value, sub, warn }: Metric) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="text-right">
        <span className={`text-sm font-semibold tabular-nums ${warn ? "text-red-500" : "text-gray-900"}`}>{value}</span>
        {sub && <span className="block text-xs text-gray-400">{sub}</span>}
      </div>
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "bg-red-400" : pct >= 50 ? "bg-yellow-400" : "bg-green-400";
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function DeployBadge({ state }: { state: string }) {
  if (state === "READY")   return <span className="text-xs font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded">Ready</span>;
  if (state === "ERROR")   return <span className="text-xs font-semibold text-red-600   bg-red-50   px-1.5 py-0.5 rounded">Error</span>;
  if (state === "BUILDING")return <span className="text-xs font-semibold text-blue-600  bg-blue-50  px-1.5 py-0.5 rounded">Building</span>;
  return <span className="text-xs text-gray-400">{state}</span>;
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function ControlPanelPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: currentPlayer } = await supabase
    .from("players").select("is_admin, is_god_mode").eq("user_id", user!.id).single();

  if (!currentPlayer?.is_god_mode) redirect("/");

  const [sb, vercel, tallyModel] = await Promise.allSettled([
    getSupabaseMetrics(),
    getVercelMetrics(),
    getAppSetting("tally_extraction_model"),
  ]);

  const sbData      = sb.status       === "fulfilled" ? sb.value        : null;
  const vData       = vercel.status   === "fulfilled" ? vercel.value    : null;
  const currentModel = tallyModel.status === "fulfilled" ? (tallyModel.value ?? "claude-3-5-haiku-20241022") : "claude-3-5-haiku-20241022";
  const sbError     = sb.status       === "rejected"  ? String(sb.reason) : null;

  return (
    <div className="px-4 py-4 pb-20 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Control Panel</h1>
        <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded">GOD MODE</span>
      </div>

      {/* ── AI Settings ── */}
      <Card title="Tally — AI Model">
        <TallyModelPicker current={currentModel} />
      </Card>

      {/* ── Supabase ── */}
      <Card title="Supabase — Database">
        {sbError ? (
          <p className="text-sm text-red-500">{sbError}</p>
        ) : sbData ? (
          <>
            <div className="mb-3">
              <MetricRow
                label="DB size"
                value={`${sbData.dbSize} / 500 MB`}
                sub={`${sbData.pct}% of free tier`}
                warn={sbData.pct >= 80}
              />
              <ProgressBar pct={sbData.pct} />
            </div>
            <MetricRow label="Auth users" value={String(sbData.authUsers)} sub="signed-in accounts" />
          </>
        ) : <p className="text-sm text-gray-400">Loading…</p>}
      </Card>

      {/* ── App tables ── */}
      {sbData && (
        <Card title="Supabase — Table Rows">
          {sbData.appTables.map(t => {
            const row = sbData.tableMap[t];
            return row ? (
              <MetricRow key={t} label={t} value={row.rows.toLocaleString()} sub={row.size} />
            ) : (
              <MetricRow key={t} label={t} value="—" />
            );
          })}
        </Card>
      )}

      {/* ── Vercel ── */}
      <Card title="Vercel — Account">
        {!process.env.VERCEL_API_TOKEN ? (
          <p className="text-xs text-gray-400">Set VERCEL_API_TOKEN to enable.</p>
        ) : vData ? (
          <>
            <MetricRow label="Plan" value={vData.plan.charAt(0).toUpperCase() + vData.plan.slice(1)} />
            {!vData.projectId && (
              <p className="text-xs text-orange-500 mt-1">Set VERCEL_PROJECT_ID for deployment details.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-red-500">Vercel API error</p>
        )}
      </Card>

      {vData?.deployments && vData.deployments.length > 0 && (
        <Card title="Vercel — Recent Deployments">
          {vData.deployments.map(d => (
            <div key={d.uid} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 gap-2">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-mono text-gray-500 truncate">{d.url}</span>
                <span className="text-xs text-gray-400">{new Date(d.created).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <DeployBadge state={d.state} />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
