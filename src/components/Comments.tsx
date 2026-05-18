import { useCallback, useEffect, useState } from 'react';
import {
  fetchComments,
  postComment,
  deleteComment,
  togglePinComment,
  type CommentWithAuthor,
} from '../lib/dataLayer';
import { useAuth } from '../lib/useAuth';
import {
  detectEquipmentInText,
  equipmentChipColors,
} from '../lib/equipmentColors';
import {
  MessageSquare,
  Send,
  Loader2,
  AlertCircle,
  Trash2,
  Pin,
  PinOff,
  Lock,
} from 'lucide-react';
import { Link } from 'react-router-dom';

type Props = {
  caseId: string;
  caseOwnerId: string | null;
  // 'public' / 'anonymous' = comments enabled. 'private' = disabled (only owner sees this view anyway).
  visibility: 'public' | 'anonymous' | 'private';
};

function formatWhen(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Comments({ caseId, caseOwnerId, visibility }: Props) {
  const { user, profile } = useAuth();
  const [comments, setComments] = useState<CommentWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const isOwner = !!user && !!caseOwnerId && caseOwnerId === user.id;
  const isAdmin = !!profile?.is_admin;
  const canModerate = isOwner || isAdmin;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchComments(caseId);
      setComments(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    load();
  }, [load]);

  // Private cases: no one but the owner can see them, so comments add little
  // value. Still render the section if there are any (e.g. owner left themselves
  // notes), but hide the compose box.
  const allowCompose = visibility !== 'private' && !!user;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !body.trim()) return;
    setPosting(true);
    setError(null);
    const res = await postComment(caseId, user.id, body);
    setPosting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setBody('');
    await load();
  };

  const onDelete = async (commentId: string) => {
    if (!user) return;
    if (!confirm('Delete this comment?')) return;
    setActing(commentId);
    const res = await deleteComment(commentId, user.id);
    setActing(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await load();
  };

  const onTogglePin = async (commentId: string, pinned: boolean) => {
    setActing(commentId);
    const res = await togglePinComment(commentId, !pinned);
    setActing(null);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    await load();
  };

  return (
    <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6">
      <div className="text-xs font-mono text-white/40 tracking-widest mb-4 flex items-center gap-x-2">
        <MessageSquare className="w-3.5 h-3.5" />
        // COMMENTS · {comments.length}
      </div>

      {error && (
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4 flex items-start gap-x-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {/* Compose */}
      {allowCompose && (
        <form onSubmit={onSubmit} className="mb-5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            maxLength={4000}
            placeholder="Share what you noticed or ask a question…"
            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none resize-none text-sm"
          />
          <div className="flex items-center justify-between mt-2 gap-2">
            <div className="text-xs text-white/40">{body.length}/4000</div>
            <button
              type="submit"
              disabled={!body.trim() || posting}
              className="px-4 py-2 bg-haunt-red hover:bg-red-600 disabled:bg-zinc-800 disabled:text-white/40 text-white rounded-xl font-mono tracking-widest text-xs flex items-center gap-x-2"
            >
              {posting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
              POST
            </button>
          </div>
        </form>
      )}

      {!user && visibility !== 'private' && (
        <div className="bg-zinc-800/50 border border-white/5 rounded-xl p-3 text-sm text-white/60 mb-5">
          <Link to="/auth/signin" className="text-haunt-red hover:underline">
            Sign in
          </Link>{' '}
          to comment on this case.
        </div>
      )}

      {visibility === 'private' && (
        <div className="bg-zinc-800/50 border border-white/5 rounded-xl p-3 text-xs text-white/60 mb-5 flex items-center gap-x-2">
          <Lock className="w-3.5 h-3.5" />
          This case is private. Make it public to enable discussion.
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-6 text-center">
          <Loader2 className="w-5 h-5 animate-spin mx-auto text-white/40" />
        </div>
      ) : comments.length === 0 ? (
        <div className="py-6 text-center text-sm text-white/40">
          No comments yet.
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((c) => (
            <div
              key={c.id}
              className={`rounded-2xl p-3 ${
                c.pinned
                  ? 'bg-haunt-red/5 border border-haunt-red/30'
                  : 'bg-zinc-950 border border-white/5'
              }`}
            >
              <div className="flex items-start gap-3">
                {c.author?.avatar_url ? (
                  <img
                    src={c.author.avatar_url}
                    alt=""
                    className="w-8 h-8 rounded-xl shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {c.author?.display_name
                      ? c.author.display_name
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()
                      : '?'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-x-2 flex-wrap">
                    {c.author ? (
                      <Link
                        to={`/u/${encodeURIComponent(c.author.handle)}`}
                        className="text-sm font-medium hover:text-haunt-red transition-colors"
                      >
                        {c.author.display_name}
                      </Link>
                    ) : (
                      <span className="text-sm text-white/40 italic">
                        Deleted investigator
                      </span>
                    )}
                    {c.author && (
                      <span className="text-[10px] font-mono text-white/40">
                        {c.author.handle}
                      </span>
                    )}
                    {c.pinned && (
                      <span className="text-[10px] font-mono text-haunt-red inline-flex items-center gap-x-1">
                        <Pin className="w-3 h-3" /> PINNED
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-white/40 ml-auto">
                      {formatWhen(c.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-white/80 mt-1 whitespace-pre-wrap break-words">
                    {renderCommentBody(c.body)}
                  </p>

                  {(canModerate || c.author?.id === user?.id) && (
                    <div className="flex items-center gap-2 mt-2">
                      {canModerate && (
                        <button
                          onClick={() => onTogglePin(c.id, c.pinned)}
                          disabled={acting === c.id}
                          className="text-[10px] font-mono tracking-widest text-white/40 hover:text-white inline-flex items-center gap-x-1"
                        >
                          {c.pinned ? (
                            <>
                              <PinOff className="w-3 h-3" /> UNPIN
                            </>
                          ) : (
                            <>
                              <Pin className="w-3 h-3" /> PIN
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => onDelete(c.id)}
                        disabled={acting === c.id}
                        className="text-[10px] font-mono tracking-widest text-red-400/60 hover:text-red-300 inline-flex items-center gap-x-1"
                      >
                        <Trash2 className="w-3 h-3" /> DELETE
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders a comment body, auto-detecting equipment mentions and
 * styling them as inline chips with brand-consistent colors. Reuses
 * the same palette as the case view so the visual language is
 * consistent: "K-II spike" reads with a red K-II chip in the middle.
 */
function renderCommentBody(body: string): React.ReactNode {
  const segments = detectEquipmentInText(body);
  if (segments.length === 1 && segments[0].kind === 'text') {
    return body;
  }
  return segments.map((seg, i) => {
    if (seg.kind === 'text') {
      // Use a fragment so React doesn't complain about keyed text nodes.
      return <span key={i}>{seg.value}</span>;
    }
    const chip = equipmentChipColors(seg.id);
    return (
      <span
        key={i}
        className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 ${chip.bg} ${chip.text} border ${chip.border} text-[10px] font-mono rounded tracking-widest align-baseline`}
      >
        {seg.label}
      </span>
    );
  });
}
