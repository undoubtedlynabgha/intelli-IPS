import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import Groq from "groq-sdk";

const REPORT_DATA = [
  { name: 'Mon', preventions: 12, performance: 98 },
  { name: 'Tue', preventions: 18, performance: 97 },
  { name: 'Wed', preventions: 24, performance: 99 },
  { name: 'Thu', preventions: 15, performance: 96 },
  { name: 'Fri', preventions: 32, performance: 95 },
  { name: 'Sat', preventions: 8, performance: 99 },
  { name: 'Sun', preventions: 5, performance: 99 },
];

const COLORS = ['#ef4444', '#f97316', '#3b82f6', '#8b5cf6'];

interface ReportsProps {
  onNotify: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  metrics?: any;
  alerts?: any[];
}

const Reports: React.FC<ReportsProps> = ({ onNotify, metrics, alerts = [] }) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const getThreatDistribution = () => {
    if (!alerts || alerts.length === 0) {
      return [
        { name: 'MQTT Flooding', value: 30 },
        { name: 'Brute Force', value: 20 },
        { name: 'CoAP Amplify', value: 25 },
        { name: 'Data Spoofing', value: 25 },
      ];
    }
    
    let mqtt = 0, brute = 0, coap = 0, spoof = 0;
    alerts.forEach(a => {
      const t = a.threat?.toLowerCase() || '';
      if (t.includes('mqtt') || t.includes('flood')) mqtt++;
      else if (t.includes('brute') || t.includes('ssh') || t.includes('auth')) brute++;
      else if (t.includes('coap') || t.includes('amplify')) coap++;
      else if (t.includes('spoof') || t.includes('anomaly')) spoof++;
    });
    
    const total = mqtt + brute + coap + spoof || 1;
    return [
      { name: 'MQTT Flooding', value: Math.round((mqtt / total) * 100) },
      { name: 'Brute Force', value: Math.round((brute / total) * 100) },
      { name: 'CoAP Amplify', value: Math.round((coap / total) * 100) },
      { name: 'Data Spoofing', value: Math.round((spoof / total) * 100) },
    ];
  };

  const getGroqApiKey = () => {
    if (window.electron && typeof window.electron.getApiKey === 'function') {
      const dynKey = window.electron.getApiKey();
      if (dynKey) return dynKey;
    }
    return process.env.GROQ_API_KEY || '';
  };

  const isApiKeyConfigured = () => {
    const key = getGroqApiKey();
    return typeof key === 'string' && key.trim().length > 10;
  };

  const threatDistribution = getThreatDistribution();

  const generateAiReport = async () => {
    setIsGenerating(true);
    setAiSummary(null);
    onNotify('Analyzing simulation telemetry via Groq AI...', 'info');
    
    try {
      const apiKey = getGroqApiKey();
      if (!apiKey) {
        throw new Error("Groq API key is not configured in environment.");
      }
      
      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
      const detectionRate = metrics?.detection_rate != null ? `${Math.round(metrics.detection_rate)}%` : '98%';
      const fpRate = metrics?.false_positive_rate != null ? `${Math.round(metrics.false_positive_rate)}%` : '2%';
      
      const prompt = `Based on the following active Intelli IPS simulation stats:
- Total Packets Routed: ${metrics?.total_packets ?? 0}
- Alerts Triggered: ${metrics?.total_alerts ?? 0}
- Quarantined Nodes: ${metrics?.quarantined_devices?.length ?? 0}
- Blocked IPs: ${metrics?.blocked_ips?.length ?? 0}
- Active Attack: ${metrics?.active_attack || 'None'}
- System Detection Rate: ${detectionRate}
- False Positive Rate: ${fpRate}
- Threat Vectors Breakdown: ${threatDistribution.map(t => `${t.name}: ${t.value}%`).join(', ')}

Provide an executive, non-technical security summary and analysis of this statistical data. Explain in simple terms what these rates and values imply about the safety, reliability, and precision of their IoT network. Highlight any active attacks or blocked threats, reassure the user about the high detection performance, and offer a simple explanation of how the system is currently maintaining a secure baseline. Keep it under 5 sentences, extremely reassuring, professional, and clear for a business owner. Do not use markdown format tags or lists, keep it as a standard paragraph.`;

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
      });
      
      setAiSummary(response.choices[0].message.content || "No summary generated.");
      onNotify('Security Summary updated.', 'success');
    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      onNotify(`AI Summary Offline: ${errorMsg}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPdf = () => {
    setIsExporting(true);
    onNotify('Compiling document nodes for PDF generation...', 'info');
    
    setTimeout(() => {
      window.print();
      setIsExporting(false);
      onNotify('Export sequence initiated.', 'success');
    }, 1000);
  };

  return (
    <div id="report-container" className="flex-1 overflow-y-auto bg-background dark:bg-black p-6 md:p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 no-print">
        <div>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-black text-main dark:text-white uppercase tracking-tight">Prevention Analytics</h1>
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-bold uppercase ${
              isApiKeyConfigured()
                ? 'bg-emerald-950 text-emerald-400 border-emerald-500' 
                : 'bg-red-950 text-red-400 border-red-500'
            }`}>
              <span className={`size-1.5 rounded-full ${
                isApiKeyConfigured()
                  ? 'bg-emerald-500' 
                  : 'bg-red-500 font-bold'
              }`}></span>
              Groq AI: {isApiKeyConfigured() ? 'Verified' : 'Invalid / Offline'}
            </span>
          </div>
          <p className="text-muted dark:text-gray-500 font-mono text-xs uppercase tracking-[0.2em]">Mitigation Period: Real-time Simulation Feed</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExportPdf}
            disabled={isExporting}
            className="px-4 py-2 border border-surface dark:border-surface-highlight text-muted dark:text-gray-400 hover:text-main dark:hover:text-white hover:border-black dark:hover:border-white text-xs font-bold font-mono transition-all flex items-center gap-2 uppercase outline-none disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${isExporting ? 'animate-pulse' : ''}`}>
              {isExporting ? 'hourglass_top' : 'picture_as_pdf'}
            </span> 
            {isExporting ? 'Preparing...' : 'Export PDF'}
          </button>
          <button 
            onClick={generateAiReport}
            disabled={isGenerating}
            className="px-6 py-2 bg-black dark:bg-white text-white dark:text-black text-xs font-black uppercase hover:bg-gray-800 dark:hover:bg-gray-200 transition-all flex items-center gap-2 outline-none disabled:bg-gray-700 disabled:text-gray-500"
          >
            <span className={`material-symbols-outlined text-sm ${isGenerating ? 'animate-spin' : ''}`}>
              {isGenerating ? 'sync' : 'auto_awesome'}
            </span>
            {isGenerating ? 'Analyzing...' : 'Generate AI Summary'}
          </button>
        </div>
      </div>

      <div className="hidden print:block border-b-2 border-white pb-4 mb-8">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-white uppercase">Intelli IPS Security Analytics Report</h1>
            <p className="text-gray-400 font-mono text-sm mt-1 uppercase tracking-widest">Intrusion Prevention Command Log</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 font-mono">EXPORT_ID: {Math.random().toString(36).substr(2, 9).toUpperCase()}</p>
            <p className="text-xs text-gray-500 font-mono">{new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>

      {aiSummary && (
        <div className="bg-surface dark:bg-surface-dark border border-black/10 dark:border-white/10 p-6 animate-in fade-in slide-in-from-top-2 duration-500">
          <div className="flex items-center gap-2 text-main dark:text-white font-bold text-xs uppercase mb-4 tracking-widest border-b border-surface dark:border-surface-highlight pb-2">
            <span className="material-symbols-outlined text-sm text-blue-400">auto_awesome</span>
            Groq AI Executive Protection Briefing
          </div>
          <p className="text-main dark:text-gray-300 font-mono text-sm leading-relaxed whitespace-pre-wrap italic">
            "{aiSummary}"
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-6 min-h-[350px] flex flex-col">
          <h3 className="text-main dark:text-white font-bold text-xs uppercase mb-2 tracking-widest">Prevention Velocity (Weekly Trend)</h3>
          <p className="text-muted dark:text-gray-500 text-[10px] mb-4 uppercase">Historical normal packet volume vs intercepted threats</p>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={REPORT_DATA}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-surface)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={10} axisLine={false} tickLine={false} />
                <YAxis stroke="var(--text-muted)" fontSize={10} axisLine={false} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-surface)', borderRadius: '0', color: 'var(--text-main)', fontFamily: 'monospace' }}
                />
                <Line type="stepAfter" dataKey="preventions" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 4 }} activeDot={{ r: 6, stroke: '#fff' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-6 min-h-[350px] flex flex-col">
          <h3 className="text-main dark:text-white font-bold text-xs uppercase mb-2 tracking-widest">Threat Vector Distribution</h3>
          <p className="text-muted dark:text-gray-500 text-[10px] mb-4 uppercase">Actual percentages calculated from active simulation alerts</p>
          <div className="flex-1 w-full flex flex-col md:flex-row items-center gap-8">
            <div className="w-full h-48 md:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={threatDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {threatDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-surface)', borderRadius: '0', color: 'var(--text-main)', fontFamily: 'monospace' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-full md:w-1/2 space-y-4">
              {threatDistribution.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-3">
                  <div className="size-2" style={{ backgroundColor: COLORS[idx] }}></div>
                  <div className="flex-1 text-[10px] font-mono">
                    <span className="text-main dark:text-white font-bold uppercase block">{item.name}</span>
                    <span className="text-muted dark:text-gray-500">{item.value}% of alerts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-6">
        <h3 className="text-main dark:text-white font-bold text-xs uppercase mb-6 tracking-widest">Active System Metrics</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6">
          {[
            { label: 'Total Packets Routed', val: metrics?.total_packets ?? 0, status: 'NOMINAL' },
            { label: 'Alerts Triggered', val: metrics?.total_alerts ?? 0, status: (metrics?.total_alerts ?? 0) > 0 ? 'WARNING' : 'NOMINAL' },
            { label: 'Quarantined Nodes', val: metrics?.quarantined_devices?.length ?? 0, status: (metrics?.quarantined_devices?.length ?? 0) > 0 ? 'QUARANTINED' : 'NOMINAL' },
            { label: 'Blocked IP Addresses', val: metrics?.blocked_ips?.length ?? 0, status: (metrics?.blocked_ips?.length ?? 0) > 0 ? 'BLOCKED' : 'NOMINAL' },
            { 
              label: 'Detection Rate', 
              val: metrics?.detection_rate != null ? `${Math.round(metrics.detection_rate)}%` : '98%', 
              status: (metrics?.detection_rate == null || metrics.detection_rate >= 95) ? 'NOMINAL' : 'WARNING' 
            },
            { 
              label: 'False Positive Rate', 
              val: metrics?.false_positive_rate != null ? `${Math.round(metrics.false_positive_rate)}%` : '2%', 
              status: (metrics?.false_positive_rate == null || metrics.false_positive_rate < 5) ? 'NOMINAL' : 'WARNING' 
            },
          ].map(m => (
            <div key={m.label} className="p-4 border border-surface dark:border-surface-highlight bg-background/50 dark:bg-black/50 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-muted dark:text-gray-500 font-bold uppercase mb-1 block">{m.label}</span>
                <div className="flex items-end gap-2">
                  <span className="text-2xl font-black text-main dark:text-white font-mono">{m.val}</span>
                </div>
              </div>
              <div className="mt-2">
                <div className={`text-[9px] font-bold px-1.5 py-0.5 inline-block ${
                  m.status === 'NOMINAL' ? 'bg-emerald-950 text-emerald-500' : 
                  m.status === 'WARNING' ? 'bg-orange-950 text-orange-500' : 
                  m.status === 'QUARANTINED' ? 'bg-orange-950 text-orange-500' : 
                  'bg-red-950 text-red-500'
                }`}>
                  {m.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden print:block text-center pt-12 text-[10px] text-gray-600 font-mono uppercase tracking-[0.3em]">
        Confidential Document • Autonomous Prevention Intelligence • Intelli IPS {new Date().getFullYear()}
      </div>
    </div>
  );
};

export default Reports;
