import { useEffect, useMemo, useState } from 'react';
import {
  useHauntStore,
  equipmentLabel,
  EQUIPMENT_CATALOG,
  PERSONAL_EXPERIENCE_ID,
  PERSONAL_EXPERIENCE_LABEL,
  type EquipmentId,
} from '../store/useHauntStore';
import { Star, X, Clock } from 'lucide-react';
import EquipmentDataInput from './EquipmentDataInput';
import PhotoUploadField, { type PendingPhoto } from './PhotoUploadField';

type Props = {
  open: boolean;
  onClose: () => void;
};

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes()) +
    ':' +
    pad(d.getSeconds())
  );
}

export default function LogSheet({ open, onClose }: Props) {
  const activeHunt = useHauntStore((s) => s.activeHunt);
  const addLog = useHauntStore((s) => s.addLog);

  const equipmentUsed = activeHunt?.equipmentUsed ?? [];
  const customMap = activeHunt?.customEquipment;

  // Compose the device chip list:
  //   - Personal experience (always first)
  //   - The pre-selected equipment
  //   - "More devices…" expands to the full catalog if user wants to pick something they
  //     didn't pre-commit to.
  const preselectedChips = equipmentUsed;
  const overflowCatalog = useMemo(
    () => EQUIPMENT_CATALOG.filter((c) => !equipmentUsed.includes(c.id)),
    [equipmentUsed]
  );

  const [equipmentId, setEquipmentId] = useState<
    EquipmentId | typeof PERSONAL_EXPERIENCE_ID
  >(PERSONAL_EXPERIENCE_ID);
  const [observation, setObservation] = useState('');
  const [note, setNote] = useState('');
  const [starred, setStarred] = useState(false);
  const [timestamp, setTimestamp] = useState<string>(toLocalInputValue(new Date()));
  /**
   * Which quick-offset chip is currently active. When the user types into
   * the datetime input directly, this resets to null (the chip-highlight
   * stops following the value).
   */
  const [quickOffset, setQuickOffset] = useState<number | null>(0);
  const [showMoreDevices, setShowMoreDevices] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | undefined>(undefined);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);

  useEffect(() => {
    if (open) {
      setEquipmentId(equipmentUsed[0] ?? PERSONAL_EXPERIENCE_ID);
      setObservation('');
      setNote('');
      setStarred(false);
      setTimestamp(toLocalInputValue(new Date()));
      setQuickOffset(0);
      setShowMoreDevices(false);
      setData(undefined);
      setPhotos([]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Set the timestamp to now-minus-N-minutes (0 = exactly now). Highlights
   * the matching chip.
   */
  const applyQuickOffset = (minutes: number) => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - minutes);
    setTimestamp(toLocalInputValue(d));
    setQuickOffset(minutes);
  };

  // Clear structured data when switching devices — the shape doesn't carry over.
  const setDevice = (id: EquipmentId | typeof PERSONAL_EXPERIENCE_ID) => {
    setEquipmentId(id);
    setData(undefined);
  };

  if (!open) return null;

  const canSave = observation.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    // The datetime-local input can be cleared to '' (or hold an invalid
    // value), which makes new Date(...).toISOString() throw RangeError and
    // silently kills the save. Fall back to "now" for an unparseable time.
    const parsed = new Date(timestamp);
    const timestampIso = Number.isNaN(parsed.getTime())
      ? new Date().toISOString()
      : parsed.toISOString();
    addLog({
      equipmentId,
      observation: observation.trim(),
      note: note.trim() || undefined,
      starred,
      timestamp: timestampIso,
      data: data && Object.keys(data).length > 0 ? data : undefined,
      pendingPhotoFiles: photos.length > 0 ? photos.map((p) => p.file) : undefined,
    });
    onClose();
  };

  const Chip = ({
    id,
    label,
    accent,
  }: {
    id: EquipmentId | typeof PERSONAL_EXPERIENCE_ID;
    label: string;
    accent?: boolean;
  }) => {
    const on = id === equipmentId;
    return (
      <button
        onClick={() => setDevice(id)}
        className={`px-4 py-2 rounded-xl text-sm border transition-all ${
          on
            ? 'bg-haunt-red text-white border-haunt-red'
            : accent
            ? 'bg-white/5 border-white/15 text-white/80 hover:border-white/40'
            : 'bg-black border-white/10 text-white/70 hover:border-white/30'
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[1300] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-zinc-950 border border-white/10 rounded-t-3xl md:rounded-3xl max-h-[90vh] overflow-y-auto pb-[env(safe-area-inset-bottom)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-zinc-950">
          <div>
            <div className="text-xs font-mono text-haunt-red tracking-widest">NEW EVENT</div>
            <div className="text-white/60 text-xs mt-0.5">
              {activeHunt?.location}
              {activeHunt?.zone ? ` · ${activeHunt.zone}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-white/10 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* DEVICE CHIPS */}
          <div>
            <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
              DEVICE OR EXPERIENCE
            </label>
            <div className="flex flex-wrap gap-2">
              <Chip
                id={PERSONAL_EXPERIENCE_ID}
                label={PERSONAL_EXPERIENCE_LABEL}
                accent
              />
              {preselectedChips.map((id) => (
                <Chip key={id} id={id} label={equipmentLabel(id, customMap)} />
              ))}

              {/* "More devices…" expands to catalog items that weren't pre-selected */}
              {!showMoreDevices && overflowCatalog.length > 0 && (
                <button
                  onClick={() => setShowMoreDevices(true)}
                  className="px-3 py-2 rounded-xl text-xs font-mono tracking-widest border border-white/10 text-white/50 hover:border-white/30"
                >
                  + MORE DEVICES
                </button>
              )}
              {showMoreDevices &&
                overflowCatalog.map((e) => (
                  <Chip key={e.id} id={e.id} label={e.name} />
                ))}
            </div>
            <p className="text-xs text-white/40 mt-2">
              Use <b>Personal experience</b> for things your gear didn't catch (cold spots,
              touches, sounds you heard).
            </p>
          </div>

          {/* EQUIPMENT-SPECIFIC STRUCTURED DATA */}
          <EquipmentDataInput
            equipmentId={equipmentId}
            value={data}
            onChange={setData}
          />

          {/* OBSERVATION */}
          <div>
            <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
              WHAT HAPPENED <span className="text-haunt-red">*</span>
            </label>
            <input
              autoFocus
              value={observation}
              onChange={(e) => setObservation(e.target.value)}
              placeholder={`spike to 4 (red) · "don't leave" · heard footsteps overhead`}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none"
            />
          </div>

          {/* NOTE */}
          <div>
            <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
              NOTE (OPTIONAL)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder={`e.g. "right after I asked who was here"`}
              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none resize-none"
            />
          </div>

          {/* PHOTOS — staged client-side; uploaded to Supabase Storage at seal time */}
          <PhotoUploadField photos={photos} onChange={setPhotos} />

          {/* TIMESTAMP + STAR */}
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-xs font-mono text-white/40 tracking-widest mb-2">
                WHEN
              </label>
              {/* Quick offset chips — Common case is "logged a few minutes
                  after the event happened". Tap to backdate the timestamp. */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                {(
                  [
                    { mins: 0, label: 'NOW' },
                    { mins: 1, label: '-1m' },
                    { mins: 5, label: '-5m' },
                    { mins: 15, label: '-15m' },
                    { mins: 30, label: '-30m' },
                  ] as const
                ).map((c) => {
                  const active = quickOffset === c.mins;
                  return (
                    <button
                      key={c.mins}
                      type="button"
                      onClick={() => applyQuickOffset(c.mins)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-mono tracking-widest transition-colors inline-flex items-center gap-x-1 ${
                        active
                          ? 'bg-haunt-red text-white'
                          : 'bg-white/5 text-white/70 hover:bg-white/10 border border-white/10'
                      }`}
                    >
                      {c.mins === 0 && <Clock className="w-3 h-3" />}
                      {c.label}
                    </button>
                  );
                })}
              </div>
              <input
                type="datetime-local"
                step="1"
                value={timestamp}
                onChange={(e) => {
                  setTimestamp(e.target.value);
                  // Manual edit — break the chip association.
                  setQuickOffset(null);
                }}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-haunt-red outline-none text-sm font-mono"
              />
            </div>
            <button
              onClick={() => setStarred(!starred)}
              className={`px-4 py-3 rounded-xl border flex items-center justify-center gap-2 transition-all ${
                starred
                  ? 'bg-yellow-400/10 border-yellow-400 text-yellow-400'
                  : 'bg-black border-white/10 text-white/60 hover:border-white/30'
              }`}
            >
              <Star className={`w-5 h-5 ${starred ? 'fill-yellow-400' : ''}`} />
              <span className="text-sm font-mono tracking-widest">
                {starred ? 'STARRED' : 'STAR THIS'}
              </span>
            </button>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex items-center gap-3 sticky bottom-0 bg-zinc-950">
          <button onClick={onClose} className="px-6 py-3 text-white/60 hover:text-white">
            CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 bg-haunt-red hover:bg-red-600 disabled:opacity-30 disabled:cursor-not-allowed text-white py-3 rounded-xl font-mono tracking-widest active:scale-[0.98] transition-all"
          >
            LOG EVENT
          </button>
        </div>
      </div>
    </div>
  );
}
