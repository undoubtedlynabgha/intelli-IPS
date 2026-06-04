
import React, { useMemo } from 'react';
import { ALERTS } from '../constants';
import { Alert, RiskLevel } from '../types';
import { ipsApi } from '../services/ipsApi';

interface AlertsLogProps {
  onNotify: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  alerts?: Alert[];
  backendConnected?: boolean;
}

const AlertsLog: React.FC<AlertsLogProps> = ({ onNotify, alerts: liveAlerts, backendConnected }) => {
  const rows = liveAlerts !== undefined ? liveAlerts : ALERTS;

  const [riskFilter, setRiskFilter] = React.useState<string>('ALL');
  const [showFilterRow, setShowFilterRow] = React.useState<boolean>(false);

  const filteredRows = useMemo(() => {
    if (riskFilter === 'ALL') return rows;
    return rows.filter(a => a.risk === riskFilter);
  }, [rows, riskFilter]);

  const handleExportCSV = () => {
    if (rows.length === 0) {
      onNotify('No alert records available to export.', 'warning');
      return;
    }
    const headers = ['ID', 'Risk Level', 'Timestamp', 'Device ID', 'Device Name', 'Threat Analysis', 'Description', 'Action Taken', 'Source IP'];
    const csvRows = [
      headers.join(','),
      ...rows.map(a => [
        a.id,
        a.risk,
        a.timestamp,
        a.deviceId,
        `"${(a.device || '').replace(/"/g, '""')}"`,
        `"${(a.threat || '').replace(/"/g, '""')}"`,
        `"${(a.description || '').replace(/"/g, '""')}"`,
        a.actionTaken || 'detected',
        a.source_ip || ''
      ].join(','))
    ];
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `intelli_ips_alerts_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onNotify('Alerts CSV exported successfully.', 'success');
  };

  const counts = useMemo(() => ({
    prevented: rows.filter((a) => a.actionTaken === 'prevented').length,
    blocked: rows.filter((a) => a.actionTaken === 'blocked').length,
    logged: rows.filter((a) => !a.actionTaken || a.actionTaken === 'detected').length,
  }), [rows]);

  const handleBlock = async (deviceId: string, deviceName: string) => {
    if (!backendConnected) {
      onNotify(`Policy Enforced. ${deviceName} traffic blocked (demo).`, 'success');
      return;
    }
    try {
      onNotify(`Blocking ${deviceName}...`, 'warning');
      await ipsApi.blockDevice(deviceId);
      onNotify(`${deviceName} quarantined and IP blocked.`, 'success');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Block failed', 'error');
    }
  };

  const handleQuarantine = async (deviceId: string, deviceName: string) => {
    if (!backendConnected) {
      onNotify(`${deviceName} quarantined (demo).`, 'success');
      return;
    }
    try {
      await ipsApi.blockDevice(deviceId);
      onNotify(`${deviceName} isolated in secure VLAN.`, 'success');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Quarantine failed', 'error');
    }
  };

  const handleDetails = (id: string) => {
    onNotify(`Loading forensic analysis for ${id}...`, 'info');
  };

  const handleClearAlerts = async () => {
    if (!backendConnected) {
      onNotify('Clearing alerts cache (demo)...', 'warning');
      return;
    }
    try {
      onNotify('Clearing prevention logs and alerts...', 'info');
      await ipsApi.clearLogs();
      onNotify('Alerts successfully cleared.', 'success');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Clear failed', 'error');
    }
  };

  const handleResetNetwork = async () => {
    if (!backendConnected) {
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

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col bg-background dark:bg-black">
      <div className="h-14 border-b border-surface dark:border-surface-highlight bg-surface/80 dark:bg-surface-dark/80 flex items-center px-6 justify-between backdrop-blur-sm sticky top-0 z-30">
        <div className="flex gap-8 font-mono text-sm">
          <div className="flex items-center gap-2 text-main dark:text-white">
            <span className="material-symbols-outlined text-[18px] pixel-icon" style={{ fontVariationSettings: "'FILL' 1" }}>shield_locked</span> 
            {counts.prevented} Prevented
          </div>
          <div className="flex items-center gap-2 text-red-500">
            <span className="material-symbols-outlined text-[18px] pixel-icon">block</span> 
            {counts.blocked} Blocked
          </div>
          <div className="flex items-center gap-2 text-muted dark:text-gray-600">
            <span className="material-symbols-outlined text-[18px] pixel-icon">visibility</span> 
            {counts.logged} Logged
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleClearAlerts}
            className="text-[10px] text-muted dark:text-gray-400 hover:text-red-400 font-mono uppercase tracking-widest flex items-center gap-1 outline-none"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span> Clear Alerts
          </button>
          <div className="h-4 w-px bg-surface dark:bg-surface-highlight"></div>
          <button 
            onClick={handleResetNetwork}
            className="text-[10px] text-muted dark:text-gray-400 hover:text-red-500 font-mono uppercase tracking-widest flex items-center gap-1 outline-none"
          >
            <span className="material-symbols-outlined text-[14px]">restart_alt</span> Reset Network
          </button>
          <div className="h-4 w-px bg-surface dark:bg-surface-highlight"></div>
          <button 
            onClick={() => setShowFilterRow(!showFilterRow)}
            className={`flex items-center gap-2 text-xs font-mono px-3 py-1.5 border transition-all outline-none ${
              showFilterRow || riskFilter !== 'ALL'
                ? 'bg-surface-highlight dark:bg-surface-highlight text-main dark:text-white border-black/10 dark:border-white/10 font-bold'
                : 'border-transparent text-muted dark:text-gray-400 hover:text-main dark:hover:text-white hover:border-surface dark:hover:border-surface-highlight'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] pixel-icon">filter_list</span> FILTER
          </button>
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 text-xs font-mono text-muted dark:text-gray-400 hover:text-main dark:hover:text-white px-3 py-1.5 border border-transparent hover:border-surface dark:hover:border-surface-highlight transition-all outline-none"
          >
            <span className="material-symbols-outlined text-[16px] pixel-icon">download</span> EXPORT
          </button>
        </div>
      </div>

      {showFilterRow && (
        <div className="h-10 border-b border-surface dark:border-surface-highlight bg-surface/30 dark:bg-surface-dark/30 flex items-center px-6 gap-2 animate-in slide-in-from-top-1 duration-200">
          <span className="text-[10px] font-mono text-muted dark:text-gray-500 font-bold uppercase mr-4">Filter by Risk:</span>
          {['ALL', 'CRITICAL', 'HIGH', 'WARNING', 'INFO', 'ANOMALY'].map(risk => (
            <button
              key={risk}
              onClick={() => setRiskFilter(risk)}
              className={`text-[10px] font-mono px-2 py-0.5 border transition-all ${
                riskFilter === risk 
                  ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white font-bold' 
                  : 'text-muted dark:text-gray-500 border-surface dark:border-surface-highlight hover:text-main dark:hover:text-white'
              }`}
            >
              {risk}
            </button>
          ))}
        </div>
      )}
      
      <div className="overflow-auto flex-1 w-full h-full">
        <table className="w-full text-left border-collapse">
          <thead className="bg-surface dark:bg-surface-dark sticky top-0 z-20 text-[10px] font-bold uppercase text-muted dark:text-gray-500 font-mono tracking-wider border-b border-surface dark:border-surface-highlight shadow-sm">
            <tr>
              <th className="px-6 py-4">Risk / Prevention Status</th>
              <th className="px-6 py-4">Timestamp</th>
              <th className="px-6 py-4">Device ID</th>
              <th className="px-6 py-4">Threat Analysis</th>
              <th className="px-6 py-4 text-right">Intelli IPS Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface dark:divide-surface-highlight font-mono text-sm bg-background dark:bg-black">
            {filteredRows.map(alert => (
              <tr key={alert.id} className="group hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <td className="px-6 py-4 align-top whitespace-nowrap">
                  <div className={`flex flex-col gap-1`}>
                    <div className={`inline-flex items-center gap-2 px-2 py-1 border ${
                      alert.risk === RiskLevel.CRITICAL ? 'bg-black dark:bg-white text-white dark:text-black border-black dark:border-white' : 'bg-surface-highlight dark:bg-surface-highlight text-main dark:text-white border-surface-highlight dark:border-surface-highlight'
                    }`}>
                      <span className="material-symbols-outlined text-[16px] pixel-icon" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {alert.risk === RiskLevel.CRITICAL ? 'dangerous' : 'warning'}
                      </span>
                      <span className="text-xs font-bold uppercase tracking-tight">{alert.risk}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 mt-1">
                      <span className={`size-1.5 rounded-full ${
                        alert.actionTaken === 'blocked' ? 'bg-red-500' : 
                        alert.actionTaken === 'prevented' ? 'bg-emerald-500' : 'bg-orange-500'
                      }`}></span>
                      <span className={`text-[10px] font-bold uppercase ${
                        alert.actionTaken === 'blocked' ? 'text-red-500' : 
                        alert.actionTaken === 'prevented' ? 'text-emerald-500' : 'text-orange-500'
                      }`}>
                        {alert.actionTaken || 'Detected'}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 align-top text-main dark:text-white">
                  Today <span className="text-muted dark:text-gray-500">{alert.timestamp}</span>
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="text-main dark:text-white font-bold">{alert.device}</div>
                  {alert.deviceId && <div className="text-xs text-muted dark:text-gray-500 mt-1">{alert.deviceId}</div>}
                </td>
                <td className="px-6 py-4 align-top">
                  <div className="text-main dark:text-white font-bold mb-1">{alert.threat}</div>
                  <p className="text-xs text-muted dark:text-gray-400 leading-relaxed max-w-md">{alert.description}</p>
                  <div className="mt-2 flex gap-2">
                    {alert.tags.map(tag => (
                      <span key={tag} className="text-[10px] uppercase border border-black/20 dark:border-white/20 px-1.5 py-0.5 text-muted dark:text-gray-400">{tag}</span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 align-top text-right">
                  <div className="flex justify-end gap-2 opacity-80 group-hover:opacity-100">
                    <button 
                      onClick={() => handleQuarantine(alert.deviceId, alert.device)}
                      className="bg-surface dark:bg-surface-dark hover:bg-orange-500 hover:text-white border border-surface dark:border-surface-highlight hover:border-orange-500 text-muted dark:text-gray-400 text-[10px] font-bold px-2.5 py-1.5 uppercase transition-colors outline-none"
                    >
                      Block Device
                    </button>
                    <button 
                      onClick={() => handleBlock(alert.deviceId, alert.device)}
                      className="bg-surface dark:bg-surface-dark hover:bg-red-600 hover:text-white border border-surface dark:border-surface-highlight hover:border-red-600 text-muted dark:text-gray-400 text-[10px] font-bold px-2.5 py-1.5 uppercase transition-colors outline-none"
                    >
                      Block IP
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-6 text-center border-t border-surface dark:border-surface-highlight text-xs text-muted dark:text-gray-600 font-mono uppercase tracking-widest">
          End of log • {filteredRows.length} of {rows.length} records found
          {backendConnected ? ' • Live from IPS API' : ' • Demo data'}
        </div>
      </div>
    </div>
  );
};

export default AlertsLog;
