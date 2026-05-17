import { useHauntStore, type DeviceType } from '../store/useHauntStore';
import { Button } from './ui/Button';
import { Zap, Radio, Thermometer, Mic, Volume2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const devices: { name: DeviceType; icon: LucideIcon; color: string }[] = [
  { name: 'K-II', icon: Zap, color: 'text-red-500' },
  { name: 'REM-POD', icon: Radio, color: 'text-blue-500' },
  { name: 'THERMAL', icon: Thermometer, color: 'text-cyan-500' },
  { name: 'SB7', icon: Mic, color: 'text-purple-500' },
  { name: 'H4n', icon: Volume2, color: 'text-amber-500' },
];

export default function DeviceLogger() {
  const addLog = useHauntStore((s) => s.addLog);
  const logDevice = (device: DeviceType) => {
    const mockValues: Record<DeviceType, string[]> = {
      'K-II': ['spike to 2', 'spike to 4 (red)', 'baseline anomaly'],
      'REM-POD': ['BURST alert', 'no one within 3 ft'],
      'THERMAL': ['drop -14°F'],
      'SB7': ['"don\'t leave"', '"who is here?"'],
      'H4n': ['multi-voice EVP'],
    };
    const values = mockValues[device] || ['event logged'];
    addLog({
      device,
      value: values[Math.floor(Math.random() * values.length)],
      note: 'Live hunt – Stage Left',
    });
  };
  return (
    <div className="grid grid-cols-5 gap-4">
      {devices.map(({ name, icon: Icon, color }) => (
        <Button
          key={name}
          onClick={() => logDevice(name)}
          className="flex flex-col items-center gap-3 h-28 hover:scale-105 transition-all border-haunt-red/30 hover:border-haunt-red"
          variant="outline"
        >
          <Icon className={`w-10 h-10 ${color}`} />
          <span className="text-sm font-mono tracking-widest">{name}</span>
        </Button>
      ))}
    </div>
  );
}
