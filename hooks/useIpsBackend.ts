import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, ChartDataPoint, Device } from '../types';
import {
  ipsApi,
  isBackendAvailable,
  LogEntry,
  MetricsResponse,
  SimulationStatus,
} from '../services/ipsApi';

const POLL_MS = 1500;
const RECONNECT_MS = 2000;
const MAX_RECONNECT_MS = 10000;

export function useIpsBackend() {
  const [connected, setConnected] = useState(false);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [trafficChart, setTrafficChart] = useState<ChartDataPoint[]>([]);
  const [simStatus, setSimStatus] = useState<SimulationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_MS);
  const mountedRef = useRef(true);

  const clearReconnect = useCallback(() => {
    if (reconnectRef.current) {
      clearTimeout(reconnectRef.current);
      reconnectRef.current = null;
    }
  }, []);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [m, a, l, t, s] = await Promise.all([
        ipsApi.getMetrics(),
        ipsApi.getAlerts(100),
        ipsApi.getLogs(80),
        ipsApi.getTrafficChart(),
        ipsApi.getSimulationStatus(),
      ]);
      if (!mountedRef.current) return;
      setMetrics(m);
      setAlerts(a);
      setLogs(l);
      setTrafficChart(t);
      setSimStatus(s);
      setConnected(true);
      // Reset reconnect delay on success
      reconnectDelayRef.current = RECONNECT_MS;
    } catch {
      if (!mountedRef.current) return;
      setConnected(false);
    }
  }, []);

  // Schedule a reconnect attempt with exponential backoff
  const scheduleReconnect = useCallback(() => {
    clearReconnect();
    clearPoll();

    const delay = reconnectDelayRef.current;
    console.log(`[useIpsBackend] Backend not available, retrying in ${delay}ms...`);

    reconnectRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;

      const ok = await isBackendAvailable();
      if (!mountedRef.current) return;

      if (ok) {
        console.log('[useIpsBackend] Backend connected!');
        setConnected(true);
        setLoading(false);
        reconnectDelayRef.current = RECONNECT_MS;
        await refresh();
      } else {
        // Exponential backoff, capped at MAX_RECONNECT_MS
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * 1.5,
          MAX_RECONNECT_MS
        );
        scheduleReconnect();
      }
    }, delay);
  }, [clearReconnect, clearPoll, refresh]);

  // Initial connection check
  useEffect(() => {
    mountedRef.current = true;

    (async () => {
      const ok = await isBackendAvailable();
      if (!mountedRef.current) return;
      setConnected(ok);
      setLoading(false);

      if (ok) {
        await refresh();
      } else {
        // Backend not available yet — start reconnect loop
        scheduleReconnect();
      }
    })();

    return () => {
      mountedRef.current = false;
      clearReconnect();
      clearPoll();
    };
  }, [refresh, scheduleReconnect, clearReconnect, clearPoll]);

  // Polling when connected
  useEffect(() => {
    if (!connected) {
      clearPoll();
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        await refresh();
      } catch {
        // If a poll fails, mark disconnected and start reconnecting
        if (mountedRef.current) {
          setConnected(false);
        }
      }
    }, POLL_MS);

    return () => {
      clearPoll();
    };
  }, [connected, refresh, clearPoll]);

  // When disconnected after having been connected, start reconnect
  useEffect(() => {
    if (!connected && !loading) {
      scheduleReconnect();
    }
    return () => {
      if (!connected) {
        clearReconnect();
      }
    };
  }, [connected, loading, scheduleReconnect, clearReconnect]);

  const devices: Device[] = metrics?.devices ?? [];

  const startSimulation = async () => {
    const s = await ipsApi.startSimulation();
    setSimStatus(s);
    await refresh();
    return s;
  };

  const stopSimulation = async () => {
    const s = await ipsApi.stopSimulation();
    setSimStatus(s);
    await refresh();
    return s;
  };

  const triggerAttack = async (
    attackType: Parameters<typeof ipsApi.triggerAttack>[0],
    targetId?: string,
    attackerId?: string,
    packetRate?: number
  ) => {
    const r = await ipsApi.triggerAttack(attackType, targetId, attackerId, packetRate);
    await refresh();
    return r;
  };

  return {
    connected,
    loading,
    metrics,
    alerts,
    logs,
    trafficChart,
    simStatus,
    devices,
    refresh,
    startSimulation,
    stopSimulation,
    triggerAttack,
    ipsApi,
  };
}
