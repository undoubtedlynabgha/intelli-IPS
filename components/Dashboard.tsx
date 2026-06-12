
import React, { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
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

const KpiCard = ({ title, value, sub, icon, accent, onClick, navLabel, isHighlighted, badge }: {
  title: string; value: string | number; sub: React.ReactNode;
  icon: string; accent: string; onClick?: () => void; navLabel?: string;
  isHighlighted?: boolean; badge?: React.ReactNode;
}) => (
  <button
    onClick={onClick}
    className={`border rounded-2xl p-5 flex flex-col justify-between h-28 relative overflow-hidden group transition-all text-left outline-none shadow-sm ${
      isHighlighted
        ? 'bg-gradient-to-br from-[#FF8A00] to-[#FF5500] text-white border-none'
        : 'bg-surface dark:bg-surface-dark border-surface dark:border-surface-highlight text-main dark:text-white hover:border-[#4A6FD4]/50 dark:hover:border-[#4A6FD4]/50'
    }`}
  >
    {/* Circular Arrow on Top-Right */}
    <div className={`absolute right-3 top-3 w-7 h-7 rounded-full border flex items-center justify-center transition-all ${
      isHighlighted
        ? 'border-white/20 text-white group-hover:bg-white/10'
        : 'border-surface dark:border-surface-highlight text-muted dark:text-gray-400 group-hover:text-primary dark:group-hover:text-blue-300'
    }`}>
      <span className="material-symbols-outlined text-[14px]">arrow_outward</span>
    </div>

    <div>
      <div className="flex items-center gap-1.5">
        <span className={`material-symbols-outlined text-[15px] pixel-icon ${isHighlighted ? 'text-white' : ''}`} style={!isHighlighted ? { color: accent } : {}}>{icon}</span>
        <p className={`text-[10px] font-bold uppercase tracking-widest ${isHighlighted ? 'text-white/70' : 'text-muted dark:text-gray-500'}`}>{title}</p>
      </div>
      <div className="flex items-baseline gap-2 mt-0.5">
        <p className="text-3xl sm:text-4xl font-black tracking-tight font-mono">{value}</p>
        {badge}
      </div>
    </div>
    
    <div className="flex items-end justify-between w-full">
      <div className={`text-[10px] font-mono leading-tight ${isHighlighted ? 'text-white/70' : 'text-muted dark:text-gray-500'}`}>{sub}</div>
      {navLabel && (
        <span className={`text-[9px] font-mono transition-colors flex items-center gap-0.5 shrink-0 ml-2 ${
          isHighlighted ? 'text-white/70 group-hover:text-white' : 'text-gray-500 dark:text-gray-600 group-hover:text-primary'
        }`}>
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
              className={`px-3 py-1 text-xs font-mono border transition-all rounded-lg outline-none ${
                activeTimeRange === t
                  ? 'bg-black dark:bg-white text-white dark:text-black font-bold border-black dark:border-white'
                  : 'bg-surface dark:bg-surface-dark text-muted dark:text-gray-400 border-surface dark:border-surface-highlight hover:border-[#4A6FD4]'
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
          isHighlighted={false}
          sub={<span className="text-emerald-500 font-mono">Nodes passing checks</span>}
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
          badge={<span className="bg-[#4A6FD4]/15 text-[#4A6FD4] dark:text-blue-300 text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold ml-1">+{pps} pps</span>}
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

        {/* Statistics Bar Chart */}
        <div
          onClick={() => onNavigate('reports')}
          className="lg:col-span-2 bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight rounded-3xl p-6 flex flex-col group cursor-pointer hover:border-[#4A6FD4]/45 dark:hover:border-[#4A6FD4]/45 transition-all shadow-sm"
        >
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg text-main">bar_chart</span>
                <h3 className="text-main dark:text-white font-bold text-sm uppercase tracking-wide group-hover:text-[#4A6FD4] transition-colors">
                  Statistics
                </h3>
              </div>
              <p className="text-muted dark:text-gray-500 text-xs font-mono mt-0.5">Vulnerability vs baseline traffic analysis</p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#FF8A00] rounded-full"></span>Allowed</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 bg-[#4A6FD4] rounded-full"></span>Prevented</span>
            </div>
          </div>

          {/* Two metrics side by side like the reference Statistics header */}
          <div className="grid grid-cols-2 gap-4 mb-6 border-b border-surface dark:border-surface-highlight pb-4">
            <div>
              <span className="text-[10px] text-muted uppercase tracking-widest block font-mono">Allowed Traffic</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-main font-mono">{onlineCount * 123}</span>
                <span className="text-[10px] text-emerald-500 font-bold font-mono">↗ 4.1% baseline</span>
              </div>
            </div>
            <div className="border-l border-surface dark:border-surface-highlight pl-4">
              <span className="text-[10px] text-muted uppercase tracking-widest block font-mono">Prevented Threats</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-black text-main font-mono">{totalPrevented * 8}</span>
                <span className="text-[10px] text-emerald-500 font-bold font-mono">↗ 2% coverage</span>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={enhancedChartData.slice(-10)} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="colorAllowed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF8A00" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#FF8A00" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="colorPrevented" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4A6FD4" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#4A6FD4" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-surface)" vertical={false} opacity={0.3} />
                <XAxis dataKey="time" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-surface)',
                    color: 'var(--text-main)',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    borderRadius: '8px'
                  }}
                  cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
                />
                <Area type="monotone" dataKey="allowed" stroke="#FF8A00" strokeWidth={2.5} fillOpacity={1} fill="url(#colorAllowed)" name="Allowed" />
                <Area type="monotone" dataKey="prevented" stroke="#4A6FD4" strokeWidth={2.5} fillOpacity={1} fill="url(#colorPrevented)" name="Prevented" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Traffic Profile & Health (Overlapping Circles + Progress Bars) */}
        <div
          onClick={() => onNavigate('network')}
          className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight rounded-3xl p-6 flex flex-col cursor-pointer hover:border-[#4A6FD4]/45 dark:hover:border-[#4A6FD4]/45 transition-all group shadow-sm"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-main">groups</span>
              <h3 className="text-main dark:text-white font-bold text-sm uppercase tracking-wide group-hover:text-[#4A6FD4] transition-colors">
                Traffic Split
              </h3>
            </div>
            <span className="text-[10px] bg-surface-highlight text-main px-2.5 py-0.5 rounded-full border border-surface/50 font-mono">
              Live Overview
            </span>
          </div>
          <p className="text-muted dark:text-gray-500 text-xs font-mono mb-4">Threat mitigation ratio</p>
          
          {/* Minimal stacked bar representing traffic composition */}
          <div className="flex-grow flex flex-col justify-center my-6 space-y-4 select-none">
            <div className="space-y-1.5 font-mono text-xs">
              <div className="flex justify-between font-bold text-main">
                <span>Traffic Distribution</span>
                <span className="text-muted">{onlineCount + totalPrevented + totalAlerts} Total</span>
              </div>
              <div className="h-3 w-full bg-surface-highlight rounded-full overflow-hidden flex shadow-inner">
                {/* Allowed */}
                <div 
                  className="h-full bg-[#FF8A00] transition-all duration-500" 
                  style={{ width: `${Math.max(5, (onlineCount / (onlineCount + totalPrevented + totalAlerts || 1)) * 100)}%` }}
                  title={`Allowed: ${onlineCount}`}
                ></div>
                {/* Blocked */}
                <div 
                  className="h-full bg-primary transition-all duration-500" 
                  style={{ width: `${Math.max(5, (totalPrevented / (onlineCount + totalPrevented + totalAlerts || 1)) * 100)}%` }}
                  title={`Blocked: ${totalPrevented}`}
                ></div>
                {/* Threats */}
                <div 
                  className="h-full bg-red-500 transition-all duration-500" 
                  style={{ width: `${Math.max(5, (totalAlerts / (onlineCount + totalPrevented + totalAlerts || 1)) * 100)}%` }}
                  title={`Threats: ${totalAlerts}`}
                ></div>
              </div>
            </div>

            {/* Muted Legends grid */}
            <div className="grid grid-cols-3 gap-2 text-[10px] font-mono border border-surface rounded-2xl p-3 bg-surface/30">
              <div className="text-center">
                <span className="text-[#FF8A00] font-bold text-sm block">{onlineCount}</span>
                <span className="text-muted uppercase text-[8px] tracking-wider block mt-0.5">Allowed</span>
              </div>
              <div className="text-center border-x border-surface">
                <span className="text-primary font-bold text-sm block">{totalPrevented}</span>
                <span className="text-muted uppercase text-[8px] tracking-wider block mt-0.5">Blocked</span>
              </div>
              <div className="text-center">
                <span className="text-red-500 font-bold text-sm block">{totalAlerts}</span>
                <span className="text-muted uppercase text-[8px] tracking-wider block mt-0.5">Threats</span>
              </div>
            </div>
          </div>

          {/* Progress Targets matching the reference */}
          <div className="space-y-3 font-mono text-[11px] mt-4 pt-4 border-t border-surface/50 dark:border-surface-highlight/30">
            <div className="space-y-1">
              <div className="flex justify-between text-muted">
                <span>Allowed Target</span>
                <span className="font-bold text-main">92%</span>
              </div>
              <div className="h-1.5 w-full bg-surface-highlight rounded-full overflow-hidden">
                <div className="h-full bg-[#FF8A00]" style={{ width: '92%' }}></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-muted">
                <span>Prevention Coverage</span>
                <span className="font-bold text-main">67%</span>
              </div>
              <div className="h-1.5 w-full bg-surface-highlight rounded-full overflow-hidden">
                <div className="h-full bg-[#4A6FD4]" style={{ width: '67%' }}></div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-muted">
                <span>AI Confidence Target</span>
                <span className="font-bold text-main">85%</span>
              </div>
              <div className="h-1.5 w-full bg-surface-highlight rounded-full overflow-hidden">
                <div className="h-full bg-gray-400 dark:bg-gray-600" style={{ width: '85%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Threat vectors + Prevention table row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* IPS Threat Vectors */}
        <div
          onClick={() => onNavigate('threat-feed')}
          className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight rounded-3xl p-5 flex flex-col cursor-pointer hover:border-red-500/30 transition-all group shadow-sm"
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
                <div className="h-1.5 w-full bg-surface-highlight dark:bg-surface-highlight overflow-hidden rounded-full">
                  <div
                    className="h-full transition-all duration-1000 rounded-full"
                    style={{ width: `${item.val}%`, background: item.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Prevention Actions */}
        <div className="lg:col-span-2 bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight rounded-3xl flex flex-col shadow-sm overflow-hidden">
          <div className="p-5 border-b border-surface dark:border-surface-highlight flex items-center justify-between">
            <div>
              <h3 className="text-main dark:text-white font-bold text-sm uppercase tracking-wide">Recent IPS Actions</h3>
              <p className="text-muted dark:text-gray-500 text-xs font-mono mt-0.5">Live prevention log — allowed & blocked</p>
            </div>
            <button
              onClick={() => onNavigate('alerts')}
              className="text-xs font-bold text-muted dark:text-gray-400 border border-surface dark:border-surface-highlight rounded-xl px-3 py-1 hover:text-[#4A6FD4] dark:hover:text-[#4A6FD4] hover:border-[#4A6FD4] dark:hover:border-[#4A6FD4] transition-all uppercase outline-none"
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
                        <span className={`size-1.5 rounded-full ${alert.risk === RiskLevel.CRITICAL ? 'bg-red-500' : alert.risk === RiskLevel.HIGH ? 'bg-orange-500' : 'bg-yellow-500'}`}></span>
                        {alert.risk}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-main dark:text-gray-300">{alert.device}</td>
                    <td className="px-5 py-3 text-muted dark:text-gray-400">{alert.threat}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2 py-0.5 border rounded-full ${
                        alert.actionTaken === 'blocked'
                          ? 'bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-400 border-red-200 dark:border-red-900/30'
                          : alert.actionTaken === 'prevented'
                          ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/30'
                          : 'bg-orange-50 dark:bg-orange-950/20 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-900/30'
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
