
import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TRAFFIC_DATA, ALERTS } from '../constants';
import { Alert, ChartDataPoint, RiskLevel } from '../types';
import { MetricsResponse } from '../services/ipsApi';

interface DashboardProps {
  onNavigate: (tab: string) => void;
  deviceCount: number;
  metrics?: MetricsResponse | null;
  alerts?: Alert[];
  trafficChart?: ChartDataPoint[];
  backendConnected?: boolean;
}

const StatusCard = ({ title, value, icon, subtext, color = "text-main dark:text-white", onClick }: any) => (
  <button 
    onClick={onClick}
    className="bg-surface dark:bg-surface-dark p-5 border border-surface dark:border-surface-highlight flex flex-col justify-between h-32 relative overflow-hidden group hover:border-black/50 dark:hover:border-white/50 transition-colors text-left outline-none"
  >
    <div className="absolute right-0 top-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      <span className="material-symbols-outlined text-6xl pixel-icon">{icon}</span>
    </div>
    <div>
      <p className="text-muted dark:text-gray-400 text-sm font-medium uppercase tracking-wider">{title}</p>
      <p className={`${color} text-3xl font-black mt-1 tracking-tight font-mono`}>{value}</p>
    </div>
    <div className="flex items-center gap-1 text-xs text-muted dark:text-gray-500 font-mono">
      {subtext}
    </div>
  </button>
);

