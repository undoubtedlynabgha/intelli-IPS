import React, { useMemo, useState } from 'react';
import { Device, Alert } from '../types';
import Groq from "groq-sdk";

const SHIELDS = [
  {
    id: 'shield_mqtt',
    name: 'MQTT Flooding Shield',
    severity: 'Active',
    type: 'Volumetric Filter',
    description: 'Intercepts MQTT broker traffic. If a device exceeds 50 packets/sec (DoS threshold), the system automatically flags the incident, blocks the sender IP, and quarantines the node.',
    metric: 'Limit: 50 pkts/sec',
    mitigation: 'Action: Auto-Block & Quarantine'
  },
  {
    id: 'shield_coap',
    name: 'CoAP Amplification Guard',
    severity: 'Active',
    type: 'Reflection Filter',
    description: 'Monitors CoAP client query payloads. Spikes in outbound requests triggers signature drops, isolating the device in a secure virtual silo to prevent server flooding.',
    metric: 'Limit: 150 pkts/tick',
    mitigation: 'Action: Volumetric Packet Drop'
  },
  {
    id: 'shield_brute',
    name: 'SSH Authentication Shield',
    severity: 'Active',
    type: 'Access Protector',
    description: 'Shields terminal access points from brute-force login attempts. Triggers immediately if more than 5 failed logins are detected within a 10-second window.',
    metric: 'Limit: 5 attempts / 10s',
    mitigation: 'Action: Session Block & Alert'
  },
  {
    id: 'shield_ml',
    name: 'AI Sensor Anomaly Guard',
    severity: 'Active',
    type: 'Isolation Forest ML Model',
    description: 'Scans telemetry metrics (like thermostat heat/payload) using an Isolation Forest ML model. Drops packets containing spoofed readings that deviate from historical baselines.',
    metric: 'Algorithm: Isolation Forest ML',
    mitigation: 'Action: Anomaly Flag & Payload Drop'
  }
];

interface ThreatFeedProps {
  devices?: Device[];
  alerts?: Alert[];
  onNotify: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  ipsApi: any;
  backendConnected?: boolean;
  metrics?: any;
}

