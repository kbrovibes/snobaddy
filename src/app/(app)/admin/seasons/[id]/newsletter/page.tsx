export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAuthPlayer } from "@/lib/auth";
import { supabase as adminDb } from "@/lib/supabase";
import { getNewsletter, upsertNewsletter } from "@/lib/db/newsletters";
import { getSeasonStats } from "@/lib/newsletter/stats";
import { generateNewsletter } from "@/lib/newsletter/generate";
import MarkdownView from "@/components/MarkdownView";

type Params = { params: Promise<{ id: string }> };

export default async function NewsletterPage({ params }: Params) {
  const auth = await getAuthPlayer();
  if (!auth?.isAdmin) redirect("/");

  const { id: seasonId } = await params;
  const { data: season } = await adminDb
    .from("seasons")
    .select("id, name, status, start_date, end_date, stats_lock_date")
    .eq("id", seasonId)
    .maybeSingle();
  if (!season) notFound();

  let newsletter = await getNewsletter(seasonId);

  // First-visit auto-generate: no newsletter yet → generate one from current stats.
  if (!newsletter) {
    const stats = await getSeasonStats(seasonId);
    const { title, content_md } = generateNewsletter(stats);
    newsletter = await upsertNewsletter({
      season_id: seasonId,
      title,
      content_md,
      intro_context: null,
      stats_json: stats as unknown as Record<string, unknown>,
      generated_by: auth.id,
    });
  }

  const updated = new Date(newsletter.updated_at);
  const updatedLabel = updated.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="px-4 py-4 pb-24 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link href="/admin/seasons" className="text-xs font-semibold uppercase tracking-wide text-muted-light">
          ← All seasons
        </Link>
        <span className="text-xs text-muted-light">As of {updatedLabel}</span>
      </div>

      <div className="rounded-xl border border-muted/30 bg-surface/30 p-4">
        <MarkdownView source={newsletter.content_md} />
      </div>
    </div>
  );
}
