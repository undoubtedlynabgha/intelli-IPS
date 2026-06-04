import React, { useState, useEffect } from 'react';
import { AttackType } from '../services/ipsApi';
import { Device } from '../types';

interface SimulationLabProps {
  connected: boolean;
  running: boolean;
  activeAttack: string | null;
  mlTrained: boolean;
  onStart: () => Promise<void>;
  onStop: () => Promise<void>;
  onAttack: (type: AttackType, targetId?: string, attackerId?: string, packetRate?: number) => Promise<void>;
  onNotify: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  devices?: Device[];
}

const ATTACKS: { id: AttackType; label: string; desc: string }[] = [
  { id: 'dos_mqtt', label: 'MQTT Flood', desc: 'Broker flooding (DoS)' },
  { id: 'dos_coap', label: 'CoAP Amplify', desc: 'CoAP amplification' },
  { id: 'brute_force', label: 'Brute Force', desc: 'Auth credential stuffing' },
  { id: 'data_spoofing', label: 'Data Spoofing', desc: 'Sensor value injection' },
  { id: 'heavy_traffic', label: 'High-Load Traffic', desc: 'Outbound anomaly profile' },
];

const SimulationLab: React.FC<SimulationLabProps> = ({
  connected,
  running,
  activeAttack,
  mlTrained,
  onStart,
  onStop,
  onAttack,
  onNotify,
  devices = [],
}) => {
  const [selectedAttackId, setSelectedAttackId] = useState<AttackType | null>(null);
  const [targetId, setTargetId] = useState<string>('');
  const [attackerId, setAttackerId] = useState<string>('');
  const [packetRate, setPacketRate] = useState<number>(50);

  useEffect(() => {
    if (!selectedAttackId) return;
    if (selectedAttackId === 'dos_mqtt' || selectedAttackId === 'dos_coap') {
      setPacketRate(100);
    } else if (selectedAttackId === 'brute_force') {
      setPacketRate(10);
    } else if (selectedAttackId === 'data_spoofing') {
      setPacketRate(5);
    } else if (selectedAttackId === 'heavy_traffic') {
      setPacketRate(30);
    }
    setTargetId('');
    setAttackerId('');
  }, [selectedAttackId]);

  const handle = async (fn: () => Promise<void>, ok: string, err: string) => {
    try {
      await fn();
      onNotify(ok, 'success');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : err, 'error');
    }
  };

  if (!connected) {
    return (
      <div className="bg-orange-950/30 border border-orange-500/50 p-4 text-orange-400 text-xs font-mono">
        Backend offline. Start API: <code className="text-main dark:text-white">cd backend &amp;&amp; python main.py</code>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`text-[10px] font-bold uppercase px-2 py-1 border ${
            running
              ? 'bg-emerald-950 text-emerald-400 border-emerald-500'
              : 'bg-surface dark:bg-surface-dark text-muted border-surface dark:border-surface-highlight'
          }`}
        >
          {running ? 'Simulation Active' : 'Simulation Stopped'}
        </span>
        {activeAttack && (
          <span className="text-[10px] font-bold uppercase px-2 py-1 border bg-red-950 text-red-400 border-red-500 animate-pulse">
            Attack: {activeAttack}
          </span>
        )}
        {mlTrained && (
          <span className="text-[10px] font-mono text-blue-400">ML baseline trained</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={running}
          onClick={() => handle(onStart, 'IoT network simulation started', 'Failed to start')}
          className="px-4 py-2 text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Start Simulation
        </button>
        <button
          type="button"
          disabled={!running}
          onClick={() => handle(onStop, 'Simulation stopped', 'Failed to stop')}
          className="px-4 py-2 text-xs font-bold uppercase bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight hover:border-red-500 disabled:opacity-40"
        >
          Stop
        </button>
      </div>

      <p className="text-[10px] text-muted dark:text-gray-500 uppercase tracking-widest">
        Inject attack traffic (requires running simulation)
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2">
        {ATTACKS.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={!running || !!activeAttack}
            onClick={() => setSelectedAttackId(a.id)}
            className={`text-left p-3 border transition-colors bg-background dark:bg-black ${
              selectedAttackId === a.id 
                ? 'border-red-500 bg-red-500/5' 
                : 'border-surface dark:border-surface-highlight hover:border-red-500/60'
            } disabled:opacity-40`}
          >
            <span className="block text-xs font-bold text-main dark:text-white uppercase">{a.label}</span>
            <span className="block text-[10px] text-muted dark:text-gray-500 mt-1">{a.desc}</span>
          </button>
        ))}
      </div>

      {selectedAttackId && (
        <div className="border border-red-500/30 bg-red-950/5 dark:bg-red-950/10 p-4 space-y-4 font-mono animate-in fade-in slide-in-from-top-1 duration-300">
          <div className="flex justify-between items-center border-b border-red-500/20 pb-2">
            <span className="text-xs font-bold uppercase text-red-400">Configure Attack: {ATTACKS.find(a => a.id === selectedAttackId)?.label}</span>
            <button onClick={() => setSelectedAttackId(null)} className="text-muted dark:text-gray-400 hover:text-white text-xs">Close</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Attacker Node (Source)</label>
              <select 
                value={attackerId} 
                onChange={e => setAttackerId(e.target.value)}
                className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight text-main dark:text-white text-xs h-8 px-2 outline-none"
              >
                <option value="">External Attacker (Internet IP)</option>
                {devices.filter(d => d.name !== 'IoT_Gateway_Main' && d.status !== 'blocked').map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.ip || 'no IP'})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Target Node (Victim)</label>
              <select 
                value={targetId} 
                onChange={e => setTargetId(e.target.value)}
                className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight text-main dark:text-white text-xs h-8 px-2 outline-none"
              >
                <option value="">Random Active Device</option>
                {devices.filter(d => d.name !== 'IoT_Gateway_Main' && d.status !== 'blocked').map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.ip || 'no IP'})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase flex justify-between">
                <span>
                  {selectedAttackId === 'brute_force' ? 'Attempts / tick' : 'Packets / tick'}
                </span>
                <span className="text-red-400 font-bold">{packetRate}</span>
              </label>
              <div className="flex items-center gap-2">
                <input 
                  type="range"
                  min={1}
                  max={selectedAttackId === 'brute_force' ? 50 : selectedAttackId === 'data_spoofing' ? 20 : 400}
                  value={packetRate}
                  onChange={e => setPacketRate(parseInt(e.target.value))}
                  className="w-full cursor-pointer accent-red-500"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setSelectedAttackId(null)}
              className="px-4 py-1.5 border border-surface dark:border-surface-highlight text-xs uppercase hover:text-white"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                handle(
                  () => onAttack(selectedAttackId, targetId || undefined, attackerId || undefined, packetRate),
                  `${ATTACKS.find(a => a.id === selectedAttackId)?.label} attack injected successfully`,
                  'Attack failed — is simulation running?'
                );
                setSelectedAttackId(null);
              }}
              className="px-6 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase"
            >
              Launch Attack
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimulationLab;
