import { useHauntStore } from '../store/useHauntStore';
import CaseCard from '../components/CaseCard';
export default function Vault() {
  const { cases } = useHauntStore();
  return (
    <div>
      <h1 className="text-5xl font-medium tracking-tighter mb-8">YOUR EVIDENCE VAULT</h1>
      <div className="grid grid-cols-3 gap-6">
        {cases.map((c) => (
          <CaseCard key={c.id} caseData={c} />
        ))}
        {cases.length === 0 && (
          <div className="col-span-3 text-center py-20 text-white/40">
            No sealed cases yet.<br />Start a live hunt to create your first dossier.
          </div>
        )}
      </div>
    </div>
  );
}
