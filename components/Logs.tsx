
import React, { useState } from 'react';
import { LogEntry } from '../services/ipsApi';

const DEMO_LOGS: LogEntry[] = [
  { id: 'L1', timestamp: '11:05:42', source: 'GW_01', category: 'MITIGATION', message: 'Intelli IPS Rule Enforced: Dropped 45 malformed MQTT packets from 192.168.1.105', status: 'BLOCKED' },
  { id: 'L2', timestamp: '11:05:39', source: 'CORE', category: 'AUTH', message: 'User logged in via WebUI', status: 'INFO' },
  { id: 'L3', timestamp: '11:04:12', source: 'CAM_04', category: 'MITIGATION', message: 'Automated Quarantine: Node CAM_04 isolated', status: 'SUCCESS' },
];

interface LogsProps {
  onNotify: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  logs?: LogEntry[];
  uptimeSeconds?: number;
  ipsApi?: any;
  backendConnected?: boolean;
}

const Logs: React.FC<LogsProps> = ({ onNotify, logs: liveLogs, uptimeSeconds, ipsApi, backendConnected }) => {
  const [filter, setFilter] = useState('ALL');
  const logs = liveLogs !== undefined ? liveLogs : DEMO_LOGS;
  const filteredLogs = filter === 'ALL' ? logs : logs.filter(l => l.category === filter);

  const handleClearLogs = async () => {
    if (!backendConnected || !ipsApi) {
      onNotify('Clearing logs cache (demo)...', 'warning');
      return;
    }
    try {
      onNotify('Clearing activity logs...', 'info');
      await ipsApi.clearLogs();
      onNotify('Logs successfully cleared.', 'success');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Clear failed', 'error');
    }
  };

  const handleResetNetwork = async () => {
    if (!backendConnected || !ipsApi) {
      onNotify('Resetting network topology (demo)...', 'warning');
      return;
    }
    try {
      onNotify('Resetting IPS simulation and network topology...', 'warning');
      await ipsApi.resetIps();
      onNotify('System topology and IPS state successfully reset.', 'success');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Reset failed', 'error');
    }
  };

  const formatUptime = (s?: number) => {
    if (s == null) return '42d 03h 12m 04s';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h > 0 ? `${h}h ${m}m ${sec}s` : `${m}m ${sec}s`;
  };

  return (
    <div className="flex-1 flex flex-col bg-background dark:bg-black overflow-hidden">
      <div className="h-12 border-b border-surface dark:border-surface-highlight flex items-center px-6 justify-between bg-surface/30 dark:bg-surface-dark/30 backdrop-blur-sm z-10">
        <div className="flex items-center gap-6">
          <div className="flex gap-2">
            {['ALL', 'SYSTEM', 'NETWORK', 'AUTH', 'IO', 'MITIGATION'].map(cat => (
              <button 
                key={cat}
                onClick={() => setFilter(cat)}
                className={`text-[10px] font-mono px-2 py-0.5 border transition-all ${
                  filter === cat ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white font-bold' : 'text-muted dark:text-gray-500 border-surface dark:border-surface-highlight hover:text-main dark:hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleClearLogs}
            className="text-[10px] text-muted dark:text-gray-500 hover:text-red-400 font-mono uppercase tracking-widest flex items-center gap-1 outline-none"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span> Clear Event Logs
          </button>
          <div className="h-4 w-px bg-surface dark:bg-surface-highlight"></div>
          <button 
            onClick={handleResetNetwork}
            className="text-[10px] text-muted dark:text-gray-500 hover:text-red-500 font-mono uppercase tracking-widest flex items-center gap-1 outline-none"
          >
            <span className="material-symbols-outlined text-[14px]">restart_alt</span> Reset Network Topology
          </button>
          <div className="h-4 w-px bg-surface dark:bg-surface-highlight"></div>
          <p className="text-[10px] text-muted dark:text-gray-500 font-mono">{logs.length} ACTIVE EVENTS</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 font-mono">
        <div className="border border-surface dark:border-surface-highlight bg-background dark:bg-[#050505]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface dark:bg-surface-dark text-muted dark:text-gray-500 text-[10px] uppercase border-b border-surface dark:border-surface-highlight sticky top-0">
              <tr>
                <th className="px-4 py-3 font-bold">Time</th>
                <th className="px-4 py-3 font-bold">Source</th>
                <th className="px-4 py-3 font-bold">Category</th>
                <th className="px-4 py-3 font-bold">Event Message</th>
                <th className="px-4 py-3 font-bold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface dark:divide-surface-highlight/50">
              {filteredLogs.map(log => (
                <tr key={log.id} className="group hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer" onClick={() => onNotify(`Inspecting event ${log.id}`, 'info')}>
                  <td className="px-4 py-3 text-xs text-muted dark:text-gray-400 whitespace-nowrap">{log.timestamp}</td>
                  <td className="px-4 py-3 text-xs text-main dark:text-white font-bold">{log.source}</td>
                  <td className="px-4 py-3 text-xs text-muted dark:text-gray-500">{log.category}</td>
                  <td className="px-4 py-3 text-xs text-main dark:text-gray-300 group-hover:text-main dark:group-hover:text-white transition-colors">{log.message}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`text-[10px] font-black px-1.5 py-0.5 border ${
                      log.status === 'ERROR' ? 'bg-red-950 text-red-400 border-red-500' :
                      log.status === 'BLOCKED' ? 'bg-red-600 text-white border-red-500' :
                      log.status === 'WARNING' ? 'bg-orange-950 text-orange-400 border-orange-500' :
                      log.status === 'SUCCESS' ? 'bg-emerald-950 text-emerald-400 border-emerald-500' :
                      'bg-surface dark:bg-surface-dark text-blue-400 border-surface dark:border-surface-highlight'
                    }`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="h-8 border-t border-surface dark:border-surface-highlight bg-surface/20 dark:bg-surface-dark/20 flex items-center px-6 justify-between text-[10px] text-muted dark:text-gray-600 uppercase font-mono tracking-widest">
        <span>Simulation Uptime: {formatUptime(uptimeSeconds)}</span>
        <span className="flex items-center gap-2">
          <span className={`size-1.5 rounded-full animate-pulse ${liveLogs?.length ? 'bg-emerald-500' : 'bg-gray-500'}`}></span>
          {liveLogs?.length ? 'Live IPS Event Stream' : 'Demo Mode'}
        </span>
      </div>
    </div>
  );
};

export default Logs;
