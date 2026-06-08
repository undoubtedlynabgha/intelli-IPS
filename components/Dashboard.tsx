
import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
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

const KpiCard = ({ title, value, sub, icon, accent, onClick, navLabel }: {
  title: string; value: string | number; sub: React.ReactNode;
  icon: string; accent: string; onClick?: () => void; navLabel?: string;
}) => (
  <button
    onClick={onClick}
    className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-5 flex flex-col justify-between h-28 relative overflow-hidden group hover:border-opacity-80 transition-all text-left outline-none"
    style={{ '--accent': accent } as any}
  >
    <div className="absolute right-3 top-3 opacity-8 group-hover:opacity-15 transition-opacity">
      <span className="material-symbols-outlined text-5xl pixel-icon" style={{ color: accent }}>{icon}</span>
    </div>
    <div>
      <p className="text-muted dark:text-gray-500 text-[11px] font-bold uppercase tracking-widest">{title}</p>
      <p className="text-2xl font-black mt-1 tracking-tight font-mono" style={{ color: accent }}>{value}</p>
    </div>
    <div className="flex items-end justify-between w-full">
      <div className="text-[11px] font-mono text-muted dark:text-gray-500">{sub}</div>
      {navLabel && (
        <span className="text-[9px] font-mono text-gray-600 dark:text-gray-700 group-hover:text-gray-400 dark:group-hover:text-gray-400 transition-colors flex items-center gap-0.5 shrink-0 ml-2">
          <span className="material-symbols-outlined text-[10px]">arrow_forward</span>{navLabel}
        </span>
      )}
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
  const alertRows = liveAlerts?.length ? liveAlerts.slice(0, 6) : ALERTS;

  const totalAlerts = metrics?.total_alerts ?? liveAlerts?.length ?? 5;
  const totalPrevented = (metrics?.total_prevented ?? 12) + (metrics?.total_blocked ?? 0);
  const totalBlocked = metrics?.total_blocked ?? 0;
  const detectionRate = metrics?.detection_rate ?? 0;
  const pps = metrics?.packets_per_second ?? 0;
  const mlTrained = metrics?.ml_model_trained ?? false;
  const simRunning = metrics?.simulation_running ?? false;

  const onlineCount = metrics?.devices.filter(d => d.status === 'online').length ?? deviceCount;
  const blockedCount = metrics?.devices.filter(d => d.status === 'blocked').length ?? 1;
  const threatCount = metrics?.devices.filter(d => d.status === 'threat').length ?? 0;

  // Traffic breakdown pie chart data
  const trafficBreakdown = [
    { name: 'Allowed', value: onlineCount, color: '#10b981' },
    { name: 'Prevented', value: blockedCount, color: '#ef4444' },
    { name: 'Flagged', value: threatCount, color: '#f97316' },
  ].filter(d => d.value > 0);

  // Traffic trend: augment with allowed vs prevented
  const enhancedChartData = chartData.map((d, i) => ({
    time: d.time,
    allowed: Math.round(d.value * 0.85),
    prevented: Math.round(d.value * 0.15),
  }));

  return (
    <div className="flex-1 overflow-y-auto p-5 md:p-7 space-y-6 bg-background dark:bg-black">

      {/* Page title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-main dark:text-white uppercase">IPS Traffic Overview</h1>
          <div className="flex items-center gap-2 text-muted dark:text-gray-500 text-xs font-mono mt-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full bg-emerald-400 opacity-75 rounded-full"></span>
              <span className="relative inline-flex h-1.5 w-1.5 bg-emerald-500 rounded-full"></span>
            </span>
            Live Prevention Engine Active &bull; {deviceCount} Nodes Monitored
            {backendConnected && (
              <span className="text-emerald-500">&bull; API Live{simRunning ? ' · Sim Running' : ''}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['1h', '24h', '7d'].map(t => (
            <button
              key={t}
              onClick={() => setActiveTimeRange(t)}
              className={`px-3 py-1 text-xs font-mono border transition-all outline-none ${
                activeTimeRange === t
                  ? 'bg-black dark:bg-white text-white dark:text-black font-bold border-black dark:border-white'
                  : 'bg-surface dark:bg-surface-dark text-muted dark:text-gray-400 border-surface dark:border-surface-highlight hover:border-black dark:hover:border-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          title="Traffic Allowed"
          value={onlineCount}
          icon="verified_user"
          accent="#10b981"
          onClick={() => onNavigate('network')}
          navLabel="Network"
          sub={<span className="text-emerald-500">Nodes passing IPS checks</span>}
        />
        <KpiCard
          title="Traffic Prevented"
          value={totalPrevented}
          icon="shield_locked"
          accent="#ef4444"
          onClick={() => onNavigate('threat-feed')}
          navLabel="Prevention Feed"
          sub={<span className="text-red-400">Blocked: {totalBlocked} &bull; Stopped threats</span>}
        />
        <KpiCard
          title="Active Threats"
          value={totalAlerts}
          icon="warning"
          accent="#f97316"
          onClick={() => onNavigate('alerts')}
          navLabel="Actions Log"
          sub={<span className="text-orange-400">PPS: {pps} &bull; Under analysis</span>}
        />
        <KpiCard
          title="Detection Rate"
          value={`${detectionRate}%`}
          icon="analytics"
          accent="#60a5fa"
          onClick={() => onNavigate('reports')}
          navLabel="Analytics"
          sub={<span className="text-blue-400">{mlTrained ? 'ML Model Active' : 'Building baseline...'}</span>}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Allowed vs Prevented Traffic Chart */}
        <div
          onClick={() => onNavigate('reports')}
          className="lg:col-span-2 bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-5 flex flex-col group cursor-pointer hover:border-black/20 dark:hover:border-white/20 transition-all"
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-main dark:text-white font-bold text-sm uppercase tracking-wide group-hover:text-emerald-400 transition-colors">
                Allowed vs Prevented Traffic
              </h3>
              <p className="text-muted dark:text-gray-500 text-xs font-mono mt-0.5">Real-time IPS traffic classification</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span>Allowed</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-red-500 rounded-full"></span>Prevented</span>
            </div>
          </div>
          <div className="flex-1 w-full min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={enhancedChartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradAllowed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPrevented" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-surface)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-surface)',
                    color: 'var(--text-main)',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }}
                />
                <Area type="monotone" dataKey="allowed" stroke="#10b981" strokeWidth={2} fill="url(#gradAllowed)" name="Allowed" />
                <Area type="monotone" dataKey="prevented" stroke="#ef4444" strokeWidth={2} fill="url(#gradPrevented)" name="Prevented" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Traffic Breakdown Pie */}
        <div
          onClick={() => onNavigate('network')}
          className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-5 flex flex-col cursor-pointer hover:border-black/20 dark:hover:border-white/20 transition-all group"
        >
          <h3 className="text-main dark:text-white font-bold text-sm uppercase tracking-wide mb-1 group-hover:text-blue-400 transition-colors">
            Node Status Split
          </h3>
          <p className="text-muted dark:text-gray-500 text-xs font-mono mb-4">IPS classification by node</p>
          <div className="flex-1 min-h-[160px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={trafficBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {trafficBreakdown.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-surface)',
                    color: 'var(--text-main)',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2 mt-2">
            {trafficBreakdown.map(item => (
              <div key={item.name} className="flex items-center justify-between text-xs font-mono">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: item.color }}></span>
                  <span className="text-muted dark:text-gray-400">{item.name}</span>
                </span>
                <span className="font-bold" style={{ color: item.color }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Threat vectors + Prevention table row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* IPS Threat Vectors */}
        <div
          onClick={() => onNavigate('threat-feed')}
          className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-5 flex flex-col cursor-pointer hover:border-red-500/20 transition-all group"
        >
          <h3 className="text-main dark:text-white font-bold text-sm uppercase tracking-wide mb-1 group-hover:text-red-400 transition-colors">
            Prevention by Vector
          </h3>
          <p className="text-muted dark:text-gray-500 text-xs font-mono mb-4">Last 24h attack types stopped</p>
          <div className="space-y-3 flex-1">
            {[
              { label: 'DoS / DDoS', val: 38, color: '#ef4444' },
              { label: 'Brute Force Auth', val: 27, color: '#f97316' },
              { label: 'Data Exfiltration', val: 18, color: '#eab308' },
              { label: 'Protocol Exploit', val: 11, color: '#8b5cf6' },
              { label: 'Lateral Movement', val: 6, color: '#3b82f6' },
            ].map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-muted dark:text-gray-300">{item.label}</span>
                  <span className="font-bold" style={{ color: item.color }}>{item.val}%</span>
                </div>
                <div className="h-1.5 w-full bg-surface-highlight dark:bg-surface-highlight overflow-hidden">
                  <div
                    className="h-full transition-all duration-1000"
                    style={{ width: `${item.val}%`, background: item.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Prevention Actions */}
        <div className="lg:col-span-2 bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight flex flex-col">
          <div className="p-5 border-b border-surface dark:border-surface-highlight flex items-center justify-between">
            <div>
              <h3 className="text-main dark:text-white font-bold text-sm uppercase tracking-wide">Recent IPS Actions</h3>
              <p className="text-muted dark:text-gray-500 text-xs font-mono mt-0.5">Live prevention log — allowed & blocked</p>
            </div>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-xs font-bold text-muted dark:text-gray-400 border border-surface dark:border-surface-highlight px-3 py-1 hover:text-main dark:hover:text-white hover:border-black dark:hover:border-white transition-all uppercase outline-none"
            >
              Full Log
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-surface-highlight dark:bg-surface-highlight text-muted dark:text-gray-400 uppercase font-bold">
                <tr>
                  <th className="px-5 py-3">Risk</th>
                  <th className="px-5 py-3">Device</th>
                  <th className="px-5 py-3">Threat</th>
                  <th className="px-5 py-3">IPS Action</th>
                  <th className="px-5 py-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-highlight dark:divide-surface-highlight">
                {alertRows.map(alert => (
                  <tr
                    key={alert.id}
                    className="hover:bg-surface-highlight dark:hover:bg-surface-highlight transition-colors cursor-pointer"
                    onClick={() => onNavigate('alerts')}
                  >
                    <td className="px-5 py-3">
                      <span className={`flex items-center gap-1.5 text-[11px] font-bold uppercase ${
                        alert.risk === RiskLevel.CRITICAL ? 'text-red-500' :
                        alert.risk === RiskLevel.HIGH ? 'text-orange-500' :
                        'text-yellow-500'
                      }`}>
                        <span className={`size-1.5 ${alert.risk === RiskLevel.CRITICAL ? 'bg-red-500' : alert.risk === RiskLevel.HIGH ? 'bg-orange-500' : 'bg-yellow-500'}`}></span>
                        {alert.risk}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-main dark:text-gray-300">{alert.device}</td>
                    <td className="px-5 py-3 text-muted dark:text-gray-400">{alert.threat}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 border ${
                        alert.actionTaken === 'blocked'
                          ? 'text-red-400 border-red-500/30 bg-red-950/20'
                          : alert.actionTaken === 'prevented'
                          ? 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20'
                          : 'text-orange-400 border-orange-500/30 bg-orange-950/20'
                      }`}>
                        <span className="material-symbols-outlined text-[12px] pixel-icon">
                          {alert.actionTaken === 'blocked' ? 'block' : alert.actionTaken === 'prevented' ? 'verified_user' : 'visibility'}
                        </span>
                        {alert.actionTaken === 'blocked' ? 'Prevented' : alert.actionTaken === 'prevented' ? 'Allowed' : 'Monitoring'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-muted dark:text-gray-500">{alert.timestamp}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
