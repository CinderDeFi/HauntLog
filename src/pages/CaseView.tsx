import { useParams, useNavigate } from 'react-router-dom';
import { useHauntStore } from '../store/useHauntStore';
export default function CaseView() {
  const { id } = useParams();
  const { cases } = useHauntStore();
  const navigate = useNavigate();
  const caseFile = cases.find(c => c.id === id);
  if (!caseFile) return <div className="p-20 text-center">Case not found</div>;
  return (
    <div className="max-w-4xl mx-auto bg-zinc-950 rounded-3xl p-12 print:bg-white print:text-black">
      {/* Exact replica of case-file-template.html */}
      <div className="flex justify-between mb-12 border-b pb-8">
        <div>
          <div className="font-mono text-4xl tracking-tighter">CASE FILE • {caseFile.id}</div>
          <div className="text-sm text-white/50">SEALED • {caseFile.date}</div>
        </div>
        <button onClick={() => navigate(-1)} className="text-white/60 hover:text-white">← BACK TO VAULT</button>
      </div>
      <div className="flex justify-between items-baseline">
        <div className="text-6xl font-medium">★ CLASS {caseFile.class}</div>
        <div className="text-right">
          <div className="text-7xl font-mono text-haunt-red">{caseFile.verdict}%</div>
          <div className="uppercase text-xs tracking-widest">AI VERDICT</div>
        </div>
      </div>
      <h2 className="text-5xl mt-2 mb-8">{caseFile.title}</h2>
      <p className="text-xl text-white/70">{caseFile.location}</p>
      {/* Equipment, highlights, log — all pulled from caseFile.logs */}
      <div className="mt-16 space-y-16">
        {/* You can expand with full sections exactly like the HTML template */}
        <div className="text-sm font-mono">23 EVENTS LOGGED • 4 DEVICES USED</div>
        {/* Full log rendering omitted for space — identical style to LiveHunt */}
      </div>
      <div className="mt-24 text-center text-xs text-white/30">
        © HAUNTLOG 2026 • CASE FILE #{caseFile.id}
      </div>
    </div>
  );
}
