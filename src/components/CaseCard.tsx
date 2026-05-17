import { Link } from 'react-router-dom';
import type { CaseFile, LogEntry } from '../store/useHauntStore';

export default function CaseCard({ caseData }: { caseData: CaseFile }) {
  return (
    <Link to={`/case/${caseData.id}`} className="block">
      <div className="bg-zinc-900 border border-white/10 rounded-3xl p-6 hover:border-haunt-red/50 transition-all group">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="px-3 py-1 bg-red-500/10 text-red-400 text-xs font-mono rounded-full">CLASS {caseData.class}</span>
          </div>
          <div className="text-right">
            <div className="text-3xl font-mono text-white/80">{caseData.verdict}%</div>
            <div className="text-xs text-white/40">AI VERDICT</div>
          </div>
        </div>
        <h3 className="text-2xl font-medium text-white mb-1">{caseData.title}</h3>
        <p className="text-white/60 text-sm">{caseData.location}</p>
        <p className="text-white/40 text-xs mt-1">{caseData.date}</p>
        <div className="mt-6 pt-6 border-t border-white/10 flex items-center justify-between text-xs">
          <div className="flex items-center gap-x-5">
            <div>{caseData.logs.length} EVENTS</div>
            <div className="flex -space-x-2">
              {caseData.logs.slice(0, 3).map((log: LogEntry, i: number) => (
                <div key={i} className="w-6 h-6 bg-white/10 rounded-2xl flex items-center justify-center text-[10px] font-mono border border-white/30">
                  {log.device[0]}
                </div>
              ))}
            </div>
          </div>
          <div className="text-haunt-red group-hover:underline">VIEW SEALED FILE →</div>
        </div>
      </div>
    </Link>
  );
}
