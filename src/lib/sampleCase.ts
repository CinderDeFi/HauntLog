import type { CaseFile, LogEntry } from '../store/useHauntStore';

/**
 * A complete, hardcoded sample case file shown to new users in their
 * empty Vault/Feed and accessible via /case/sample. It demonstrates
 * the full shape of a sealed case so users understand what they're
 * building toward.
 *
 * This is NOT a database row. It only exists in JS bundle. CaseView
 * detects the id "sample" and renders it from this constant.
 */

export const SAMPLE_CASE_ID = 'sample';

// Timestamps reflect a one-night hunt about 78 minutes long. Generated
// fresh on import so the dates feel recent without changing the story.
const baseDate = new Date();
baseDate.setHours(22, 14, 3, 0);
// Use yesterday so it doesn't conflict with "today's hunt" framing.
baseDate.setDate(baseDate.getDate() - 1);

function offsetIso(baseIso: string, addMinutes: number, addSeconds = 0): string {
  const d = new Date(baseIso);
  d.setMinutes(d.getMinutes() + addMinutes);
  d.setSeconds(d.getSeconds() + addSeconds);
  return d.toISOString();
}

const startedAt = baseDate.toISOString();

const sampleLogs: LogEntry[] = [
  {
    id: 'sample-log-1',
    timestamp: startedAt,
    equipmentId: 'sb7',
    equipmentLabel: 'SB7 Spirit Box',
    observation: '"don\'t leave"',
    note: 'Female voice, third sweep, channel 7. First voice. Cold sweep, no wind.',
    starred: true,
    data: {
      sweep: 3,
      channel: 7,
      direction: 'forward',
    },
  },
  {
    id: 'sample-log-2',
    timestamp: offsetIso(startedAt, 0, 8),
    equipmentId: 'k2',
    equipmentLabel: 'K-II EMF Meter',
    observation: 'Spike to red zone (5+)',
    note: 'Held for 4 seconds, then dropped to flat. Came 8 seconds after the SB7. I asked "are you here?" right before.',
    starred: true,
    data: {
      reading: 5,
      duration_seconds: 4,
    },
  },
  {
    id: 'sample-log-3',
    timestamp: offsetIso(startedAt, 37, 44),
    equipmentId: 'thermal',
    equipmentLabel: 'Thermal',
    observation: 'Temperature drop of -14°F',
    note: 'Center of stage, no draft source. Cleared once I stepped through it. Walked back, gone.',
    data: {
      delta_f: -14,
      ambient_f: 64,
    },
  },
  {
    id: 'sample-log-4',
    timestamp: offsetIso(startedAt, 54, 19),
    equipmentId: 'rempod',
    equipmentLabel: 'REM Pod',
    observation: 'Multi-touch alert',
    note: 'Touched 3 times in 8 seconds, then silence. Audio recorder caught a footstep right after the last hit.',
    data: {
      touches: 3,
      window_seconds: 8,
    },
  },
  {
    id: 'sample-log-5',
    timestamp: offsetIso(startedAt, 76, 57),
    equipmentId: '__personal__',
    equipmentLabel: 'Personal experience',
    observation: 'Sounds of breathing behind us',
    note: 'Both of us heard it. No one else in the building. Ended the session 15 minutes early.',
    starred: true,
  },
];

export const SAMPLE_CASE: CaseFile = {
  id: SAMPLE_CASE_ID,
  ownerHandle: '@riley.hunts',
  title: 'The Whispering Tenant',
  summary:
    'Five distinct events at the stage-left mark in 78 minutes. K-II spike directly responded to a question following an SB7 capture. Cold spot localized to one footprint of space. Voice analysis still pending.',
  location: 'Old Lyon Theatre',
  zone: 'Stage left',
  startedAt,
  endedAt: offsetIso(startedAt, 78, 0),
  visibility: 'public',
  gpsVerified: true,
  equipmentUsed: ['sb7', 'k2', 'thermal', 'rempod'],
  tags: ['theatre', 'sb7', 'k2-spike', 'cold-spot', 'class-iii'],
  logs: sampleLogs,
  sealed: true,
};

/** Quick check used by CaseView to decide which render path to take. */
export function isSampleCaseId(id: string | undefined): boolean {
  return id === SAMPLE_CASE_ID;
}
