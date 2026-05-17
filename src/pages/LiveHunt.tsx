import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useHauntStore,
  equipmentAbbr,
} from '../store/useHauntStore';
import LogSheet from '../components/LogSheet';
import {
  MapPin,
  Plus,
  Star,
  Trash2,
  Lock,
  Globe,
  EyeOff,
  ShieldCheck,
  X as XIcon,
} from 'lucide-react';

function formatTimeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export default function LiveHunt() {
  const navigate = useNavigate();
  const activeHunt = useHauntStore((s) => s.activeHunt);
  const updateLog = useHauntStore((s) => s.updateLog);
  const deleteLog = useHauntStore((s) => s.deleteLog);
  const cancelHunt = useHauntStore((s) => s.cancelHunt);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!activeHunt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [activeHunt]);

  if (!activeHunt) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="text-xs font-mono text-white/40 tracking-widest mb-4">
          // NO ACTIVE HUNT
        </div>
        <h1 className="text-5xl font-medium tracking-tighter mb-4">Ready when you are.</h1>
        <p className="text-white/60 mb-10">
          Start a new hunt, pick your visibility, and we'll keep the timeline.
        </p>
        <button
          onClick={() => navigate('/app/hunt/new')}
          className="bg-haunt-red hover:bg-red-600 text-white px-10 py-5 rounded-2xl font-mono tracking-widest text-lg transition-colors active:scale-[0.98]"
        >
          START A HUNT →
        </button>
      </div>
    );
  }

  const elapsed = now - new Date(activeHunt.startedAt).getTime();
  const reversedLogs = [...activeHunt.logs].reverse();

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-x-3 mb-2 flex-wrap">
            <div className="flex items-center gap-x-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-haunt-red"></span>
              </span>
              <div className="text-xs font-mono text-haunt-red tracking-widest">LIVE HUNT</div>
            </div>

            {/* Visibility badge */}
            {activeHunt.visibility === 'public' && (
              <div className="text-[10px] font-mono tracking-widest text-green-400 inline-flex items-center gap-x-1 px-2 py-0.5 bg-green-400/10 rounded">
                <Globe className="w-3 h-3" /> PUBLIC
              </div>
            )}
            {activeHunt.visibility === 'anonymous' && (
              <div className="text-[10px] font-mono tracking-widest text-amber-400 inline-flex items-center gap-x-1 px-2 py-0.5 bg-amber-400/10 rounded">
                <EyeOff className="w-3 h-3" /> ANONYMOUS
              </div>
            )}
            {activeHunt.visibility === 'private' && (
              <div className="text-[10px] font-mono tracking-widest text-white/60 inline-flex items-center gap-x-1 px-2 py-0.5 bg-white/10 rounded">
                <Lock className="w-3 h-3" /> PRIVATE
              </div>
            )}

            {/* GPS verified badge */}
            {activeHunt.gpsVerified && (
              <div className="text-[10px] font-mono tracking-widest text-green-400 inline-flex items-center gap-x-1 px-2 py-0.5 bg-green-400/10 rounded">
                <ShieldCheck className="w-3 h-3" /> GPS VERIFIED
              </div>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-medium tracking-tighter">
            {activeHunt.location}
          </h1>
          {activeHunt.zone && (
            <p className="text-white/60 mt-1 flex items-center gap-x-1.5">
              <MapPin className="w-4 h-4" /> {activeHunt.zone}
            </p>
          )}
        </div>

        <div className="text-right">
          <div className="font-mono text-3xl md:text-4xl tabular-nums tracking-tight">
            {formatDuration(elapsed)}
          </div>
          <div className="text-xs font-mono text-white/40 tracking-widest mt-1">ELAPSED</div>
        </div>
      </div>

      {/* Equipment manifest (only if any gear was selected) */}
      {activeHunt.equipmentUsed.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          {activeHunt.equipmentUsed.map((id) => (
            <div
              key={id}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs font-mono text-white/70 tracking-widest"
            >
              {equipmentAbbr(id, activeHunt.customEquipment)}
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 md:p-8 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="text-xs font-mono text-white/40 tracking-widest">// SESSION LOG</div>
          <div className="text-xs font-mono text-white/40">
            {activeHunt.logs.length}{' '}
            {activeHunt.logs.length === 1 ? 'EVENT' : 'EVENTS'}
          </div>
        </div>

        {activeHunt.logs.length === 0 ? (
          <div className="text-center py-12 text-white/40">
            <p className="text-sm">No events logged yet.</p>
            <p className="text-xs mt-1">Tap the button below when something happens.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reversedLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-4 bg-black/40 border border-white/5 rounded-2xl px-4 py-3 group"
              >
                <div className="font-mono text-xs text-white/40 w-20 pt-1 shrink-0 tabular-nums">
                  {formatTimeOfDay(log.timestamp)}
                </div>
                <div className="shrink-0">
                  <span className="px-2.5 py-1 bg-white/10 text-xs font-mono rounded-lg tracking-widest">
                    {equipmentAbbr(log.equipmentId, activeHunt.customEquipment)}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white break-words">{log.observation}</p>
                  {log.note && (
                    <p className="text-white/50 text-sm mt-1 break-words">{log.note}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => updateLog(log.id, { starred: !log.starred })}
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
                    title={log.starred ? 'Unstar' : 'Star'}
                  >
                    <Star
                      className={`w-4 h-4 ${
                        log.starred ? 'text-yellow-400 fill-yellow-400' : 'text-white/40'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => deleteLog(log.id)}
                    className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-haunt-red"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
        <button
          onClick={() => setSheetOpen(true)}
          className="bg-haunt-red hover:bg-red-600 text-white py-5 rounded-2xl font-mono tracking-widest text-lg flex items-center justify-center gap-x-3 transition-colors active:scale-[0.98]"
        >
          <Plus className="w-5 h-5" />
          LOG EVENT
        </button>
        <button
          onClick={() => navigate('/app/seal')}
          disabled={activeHunt.logs.length === 0}
          className="bg-white text-black hover:bg-white/90 disabled:opacity-30 disabled:cursor-not-allowed py-5 px-8 rounded-2xl font-mono tracking-widest flex items-center justify-center gap-x-2 transition-colors active:scale-[0.98]"
          title={
            activeHunt.logs.length === 0
              ? 'Log at least one event before sealing'
              : 'Seal case file'
          }
        >
          <Lock className="w-4 h-4" />
          SEAL CASE
        </button>
        <button
          onClick={() => setConfirmCancel(true)}
          className="py-5 px-6 text-white/50 hover:text-haunt-red rounded-2xl font-mono tracking-widest text-sm"
        >
          CANCEL HUNT
        </button>
      </div>

      <LogSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />

      {confirmCancel && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setConfirmCancel(false)}
        >
          <div
            className="bg-zinc-950 border border-white/10 rounded-3xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-mono text-haunt-red tracking-widest">CANCEL HUNT?</div>
              <button
                onClick={() => setConfirmCancel(false)}
                className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center"
              >
                <XIcon className="w-4 h-4" />
              </button>
            </div>
            <p className="text-white/70 mb-6 text-sm">
              You'll lose all {activeHunt.logs.length} logged{' '}
              {activeHunt.logs.length === 1 ? 'event' : 'events'} and your check-in will end.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCancel(false)}
                className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl"
              >
                Keep hunting
              </button>
              <button
                onClick={() => {
                  cancelHunt();
                  setConfirmCancel(false);
                }}
                className="flex-1 bg-haunt-red hover:bg-red-600 py-3 rounded-xl font-mono tracking-widest text-sm"
              >
                DISCARD
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
