import {
  EQUIPMENT_CATALOG,
  PERSONAL_EXPERIENCE_ID,
  type EquipmentId,
} from '../store/useHauntStore';

/**
 * Maps each equipment kind to a Tailwind color palette for use in
 * chips on case file displays. The colors follow the convention
 * established on the landing-page sample card so real cases match
 * the marketing tease.
 *
 * Returns {bg, text, border} class strings ready to drop into JSX:
 *   <span className={`px-2 py-1 ${cls.bg} ${cls.text} ${cls.border} ...`}>
 */
export type EquipmentChipColors = {
  bg: string;
  text: string;
  border: string;
  /** A saturated bg used for the colored accent bar on log rows. */
  bar: string;
};

const FALLBACK: EquipmentChipColors = {
  bg: 'bg-white/10',
  text: 'text-white/70',
  border: 'border-white/10',
  bar: 'bg-white/30',
};

const COLORS: Record<string, EquipmentChipColors> = {
  // SB7 spirit boxes — voice / words — purple
  sb7: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    bar: 'bg-purple-500',
  },
  // K-II EMF — electromagnetic spikes — brand red
  k2: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/30',
    bar: 'bg-red-500',
  },
  // REM Pod — proximity touches — emerald green
  rempod: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bar: 'bg-emerald-500',
  },
  // Thermal — temperature deltas — cyan (cold spot)
  thermal: {
    bg: 'bg-cyan-500/10',
    text: 'text-cyan-400',
    border: 'border-cyan-500/30',
    bar: 'bg-cyan-500',
  },
  // Voice recorder — EVP — amber
  voice: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    bar: 'bg-amber-500',
  },
  // Geophone — vibration / footstep — blue
  geophone: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    bar: 'bg-blue-500',
  },
};

/**
 * Returns chip colors for a given equipment id. Personal experiences
 * are visually distinct (warm gray-white) since they're not gear.
 * Unknown / custom equipment uses a neutral fallback.
 */
export function equipmentChipColors(
  equipmentId: EquipmentId | typeof PERSONAL_EXPERIENCE_ID
): EquipmentChipColors {
  if (equipmentId === PERSONAL_EXPERIENCE_ID) {
    return {
      bg: 'bg-white/10',
      text: 'text-white/80',
      border: 'border-white/20',
      bar: 'bg-white/50',
    };
  }
  // Match against the catalog by id (lowercase for safety since
  // userMemory might have stored uppercase).
  const known = EQUIPMENT_CATALOG.find((e) => e.id === equipmentId);
  if (known && COLORS[known.id]) return COLORS[known.id];
  return FALLBACK;
}
