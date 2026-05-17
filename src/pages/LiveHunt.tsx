import { useHauntStore } from '../store/useHauntStore';
import DeviceLogger from '../components/DeviceLogger';
import { Button } from '../components/ui/Button';
import { Save } from 'lucide-react';
import { format } from 'date-fns';
export default function LiveHunt() {
  const { currentHunt, sealCase, startHunt } = useHauntStore();
  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-5xl font-medium tracking-tighter">LIVE HUNT</h1>
          <p className="text-white/60">Old Lyon Theatre • Stage Left</p>
        </div>
        {currentHunt ? (
          <Button onClick={sealCase} className="bg-haunt-red text-white px-10 py-6 flex items-center gap-x-3 text-xl">
            <Save className="w-6 h-6" />
            SEAL CASE FILE
          </Button>
        ) : (
          <Button onClick={startHunt} className="bg-white text-black px-10 py-6 text-xl">
            START NEW HUNT
          </Button>
        )}
      </div>
      {currentHunt && (
        <div className="bg-zinc-900 rounded-3xl p-8">
          <DeviceLogger />
          <div className="mt-12">
            <h3 className="text-sm font-mono mb-4 text-white/50">SESSION LOG • LIVE</h3>
            <div className="space-y-4 max-h-96 overflow-auto">
              {currentHunt.logs.map((log) => (
                <div key={log.id} className="flex items-center gap-x-6 bg-black/50 rounded-2xl px-6 py-4">
                  <span className="font-mono text-xs text-white/40 w-20">{format(new Date(log.timestamp), 'HH:mm:ss')}</span>
                  <span className="px-4 py-1 bg-white/10 text-white/90 text-sm font-medium rounded-xl">{log.device}</span>
                  <span className="flex-1 text-white">{log.value}</span>
                  {log.starred && <span className="text-yellow-400">★</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
