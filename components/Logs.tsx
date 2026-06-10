
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
  const [searchTerm, setSearchTerm] = useState('');
  const logs = liveLogs !== undefined ? liveLogs : DEMO_LOGS;
  
  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'ALL' || log.category === filter;
    const matchesSearch = 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.source.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleClearLogs = async () => {
    if (!window.confirm("Are you sure you want to clear all intrusion activity logs? This action cannot be undone.")) {
      return;
    }
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
    if (!window.confirm("WARNING: This will reset the entire IPS state and simulation network topology! Do you want to proceed?")) {
      return;
    }
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
    <div className="flex-1 flex flex-col bg-background overflow-hidden select-none">
      {/* Tactical logs control sub-header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border-b border-surface dark:border-surface-highlight bg-surface/20 dark:bg-surface-dark/20 backdrop-blur-md z-10">
        
        {/* Left: category buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          {['ALL', 'SYSTEM', 'NETWORK', 'AUTH', 'IO', 'MITIGATION'].map(cat => {
            const isActive = filter === cat;
            return (
              <button 
                key={cat}
                onClick={() => setFilter(cat)}
                className={`text-[9px] font-mono px-3 py-1 border transition-all duration-200 uppercase tracking-widest outline-none ${
                  isActive 
                    ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white font-bold shadow-[0_0_10px_rgba(255,255,255,0.1)]' 
                    : 'bg-surface/45 text-muted dark:text-gray-500 border-surface hover:text-main dark:hover:text-white hover:border-white/20'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Search bar inside header */}
        <div className="flex flex-1 max-w-sm relative group items-center mx-0 md:mx-4">
          <span className="material-symbols-outlined absolute left-3 text-gray-500 group-focus-within:text-white transition-colors text-[16px] pointer-events-none">search</span>
          <input
            type="text"
            placeholder="Search event logs (msg, source, status)..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-surface/50 dark:bg-[#070707] border border-surface dark:border-surface-highlight h-8 pl-9 pr-8 text-xs text-main dark:text-white placeholder-gray-500 focus:ring-1 focus:ring-black dark:focus:ring-white focus:border-black dark:focus:border-white transition-all font-mono outline-none"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-2.5 text-gray-500 hover:text-white p-0.5"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>

        {/* Right action buttons */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <button 
            onClick={handleClearLogs}
            className="text-[10px] text-muted dark:text-gray-500 hover:text-red-400 font-mono uppercase tracking-wider flex items-center gap-1.5 outline-none transition-colors border border-transparent hover:border-red-900/30 px-2.5 py-1 bg-surface/10 hover:bg-red-950/10"
          >
            <span className="material-symbols-outlined text-[14px] shrink-0">delete</span> Clear Events
          </button>
          <button 
            onClick={handleResetNetwork}
            className="text-[10px] text-muted dark:text-gray-500 hover:text-red-500 font-mono uppercase tracking-wider flex items-center gap-1.5 outline-none transition-colors border border-transparent hover:border-red-900/30 px-2.5 py-1 bg-surface/10 hover:bg-red-950/10"
          >
            <span className="material-symbols-outlined text-[14px] shrink-0">restart_alt</span> Reset Topology
          </button>
          <div className="h-4 w-px bg-surface dark:bg-surface-highlight hidden lg:block"></div>
          <p className="text-[10px] text-muted dark:text-gray-500 font-mono hidden lg:block tracking-wider uppercase">{filteredLogs.length} MATCHED</p>
        </div>
      </div>

      {/* Main event telemetry log body */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="border border-surface dark:border-surface-highlight bg-surface/25 dark:bg-black/30 backdrop-blur-md shadow-2xl relative overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-16 font-mono">
              <span className="material-symbols-outlined text-4xl text-gray-600 mb-3 animate-pulse">database_off</span>
              <p className="text-xs text-muted dark:text-gray-500 uppercase tracking-widest">No matching logs found</p>
              <p className="text-[10px] text-gray-600 mt-1">Try refining your filter parameters or search term.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="bg-surface/80 dark:bg-surface-dark/90 text-muted dark:text-gray-500 text-[10px] uppercase border-b border-surface dark:border-surface-highlight sticky top-0 backdrop-blur-md tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 font-bold w-24">Time</th>
                  <th className="px-5 py-3.5 font-bold w-32">Source</th>
                  <th className="px-5 py-3.5 font-bold w-32">Category</th>
                  <th className="px-5 py-3.5 font-bold">Event Message</th>
                  <th className="px-5 py-3.5 font-bold text-right w-28">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface/40 dark:divide-surface-highlight/20 font-mono">
                {filteredLogs.map(log => {
                  let categoryColor = 'border-gray-500/20 bg-gray-500/5 text-gray-400';
                  if (log.category === 'MITIGATION') categoryColor = 'border-red-500/20 bg-red-950/20 text-red-400';
                  else if (log.category === 'SYSTEM') categoryColor = 'border-blue-500/20 bg-blue-950/20 text-blue-400';
                  else if (log.category === 'NETWORK') categoryColor = 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400';
                  else if (log.category === 'AUTH') categoryColor = 'border-purple-500/20 bg-purple-950/20 text-purple-400';
                  else if (log.category === 'IO') categoryColor = 'border-amber-500/20 bg-amber-950/10 text-amber-400';

                  return (
                    <tr 
                      key={log.id} 
                      className="group hover:bg-white/[0.02] dark:hover:bg-white/[0.02] transition-all duration-200 cursor-pointer"
                      onClick={() => onNotify(`Inspecting telemetry event [ID: ${log.id}] on source ${log.source}`, 'info')}
                    >
                      {/* Time */}
                      <td className="px-5 py-3.5 text-xs text-muted dark:text-gray-400 whitespace-nowrap">{log.timestamp}</td>
                      
                      {/* Source */}
                      <td className="px-5 py-3.5 text-xs text-main dark:text-white font-bold tracking-tight truncate max-w-[120px]">{log.source}</td>
                      
                      {/* Category */}
                      <td className="px-5 py-3.5 text-xs">
                        <span className={`px-2.5 py-0.5 text-[8px] font-bold border uppercase tracking-widest ${categoryColor}`}>
                          {log.category}
                        </span>
                      </td>
                      
                      {/* Message */}
                      <td className="px-5 py-3.5 text-xs text-main dark:text-gray-300 group-hover:text-main dark:group-hover:text-white transition-colors leading-relaxed pr-8">{log.message}</td>
                      
                      {/* Status */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        {log.status === 'ERROR' ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 border bg-red-950/30 text-red-400 border-red-500/30 shadow-[0_0_6px_rgba(239,68,68,0.1)]">
                            <span className="material-symbols-outlined text-[11px] animate-pulse">error</span>ERROR
                          </span>
                        ) : log.status === 'BLOCKED' ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 border bg-red-700 text-white border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                            <span className="material-symbols-outlined text-[11px]">shield_locked</span>BLOCKED
                          </span>
                        ) : log.status === 'WARNING' ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 border bg-orange-950/30 text-orange-400 border-orange-500/30 shadow-[0_0_6px_rgba(249,115,22,0.1)]">
                            <span className="material-symbols-outlined text-[11px]">warning</span>WARN
                          </span>
                        ) : log.status === 'SUCCESS' ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 border bg-emerald-950/30 text-emerald-400 border-emerald-500/30 shadow-[0_0_6px_rgba(16,185,129,0.1)]">
                            <span className="material-symbols-outlined text-[11px]">verified</span>SUCCESS
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-2 py-0.5 border bg-surface/30 text-sky-400 border-surface-highlight">
                            <span className="material-symbols-outlined text-[11px]">info</span>INFO
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="h-8 border-t border-surface dark:border-surface-highlight bg-surface/20 dark:bg-surface-dark/20 flex items-center px-6 justify-between text-[10px] text-muted dark:text-gray-500 uppercase font-mono tracking-widest">
        <span>Simulation Live Uptime: {formatUptime(uptimeSeconds)}</span>
        <span className="flex items-center gap-2">
          <span className={`size-1.5 rounded-full ${logs.length > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`}></span>
          {logs.length > 0 ? 'Live IPS Telemetry Feed' : 'Demo Logs Cache'}
        </span>
      </div>
    </div>
  );
};

export default Logs;
