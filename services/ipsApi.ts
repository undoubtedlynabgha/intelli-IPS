import { Alert, ChartDataPoint, Device } from '../types';

/**
 * Determine the API base URL based on the runtime context:
 * 1. Electron packaged app or dev client (direct loopback) → http://127.0.0.1:8000
 * 2. Vite dev server web client → use /api prefix which gets proxied to http://127.0.0.1:8000
 * 3. Custom env override → use VITE_API_URL
 */
function getApiBase(): string {
  // If running inside Electron or loaded via file:// protocol, bypass proxy and query loopback directly
  if (
    typeof window !== 'undefined' &&
    (window.location.protocol === 'file:' || (window as any).electron)
  ) {
    return 'http://127.0.0.1:8000';
  }

  // Check for explicit env override
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) {
    return envUrl;
  }

  // Vite dev server web fallback: proxy /api → localhost:8000
  return '/api';
}

const API_BASE = getApiBase();

export type AttackType = 'dos_mqtt' | 'dos_coap' | 'brute_force' | 'data_spoofing' | 'heavy_traffic';

export interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  category: 'SYSTEM' | 'NETWORK' | 'AUTH' | 'IO' | 'MITIGATION';
  message: string;
  status: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'BLOCKED';
}

export interface MetricsResponse {
  simulation_running: boolean;
  total_packets: number;
  total_alerts: number;
  total_blocked: number;
  total_prevented: number;
  blocked_ips: string[];
  quarantined_devices: string[];
  packets_per_second: number;
  detection_rate: number;
  false_positive_rate: number;
  devices: Device[];
  active_attack: string | null;
  active_attack_attacker_id?: string | null;
  active_attack_target_id?: string | null;
  ml_model_trained: boolean;
  ml_precision: number;
  ml_recall: number;
  ml_f1_score: number;
  ml_accuracy: number;
  confusion_matrix: { tp: number; fp: number; tn: number; fn: number };
}

export interface SimulationStatus {
  running: boolean;
  uptime_seconds: number;
  total_packets_generated: number;
  total_attacks_injected: number;
  active_attack: string | null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      signal: controller.signal,
      ...options,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      throw new Error(err.detail ?? res.statusText);
    }
    return res.json();
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw e;
  }
}

export const ipsApi = {
  health: () => request<{ status: string; simulation_running: boolean }>('/'),

  startSimulation: () =>
    request<SimulationStatus>('/simulation/start', { method: 'POST' }),

  stopSimulation: () =>
    request<SimulationStatus>('/simulation/stop', { method: 'POST' }),

  resetSimulation: () =>
    request<{ status: string; message: string }>('/simulation/reset', { method: 'POST' }),

  getSimulationStatus: () => request<SimulationStatus>('/simulation/status'),

  getMode: () => request<{ mode: 'simulation' | 'real' }>('/simulation/mode'),

  setMode: (mode: 'simulation' | 'real') =>
    request<{ status: string; mode: string }>('/simulation/mode', {
      method: 'POST',
      body: JSON.stringify({ mode }),
    }),

  scanRealNetwork: () =>
    request<{ status: string; message: string }>('/simulation/scan-real', { method: 'POST' }),

  triggerAttack: (attack_type: AttackType, target_device_id?: string, attacker_device_id?: string, packet_rate?: number) =>
    request<{ status: string; attack_type: string; label: string }>('/simulation/attack', {
      method: 'POST',
      body: JSON.stringify({ attack_type, target_device_id, attacker_device_id, packet_rate }),
    }),

  stopAttack: () =>
    request<{ status: string }>('/simulation/attack/stop', { method: 'POST' }),

  getAlerts: (limit = 50) => request<Alert[]>(`/ips/alerts?limit=${limit}`),

  getMetrics: () => request<MetricsResponse>('/ips/metrics'),

  getLogs: (limit = 50) => request<LogEntry[]>(`/ips/logs?limit=${limit}`),

  getTrafficChart: () => request<ChartDataPoint[]>('/ips/traffic-chart'),

  resetIps: () => request<{ status: string }>('/ips/reset', { method: 'POST' }),

  clearLogs: () => request<{ status: string }>('/ips/clear-logs', { method: 'POST' }),

  runScenario: (scenario_type: string) =>
    request<{ status: string; scenario: string; message: string }>('/simulation/run-scenario', {
      method: 'POST',
      body: JSON.stringify({ scenario_type }),
    }),

  uploadTrace: (packets: any[]) =>
    request<{ status: string; packet_count: number }>('/simulation/upload-trace', {
      method: 'POST',
      body: JSON.stringify({ packets }),
    }),

  retrainMlModel: (contamination: number, n_estimators: number) =>
    request<{ status: string; message: string }>('/ips/retrain', {
      method: 'POST',
      body: JSON.stringify({ contamination, n_estimators }),
    }),

  getFirewallScriptUrl: (ip: string, osType: 'windows' | 'linux') =>
    `${API_BASE}/ips/firewall-script?ip=${ip}&os_type=${osType}`,

  getReportDownloadUrl: () => `${API_BASE}/ips/reports/download`,

  blockDevice: (deviceId: string) =>
    request<{ status: string }>(`/devices/${deviceId}/block`, { method: 'POST' }),

  unblockDevice: (deviceId: string) =>
    request<{ status: string }>(`/devices/${deviceId}/unblock`, { method: 'POST' }),

  toggleDeviceAllow: (deviceId: string, allowed: boolean) =>
    request<{ status: string }>(`/devices/${deviceId}/allow?allowed=${allowed}`, { method: 'POST' }),

  addDevice: (device: Device) =>
    request<Device>('/devices/', {
      method: 'POST',
      body: JSON.stringify(device),
    }),

  removeDevice: (deviceId: string) =>
    request<{ status: string; message: string }>(`/devices/${deviceId}`, {
      method: 'DELETE',
    }),
};

export async function isBackendAvailable(): Promise<boolean> {
  try {
    await ipsApi.health();
    return true;
  } catch {
    return false;
  }
}
