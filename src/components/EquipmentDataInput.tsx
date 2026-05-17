import type { EquipmentId } from '../store/useHauntStore';
import { PERSONAL_EXPERIENCE_ID } from '../store/useHauntStore';

// Each known device knows its own data shape. Custom or unknown devices
// have no structured input — they fall back to observation only.
export type EquipmentData =
  | { lights: number } // K-II
  | { proximity: 'far' | 'near' | 'touch' } // REM Pod
  | { baseTempF: number; observedTempF: number; unit: 'F' | 'C' } // Thermal
  | { word: string } // SB7
  | { transcription: string } // Voice
  | { magnitude: number; durationSec?: number } // Geophone
  | Record<string, unknown>; // anything else (custom)

// ============================================================
// INPUT
// ============================================================
type Props = {
  equipmentId: EquipmentId | typeof PERSONAL_EXPERIENCE_ID;
  value: Record<string, unknown> | undefined;
  onChange: (next: Record<string, unknown> | undefined) => void;
};

export default function EquipmentDataInput({ equipmentId, value, onChange }: Props) {
  // Personal experience or unknown device → no structured input.
  if (equipmentId === PERSONAL_EXPERIENCE_ID) return null;

  switch (equipmentId) {
    case 'k2':
      return <K2Input value={value} onChange={onChange} />;
    case 'rempod':
      return <RemPodInput value={value} onChange={onChange} />;
    case 'thermal':
      return <ThermalInput value={value} onChange={onChange} />;
    case 'sb7':
      return <SB7Input value={value} onChange={onChange} />;
    case 'voice':
      return <VoiceInput value={value} onChange={onChange} />;
    case 'geophone':
      return <GeophoneInput value={value} onChange={onChange} />;
    default:
      // Custom equipment: no structured input.
      return null;
  }
}

// ============================================================
// K-II — 1 to 5 lights
// ============================================================
function K2Input({ value, onChange }: Omit<Props, 'equipmentId'>) {
  const current = typeof value?.lights === 'number' ? (value.lights as number) : 0;

  return (
    <Container label="K-II READING">
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const on = n <= current;
          const color =
            n <= 2 ? 'bg-green-400' : n === 3 ? 'bg-yellow-400' : 'bg-red-500';
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(current === n ? undefined : { lights: n })}
              className={`flex-1 h-12 rounded-lg border transition-all ${
                on
                  ? `${color} border-transparent`
                  : 'bg-black border-white/10 hover:border-white/30'
              }`}
              title={`${n} ${n === 1 ? 'light' : 'lights'}`}
            />
          );
        })}
        <div className="ml-2 text-xs font-mono tabular-nums w-8 text-right text-white/60">
          {current || '—'}
        </div>
      </div>
      <Hint>Tap the highest light reached. Tap again to clear.</Hint>
    </Container>
  );
}

