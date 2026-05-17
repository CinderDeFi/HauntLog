import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  fetchFollowers,
  fetchFollowing,
  followUser,
  unfollowUser,
  isFollowing,
  type FollowProfile,
} from '../lib/dataLayer';
import { useAuth } from '../lib/useAuth';
import {
  ArrowLeft,
  Loader2,
  Users,
  UserPlus,
  UserCheck,
  AtSign,
} from 'lucide-react';

type Mode = 'followers' | 'following';

type RowState = {
  profile: FollowProfile;
  followingViewer: boolean; // does the VIEWER follow this profile?
};

export default function FollowList({ mode }: { mode: Mode }) {
  const { handle } = useParams<{ handle: string }>();
  const { user: authUser } = useAuth();

  const [subjectName, setSubjectName] = useState<string>('');
  const [subjectHandle, setSubjectHandle] = useState<string>('');
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!handle) return;
    const normalized = handle.startsWith('@') ? handle : '@' + handle;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        // First, resolve the subject profile (the user whose page this is).
        const { data: subject, error: pErr } = await supabase
          .from('profiles')
          .select('id, display_name, handle')
          .eq('handle', normalized)
          .maybeSingle();
        if (pErr) throw pErr;
        if (!subject) {
          setError('Investigator not found.');
          setLoading(false);
          return;
        }
        setSubjectName(subject.display_name);
        setSubjectHandle(subject.handle);

        // Fetch the list itself.
        const list =
          mode === 'followers'
            ? await fetchFollowers(subject.id)
            : await fetchFollowing(subject.id);

        // If signed in, also check which of those the viewer follows so
        // we can render "Follow back" vs "Following" buttons.
        let viewerFollows: Set<string> = new Set();
        if (authUser) {
          // We could batch this, but the simplest correct version is N small
          // queries. The list is bounded; this is fine for now.
          const checks = await Promise.all(
            list.map((p) =>
              isFollowing(authUser.id, p.id).then((v) => (v ? p.id : null))
            )
          );
          viewerFollows = new Set(checks.filter((x): x is string => !!x));
        }

        setRows(
          list.map((p) => ({
            profile: p,
            followingViewer: viewerFollows.has(p.id),
          }))
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [handle, mode, authUser]);

  const toggleFollow = async (subjectId: string, currentlyFollowing: boolean) => {
    if (!authUser || busy === subjectId) return;
    setBusy(subjectId);
    // Optimistic flip
    setRows((rs) =>
      rs.map((r) =>
        r.profile.id === subjectId ? { ...r, followingViewer: !currentlyFollowing } : r
      )
    );
    const res = currentlyFollowing
      ? await unfollowUser(authUser.id, subjectId)
      : await followUser(authUser.id, subjectId);
    if (!res.ok) {
      // Rollback
      setRows((rs) =>
        rs.map((r) =>
          r.profile.id === subjectId ? { ...r, followingViewer: currentlyFollowing } : r
        )
      );
    }
    setBusy(null);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-white/10">
        <div className="max-w-screen-xl mx-auto px-6 md:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-x-2">
            <img src="/hauntlog-mark-color.svg" alt="HauntLog" className="h-8 w-8" />
            <span className="font-mono text-2xl tracking-tighter">HAUNTLOG</span>
          </Link>
          {!authUser && (
            <Link to="/auth/signin" className="text-sm text-white/70 hover:text-white">
              Sign in
            </Link>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-3xl mx-auto w-full px-6 md:px-8 py-10">
        <Link
          to={`/u/${encodeURIComponent(subjectHandle || handle || '')}`}
          className="inline-flex items-center gap-x-2 text-white/60 hover:text-white text-sm mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> BACK TO PROFILE
        </Link>

        <div className="text-xs font-mono text-haunt-red tracking-widest mb-2 flex items-center gap-x-2">
          <Users className="w-3.5 h-3.5" />
          {mode === 'followers' ? 'FOLLOWERS' : 'FOLLOWING'}
        </div>
        <h1 className="text-3xl md:text-4xl font-medium tracking-tighter mb-1">
          {mode === 'followers'
            ? `Investigators following ${subjectName || '...'}`
            : `${subjectName || '...'} is following`}
        </h1>
        <div className="text-sm font-mono text-white/40 mb-8">
          {subjectHandle || handle}
        </div>

        {error && (
          <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-sm text-red-300 mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-12 text-center">
            <Users className="w-10 h-10 text-white/30 mx-auto mb-3" />
            <p className="text-white/60 text-sm">
              {mode === 'followers'
                ? 'No followers yet.'
                : "Not following anyone yet."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => {
              const isMe = authUser?.id === r.profile.id;
              return (
                <div
                  key={r.profile.id}
                  className="bg-zinc-900 border border-white/10 rounded-2xl p-3 flex items-center gap-3 hover:border-white/30 transition-colors"
                >
                  <Link
                    to={`/u/${encodeURIComponent(r.profile.handle)}`}
                    className="flex items-center gap-3 flex-1 min-w-0"
                  >
                    {r.profile.avatar_url ? (
                      <img
                        src={r.profile.avatar_url}
                        alt=""
                        className="w-11 h-11 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {r.profile.display_name
                          .split(' ')
                          .map((p) => p[0])
                          .join('')
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{r.profile.display_name}</div>
                      <div className="text-xs font-mono text-white/40 truncate inline-flex items-center gap-x-1">
                        <AtSign className="w-3 h-3" />
                        {r.profile.handle.replace(/^@/, '')}
                      </div>
                      {r.profile.bio && (
                        <p className="text-xs text-white/60 line-clamp-1 mt-1">
                          {r.profile.bio}
                        </p>
                      )}
                    </div>
                  </Link>

                  {authUser && !isMe && (
                    <button
                      onClick={() => toggleFollow(r.profile.id, r.followingViewer)}
                      disabled={busy === r.profile.id}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono tracking-widest flex items-center gap-x-1.5 transition-colors disabled:opacity-50 ${
                        r.followingViewer
                          ? 'bg-white/10 hover:bg-red-500/20 hover:text-red-300 text-white/80 border border-white/10'
                          : 'bg-haunt-red hover:bg-red-600 text-white'
                      }`}
                    >
                      {busy === r.profile.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : r.followingViewer ? (
                        <UserCheck className="w-3 h-3" />
                      ) : (
                        <UserPlus className="w-3 h-3" />
                      )}
                      {r.followingViewer ? 'FOLLOWING' : 'FOLLOW'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
