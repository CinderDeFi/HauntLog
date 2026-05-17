import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  useHauntStore,
  equipmentLabel,
  equipmentAbbr,
} from '../store/useHauntStore';
import {
  ArrowLeft,
  Globe,
  Lock,
  EyeOff,
  MapPin,
  Star,
  Link as LinkIcon,
  ShieldCheck,
} from 'lucide-react';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(startIso: string, endIso?: string) {
  if (!endIso) return '—';
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function CaseView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const cases = useHauntStore((s) => s.cases);
  const caseFile = cases.find((c) => c.id === id);

  if (!caseFile) {
    return (
      <div className="min-h-screen bg-black text-white px-6 py-20 text-center">
        <div className="text-xs font-mono text-white/40 tracking-widest mb-4">// 404</div>
        <h1 className="text-3xl font-medium mb-2">Case not found</h1>
        <p className="text-white/60 mb-8">
          This case may have been deleted, set to private, or never existed.
        </p>
        <Link
          to="/app/vault"
          className="inline-block bg-white text-black px-6 py-3 rounded-xl font-mono tracking-widest text-sm hover:bg-haunt-red hover:text-white transition-colors"
        >
          ← BACK TO VAULT
        </Link>
      </div>
    );
  }

  const sortedLogs = [...caseFile.logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const starredLogs = sortedLogs.filter((l) => l.starred);

  const deviceCounts = caseFile.equipmentUsed.map((id) => ({
    id,
    label: equipmentLabel(id, caseFile.customEquipment),
    abbr: equipmentAbbr(id, caseFile.customEquipment),
    count: caseFile.logs.filter((l) => l.equipmentId === id).length,
  }));

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/case/${caseFile.id}` : '';

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      /* best-effort */
    }
  };

  const ownerDisplay =
    caseFile.visibility === 'anonymous' ? 'Anonymous investigator' : caseFile.ownerHandle;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-white/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-x-2 text-white/60 hover:text-white text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> BACK
          </button>
          <div className="flex items-center gap-x-3">
            {/* Visibility badge */}
            {caseFile.visibility === 'public' && (
              <div className="text-xs font-mono tracking-widest text-green-400 inline-flex items-center gap-x-1.5">
                <Globe className="w-3 h-3" /> PUBLIC
              </div>
            )}
            {caseFile.visibility === 'anonymous' && (
              <div className="text-xs font-mono tracking-widest text-amber-400 inline-flex items-center gap-x-1.5">
                <EyeOff className="w-3 h-3" /> ANONYMOUS
              </div>
            )}
            {caseFile.visibility === 'private' && (
              <div className="text-xs font-mono tracking-widest text-white/60 inline-flex items-center gap-x-1.5">
                <Lock className="w-3 h-3" /> PRIVATE
              </div>
            )}

            {caseFile.gpsVerified && (
              <div className="text-xs font-mono tracking-widest text-green-400 inline-flex items-center gap-x-1.5">
                <ShieldCheck className="w-3 h-3" /> GPS VERIFIED
              </div>
            )}

            {caseFile.visibility !== 'private' && (
              <button
                onClick={copyShareLink}
                className="text-xs font-mono tracking-widest text-white/60 hover:text-white flex items-center gap-x-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg"
              >
                <LinkIcon className="w-3 h-3" />
                COPY LINK
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-4 text-xs font-mono text-white/40 tracking-widest">
          CASE FILE · #{caseFile.id}
        </div>
        <h1 className="text-5xl md:text-6xl font-medium tracking-tighter leading-[1.05] mb-3">
          {caseFile.title}
        </h1>
        <div className="flex items-center gap-x-2 text-white/70 mb-1">
          <MapPin className="w-4 h-4 text-haunt-red" />
          <span>
            {caseFile.location}
            {caseFile.zone ? ` · ${caseFile.zone}` : ''}
          </span>
        </div>
        <div className="text-sm text-white/40 mb-8">
          Logged by <span className="text-white/70 font-medium">{ownerDisplay}</span> · Started{' '}
          {formatDateTime(caseFile.startedAt)}
          {caseFile.endedAt && ` · ${formatDuration(caseFile.startedAt, caseFile.endedAt)} long`}
        </div>

        {caseFile.summary && (
          <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 mb-8">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-3">// SUMMARY</div>
            <p className="text-white/80 leading-relaxed whitespace-pre-wrap">{caseFile.summary}</p>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
            <div className="text-3xl font-mono tabular-nums">{caseFile.logs.length}</div>
            <div className="text-xs text-white/40 mt-1">EVENTS</div>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
            <div className="text-3xl font-mono tabular-nums">{caseFile.equipmentUsed.length}</div>
            <div className="text-xs text-white/40 mt-1">DEVICES</div>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
            <div className="text-3xl font-mono tabular-nums">
              {formatDuration(caseFile.startedAt, caseFile.endedAt)}
            </div>
            <div className="text-xs text-white/40 mt-1">DURATION</div>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
            <div className="text-3xl font-mono tabular-nums flex items-center gap-x-2">
              {starredLogs.length}
              {starredLogs.length > 0 && (
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
              )}
            </div>
            <div className="text-xs text-white/40 mt-1">STARRED</div>
          </div>
        </div>

        {/* Equipment manifest only if present */}
        {deviceCounts.length > 0 && (
          <div className="mb-10">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
              // EQUIPMENT MANIFEST
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {deviceCounts.map((d) => (
                <div key={d.id} className="bg-zinc-900 border border-white/10 rounded-2xl p-4">
                  <div className="font-mono text-xs tracking-widest text-haunt-red mb-1">
                    {d.abbr}
                  </div>
                  <div className="font-medium">{d.label}</div>
                  <div className="text-xs text-white/40 mt-2">
                    <span className="text-white">{d.count}</span>{' '}
                    {d.count === 1 ? 'log' : 'logs'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Starred highlights */}
        {starredLogs.length > 0 && (
          <div className="mb-10">
            <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
              // STARRED HIGHLIGHTS · {starredLogs.length}
            </div>
            <div className="space-y-3">
              {starredLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-yellow-400/5 border border-yellow-400/20 rounded-2xl p-5 flex items-start gap-4"
                >
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400 shrink-0 mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-x-3 mb-1">
                      <span className="font-mono text-xs tracking-widest text-white/60">
                        {formatTime(log.timestamp)}
                      </span>
                      <span className="px-2 py-0.5 bg-white/10 text-[10px] font-mono rounded-md tracking-widest">
                        {equipmentAbbr(log.equipmentId, caseFile.customEquipment)}
                      </span>
                    </div>
                    <p className="text-white text-lg">{log.observation}</p>
                    {log.note && (
                      <p className="text-white/60 text-sm mt-2 italic">{log.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Full log */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-mono text-white/40 tracking-widest">
              // FULL SESSION LOG
            </div>
            <div className="text-xs font-mono text-white/40">
              {sortedLogs.length} {sortedLogs.length === 1 ? 'entry' : 'entries'}
            </div>
          </div>
          <div className="bg-zinc-900 border border-white/10 rounded-3xl divide-y divide-white/5">
            {sortedLogs.length === 0 && (
              <div className="p-6 text-center text-white/40 text-sm">No events were logged.</div>
            )}
            {sortedLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-4 px-4 md:px-6 py-3">
                <div className="font-mono text-xs text-white/40 w-20 pt-1 shrink-0 tabular-nums">
                  {formatTime(log.timestamp)}
                </div>
                <div className="shrink-0">
                  <span className="px-2 py-1 bg-white/10 text-[10px] font-mono rounded-md tracking-widest">
                    {equipmentAbbr(log.equipmentId, caseFile.customEquipment)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white break-words">{log.observation}</p>
                  {log.note && (
                    <p className="text-white/50 text-sm mt-0.5 break-words">{log.note}</p>
                  )}
                </div>
                {log.starred && (
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400 shrink-0 mt-1" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-dashed border-white/10 rounded-3xl p-6 text-center text-white/40 text-sm">
          Video evidence attachments coming in a later release. <br />
          Once added, you'll be able to link footage from your camera review to specific log
          entries.
        </div>

        <div className="mt-12 text-center text-xs font-mono text-white/30 tracking-widest">
          SEALED · CASE FILE #{caseFile.id}
        </div>
      </div>
    </div>
  );
}
