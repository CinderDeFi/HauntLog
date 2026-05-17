import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth';
import { supabase } from '../lib/supabase';
import type {
  AdminReviewRow,
  LocationClaimRow,
  LocationRow,
  ProfileRow,
  TeamRow,
} from '../lib/database.types';
import type { VenueSubmissionRow } from '../lib/dataLayer';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Mail,
  MessageSquare,
  Clock,
  AlertCircle,
  RefreshCw,
  MapPin,
} from 'lucide-react';

type ReviewWithRelations = AdminReviewRow & {
  // Exactly one of these is populated, depending on `kind`.
  claim?: LocationClaimRow & {
    location?: Pick<LocationRow, 'id' | 'name' | 'city' | 'state'>;
  };
  team?: Pick<TeamRow, 'id' | 'slug' | 'name' | 'description' | 'website'>;
  submission?: VenueSubmissionRow;
  submitter?: Pick<ProfileRow, 'id' | 'handle' | 'display_name'>;
};

type Filter = 'pending' | 'all';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Admin() {
  const { profile } = useAuth();
  const isAdmin = !!profile?.is_admin;

  const [filter, setFilter] = useState<Filter>('pending');
  const [reviews, setReviews] = useState<ReviewWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('admin_reviews')
        .select('*')
        .order('created_at', { ascending: false });
      if (filter === 'pending') {
        query = query.eq('status', 'pending');
      }
      const { data: revs, error: err } = await query;
      if (err) throw err;
      const baseRows = (revs ?? []) as AdminReviewRow[];

      // Fan-out fetch related rows. Doing this in parallel keeps the
      // page snappy even if we have a lot of pending items.
      const claimIds = baseRows
        .filter((r) => r.kind === 'location_claim')
        .map((r) => r.target_id);
      const teamIds = baseRows
        .filter((r) => r.kind === 'team_verification')
        .map((r) => r.target_id);
      const submissionIds = baseRows
        .filter((r) => r.kind === 'location_submission')
        .map((r) => r.target_id);
      const submitterIds = Array.from(new Set(baseRows.map((r) => r.submitted_by)));

      const [claimsRes, teamsRes, submissionsRes, submittersRes] = await Promise.all([
        claimIds.length
          ? supabase
              .from('location_claims')
              .select('*, location:locations(id,name,city,state)')
              .in('id', claimIds)
          : Promise.resolve({ data: [], error: null }),
        teamIds.length
          ? supabase
              .from('teams')
              .select('id,slug,name,description,website')
              .in('id', teamIds)
          : Promise.resolve({ data: [], error: null }),
        submissionIds.length
          ? supabase
              .from('location_submissions')
              .select('*')
              .in('id', submissionIds)
          : Promise.resolve({ data: [], error: null }),
        submitterIds.length
          ? supabase
              .from('profiles')
              .select('id,handle,display_name')
              .in('id', submitterIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (claimsRes.error) throw claimsRes.error;
      if (teamsRes.error) throw teamsRes.error;
      if (submissionsRes.error) throw submissionsRes.error;
      if (submittersRes.error) throw submittersRes.error;

      const claimsById = new Map(
        (claimsRes.data as unknown as (LocationClaimRow & { location?: any })[]).map(
          (c) => [c.id, c]
        )
      );
      const teamsById = new Map(
        (teamsRes.data as unknown as TeamRow[]).map((t) => [t.id, t])
      );
      const submissionsById = new Map(
        (submissionsRes.data as unknown as VenueSubmissionRow[]).map((s) => [s.id, s])
      );
      const submittersById = new Map(
        (submittersRes.data as unknown as ProfileRow[]).map((p) => [p.id, p])
      );

      const enriched: ReviewWithRelations[] = baseRows.map((r) => ({
        ...r,
        claim:
          r.kind === 'location_claim' ? (claimsById.get(r.target_id) as any) : undefined,
        team:
          r.kind === 'team_verification' ? (teamsById.get(r.target_id) as any) : undefined,
        submission:
          r.kind === 'location_submission'
            ? (submissionsById.get(r.target_id) as any)
            : undefined,
        submitter: submittersById.get(r.submitted_by) as any,
      }));

      setReviews(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (isAdmin) load();
  }, [load, isAdmin]);

  const handleDecision = async (
    review: ReviewWithRelations,
    decision: 'approve' | 'reject',
    note?: string
  ) => {
    setActionId(review.id);
    setActionError(null);
    try {
      let rpc: string;
      let params: Record<string, unknown>;
      if (review.kind === 'location_claim') {
        rpc =
          decision === 'approve'
            ? 'approve_location_claim'
            : 'reject_location_claim';
        params =
          decision === 'approve'
            ? { p_claim_id: review.target_id }
            : { p_claim_id: review.target_id, p_note: note ?? null };
      } else if (review.kind === 'location_submission') {
        rpc =
          decision === 'approve'
            ? 'approve_location_submission'
            : 'reject_location_submission';
        params =
          decision === 'approve'
            ? { p_submission_id: review.target_id }
            : { p_submission_id: review.target_id, p_note: note ?? null };
      } else {
        rpc =
          decision === 'approve'
            ? 'approve_team_verification'
            : 'reject_team_verification';
        params =
          decision === 'approve'
            ? { p_team_id: review.target_id }
            : { p_team_id: review.target_id, p_note: note ?? null };
      }
      const { error: err } = await supabase.rpc(rpc as any, params as any);
      if (err) throw err;
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : String(e));
    } finally {
      setActionId(null);
    }
  };

  const counts = useMemo(() => {
    const pending = reviews.filter((r) => r.status === 'pending').length;
    return { pending, total: reviews.length };
  }, [reviews]);

  // ============================================================
  // Gate
  // ============================================================
  if (profile === null) {
    return (
      <div className="max-w-2xl mx-auto py-10 text-center">
        <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/app/live" replace />;
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8 flex-wrap gap-3">
        <div>
          <div className="text-xs font-mono text-haunt-red tracking-widest mb-2 flex items-center gap-x-2">
            <ShieldAlert className="w-3.5 h-3.5" /> ADMIN
          </div>
          <h1 className="text-4xl font-medium tracking-tighter">Review queue</h1>
          <p className="text-white/60 text-sm mt-1">
            Approve or reject pending location claims and team verifications.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-mono tracking-widest flex items-center gap-x-2"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          REFRESH
        </button>
      </div>

      {/* Filter pills + counts */}
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex gap-2">
          {(['pending', 'all'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-mono tracking-widest border transition-all ${
                filter === f
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-white/60 border-white/10 hover:border-white/30'
              }`}
            >
              {f === 'pending' ? `PENDING · ${counts.pending}` : `ALL · ${counts.total}`}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4 flex items-start gap-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {actionError && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4 flex items-start gap-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">Action failed: {actionError}</span>
        </div>
      )}

      {loading && reviews.length === 0 && (
        <div className="text-center py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
        </div>
      )}

      {!loading && reviews.length === 0 && (
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-3" />
          <div className="text-lg font-medium mb-1">Nothing to review.</div>
          <div className="text-sm text-white/60">
            {filter === 'pending'
              ? 'No pending claims or verifications. Good night.'
              : 'No reviews on record yet.'}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {reviews.map((r) => (
          <ReviewCard
            key={r.id}
            review={r}
            busy={actionId === r.id}
            onApprove={() => handleDecision(r, 'approve')}
            onReject={(note) => handleDecision(r, 'reject', note)}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// Card
// ============================================================
function ReviewCard({
  review,
  busy,
  onApprove,
  onReject,
}: {
  review: ReviewWithRelations;
  busy: boolean;
  onApprove: () => void;
  onReject: (note: string) => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');

  const isPending = review.status === 'pending';
  const isLocation = review.kind === 'location_claim';
  const isSubmission = review.kind === 'location_submission';
  const isTeam = review.kind === 'team_verification';

  const kindLabel = isLocation
    ? 'LOCATION CLAIM'
    : isSubmission
    ? 'VENUE SUBMISSION'
    : 'TEAM VERIFICATION';

  return (
    <div
      className={`bg-zinc-900 border rounded-2xl p-5 ${
        isPending ? 'border-haunt-red/40' : 'border-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-x-2">
          <span
            className={`inline-flex items-center gap-x-1 text-[10px] font-mono tracking-widest px-2 py-0.5 rounded ${
              review.status === 'pending'
                ? 'bg-haunt-red/10 text-haunt-red'
                : review.status === 'approved'
                ? 'bg-green-400/10 text-green-400'
                : 'bg-white/10 text-white/40'
            }`}
          >
            {review.status.toUpperCase()}
          </span>
          <span className="inline-flex items-center gap-x-1 text-[10px] font-mono tracking-widest px-2 py-0.5 rounded bg-white/5 text-white/60">
            {kindLabel}
          </span>
        </div>
        <div className="text-xs font-mono text-white/40 inline-flex items-center gap-x-1">
          <Clock className="w-3 h-3" />
          {formatDateTime(review.created_at)}
        </div>
      </div>

      {/* Body */}
      {isLocation && review.claim && (
        <div>
          <h3 className="text-xl font-medium mb-1">
            {review.claim.location?.name ?? 'Unknown location'}
          </h3>
          <div className="text-sm text-white/60 mb-3">
            {[review.claim.location?.city, review.claim.location?.state]
              .filter(Boolean)
              .join(', ')}
          </div>
          {/* Claimed role pill (step 16) */}
          {review.claim.claimed_role && (
            <div className="text-[10px] font-mono tracking-widest text-amber-300 inline-flex items-center gap-x-1 bg-amber-400/10 border border-amber-400/30 rounded px-2 py-1 mb-3">
              CLAIMS · {String(review.claim.claimed_role).toUpperCase()}
            </div>
          )}
          {review.claim.message && (
            <div className="text-sm bg-zinc-800/50 border border-white/5 rounded-xl p-3 mb-3 flex items-start gap-x-2">
              <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-white/40" />
              <span className="whitespace-pre-wrap break-words">
                {review.claim.message}
              </span>
            </div>
          )}
          {review.claim.proof_url && (
            <a
              href={review.claim.proof_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-x-1.5 text-sm text-haunt-red hover:underline mb-3"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View proof
            </a>
          )}
          {/* Proof links list (step 16) */}
          {review.claim.proof_links && review.claim.proof_links.length > 0 && (
            <div className="mb-3">
              <div className="text-[10px] font-mono text-white/40 tracking-widest mb-1">
                PROOF LINKS · {review.claim.proof_links.length}
              </div>
              <div className="space-y-1">
                {review.claim.proof_links.map((l) => (
                  <a
                    key={l}
                    href={l}
                    target="_blank"
                    rel="noreferrer"
                    className="block bg-zinc-800/50 border border-white/5 rounded-lg px-3 py-1.5 text-xs font-mono text-blue-300 hover:text-blue-200 truncate"
                  >
                    <ExternalLink className="w-3 h-3 inline mr-1" />
                    {l}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isSubmission && review.submission && (
        <div>
          <h3 className="text-xl font-medium mb-1">
            {review.submission.payload?.name ?? '(unnamed venue)'}
          </h3>
          <div className="text-sm text-white/60 mb-3 inline-flex items-center gap-x-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {[
              review.submission.payload?.city,
              review.submission.payload?.state,
              review.submission.payload?.country,
            ]
              .filter(Boolean)
              .join(', ')}
          </div>
          {/* Submitter's claimed relationship */}
          {review.submission.payload?.submitter_role && (
            <div className="text-[10px] font-mono tracking-widest text-amber-300 inline-flex items-center gap-x-1 bg-amber-400/10 border border-amber-400/30 rounded px-2 py-1 mb-3">
              ROLE · {String(review.submission.payload.submitter_role).toUpperCase()}
              {review.submission.payload.submitter_role === 'other' &&
                review.submission.payload.submitter_role_other &&
                ` — ${review.submission.payload.submitter_role_other}`}
            </div>
          )}
          {review.submission.payload?.tagline && (
            <p className="text-sm text-white/70 italic mb-3 break-words">
              {review.submission.payload.tagline}
            </p>
          )}
          {review.submission.payload?.description && (
            <div className="text-sm bg-zinc-800/50 border border-white/5 rounded-xl p-3 mb-3 whitespace-pre-wrap break-words">
              {review.submission.payload.description}
            </div>
          )}
          {/* Address */}
          {(review.submission.payload?.street || review.submission.payload?.zip) && (
            <div className="text-xs text-white/50 mb-3">
              {[
                review.submission.payload?.street,
                review.submission.payload?.city,
                review.submission.payload?.state,
                review.submission.payload?.zip,
                review.submission.payload?.country,
              ]
                .filter(Boolean)
                .join(', ')}
            </div>
          )}
          {/* Links */}
          {review.submission.payload?.website && (
            <a
              href={review.submission.payload.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-x-1.5 text-sm text-haunt-red hover:underline mb-2 mr-3"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Website
            </a>
          )}
          {review.submission.payload?.booking_url && (
            <a
              href={review.submission.payload.booking_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-x-1.5 text-sm text-haunt-red hover:underline mb-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Booking URL
            </a>
          )}
          {/* Notes from submitter */}
          {review.submission.payload?.notes && (
            <div className="mt-3 text-sm bg-zinc-800/50 border border-white/5 rounded-xl p-3 flex items-start gap-x-2">
              <MessageSquare className="w-4 h-4 mt-0.5 shrink-0 text-white/40" />
              <span className="whitespace-pre-wrap break-words text-white/70">
                {review.submission.payload.notes}
              </span>
            </div>
          )}
          {/* If approved, link to the new venue */}
          {review.status === 'approved' && review.submission.approved_location_id && (
            <Link
              to={`/app/atlas/venue/${review.submission.approved_location_id}`}
              className="mt-3 inline-flex items-center gap-x-1.5 text-sm text-green-300 hover:underline"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              View created venue
            </Link>
          )}
        </div>
      )}

      {isTeam && review.team && (
        <div>
          <h3 className="text-xl font-medium mb-1">{review.team.name}</h3>
          <div className="text-sm text-white/40 font-mono mb-3">
            @{review.team.slug}
          </div>
          {review.team.description && (
            <p className="text-sm text-white/70 mb-3 whitespace-pre-wrap break-words">
              {review.team.description}
            </p>
          )}
          {review.team.website && (
            <a
              href={review.team.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-x-1.5 text-sm text-haunt-red hover:underline mb-3"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {review.team.website}
            </a>
          )}
        </div>
      )}

      {/* Submitter line */}
      {review.submitter && (
        <div className="text-xs text-white/40 inline-flex items-center gap-x-1 mb-3">
          <Mail className="w-3 h-3" />
          Submitted by{' '}
          <span className="text-white/70 font-medium">
            {review.submitter.display_name}
          </span>{' '}
          ({review.submitter.handle})
        </div>
      )}

      {/* Actions */}
      {isPending && !rejecting && (
        <div className="flex gap-2 pt-3 border-t border-white/5">
          <button
            onClick={onApprove}
            disabled={busy}
            className="flex-1 px-4 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 disabled:opacity-50 text-green-300 rounded-xl text-xs font-mono tracking-widest flex items-center justify-center gap-x-2"
          >
            {busy ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            APPROVE
          </button>
          <button
            onClick={() => setRejecting(true)}
            disabled={busy}
            className="flex-1 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-50 text-red-300 rounded-xl text-xs font-mono tracking-widest flex items-center justify-center gap-x-2"
          >
            <XCircle className="w-3.5 h-3.5" />
            REJECT
          </button>
        </div>
      )}

      {isPending && rejecting && (
        <div className="pt-3 border-t border-white/5 space-y-2">
          <label className="block text-xs font-mono text-white/40 tracking-widest">
            REJECTION NOTE (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Reason will not be shown to the user yet — for your records."
            className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-sm focus:border-red-500 outline-none resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                setRejecting(false);
                setNote('');
              }}
              disabled={busy}
              className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-mono tracking-widest"
            >
              CANCEL
            </button>
            <button
              onClick={() => onReject(note)}
              disabled={busy}
              className="flex-1 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 disabled:opacity-50 text-red-300 rounded-xl text-xs font-mono tracking-widest flex items-center justify-center gap-x-2"
            >
              {busy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <XCircle className="w-3.5 h-3.5" />
              )}
              CONFIRM REJECT
            </button>
          </div>
        </div>
      )}

      {!isPending && review.decided_at && (
        <div className="text-xs font-mono text-white/40 pt-3 border-t border-white/5">
          Decided {formatDateTime(review.decided_at)}
          {review.notes && (
            <div className="mt-2 text-white/60 italic font-sans">"{review.notes}"</div>
          )}
        </div>
      )}
    </div>
  );
}