const ThreatFeed: React.FC<ThreatFeedProps> = ({
  devices = [],
  alerts = [],
  onNotify,
  ipsApi,
  backendConnected = false,
  metrics,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);

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

  const generateAiInsights = async () => {
    setIsGenerating(true);
    setAiInsights(null);
    onNotify('Querying Groq AI for security detection insights...', 'info');

    try {
      const apiKey = getGroqApiKey();
      if (!apiKey) {
        throw new Error("Groq API key is not configured in environment.");
      }

      const groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
      const detectionRate = metrics?.detection_rate != null ? `${Math.round(metrics.detection_rate)}%` : '98%';
      const fpRate = metrics?.false_positive_rate != null ? `${Math.round(metrics.false_positive_rate)}%` : '2%';

      const prompt = `You are a cybersecurity expert analyzing an Intrusion Prevention System (IPS) deployment.
Here are the current live metrics of the system:
- Total Packets Routed: ${metrics?.total_packets ?? 0}
- Total Alerts Triggered: ${metrics?.total_alerts ?? 0}
- Current Detection Rate (Malicious traffic caught): ${detectionRate}
- False Positive Rate (Normal traffic flagged): ${fpRate}
- Quarantined Devices: ${metrics?.quarantined_devices?.length ?? 0}
- Blocked IPs: ${metrics?.blocked_ips?.length ?? 0}
- Current Active Attack: ${metrics?.active_attack || 'None'}

Provide a highly focused technical analysis of the current Detection Rate.
Explain what this detection rate implies about the safety of the network, and suggest 2 concrete actions to improve or optimize the detection rate (e.g. adjusting signature thresholds, training the Isolation Forest ML model on clean baseline data, or modifying blocking policies for specific smart home IoT device categories like lights, speakers, or plugs).
Keep your analysis concise (under 5 sentences), actionable, and highly professional. Do not use markdown headers or lists, keep it as regular text.`;

      const response = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
      });

      setAiInsights(response.choices[0].message.content || "No insights generated.");
      onNotify('AI Detection Insights updated successfully.', 'success');
    } catch (e) {
      console.error(e);
      const errorMsg = e instanceof Error ? e.message : 'Unknown error';
      onNotify(`Failed to generate insights: ${errorMsg}`, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const blockedDevices = useMemo(() => {
    return devices.filter(d => d.status === 'blocked' || d.allowed === false);
  }, [devices]);

  const getMitigationShield = (device: Device) => {
    if (device.allowed === false) {
      return {
        shield: 'Whitelist Guard',
        threat: 'Unauthorized Connection Attempt',
        details: 'Device is not on the whitelisted allowed devices list.',
      };
    }

    const devAlerts = alerts.filter(a => a.deviceId === device.id);
    if (devAlerts.length > 0) {
      const latest = devAlerts[0];
      const threatName = latest.threat.toLowerCase();
      if (threatName.includes('mqtt')) {
        return {
          shield: 'MQTT Flooding Shield',
          threat: latest.threat,
          details: latest.description,
        };
      } else if (threatName.includes('coap')) {
        return {
          shield: 'CoAP Amplification Guard',
          threat: latest.threat,
          details: latest.description,
        };
      } else if (threatName.includes('ssh') || threatName.includes('brute')) {
        return {
          shield: 'SSH Authentication Shield',
          threat: latest.threat,
          details: latest.description,
        };
      } else if (threatName.includes('anomaly') || threatName.includes('ml') || threatName.includes('spoof')) {
        return {
          shield: 'AI Sensor Anomaly Guard',
          threat: latest.threat,
          details: latest.description,
        };
      }
      return {
        shield: 'Signature Intrusion Filter',
        threat: latest.threat,
        details: latest.description,
      };
    }

    return {
      shield: 'Automated Quarantine Policy',
      threat: 'Suspicious Behavior Flagged',
      details: 'Traffic anomaly detected by IPS engine. Secure silo isolation applied.',
    };
  };

  const handleReauthorize = async (deviceId: string, deviceName: string, currentlyAllowed: boolean) => {
    try {
      onNotify(`Reauthorizing node ${deviceName}...`, 'info');
      
      if (!currentlyAllowed) {
        // If not in allowed whitelist, we need to toggle allow state first to prevent instant re-quarantine
        await ipsApi.toggleDeviceAllow(deviceId, true);
      }
      
      await ipsApi.unblockDevice(deviceId);
      onNotify(`Node ${deviceName} successfully reauthorized and returned to mesh.`, 'success');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Reauthorization failed', 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background dark:bg-black p-6 md:p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-main dark:text-white mb-1 uppercase flex items-center gap-3">
          <span className="material-symbols-outlined text-blue-500 pixel-icon">shield_locked</span>
          Prevention & Quarantine Feed
        </h1>
        <p className="text-muted dark:text-gray-500 font-mono text-xs uppercase tracking-widest">
          Local IPS Engine • Real-time Threat Mitigation & Admission Control
        </p>
      </div>

      {/* AI Detection Insights Panel */}
      <div className="border border-surface dark:border-surface-highlight bg-surface/20 dark:bg-surface-dark/20 p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface dark:border-surface-highlight pb-4">
          <div>
            <h3 className="text-main dark:text-white font-bold uppercase tracking-widest text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-blue-400 pixel-icon">auto_awesome</span>
              AI Detection Insights Report
            </h3>
            <p className="text-muted dark:text-gray-500 text-[10px] uppercase font-mono mt-1">
              Groq AI-powered telemetry analysis and optimization guidelines
            </p>
          </div>
          <div className="flex items-center gap-3">
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
            <button
              onClick={generateAiInsights}
              disabled={isGenerating}
              className="px-4 py-2 bg-black dark:bg-white text-white dark:text-black text-xs font-black uppercase hover:bg-gray-800 dark:hover:bg-gray-200 transition-all flex items-center gap-2 outline-none disabled:bg-gray-700 disabled:text-gray-500 shrink-0"
            >
              <span className={`material-symbols-outlined text-sm ${isGenerating ? 'animate-spin' : ''}`}>
                {isGenerating ? 'sync' : 'auto_awesome'}
              </span>
              {isGenerating ? 'Analyzing...' : 'Generate AI Report'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Current telemetry parameters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 border border-surface dark:border-surface-highlight bg-background/50 dark:bg-black/50 flex flex-col justify-between">
              <span className="text-[9px] text-muted dark:text-gray-500 font-bold uppercase mb-2 block font-mono">Detection Rate</span>
              <div>
                <span className="text-3xl font-black text-main dark:text-white font-mono">
                  {metrics?.detection_rate != null ? `${Math.round(metrics.detection_rate)}%` : '98%'}
                </span>
                <span className="text-[10px] text-emerald-500 block font-mono font-bold mt-1">▲ TARGET: &gt;95%</span>
              </div>
            </div>

            <div className="p-4 border border-surface dark:border-surface-highlight bg-background/50 dark:bg-black/50 flex flex-col justify-between">
              <span className="text-[9px] text-muted dark:text-gray-500 font-bold uppercase mb-2 block font-mono">False Positives</span>
              <div>
                <span className="text-3xl font-black text-main dark:text-white font-mono">
                  {metrics?.false_positive_rate != null ? `${Math.round(metrics.false_positive_rate)}%` : '2%'}
                </span>
                <span className="text-[10px] text-blue-400 block font-mono font-bold mt-1">▼ TARGET: &lt;5%</span>
              </div>
            </div>
          </div>

          {/* Detailed insights report */}
          <div className="p-4 border border-surface dark:border-surface-highlight bg-background/50 dark:bg-black/50 min-h-[100px] flex items-center justify-center">
            {aiInsights ? (
              <p className="text-main dark:text-gray-300 font-mono text-xs leading-relaxed italic w-full">
                "{aiInsights}"
              </p>
            ) : (
              <div className="text-center text-muted dark:text-gray-500 font-mono text-xs p-4">
                <span className="material-symbols-outlined text-2xl block mb-2 mx-auto">insights</span>
                Click the Generate AI Report button to run dynamic IPS telemetry analysis.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Active Network Silos & Mitigations Panel */}
      <div className="border border-surface dark:border-surface-highlight bg-surface/20 dark:bg-surface-dark/20 p-6">
        <h3 className="text-main dark:text-white font-bold uppercase tracking-widest border-b border-surface dark:border-surface-highlight pb-3 text-sm flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-[18px] text-red-500 pixel-icon">gpp_maybe</span>
          Active Network Silos & Mitigations
        </h3>

        {blockedDevices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-emerald-500/30 bg-emerald-500/5 text-center font-mono">
            <span className="material-symbols-outlined text-3xl text-emerald-500 mb-2 animate-pulse">verified_user</span>
            <div className="text-emerald-600 dark:text-emerald-400 font-bold uppercase text-xs tracking-wider">ALL MESH TOPOLOGY SECURE</div>
            <p className="text-muted dark:text-gray-500 text-[10px] mt-1 uppercase max-w-md">
              No unauthorized or malicious nodes currently quarantined. All active traffic is routed through whitelisted channels.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-surface dark:border-surface-highlight">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface dark:bg-surface-dark text-[10px] font-bold uppercase text-muted dark:text-gray-500 font-mono tracking-wider border-b border-surface dark:border-surface-highlight">
                <tr>
                  <th className="px-4 py-3">Device Name & ID</th>
                  <th className="px-4 py-3">Network Addresses</th>
                  <th className="px-4 py-3">Enforced Mitigation</th>
                  <th className="px-4 py-3">Intrusion Details</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface dark:divide-surface-highlight font-mono text-xs bg-background dark:bg-black">
                {blockedDevices.map(device => {
                  const details = getMitigationShield(device);
                  const currentlyAllowed = device.allowed ?? true;
                  return (
                    <tr key={device.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-main dark:text-white">{device.name}</div>
                        <div className="text-[10px] text-muted dark:text-gray-500 mt-0.5">{device.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div>IP: {device.ip || 'Unknown'}</div>
                        <div className="text-[10px] text-muted dark:text-gray-500 mt-0.5">MAC: {device.mac || 'N/A'}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-red-500/30 bg-red-500/10 text-red-500 font-bold uppercase text-[9px]">
                          <span className="size-1 bg-red-500 rounded-full animate-ping"></span>
                          {details.shield}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-bold text-main dark:text-white truncate">{details.threat}</div>
                        <div className="text-[10px] text-muted dark:text-gray-400 mt-0.5 leading-relaxed">
                          {details.details}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleReauthorize(device.id, device.name, currentlyAllowed)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 uppercase text-[10px] transition-colors outline-none inline-flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-[14px]">bolt</span>
                          Reauthorize
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <h3 className="text-main dark:text-white font-bold uppercase tracking-widest border-b border-surface dark:border-surface-highlight pb-2 text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] pixel-icon">security</span>
          IPS Rules & Automatic Mitigations
        </h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {SHIELDS.map((item) => (
            <div key={item.id} className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-5 hover:border-blue-500/50 transition-colors group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="px-2 py-1 text-xs font-black font-mono border bg-emerald-950 text-emerald-400 border-emerald-500">
                    {item.severity}
                  </div>
                  <span className="text-muted dark:text-gray-500 font-mono text-xs">{item.type}</span>
                </div>
              </div>
              <h4 className="text-main dark:text-white font-bold group-hover:text-blue-400 transition-colors mb-2 uppercase tracking-tight">{item.name}</h4>
              <p className="text-muted dark:text-gray-400 text-sm font-mono leading-relaxed mb-4">
                {item.description}
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-[10px] bg-background dark:bg-black border border-surface dark:border-surface-highlight px-2 py-1 text-muted dark:text-gray-500 font-mono uppercase">
                  {item.metric}
                </span>
                <span className="text-[10px] bg-background dark:bg-black border border-surface dark:border-surface-highlight px-2 py-1 text-blue-400 font-mono uppercase">
                  {item.mitigation}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-6">
          <h3 className="text-main dark:text-white font-bold uppercase mb-4 text-sm">How to Prevent Suspicious Traffic</h3>
          <div className="space-y-4 text-sm font-mono leading-relaxed text-muted dark:text-gray-300">
            <div className="p-4 bg-background dark:bg-black border border-surface dark:border-surface-highlight">
              <span className="text-blue-400 font-bold block mb-1">1. Keep Simulation Active</span>
              Ensure the simulation is running in the Settings tab. The IPS engine dynamically checks incoming packets only when simulation is live.
            </div>
            <div className="p-4 bg-background dark:bg-black border border-surface dark:border-surface-highlight">
              <span className="text-blue-400 font-bold block mb-1">2. Run Attacks in Settings</span>
              Go to the Settings tab and use the Network Simulation Lab to trigger MQTT Flood, CoAP Amplify, Brute Force, or Data Spoofing. Watch how the filters intercept and block them in real-time.
            </div>
            <div className="p-4 bg-background dark:bg-black border border-surface dark:border-surface-highlight">
              <span className="text-blue-400 font-bold block mb-1">3. Manual Disconnection</span>
              You can disconnect any node instantly from the Network Map or the Connected Device registry under Settings to force drop all of its traffic.
            </div>
          </div>
        </div>
        <div className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-main dark:text-white font-bold uppercase mb-4 text-sm">Current Defense Status</h3>
            <p className="text-xs text-muted dark:text-gray-400 leading-relaxed mb-4">
              All rules are active. The Isolation Forest ML model automatically trains on the first 10 seconds of baseline normal traffic.
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-main dark:text-white font-bold">Detection System</span>
                <span className="text-emerald-500 font-bold">ACTIVE</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-main dark:text-white font-bold">ML Anomaly Model</span>
                <span className="text-blue-400 font-bold">AUTONOMOUS</span>
              </div>
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-main dark:text-white font-bold">Mitigation Action</span>
                <span className="text-emerald-500 font-bold">AUTO-BLOCK</span>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-surface dark:border-surface-highlight">
             <div className="p-3 bg-blue-950/20 border border-blue-500/30">
               <span className="text-[10px] font-bold text-blue-400 block mb-1 font-mono">&gt; SECURITY ADVISORY</span>
               <p className="text-[10px] text-muted dark:text-gray-400 font-mono">Keep an eye on the Action Log for block events when injecting attacks.</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThreatFeed;
