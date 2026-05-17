// src/components/SampleCaseModal.tsx
import { X, Star, Download, Share2 } from 'lucide-react';
import { useHauntStore } from '../store/useHauntStore';
import { format } from 'date-fns';

interface SampleCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SampleCaseModal({ isOpen, onClose }: SampleCaseModalProps) {
  const { cases } = useHauntStore();
  const demoCase = cases.find(c => c.id === 'X4M-PT9') || cases[0];

  if (!isOpen || !demoCase) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div 
        onClick={e => e.stopPropagation()}
        className="max-w-4xl w-full bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl max-h-[95vh] flex flex-col"
      >
        {/* HEADER */}
        <div className="px-8 py-6 border-b border-white/10 flex items-center justify-between bg-black">
          <div className="flex items-center gap-x-3">
            <img src="/hauntlog-mark-color.svg" alt="HauntLog" className="h-8" />
            <div>
              <div className="font-mono text-2xl tracking-tighter">CASE FILE</div>
              <div className="text-xs text-white/40">#{demoCase.id} • SEALED • {demoCase.date}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-2xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-8">
          {/* CASE HEADER */}
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-x-4">
                <span className="text-7xl">★</span>
                <div>
                  <span className="text-5xl font-medium">CLASS {demoCase.class}</span>
                </div>
              </div>
              <h1 className="text-5xl font-medium mt-2">{demoCase.title}</h1>
              <p className="text-2xl text-white/70 mt-1">{demoCase.location}</p>
            </div>

            <div className="text-right">
              <div className="text-8xl font-mono font-light text-haunt-red">{demoCase.verdict}%</div>
              <div className="uppercase text-xs tracking-[2px] text-white/40 -mt-2">AI VERDICT</div>
            </div>
          </div>

          {/* STATS BAR */}
          <div className="mt-10 grid grid-cols-4 gap-6 text-center border-y border-white/10 py-6">
            <div>
              <div className="text-4xl font-mono">{demoCase.logs.length}</div>
              <div className="text-xs font-medium text-white/40">EVENTS LOGGED</div>
            </div>
            <div>
              <div className="text-4xl font-mono">4</div>
              <div className="text-xs font-medium text-white/40">DEVICES USED</div>
            </div>
            <div>
              <div className="text-4xl font-mono">01:47</div>
              <div className="text-xs font-medium text-white/40">DURATION</div>
            </div>
            <div>
              <div className="text-4xl font-mono flex justify-center gap-x-1">
                {demoCase.logs.filter(l => l.starred).length}
                <Star className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-xs font-medium text-white/40">STARRED</div>
            </div>
          </div>

          {/* AI VERDICT */}
          <div className="mt-10">
            <div className="uppercase text-xs tracking-widest text-white/40 mb-3">// AI VERDICT</div>
            <div className="bg-black/50 rounded-3xl p-6">
              <div className="flex items-center gap-x-4">
                <div className="text-6xl font-light text-haunt-red">78%</div>
                <div className="flex-1 text-white/80">
                  Analysis of {demoCase.logs.length} logged events across 4 devices. 
                  Clustering detected: K-II and REM pod alerts at 02:14 within 4 seconds of each other. 
                  SB7 word capture corroborates timing.
                </div>
              </div>
            </div>
          </div>

          {/* EQUIPMENT MANIFEST */}
          <div className="mt-12">
            <div className="uppercase text-xs tracking-widest text-white/40 mb-4">// EQUIPMENT MANIFEST</div>
            <div className="grid grid-cols-5 gap-4">
              {['K-II EMF', 'REM POD', 'THERMAL', 'SB7', 'H4n'].map((device, i) => (
                <div key={i} className="bg-white/5 rounded-2xl p-4 text-center">
                  <div className="text-sm font-medium">{device}</div>
                  <div className="text-4xl font-mono text-white/70 mt-1">{[8,4,6,3,2][i]}</div>
                  <div className="text-xs text-white/40">LOGS</div>
                </div>
              ))}
            </div>
          </div>

          {/* STARRED HIGHLIGHTS */}
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <div className="uppercase text-xs tracking-widest text-white/40">// STARRED HIGHLIGHTS · 3</div>
            </div>
            <div className="space-y-4">
              {demoCase.logs.filter(l => l.starred).map((log) => (
                <div key={log.id} className="flex gap-x-6 bg-white/5 rounded-3xl px-6 py-5 items-center">
                  <div className="font-mono text-sm w-16 text-white/40">{format(new Date(log.timestamp), 'HH:mm')}</div>
                  <div className="flex-1">
                    <span className="px-4 py-1 text-xs font-mono bg-white/10 rounded-2xl">{log.device}</span>
                    <span className="ml-4 text-white">{log.value}</span>
                    {log.note && <div className="text-white/60 text-sm mt-1">{log.note}</div>}
                  </div>
                  <Star className="w-6 h-6 text-yellow-400" />
                </div>
              ))}
            </div>
          </div>

          {/* FULL SESSION LOG */}
          <div className="mt-12">
            <div className="uppercase text-xs tracking-widest text-white/40 mb-4">// SESSION LOG • FULL</div>
            <div className="space-y-3 max-h-80 overflow-auto pr-2">
              {demoCase.logs.map((log) => (
                <div key={log.id} className="flex items-center gap-x-6 bg-black/40 rounded-2xl px-6 py-4">
                  <div className="font-mono text-xs text-white/50 w-20">
                    {format(new Date(log.timestamp), 'HH:mm:ss')}
                  </div>
                  <div className="px-4 py-1 bg-white/10 text-xs font-mono rounded-2xl text-white/80">
                    {log.device}
                  </div>
                  <div className="flex-1 font-medium">{log.value}</div>
                  {log.note && <div className="text-white/50 text-sm">{log.note}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* FOOTER BAR */}
        <div className="px-8 py-6 border-t border-white/10 bg-black flex items-center justify-between text-sm">
          <div className="flex items-center gap-x-6">
            <button className="flex items-center gap-x-2 hover:text-haunt-red transition-colors">
              <Download className="w-4 h-4" />
              EXPORT PDF
            </button>
            <button className="flex items-center gap-x-2 hover:text-haunt-red transition-colors">
              <Share2 className="w-4 h-4" />
              SHARE LINK
            </button>
          </div>

          <div className="flex items-center gap-x-3 text-xs">
            <div className="px-4 py-2 bg-white/10 rounded-2xl">SIGNED • @RILEY.HUNTS</div>
            <div className="font-mono text-haunt-red">HAUNTLOG.APP/X4M-PT9</div>
          </div>

          <button
            onClick={onClose}
            className="px-8 py-3 bg-white text-black rounded-2xl hover:bg-haunt-red hover:text-white transition-all"
          >
            CLOSE DOSSIER
          </button>
        </div>
      </div>
    </div>
  );
}