// ============================================================
// REM Pod — proximity
// ============================================================
function RemPodInput({ value, onChange }: Omit<Props, 'equipmentId'>) {
  const current = (value?.proximity as string | undefined) ?? '';
  const opts: Array<{ id: 'far' | 'near' | 'touch'; label: string }> = [
    { id: 'far', label: 'FAR' },
    { id: 'near', label: 'NEAR' },
    { id: 'touch', label: 'TOUCH' },
  ];

  return (
    <Container label="REM POD ALERT">
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => {
          const on = current === o.id;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() =>
                onChange(on ? undefined : { proximity: o.id })
              }
              className={`py-2.5 rounded-lg text-xs font-mono tracking-widest border transition-all ${
                on
                  ? 'bg-haunt-red border-haunt-red text-white'
                  : 'bg-black border-white/10 text-white/60 hover:border-white/30'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </Container>
  );
}

// ============================================================
// Thermal — base + observed
// ============================================================
function ThermalInput({ value, onChange }: Omit<Props, 'equipmentId'>) {
  const unit = (value?.unit as 'F' | 'C') ?? 'F';
  const base = (value?.baseTempF as number | undefined) ?? '';
  const observed = (value?.observedTempF as number | undefined) ?? '';
  const delta =
    typeof base === 'number' && typeof observed === 'number'
      ? observed - base
      : null;

  const update = (patch: Record<string, unknown>) => {
    const next = { unit, baseTempF: base, observedTempF: observed, ...patch };
    // Only emit when at least observed is set, otherwise clear.
    if (typeof next.observedTempF !== 'number') {
      onChange(undefined);
    } else {
      onChange(next);
    }
  };

  return (
    <Container label="THERMAL">
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="block text-[10px] font-mono text-white/40 tracking-widest mb-1">
            AMBIENT
          </label>
          <input
            type="number"
            step="0.1"
            value={base === '' ? '' : base}
            onChange={(e) =>
              update({
                baseTempF: e.target.value === '' ? undefined : parseFloat(e.target.value),
              })
            }
            placeholder="68"
            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 focus:border-haunt-red outline-none text-sm font-mono"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono text-white/40 tracking-widest mb-1">
            OBSERVED
          </label>
          <input
            type="number"
            step="0.1"
            value={observed === '' ? '' : observed}
            onChange={(e) =>
              update({
                observedTempF:
                  e.target.value === '' ? undefined : parseFloat(e.target.value),
              })
            }
            placeholder="61"
            className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 focus:border-haunt-red outline-none text-sm font-mono"
          />
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <div className="flex gap-1">
          {(['F', 'C'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => update({ unit: u })}
              className={`px-2 py-0.5 rounded text-[10px] font-mono tracking-widest ${
                unit === u
                  ? 'bg-white text-black'
                  : 'bg-transparent text-white/40 hover:text-white'
              }`}
            >
              °{u}
            </button>
          ))}
        </div>
        {delta !== null && (
          <div
            className={`font-mono ${
              delta < 0 ? 'text-haunt-red' : delta > 0 ? 'text-yellow-400' : 'text-white/40'
            }`}
          >
            Δ {delta > 0 ? '+' : ''}
            {delta.toFixed(1)}°{unit}
          </div>
        )}
      </div>
    </Container>
  );
}

// ============================================================
// SB7 — captured word
// ============================================================
function SB7Input({ value, onChange }: Omit<Props, 'equipmentId'>) {
  const word = (value?.word as string | undefined) ?? '';
  return (
    <Container label="SPIRIT BOX HIT">
      <input
        type="text"
        value={word}
        onChange={(e) =>
          onChange(e.target.value ? { word: e.target.value } : undefined)
        }
        placeholder="e.g. Mary"
        className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 focus:border-haunt-red outline-none text-sm"
      />
      <Hint>The word or phrase you heard clearly.</Hint>
    </Container>
  );
}

// ============================================================
// Voice Recorder — transcription
// ============================================================
function VoiceInput({ value, onChange }: Omit<Props, 'equipmentId'>) {
  const t = (value?.transcription as string | undefined) ?? '';
  return (
    <Container label="EVP TRANSCRIPTION">
      <textarea
        value={t}
        onChange={(e) =>
          onChange(e.target.value ? { transcription: e.target.value } : undefined)
        }
        rows={2}
        placeholder='What did the recording say?'
        className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 focus:border-haunt-red outline-none text-sm resize-none"
      />
    </Container>
  );
}

// ============================================================
// Geophone — magnitude
// ============================================================
function GeophoneInput({ value, onChange }: Omit<Props, 'equipmentId'>) {
  const mag = (value?.magnitude as number | undefined) ?? 0;
  const dur = (value?.durationSec as number | undefined) ?? '';
  return (
    <Container label="GEOPHONE">
      <div className="flex items-center gap-3 mb-2">
        <input
          type="range"
          min={0}
          max={10}
          step={1}
          value={mag}
          onChange={(e) =>
            onChange({ magnitude: parseInt(e.target.value, 10), durationSec: dur === '' ? undefined : dur })
          }
          className="flex-1 accent-haunt-red"
        />
        <div className="font-mono text-sm tabular-nums w-8 text-right">{mag || '—'}</div>
      </div>
      <div>
        <label className="block text-[10px] font-mono text-white/40 tracking-widest mb-1">
          DURATION (SECONDS, OPTIONAL)
        </label>
        <input
          type="number"
          min={0}
          step="0.5"
          value={dur === '' ? '' : dur}
          onChange={(e) =>
            onChange({
              magnitude: mag,
              durationSec: e.target.value === '' ? undefined : parseFloat(e.target.value),
            })
          }
          placeholder="2"
          className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 focus:border-haunt-red outline-none text-sm font-mono"
        />
      </div>
    </Container>
  );
}

// ============================================================
// shared layout
// ============================================================
function Container({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/60 border border-white/10 rounded-xl p-3">
      <div className="text-[10px] font-mono text-white/40 tracking-widest mb-2">{label}</div>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-white/40 mt-1.5">{children}</p>;
}

// ============================================================
// VIEWER — renders the structured data nicely on a sealed case
// ============================================================
export function EquipmentDataDisplay({
  equipmentId,
  data,
}: {
  equipmentId: EquipmentId | typeof PERSONAL_EXPERIENCE_ID;
  data: Record<string, unknown> | undefined;
}) {
  if (!data || Object.keys(data).length === 0) return null;

  if (equipmentId === 'k2' && typeof data.lights === 'number') {
    const n = data.lights;
    const color =
      n <= 2 ? 'bg-green-400' : n === 3 ? 'bg-yellow-400' : 'bg-red-500';
    return (
      <DisplayRow label="K-II">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`w-3 h-3 rounded-sm ${
                i <= n ? color : 'bg-white/10'
              }`}
            />
          ))}
          <span className="ml-1 font-mono text-xs">{n}/5</span>
        </div>
      </DisplayRow>
    );
  }

  if (equipmentId === 'rempod' && typeof data.proximity === 'string') {
    return (
      <DisplayRow label="REM Pod">
        <span className="font-mono text-xs tracking-widest text-haunt-red">
          {(data.proximity as string).toUpperCase()}
        </span>
      </DisplayRow>
    );
  }

  if (equipmentId === 'thermal' && typeof data.observedTempF === 'number') {
    const unit = (data.unit as 'F' | 'C' | undefined) ?? 'F';
    const base = data.baseTempF as number | undefined;
    const obs = data.observedTempF as number;
    const delta = typeof base === 'number' ? obs - base : null;
    return (
      <DisplayRow label="Thermal">
        <span className="font-mono text-xs">
          {typeof base === 'number' && `${base.toFixed(1)}°${unit} → `}
          {obs.toFixed(1)}°{unit}
          {delta !== null && (
            <span
              className={`ml-2 ${
                delta < 0 ? 'text-haunt-red' : delta > 0 ? 'text-yellow-400' : 'text-white/40'
              }`}
            >
              ({delta > 0 ? '+' : ''}
              {delta.toFixed(1)}°)
            </span>
          )}
        </span>
      </DisplayRow>
    );
  }

  if (equipmentId === 'sb7' && typeof data.word === 'string') {
    return (
      <DisplayRow label="SB7">
        <span className="font-mono text-xs">"{data.word as string}"</span>
      </DisplayRow>
    );
  }

  if (equipmentId === 'voice' && typeof data.transcription === 'string') {
    return (
      <DisplayRow label="EVP">
        <span className="text-xs italic">"{data.transcription as string}"</span>
      </DisplayRow>
    );
  }

  if (equipmentId === 'geophone' && typeof data.magnitude === 'number') {
    const mag = data.magnitude as number;
    const dur = data.durationSec as number | undefined;
    return (
      <DisplayRow label="Geophone">
        <span className="font-mono text-xs">
          {mag}/10
          {typeof dur === 'number' && ` for ${dur}s`}
        </span>
      </DisplayRow>
    );
  }

  return null;
}

function DisplayRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-x-2 text-xs">
      <span className="text-[10px] font-mono tracking-widest text-white/40">
        {label.toUpperCase()}
      </span>
      <span className="text-white/80">{children}</span>
    </div>
  );
}