const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  deviceCount,
  metrics,
  alerts: liveAlerts,
  trafficChart,
  backendConnected,
}) => {
  const [activeTimeRange, setActiveTimeRange] = useState('24h');
  const chartData = trafficChart?.length ? trafficChart : TRAFFIC_DATA;
  const alertRows = liveAlerts?.length ? liveAlerts.slice(0, 8) : ALERTS;
  const onlineCount = metrics?.devices.filter((d) => d.status === 'online').length ?? deviceCount;
  const securedPct = metrics?.devices.length
    ? Math.round((onlineCount / metrics.devices.length) * 100)
    : 98;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-main dark:text-white mb-1 uppercase">IoT Prevention Overview</h1>
          <div className="flex items-center gap-2 text-muted dark:text-gray-500 text-sm font-mono">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 bg-blue-500"></span>
            </span>
            Active Prevention Mode • {deviceCount} Shields Active
            {backendConnected && (
              <span className="text-emerald-500"> • API Live{metrics?.simulation_running ? ' • Sim Running' : ''}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {['1h', '24h', '7d'].map((t) => (
            <button 
              key={t}
              onClick={() => setActiveTimeRange(t)}
              className={`px-3 py-1.5 text-xs font-mono border transition-all outline-none ${
                activeTimeRange === t 
                  ? 'bg-black dark:bg-white text-white dark:text-black font-bold border-black dark:border-white' 
                  : 'bg-surface dark:bg-surface-dark text-muted dark:text-gray-400 hover:text-main dark:hover:text-white border-surface dark:border-surface-highlight hover:border-black dark:hover:border-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard 
          title="Nodes Secured" value={`${securedPct}%`} icon="security_update_good" 
          color="text-emerald-500" 
          onClick={() => onNavigate('network')}
          subtext={<><span className="material-symbols-outlined text-emerald-500 text-[16px] pixel-icon">check_circle</span> {onlineCount} Active Shields</>} 
        />
        <StatusCard 
          title="Prevented" value={String((metrics?.total_prevented ?? 12) + (metrics?.total_blocked ?? 0))} icon="shield_locked" 
          color="text-blue-500"
          onClick={() => onNavigate('alerts')}
          subtext={<span className="text-blue-500 font-medium">Blocked: {metrics?.total_blocked ?? 0}</span>} 
        />
        <StatusCard 
          title="Active Alerts" value={String(metrics?.total_alerts ?? liveAlerts?.length ?? 5)} icon="warning" 
          onClick={() => onNavigate('alerts')}
          subtext={<span className="text-orange-500 font-medium">PPS: {metrics?.packets_per_second ?? 0}</span>} 
        />
        <StatusCard 
          title="Detection Rate" value={`${metrics?.detection_rate ?? 0}%`} icon="memory" 
          onClick={() => onNavigate('settings')}
          subtext={<span className="text-blue-400">{metrics?.ml_model_trained ? 'ML Active' : 'Training baseline...'}</span>} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div 
          onClick={() => onNavigate('reports')}
          className="lg:col-span-2 bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-6 flex flex-col group cursor-pointer hover:border-black/30 dark:hover:border-white/30 transition-all"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-main dark:text-white font-bold text-lg uppercase group-hover:text-emerald-400 transition-colors">IoT Network Activity</h3>
              <p className="text-muted dark:text-gray-400 text-sm font-mono">Protocol distribution (MQTT/CoAP/HTTP)</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-main dark:text-white font-mono">2.4 TB</p>
              <p className="text-xs text-emerald-500 font-medium font-mono">Within quotas</p>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-surface)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} fontStyle="italic" />
                <YAxis hide />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-surface)', color: 'var(--text-main)', fontSize: '12px', fontFamily: 'monospace' }}
                />
                <Area type="monotone" dataKey="value" stroke="var(--text-main)" strokeWidth={2} fill="var(--text-main)" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div 
          onClick={() => onNavigate('threat-feed')}
          className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-6 flex flex-col cursor-pointer hover:border-red-500/30 transition-all group"
        >
          <div className="mb-6">
            <h3 className="text-main dark:text-white font-bold text-lg uppercase group-hover:text-red-500 transition-colors">IoT Threat Vectors</h3>
            <p className="text-muted dark:text-gray-400 text-sm font-mono">Last 24 Hours</p>
          </div>
          <div className="space-y-5 flex-1 justify-center flex flex-col">
            {[
              { label: 'Botnet Activity', val: 42, color: 'bg-red-600' },
              { label: 'Firmware Tamper', val: 28, color: 'bg-orange-600' },
              { label: 'MITM Attack', val: 15, color: 'bg-yellow-600' },
              { label: 'Privilege Esc.', val: 10, color: 'bg-blue-600' },
              { label: 'Side Channel', val: 5, color: 'bg-purple-600' },
            ].map(item => (
              <div key={item.label} className="space-y-1.5 group cursor-help">
                <div className="flex justify-between text-sm">
                  <span className="text-main dark:text-white font-medium font-mono group-hover:text-main/80 dark:group-hover:text-white/80">{item.label}</span>
                  <span className="text-muted dark:text-gray-400 font-mono">{item.val}%</span>
                </div>
                <div className="h-4 w-full bg-surface-highlight dark:bg-surface-highlight border border-surface-highlight dark:border-surface-highlight overflow-hidden">
                  <div className={`h-full ${item.color} transition-all duration-1000 group-hover:brightness-125`} style={{ width: `${item.val}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight flex flex-col">
        <div className="p-6 border-b border-surface dark:border-surface-highlight flex justify-between items-center">
          <div>
            <h3 className="text-main dark:text-white font-bold text-lg uppercase">Prevention Status & Active Mitigation</h3>
            <p className="text-muted dark:text-gray-400 text-sm font-mono">Real-time risk scoring & autonomous responses</p>
          </div>
          <button 
            onClick={() => onNavigate('alerts')}
            className="text-main dark:text-white text-sm font-bold border border-black dark:border-white px-3 py-1 hover:bg-black dark:hover:bg-white hover:text-white dark:hover:text-black transition-colors uppercase outline-none"
          >
            Action Log
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-surface-highlight dark:bg-surface-highlight text-main dark:text-white uppercase text-xs font-bold font-mono">
              <tr>
                <th className="px-6 py-4">Risk Level</th>
                <th className="px-6 py-4">Timestamp</th>
                <th className="px-6 py-4">IoT Device</th>
                <th className="px-6 py-4">Threat Type</th>
                <th className="px-6 py-4">Prevention Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-highlight dark:divide-surface-highlight text-main dark:text-gray-300">
              {alertRows.map((alert) => (
                <tr key={alert.id} className="hover:bg-surface-highlight dark:hover:bg-surface-highlight transition-colors cursor-pointer" onClick={() => onNavigate('alerts')}>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-2 text-xs font-bold uppercase ${
                      alert.risk === RiskLevel.CRITICAL ? 'text-red-500' : 'text-orange-500'
                    }`}>
                      <span className={`size-2 ${alert.risk === RiskLevel.CRITICAL ? 'bg-red-500' : 'bg-orange-500'}`}></span>
                      {alert.risk}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-muted dark:text-gray-400">{alert.timestamp}</td>
                  <td className="px-6 py-4 font-mono text-main dark:text-white">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-[18px] text-muted dark:text-gray-400 pixel-icon">router</span>
                      <div>
                        <span className="block text-main dark:text-white">{alert.device}</span>
                        <span className="text-xs text-muted dark:text-gray-500">ID: {alert.deviceId}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-medium text-main dark:text-white">{alert.threat}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-[18px] pixel-icon ${
                        alert.actionTaken === 'blocked' ? 'text-red-500' : 
                        alert.actionTaken === 'prevented' ? 'text-emerald-500' : 'text-orange-500'
                      }`}>
                        {alert.actionTaken === 'blocked' ? 'block' : 
                         alert.actionTaken === 'prevented' ? 'verified_user' : 'visibility'}
                      </span>
                      <span className={`text-xs font-mono uppercase font-bold ${
                        alert.actionTaken === 'blocked' ? 'text-red-500' : 
                        alert.actionTaken === 'prevented' ? 'text-emerald-500' : 'text-orange-500'
                      }`}>
                        {alert.actionTaken || 'detected'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-muted dark:text-gray-400 hover:text-main dark:hover:text-white p-1 outline-none"><span className="material-symbols-outlined text-[20px] pixel-icon">more_vert</span></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
