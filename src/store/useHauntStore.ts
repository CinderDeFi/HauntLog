import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { format } from 'date-fns';

export type DeviceType = 'K-II' | 'REM-POD' | 'THERMAL' | 'SB7' | 'H4n';

export type LogEntry = {
  id: string;
  timestamp: string;
  device: DeviceType;
  value: string;
  note?: string;
  starred?: boolean;
};

export type CaseFile = {
  id: string;
  title: string;
  location: string;
  date: string;
  class: string;
  logs: LogEntry[];
  verdict: number;
};

export type User = {
  name: string;
  handle: string;
  tier: string;
};

type HauntState = {
  user: User;
  cases: CaseFile[];
  currentHunt: { id: string; logs: LogEntry[] } | null;
  addLog: (entry: Omit<LogEntry, 'id' | 'timestamp'>) => void;
  sealCase: () => void;
  startHunt: () => void;
};

export const useHauntStore = create<HauntState>()(
  persist(
    (set, get) => ({
      user: { name: 'Riley Hunts', handle: '@riley.hunts', tier: 'Pro' },
      cases: [
        {
          id: 'X4M-PT9',
          title: 'The whispering tenant',
          location: 'Old Lyon Theatre · Stage Left',
          date: 'May 15, 2026',
          class: 'III',
          logs: [
            { id: '1', timestamp: '2026-05-15T02:14:00', device: 'SB7', value: '"don\'t leave"', note: 'hunter asked "who is here?"', starred: true },
            { id: '2', timestamp: '2026-05-15T02:14:00', device: 'K-II', value: 'spike to 4 (red)', note: '1s after SB7', starred: true },
            { id: '3', timestamp: '2026-05-15T23:08:00', device: 'THERMAL', value: 'drop -14°F', note: 'stage left', starred: true },
          ],
          verdict: 78,
        },
      ],
      currentHunt: null,
      addLog: (entry) => {
        const timestamp = new Date().toISOString();
        const newLog: LogEntry = { ...entry, id: crypto.randomUUID(), timestamp };
        set((state) => {
          if (!state.currentHunt) {
            return { currentHunt: { id: 'live-' + Date.now(), logs: [newLog] } };
          }
          return {
            currentHunt: {
              ...state.currentHunt,
              logs: [...state.currentHunt.logs, newLog],
            },
          };
        });
      },
      sealCase: () => {
        const state = get();
        if (!state.currentHunt) return;
        const sealed: CaseFile = {
          id: 'X4M-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
          title: 'New Sealed Case',
          location: 'Active Hunt Location',
          date: format(new Date(), 'MMM dd, yyyy'),
          class: 'III',
          logs: state.currentHunt.logs,
          verdict: Math.floor(Math.random() * 30) + 70,
        };
        set((s) => ({
          cases: [sealed, ...s.cases],
          currentHunt: null,
        }));
      },
      startHunt: () => set({ currentHunt: { id: 'live-' + Date.now(), logs: [] } }),
    }),
    { name: 'hauntlog-storage' }
  )
);
