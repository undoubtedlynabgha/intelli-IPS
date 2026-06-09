
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Device } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { AttackType, ipsApi } from '../services/ipsApi';

interface NetworkMapProps {
  isScanning?: boolean;
  onNotify: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  devices: Device[];
  externalSelectedId?: string | null;
  onClearExternalSelect?: () => void;
  ipsApi?: any;
  backendConnected?: boolean;
  // Simulation props
  simulationRunning?: boolean;
  activeAttack?: string | null;
  mlTrained?: boolean;
  onStartSimulation?: () => Promise<unknown>;
  onStopSimulation?: () => Promise<unknown>;
  onTriggerAttack?: (type: AttackType, targetId?: string, attackerId?: string, packetRate?: number) => Promise<unknown>;
  isAdmin?: boolean;
  onAddDevice?: (device: Device) => void;
  onRemoveDevice?: (id: string) => void;
}

const ATTACKS: { id: AttackType; label: string; icon: string; desc: string; color: string }[] = [
  { id: 'dos_mqtt', label: 'MQTT Flood', icon: 'flood', desc: 'Broker flooding (DoS)', color: 'red' },
  { id: 'dos_coap', label: 'CoAP Amplify', icon: 'wifi_tethering_error', desc: 'CoAP amplification', color: 'red' },
  { id: 'brute_force', label: 'Brute Force', icon: 'key_off', desc: 'Auth credential stuffing', color: 'orange' },
  { id: 'data_spoofing', label: 'Data Spoofing', icon: 'edit_note', desc: 'Sensor value injection', color: 'orange' },
  { id: 'heavy_traffic', label: 'Traffic Surge', icon: 'network_check', desc: 'Outbound anomaly profile', color: 'yellow' },
];

const NetworkMap: React.FC<NetworkMapProps> = ({
  isScanning,
  onNotify,
  devices,
  externalSelectedId,
  onClearExternalSelect,
  ipsApi,
  backendConnected,
  simulationRunning = false,
  activeAttack = null,
  mlTrained = false,
  onStartSimulation,
  onStopSimulation,
  onTriggerAttack,
  isAdmin = true,
  onAddDevice,
  onRemoveDevice,
}) => {
  const { theme } = useTheme();
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showNodePanel, setShowNodePanel] = useState(true);
  const [selectedNode, setSelectedNode] = useState('CAM_EXT_04');
  const [showSimPanel, setShowSimPanel] = useState(true);
  const [simTab, setSimTab] = useState<'control' | 'attack' | 'add'>('control');
  const [selectedAttackId, setSelectedAttackId] = useState<AttackType | null>(null);
  const [targetId, setTargetId] = useState<string>('');
  const [attackerId, setAttackerId] = useState<string>('');
  const [packetRate, setPacketRate] = useState<number>(50);

  const [addDeviceName, setAddDeviceName] = useState('');
  const [addDeviceType, setAddDeviceType] = useState('sensors');
  const [addDeviceIp, setAddDeviceIp] = useState(`192.168.1.${Math.floor(Math.random() * 150) + 100}`);
  const [addDeviceAllowed, setAddDeviceAllowed] = useState(true);

  const [selectedScenario, setSelectedScenario] = useState('ddos_gateway');
  const [runningScenario, setRunningScenario] = useState(false);

  const handleRunScenario = async () => {
    setRunningScenario(true);
    onNotify(`Loading scenario: ${selectedScenario}...`, 'info');
    try {
      await ipsApi.runScenario(selectedScenario);
      onNotify(`Scenario '${selectedScenario}' initiated. Training baseline...`, 'success');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Failed to launch scenario', 'error');
    } finally {
      setRunningScenario(false);
    }
  };

  const handleTraceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!Array.isArray(json)) {
          onNotify('Invalid trace format: must be a JSON array of packets', 'error');
          return;
        }
        onNotify(`Replaying trace: uploading ${json.length} packets...`, 'info');
        await ipsApi.uploadTrace(json);
        onNotify(`Trace replay initiated in backend. Check Event Streams!`, 'success');
      } catch (err) {
        onNotify('Failed to parse JSON file', 'error');
      }
    };
    reader.readAsText(file);
  };

  // Draggable panel state
  const [panelPos, setPanelPos] = useState({ x: 16, y: 16 });
  const isDraggingRef = useRef(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Draggable canvas panning state
  const canvasWrapRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only drag with left click
    if (e.button !== 0) return;
    
    // Check if the click target is interactive (like a node, button, select, panel etc.)
    const target = e.target as HTMLElement;
    if (
      target.closest('.pointer-events-auto') || 
      target.closest('button') || 
      target.closest('select') || 
      target.closest('input') ||
      target.closest('a')
    ) {
      return;
    }

    const wrap = canvasWrapRef.current;
    if (!wrap) return;

    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: wrap.scrollLeft,
      scrollTop: wrap.scrollTop,
    };
    e.preventDefault();
  };

  const handleCanvasMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;
    const wrap = canvasWrapRef.current;
    if (!wrap) return;

    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;

    wrap.scrollLeft = panStartRef.current.scrollLeft - dx;
    wrap.scrollTop = panStartRef.current.scrollTop - dy;
  }, [isPanning]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  useEffect(() => {
    if (isPanning) {
      window.addEventListener('mousemove', handleCanvasMouseMove);
      window.addEventListener('mouseup', handleCanvasMouseUp);
    } else {
      window.removeEventListener('mousemove', handleCanvasMouseMove);
      window.removeEventListener('mouseup', handleCanvasMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleCanvasMouseMove);
      window.removeEventListener('mouseup', handleCanvasMouseUp);
    };
  }, [isPanning, handleCanvasMouseMove, handleCanvasMouseUp]);

  useEffect(() => {
    if (!selectedAttackId) return;
    if (selectedAttackId === 'dos_mqtt' || selectedAttackId === 'dos_coap') setPacketRate(100);
    else if (selectedAttackId === 'brute_force') setPacketRate(10);
    else if (selectedAttackId === 'data_spoofing') setPacketRate(5);
    else if (selectedAttackId === 'heavy_traffic') setPacketRate(30);
    setTargetId('');
    setAttackerId('');
  }, [selectedAttackId]);

  useEffect(() => {
    if (externalSelectedId) {
      setSelectedNode(externalSelectedId);
      setShowNodePanel(true);
      onClearExternalSelect?.();
    }
  }, [externalSelectedId, onClearExternalSelect]);

  // Dragging logic for the node panel
  const handlePanelMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    dragOffsetRef.current = { x: e.clientX - panelPos.x, y: e.clientY - panelPos.y };

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const container = canvasRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newX = Math.max(0, Math.min(ev.clientX - dragOffsetRef.current.x, rect.width - 290));
      const newY = Math.max(0, Math.min(ev.clientY - dragOffsetRef.current.y, rect.height - 100));
      setPanelPos({ x: newX, y: newY });
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [panelPos]);

  const handleZoom = (delta: number) => {
    setZoomLevel(prev => Math.min(Math.max(prev + delta, 40), 400));
  };

  const handleIsolate = async (id: string, name: string) => {
    if (!backendConnected || !ipsApi) {
      onNotify(`Initiating physical port isolation for ${name}...`, 'warning');
      setTimeout(() => onNotify(`Node ${name} isolated from mesh (demo).`, 'success'), 1500);
      return;
    }
    try {
      onNotify(`Quarantining ${name}...`, 'warning');
      await ipsApi.blockDevice(id);
      onNotify(`Node ${name} quarantined and blocked.`, 'success');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Isolate failed', 'error');
    }
  };

  const handleUnblock = async (id: string, name: string) => {
    if (!backendConnected || !ipsApi) {
      onNotify(`Reconnecting node ${name}...`, 'info');
      setTimeout(() => onNotify(`Node ${name} reconnected (demo).`, 'success'), 1500);
      return;
    }
    try {
      onNotify(`Reconnecting ${name}...`, 'info');
      await ipsApi.unblockDevice(id);
      onNotify(`Node ${name} successfully reconnected.`, 'success');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Reconnect failed', 'error');
    }
  };

  const handleSimAction = async (fn: () => Promise<unknown>, ok: string, err: string) => {
    try {
      await fn();
      onNotify(ok, 'success');
    } catch (e) {
      onNotify(e instanceof Error ? e.message : err, 'error');
    }
  };

  const handleLaunchAttack = async () => {
    if (!selectedAttackId) return;
    try {
      await onTriggerAttack?.(selectedAttackId, targetId || undefined, attackerId || undefined, packetRate);
      onNotify(`${ATTACKS.find(a => a.id === selectedAttackId)?.label} injected — IPS monitoring response`, 'warning');
      setSelectedAttackId(null);
    } catch (e) {
      onNotify(e instanceof Error ? e.message : 'Attack failed — is simulation running?', 'error');
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addDeviceName) {
      onNotify('Device label is required', 'error');
      return;
    }
    const ipPattern = /^192\.168\.\d+\.\d+$|^10\.\d+\.\d+\.\d+$/;
    if (!ipPattern.test(addDeviceIp)) {
      onNotify('Please enter a valid IP address (e.g. 192.168.1.50)', 'error');
      return;
    }
    const hex = '0123456789ABCDEF';
    const randByte = () => hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
    const generatedMac = `AA:BB:CC:${randByte()}:${randByte()}:${randByte()}`;
    const newDevice: Device = {
      id: `IOT_${Math.floor(Math.random() * 9000) + 1000}`,
      name: addDeviceName,
      type: addDeviceType as any,
      ip: addDeviceIp,
      mac: generatedMac,
      status: 'online',
      allowed: addDeviceAllowed
    };
    if (onAddDevice) {
      onAddDevice(newDevice);
      setAddDeviceName('');
      setAddDeviceType('sensors');
      setAddDeviceIp(`192.168.1.${Math.floor(Math.random() * 150) + 100}`);
      setAddDeviceAllowed(true);
    } else {
      onNotify('Device addition not supported', 'error');
    }
  };

  const selectNode = (id: string) => {
    setSelectedNode(id);
    setShowNodePanel(true);
  };

  // Absolute positions on a 1000x800 canvas
  const activeNodes = React.useMemo(() => {
    const nonGatewayDevices = devices.filter(d => d.type !== 'router');
    return devices.map(d => {
      if (d.type === 'router') return { ...d, x: 500, y: 400 };
      const index = nonGatewayDevices.findIndex(dd => dd.id === d.id);
      let remaining = index;
      let ringNum = 0;
      let ringCapacity = 8;
      let radius = 180;
      while (remaining >= ringCapacity) {
        remaining -= ringCapacity;
        ringNum++;
        ringCapacity = 8 + ringNum * 8;
        radius = 180 + ringNum * 110;
      }
      const angle = ringNum * 15 + (remaining * (360 / ringCapacity));
      const rad = (angle * Math.PI) / 180;
      return { ...d, x: 500 + radius * Math.cos(rad), y: 400 + radius * Math.sin(rad) };
    });
  }, [devices]);

  const meshLinks = React.useMemo(() => {
    const links: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; status: string; isGateway: boolean }> = [];
    const nonGateway = activeNodes.filter(n => n.type !== 'router');
    nonGateway.forEach(n => {
      links.push({ id: `gw-${n.id}`, x1: 500, y1: 400, x2: n.x, y2: n.y, status: n.status, isGateway: true });
    });
    nonGateway.forEach(n => {
      const others = nonGateway.filter(o => o.id !== n.id);
      if (others.length === 0) return;
      const sortedByDist = others.map(o => {
        const dx = o.x - n.x; const dy = o.y - n.y;
        return { node: o, dist: Math.sqrt(dx * dx + dy * dy) };
      }).sort((a, b) => a.dist - b.dist);
      [sortedByDist[0], sortedByDist[1]].filter(Boolean).forEach(item => {
        const near = item.node;
        let ls = 'online';
        if (n.status === 'blocked' || near.status === 'blocked') ls = 'blocked';
        else if (n.status === 'threat' || near.status === 'threat') ls = 'threat';
        const lid = [n.id, near.id].sort().join('-');
        if (!links.some(l => l.id === lid)) {
          links.push({ id: lid, x1: n.x, y1: n.y, x2: near.x, y2: near.y, status: ls, isGateway: false });
        }
      });
    });
    return links;
  }, [activeNodes]);

  const selectedDeviceData = devices.find(d => d.name === selectedNode);

  const blockedCount = devices.filter(d => d.status === 'blocked').length;
  const threatCount = devices.filter(d => d.status === 'threat').length;
  const onlineCount = devices.filter(d => d.status === 'online').length;

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col bg-background dark:bg-[#050505]">

      {/* Top status bar */}
      <div className="h-11 border-b border-surface dark:border-surface-highlight bg-surface/30 dark:bg-surface-dark/30 flex items-center px-4 gap-0 shrink-0 backdrop-blur-sm z-20">
        <div className="flex items-center gap-5 text-xs font-mono">
          <span className="flex items-center gap-2 text-emerald-500">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_6px_#10b981]"></span>
            <span className="text-muted dark:text-gray-400">Allowed:</span> {onlineCount}
          </span>
          <span className="flex items-center gap-2 text-orange-400">
            <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse shadow-[0_0_6px_#f97316]"></span>
            <span className="text-muted dark:text-gray-400">Threat:</span> {threatCount}
          </span>
          <span className="flex items-center gap-2 text-red-400">
            <span className="w-1.5 h-1.5 bg-red-600 rounded-full shadow-[0_0_6px_#ef4444]"></span>
            <span className="text-muted dark:text-gray-400">Prevented:</span> {blockedCount}
          </span>
          <div className="h-4 w-px bg-surface dark:bg-surface-highlight mx-1"></div>
          <span className={`flex items-center gap-1.5 ${simulationRunning ? 'text-blue-400' : 'text-muted dark:text-gray-500'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${simulationRunning ? 'bg-blue-400 animate-pulse shadow-[0_0_6px_#60a5fa]' : 'bg-gray-600'}`}></span>
            Sim: {simulationRunning ? 'Active' : 'Idle'}
          </span>
          {activeAttack && (
            <span className="flex items-center gap-1.5 text-red-400 animate-pulse">
              <span className="material-symbols-outlined text-[14px]">bolt</span>
              {activeAttack}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <span className="text-[10px] text-muted dark:text-gray-500 uppercase font-mono mr-2 tracking-widest">ZOOM {zoomLevel}%</span>
          <button onClick={() => handleZoom(20)} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 text-muted dark:text-gray-400 hover:text-main dark:hover:text-white outline-none rounded">
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
          <button onClick={() => handleZoom(-20)} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 text-muted dark:text-gray-400 hover:text-main dark:hover:text-white outline-none rounded">
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <button onClick={() => setZoomLevel(100)} className="p-1 hover:bg-black/10 dark:hover:bg-white/10 text-muted dark:text-gray-400 hover:text-main dark:hover:text-white outline-none rounded text-[10px] font-mono font-bold">
            FIT
          </button>
          <div className="h-4 w-px bg-surface dark:bg-surface-highlight mx-2"></div>
          {isAdmin && (
            <button
              onClick={() => setShowSimPanel(v => !v)}
              className={`flex items-center gap-1.5 text-[11px] font-bold px-3 h-7 transition-all border outline-none ${showSimPanel ? 'bg-blue-600 border-blue-500 text-white' : 'bg-surface dark:bg-surface-dark border-surface dark:border-surface-highlight text-muted dark:text-gray-400 hover:text-main dark:hover:text-white'}`}
            >
              <span className="material-symbols-outlined text-[14px]">science</span>
              Simulation
            </button>
          )}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Network canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative min-w-0 min-h-0 overflow-auto bg-background dark:bg-[#050505]"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.12) transparent' }}
        >
          {/* Custom scrollbar styles */}
          <style>{`
            .network-canvas-wrap::-webkit-scrollbar { width: 6px; height: 6px; }
            .network-canvas-wrap::-webkit-scrollbar-track { background: transparent; }
            .network-canvas-wrap::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 3px; }
            .network-canvas-wrap::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
            .network-canvas-wrap::-webkit-scrollbar-corner { background: transparent; }
          `}</style>

          <div
            ref={canvasWrapRef}
            onMouseDown={handleCanvasMouseDown}
            className={`network-canvas-wrap absolute inset-0 overflow-auto flex items-start justify-start p-4 ${isPanning ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
            style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.12) transparent' }}
          >
            <div
              style={{
                width: `${1000 * (zoomLevel / 100)}px`,
                height: `${800 * (zoomLevel / 100)}px`,
                minWidth: `${1000 * (zoomLevel / 100)}px`,
                minHeight: `${800 * (zoomLevel / 100)}px`,
                transition: 'width 0.2s, height 0.2s',
                flexShrink: 0,
              }}
              className="relative border border-surface dark:border-surface-highlight bg-white dark:bg-[#070707] shadow-inner"
            >
              <div
                style={{ width: '1000px', height: '800px', transform: `scale(${zoomLevel / 100})`, transformOrigin: '0 0', transition: 'transform 0.2s' }}
                className="absolute inset-0"
              >
                {/* Grid */}
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    backgroundImage: `linear-gradient(${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'} 1px, transparent 1px), linear-gradient(90deg, ${theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'} 1px, transparent 1px)`,
                    backgroundSize: '40px 40px'
                  }}
                ></div>

                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  {meshLinks.map(link => {
                    let strokeColor = theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)';
                    if (link.status === 'blocked') strokeColor = 'rgba(239,68,68,0.8)';
                    else if (link.status === 'threat') strokeColor = 'rgba(249,115,22,0.7)';
                    else if (!link.isGateway) strokeColor = theme === 'dark' ? 'rgba(16,185,129,0.2)' : 'rgba(5,150,105,0.2)';
                    let strokeDash = '0';
                    if (link.status === 'threat') strokeDash = '4,4';
                    else if (!link.isGateway) strokeDash = '2,4';
                    const strokeWidth = link.status === 'blocked' ? (link.isGateway ? '2.5' : '1.5') : (link.isGateway ? '1.5' : '1.0');
                    return (
                      <line key={link.id} x1={link.x1} y1={link.y1} x2={link.x2} y2={link.y2}
                        stroke={strokeColor} strokeDasharray={strokeDash} strokeWidth={strokeWidth} />
                    );
                  })}
                  
                  {/* SVG Packet Flow Animations */}
                  {simulationRunning && meshLinks.map(link => {
                    if (link.status === 'blocked') return null;
                    let particleColor = theme === 'dark' ? '#10b981' : '#059669';
                    let dur = '3.0s';
                    
                    if (link.status === 'threat') {
                      particleColor = '#ef4444';
                      dur = '0.7s';
                    } else if (!link.isGateway) {
                      particleColor = theme === 'dark' ? '#3b82f6' : '#2563eb';
                      dur = '4.0s';
                    }
                    
                    const halfDur = (parseFloat(dur) / 2) + 's';
                    
                    return (
                      <g key={`particles-${link.id}`}>
                        <circle r="3" fill={particleColor} opacity="0.8">
                          <animate attributeName="cx" from={link.x2} to={link.x1} dur={dur} begin="0s" repeatCount="indefinite" />
                          <animate attributeName="cy" from={link.y2} to={link.y1} dur={dur} begin="0s" repeatCount="indefinite" />
                        </circle>
                        <circle r="3" fill={particleColor} opacity="0.8">
                          <animate attributeName="cx" from={link.x2} to={link.x1} dur={dur} begin={halfDur} repeatCount="indefinite" />
                          <animate attributeName="cy" from={link.y2} to={link.y1} dur={dur} begin={halfDur} repeatCount="indefinite" />
                        </circle>
                      </g>
                    );
                  })}
                </svg>

                <div className="absolute inset-0 w-full h-full pointer-events-none">
                  {activeNodes.map(node => (
                    <div
                      key={node.id}
                      className="absolute pointer-events-auto flex flex-col items-center gap-2 group cursor-pointer"
                      style={{ top: `${node.y}px`, left: `${node.x}px`, transform: 'translate(-50%, -50%)' }}
                      onClick={() => selectNode(node.name)}
                    >
                      {node.type === 'router' ? (
                        <div className={`w-16 h-16 bg-black dark:bg-white border-4 border-surface dark:border-surface-dark flex items-center justify-center relative hover:scale-110 transition-all duration-300 ${selectedNode === node.name ? 'shadow-[0_0_30px_rgba(0,0,0,0.4)] dark:shadow-[0_0_30px_rgba(255,255,255,0.4)] ring-2 ring-black dark:ring-white ring-offset-4 ring-offset-background dark:ring-offset-black' : ''}`}>
                          <span className="material-symbols-outlined text-3xl text-white dark:text-black pixel-icon">router</span>
                        </div>
                      ) : node.status === 'blocked' ? (
                        <div className="relative">
                          <div className="absolute inset-0 bg-red-500/20 blur-lg"></div>
                          <div className={`w-12 h-12 bg-red-600 border-2 border-red-400 flex items-center justify-center relative transition-all duration-300 group-hover:scale-110 ${selectedNode === node.name ? 'shadow-[0_0_30px_rgba(239,68,68,0.8)]' : ''}`}>
                            <span className="material-symbols-outlined text-xl text-white pixel-icon">lock</span>
                          </div>
                        </div>
                      ) : node.status === 'threat' ? (
                        <div className="relative">
                          <div className="absolute inset-0 bg-orange-500/30 blur-xl animate-pulse"></div>
                          <div className={`w-12 h-12 bg-surface dark:bg-surface-dark border-2 border-orange-500 flex items-center justify-center relative transition-all duration-300 group-hover:scale-110 ${selectedNode === node.name ? 'shadow-[0_0_30px_rgba(249,115,22,0.8)] border-orange-400' : 'shadow-[0_0_20px_rgba(249,115,22,0.4)]'}`}>
                            <span className="material-symbols-outlined text-xl text-orange-500 pixel-icon">{node.type}</span>
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 border border-background dark:border-black flex items-center justify-center">
                              <span className="material-symbols-outlined text-[10px] text-white font-bold pixel-icon">priority_high</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={`w-10 h-10 bg-surface dark:bg-surface-dark border flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${selectedNode === node.name ? 'border-black dark:border-white shadow-[0_0_15px_rgba(0,0,0,0.3)] dark:shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-surface dark:border-surface-highlight'}`}>
                          <span className={`material-symbols-outlined text-lg pixel-icon ${selectedNode === node.name ? 'text-main dark:text-white' : 'text-muted dark:text-gray-400 group-hover:text-main dark:group-hover:text-white'}`}>{node.type}</span>
                        </div>
                      )}
                      <span className={`text-[10px] font-mono font-bold whitespace-nowrap bg-background/80 dark:bg-black/80 px-2 py-0.5 border transition-all ${node.status === 'blocked' ? 'text-red-400 border-red-900/50' : node.status === 'threat' ? 'text-orange-400 border-orange-900/50' : node.type === 'router' ? 'text-main dark:text-white border-black/20 dark:border-white/20' : (selectedNode === node.name ? 'text-main dark:text-white border-black dark:border-white' : 'text-muted dark:text-gray-500 border-surface dark:border-surface-highlight')}`}>
                        {node.name}
                      </span>
                    </div>
                  ))}
                </div>

                {isScanning && (
                  <div className="absolute top-[400px] left-[500px] -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                    <div className="w-[400px] h-[400px] border-2 border-emerald-500/20 rounded-full animate-ping"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-emerald-500/10 rounded-full animate-pulse"></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Draggable Node info panel */}
          {showNodePanel && selectedDeviceData && (
            <div
              className="absolute w-72 bg-background/97 dark:bg-black/97 backdrop-blur-md border border-surface dark:border-surface-highlight shadow-2xl flex flex-col z-30 animate-in fade-in slide-in-from-left-4 duration-300"
              style={{ top: `${panelPos.y}px`, left: `${panelPos.x}px`, userSelect: 'none' }}
            >
              {/* Drag handle header */}
              <div
                className={`p-3 border-b flex justify-between items-center cursor-grab active:cursor-grabbing ${selectedDeviceData.status === 'threat' ? 'bg-orange-950/20 border-orange-500/30' : selectedDeviceData.status === 'blocked' ? 'bg-red-950/20 border-red-500/30' : 'bg-surface dark:bg-surface-dark border-surface dark:border-surface-highlight'}`}
                onMouseDown={handlePanelMouseDown}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-gray-500 mr-0.5">drag_indicator</span>
                  <span className={`material-symbols-outlined text-sm pixel-icon ${selectedDeviceData.status === 'threat' ? 'text-orange-500' : selectedDeviceData.status === 'blocked' ? 'text-red-500' : 'text-emerald-500'}`}>
                    {selectedDeviceData.status === 'threat' ? 'warning' : selectedDeviceData.status === 'blocked' ? 'shield_locked' : 'verified_user'}
                  </span>
                  <span className={`text-xs font-bold uppercase tracking-wider font-mono ${selectedDeviceData.status === 'threat' ? 'text-orange-500' : selectedDeviceData.status === 'blocked' ? 'text-red-500' : 'text-emerald-500'}`}>
                    {selectedDeviceData.status === 'threat' ? 'Suspicious Node' : selectedDeviceData.status === 'blocked' ? 'Traffic Prevented' : 'Traffic Allowed'}
                  </span>
                </div>
                <button onClick={() => setShowNodePanel(false)} className="text-muted dark:text-gray-500 hover:text-main dark:hover:text-white p-1 outline-none cursor-pointer">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 bg-surface dark:bg-surface-dark border flex items-center justify-center shrink-0 ${selectedDeviceData.status === 'blocked' ? 'border-red-500/50' : selectedDeviceData.status === 'threat' ? 'border-orange-500/50' : 'border-surface dark:border-surface-highlight'}`}>
                    <span className="material-symbols-outlined text-main dark:text-white pixel-icon text-lg">{selectedDeviceData.type}</span>
                  </div>
                  <div>
                    <h3 className="text-main dark:text-white text-sm font-bold uppercase">{selectedDeviceData.name}</h3>
                    <p className="text-xs text-muted dark:text-gray-400 font-mono mt-0.5">{selectedDeviceData.type}</p>
                    <p className="text-xs text-muted dark:text-gray-500 font-mono">IP: {selectedDeviceData.ip || 'N/A'}</p>
                  </div>
                </div>

                {selectedDeviceData.status === 'blocked' ? (
                  <div className="p-3 bg-red-500/8 border border-red-500/20 text-xs font-mono leading-relaxed">
                    <span className="text-red-400 font-bold block mb-1">▶ IPS: TRAFFIC PREVENTED</span>
                    <span className="text-muted dark:text-gray-400">All inbound/outbound packets dropped. MQTT violation detected. Node quarantined by policy.</span>
                  </div>
                ) : selectedDeviceData.status === 'threat' ? (
                  <div className="p-3 bg-orange-500/8 border border-orange-500/20 text-xs font-mono leading-relaxed">
                    <span className="text-orange-400 font-bold block mb-1">▶ IPS: ANOMALY FLAGGED</span>
                    <span className="text-muted dark:text-gray-400">Unexpected traffic spike detected. AI model scoring in progress. Consider preventive block.</span>
                  </div>
                ) : (
                  <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 text-xs font-mono leading-relaxed">
                    <span className="text-emerald-400 font-bold block mb-1">▶ IPS: TRAFFIC ALLOWED</span>
                    <span className="text-muted dark:text-gray-400">Node within baseline parameters. All traffic permitted. Latency nominal.</span>
                  </div>
                )}

                {isAdmin && (
                  <div className="pt-2 border-t border-surface dark:border-surface-highlight flex flex-col gap-2">
                    {selectedDeviceData.status === 'blocked' ? (
                      <button
                        onClick={() => handleUnblock(selectedDeviceData.id, selectedDeviceData.name)}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-2 transition-colors uppercase flex items-center justify-center gap-2 outline-none"
                      >
                        <span className="material-symbols-outlined text-[15px] pixel-icon">check_circle</span> Allow Traffic
                      </button>
                    ) : (
                      <button
                        onClick={() => handleIsolate(selectedDeviceData.id, selectedDeviceData.name)}
                        className="w-full bg-red-700/80 hover:bg-red-600 text-white text-xs font-bold py-2.5 px-2 border border-red-500/30 transition-colors uppercase flex items-center justify-center gap-2 outline-none"
                      >
                        <span className="material-symbols-outlined text-[15px] pixel-icon">block</span> Prevent Traffic
                      </button>
                    )}
                    {selectedDeviceData.type !== 'router' && (
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to decommission ${selectedDeviceData.name}?`)) {
                            onRemoveDevice?.(selectedDeviceData.id);
                            setShowNodePanel(false);
                          }
                        }}
                        className="w-full bg-red-950/20 hover:bg-red-900/40 text-red-400 text-xs font-bold py-2.5 px-2 border border-red-900/30 transition-colors uppercase flex items-center justify-center gap-2 outline-none"
                      >
                        <span className="material-symbols-outlined text-[15px] pixel-icon">delete_forever</span> Decommission Node
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Simulation Side Panel */}
        {showSimPanel && isAdmin && (
          <div className="w-80 bg-background dark:bg-[#060606] border-l border-surface dark:border-surface-highlight flex flex-col shrink-0 overflow-hidden animate-in slide-in-from-right-4 duration-300">
            {/* Sim panel header */}
            <div className="px-4 py-3 border-b border-surface dark:border-surface-highlight flex items-center justify-between bg-surface/30 dark:bg-surface-dark/30 shrink-0">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-blue-400">science</span>
                <span className="text-sm font-bold uppercase text-main dark:text-white tracking-wide">Simulation Lab</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-mono px-2 py-0.5 border ${simulationRunning ? 'text-emerald-400 border-emerald-500/50 bg-emerald-950/30' : 'text-muted dark:text-gray-500 border-surface dark:border-surface-highlight'}`}>
                  {simulationRunning ? '● RUNNING' : '○ IDLE'}
                </span>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="flex border-b border-surface dark:border-surface-highlight shrink-0">
              {(['control', 'attack', 'add'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSimTab(tab)}
                  className={`flex-1 py-2 text-xs font-bold uppercase tracking-wide transition-colors outline-none ${simTab === tab ? 'text-main dark:text-white border-b-2 border-black dark:border-white' : 'text-muted dark:text-gray-500 hover:text-main dark:hover:text-white'}`}
                >
                  {tab === 'control' ? 'Control' : tab === 'attack' ? 'Attack Inject' : 'Add Node'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono">

              {simTab === 'control' && (
                <>
                  {!backendConnected ? (
                    <div className="p-3 bg-orange-950/20 border border-orange-500/30 text-orange-400 text-xs">
                      <span className="font-bold block mb-1">Backend Offline</span>
                      <code className="text-muted dark:text-gray-400">cd backend && python main.py</code>
                    </div>
                  ) : (
                    <>
                      {/* Status indicators */}
                      <div className="space-y-2">
                        <div className="text-[10px] text-muted dark:text-gray-500 uppercase tracking-widest font-bold">System Status</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className={`p-2.5 border text-center ${simulationRunning ? 'bg-emerald-950/20 border-emerald-500/40' : 'bg-surface dark:bg-surface-dark border-surface dark:border-surface-highlight'}`}>
                            <div className={`text-lg font-black ${simulationRunning ? 'text-emerald-400' : 'text-muted dark:text-gray-500'}`}>{simulationRunning ? 'ON' : 'OFF'}</div>
                            <div className="text-[10px] text-muted dark:text-gray-500 uppercase">Simulation</div>
                          </div>
                          <div className={`p-2.5 border text-center ${mlTrained ? 'bg-blue-950/20 border-blue-500/40' : 'bg-surface dark:bg-surface-dark border-surface dark:border-surface-highlight'}`}>
                            <div className={`text-lg font-black ${mlTrained ? 'text-blue-400' : 'text-muted dark:text-gray-500'}`}>{mlTrained ? 'YES' : 'NO'}</div>
                            <div className="text-[10px] text-muted dark:text-gray-500 uppercase">ML Trained</div>
                          </div>
                        </div>
                      </div>

                      {activeAttack && (
                        <div className="p-3 bg-red-950/20 border border-red-500/30 animate-pulse">
                          <div className="text-[10px] text-red-400 font-bold uppercase mb-1">Active Attack Vector</div>
                          <div className="text-sm text-red-300 font-bold">{activeAttack}</div>
                          <div className="text-[10px] text-muted dark:text-gray-500 mt-1">IPS is analyzing traffic patterns...</div>
                        </div>
                      )}

                      {/* Control buttons */}
                      <div className="space-y-2">
                        <div className="text-[10px] text-muted dark:text-gray-500 uppercase tracking-widest font-bold">Simulation Control</div>
                        <button
                          disabled={simulationRunning}
                          onClick={() => handleSimAction(async () => { await onStartSimulation?.(); }, 'IoT simulation started — traffic flowing', 'Failed to start')}
                          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase bg-emerald-700/80 hover:bg-emerald-600 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors border border-emerald-600/50 outline-none"
                        >
                          <span className="material-symbols-outlined text-[16px]">play_arrow</span>
                          Start Simulation
                        </button>
                        <button
                          disabled={!simulationRunning}
                          onClick={() => handleSimAction(async () => { await onStopSimulation?.(); }, 'Simulation stopped', 'Failed to stop')}
                          className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold uppercase bg-surface dark:bg-surface-dark hover:bg-red-950/30 text-muted dark:text-gray-400 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed border border-surface dark:border-surface-highlight hover:border-red-500/40 transition-all outline-none"
                        >
                          <span className="material-symbols-outlined text-[16px]">stop</span>
                          Stop Simulation
                        </button>
                      </div>

                      {/* Scenario selector */}
                      <div className="space-y-2 pt-2 border-t border-surface dark:border-surface-highlight">
                        <div className="text-[10px] text-muted dark:text-gray-500 uppercase tracking-widest font-bold">Preset Security Scenarios</div>
                        <div className="flex gap-2">
                          <select
                            value={selectedScenario}
                            onChange={e => setSelectedScenario(e.target.value)}
                            className="flex-1 bg-background dark:bg-black border border-surface dark:border-surface-highlight text-main dark:text-white text-xs h-9 px-2 outline-none font-mono"
                          >
                            <option value="ddos_gateway">DDoS Attack on Hub</option>
                            <option value="hvac_spoofing">HVAC Sensor Spoofing</option>
                            <option value="brute_force">Gateway Brute Force</option>
                          </select>
                          <button
                            onClick={handleRunScenario}
                            disabled={runningScenario}
                            className="px-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs uppercase flex items-center justify-center gap-1 transition-colors outline-none"
                          >
                            {runningScenario ? (
                              <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                            ) : (
                              <span className="material-symbols-outlined text-sm">rocket_launch</span>
                            )}
                            Run
                          </button>
                        </div>
                        <div className="text-[9px] text-muted dark:text-gray-500 leading-normal">
                          Runs a pre-scripted multi-step attack simulation with automated baseline.
                        </div>
                      </div>

                      {/* Trace Replay */}
                      <div className="space-y-2 pt-2 border-t border-surface dark:border-surface-highlight">
                        <div className="text-[10px] text-muted dark:text-gray-500 uppercase tracking-widest font-bold">Network Trace Replay</div>
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="file"
                            accept=".json"
                            id="trace-upload-input"
                            className="hidden"
                            onChange={handleTraceUpload}
                          />
                          <label
                            htmlFor="trace-upload-input"
                            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase border border-dashed border-surface dark:border-surface-highlight hover:border-blue-500/50 text-muted dark:text-gray-400 hover:text-blue-400 cursor-pointer transition-all"
                          >
                            <span className="material-symbols-outlined text-[16px]">upload_file</span>
                            Upload Packet JSON
                          </label>
                        </div>
                        <div className="text-[9px] text-muted dark:text-gray-500 leading-normal">
                          Replay recorded packet traces (JSON array) line-by-line through the IPS.
                        </div>
                      </div>

                      {/* How it works */}
                      <div className="p-3 bg-surface/50 dark:bg-surface-dark/50 border border-surface dark:border-surface-highlight text-[10px] text-muted dark:text-gray-500 leading-relaxed space-y-1">
                        <div className="text-main dark:text-white font-bold text-xs mb-2">How Intelli IPS Works</div>
                        <div className="flex gap-2"><span className="text-emerald-400">▶</span><span>Normal traffic is <strong className="text-emerald-400">allowed</strong> through the network</span></div>
                        <div className="flex gap-2"><span className="text-red-400">▶</span><span>Anomalous traffic is <strong className="text-red-400">prevented</strong> and blocked</span></div>
                        <div className="flex gap-2"><span className="text-blue-400">▶</span><span>ML model learns baseline behavior over time</span></div>
                      </div>
                    </>
                  )}
                </>
              )}

              {simTab === 'attack' && (
                <>
                  {!backendConnected ? (
                    <div className="p-3 bg-orange-950/20 border border-orange-500/30 text-orange-400 text-xs">
                      <span className="font-bold block mb-1">Backend Required</span>
                      <code className="text-muted dark:text-gray-400">cd backend && python main.py</code>
                    </div>
                  ) : !simulationRunning ? (
                    <div className="p-3 bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight text-muted dark:text-gray-500 text-xs text-center">
                      <span className="material-symbols-outlined text-2xl block mb-2 mx-auto">play_disabled</span>
                      Start simulation first to inject attacks
                    </div>
                  ) : (
                    <>
                      <div className="text-[10px] text-muted dark:text-gray-500 uppercase tracking-widest font-bold">Select Attack Vector</div>
                      <div className="space-y-1.5">
                        {ATTACKS.map(a => (
                          <button
                            key={a.id}
                            disabled={!!activeAttack}
                            onClick={() => setSelectedAttackId(prev => prev === a.id ? null : a.id)}
                            className={`w-full text-left p-2.5 border transition-colors outline-none ${selectedAttackId === a.id ? 'border-red-500/60 bg-red-950/20' : 'border-surface dark:border-surface-highlight bg-surface/30 dark:bg-surface-dark/30 hover:border-red-500/30'} disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-[15px] text-red-400 pixel-icon">{a.icon}</span>
                              <span className="text-xs font-bold text-main dark:text-white uppercase">{a.label}</span>
                            </div>
                            <span className="block text-[10px] text-muted dark:text-gray-500 mt-0.5 ml-5">{a.desc}</span>
                          </button>
                        ))}
                      </div>

                      {selectedAttackId && (
                        <div className="space-y-3 p-3 border border-red-500/20 bg-red-950/5 animate-in fade-in duration-200">
                          <div className="text-[10px] text-red-400 font-bold uppercase">Configure: {ATTACKS.find(a => a.id === selectedAttackId)?.label}</div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-muted dark:text-gray-500 uppercase">Attacker (Source)</label>
                            <select
                              value={attackerId}
                              onChange={e => setAttackerId(e.target.value)}
                              className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight text-main dark:text-white text-xs h-7 px-2 outline-none"
                            >
                              <option value="">External Attacker (Internet)</option>
                              {devices.filter(d => d.type !== 'router' && d.status !== 'blocked').map(d => (
                                <option key={d.id} value={d.id}>{d.name} ({d.ip || 'no IP'})</option>
                              ))}
                            </select>
                          </div>
 
                          <div className="space-y-1">
                            <label className="text-[10px] text-muted dark:text-gray-500 uppercase">Target (Victim)</label>
                            <select
                              value={targetId}
                              onChange={e => setTargetId(e.target.value)}
                              className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight text-main dark:text-white text-xs h-7 px-2 outline-none"
                            >
                              <option value="">Random Active Device</option>
                              {devices.filter(d => d.type !== 'router' && d.status !== 'blocked').map(d => (
                                <option key={d.id} value={d.id}>{d.name} ({d.ip || 'no IP'})</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-muted dark:text-gray-500 uppercase flex justify-between">
                              <span>{selectedAttackId === 'brute_force' ? 'Attempts/tick' : 'Packets/tick'}</span>
                              <span className="text-red-400 font-bold">{packetRate}</span>
                            </label>
                            <input
                              type="range"
                              min={1}
                              max={selectedAttackId === 'brute_force' ? 50 : selectedAttackId === 'data_spoofing' ? 20 : 400}
                              value={packetRate}
                              onChange={e => setPacketRate(parseInt(e.target.value))}
                              className="w-full cursor-pointer accent-red-500"
                            />
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => setSelectedAttackId(null)}
                              className="flex-1 py-2 text-xs border border-surface dark:border-surface-highlight text-muted dark:text-gray-400 hover:text-main dark:hover:text-white uppercase outline-none transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleLaunchAttack}
                              className="flex-1 py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold uppercase outline-none transition-colors flex items-center justify-center gap-1"
                            >
                              <span className="material-symbols-outlined text-[14px]">bolt</span>
                              Inject
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {simTab === 'add' && (
                <form onSubmit={handleAddSubmit} className="space-y-4 animate-in fade-in duration-200">
                  <div className="text-[10px] text-muted dark:text-gray-500 uppercase tracking-widest font-bold">Commission Node</div>
                  <p className="text-muted dark:text-gray-500 text-[10px] uppercase tracking-wide leading-relaxed">
                    Deploy a new simulated IoT node into the active mesh topology.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted dark:text-gray-400 uppercase tracking-wider">Device Label</label>
                    <input
                      type="text"
                      value={addDeviceName}
                      onChange={e => setAddDeviceName(e.target.value)}
                      placeholder="e.g. SMART_LIGHT_01"
                      className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight focus:border-black dark:focus:border-white text-main dark:text-white text-xs h-8 px-2.5 outline-none transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted dark:text-gray-400 uppercase tracking-wider">Device Class</label>
                    <select
                      value={addDeviceType}
                      onChange={e => setAddDeviceType(e.target.value)}
                      className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight focus:border-black dark:focus:border-white text-main dark:text-white text-xs h-8 px-2 outline-none transition-all"
                    >
                      <option value="sensors">Sensor Array</option>
                      <option value="videocam">Surveillance Node</option>
                      <option value="lock">Security Lock</option>
                      <option value="thermostat">HVAC Control</option>
                      <option value="speaker">Smart Speaker</option>
                      <option value="power">Smart Plug</option>
                      <option value="tv">Smart TV</option>
                      <option value="kitchen">Smart Refrigerator</option>
                      <option value="precision_manufacturing">Industrial PLC</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted dark:text-gray-400 uppercase tracking-wider">IP Address (Static)</label>
                    <input
                      type="text"
                      value={addDeviceIp}
                      onChange={e => setAddDeviceIp(e.target.value)}
                      className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight focus:border-black dark:focus:border-white text-main dark:text-white text-xs h-8 px-2.5 outline-none transition-all font-mono"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="sim-form-allowed"
                      checked={addDeviceAllowed}
                      onChange={e => setAddDeviceAllowed(e.target.checked)}
                      className="size-4 bg-background dark:bg-black border border-surface dark:border-surface-highlight cursor-pointer accent-black dark:accent-white"
                    />
                    <label htmlFor="sim-form-allowed" className="text-[10px] text-muted dark:text-gray-400 font-bold uppercase cursor-pointer select-none">
                      Whitelist default traffic
                    </label>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-black dark:bg-white text-white dark:text-black font-black uppercase text-xs h-9 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all flex items-center justify-center gap-1.5 outline-none tracking-wider mt-2"
                  >
                    <span className="material-symbols-outlined text-[15px]">add_circle</span>
                    Commission Device
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Non-admin notice if sim panel toggled */}
        {!isAdmin && (
          <div className="w-64 bg-background dark:bg-[#060606] border-l border-surface dark:border-surface-highlight flex flex-col items-center justify-center p-6 shrink-0">
            <span className="material-symbols-outlined text-4xl text-gray-600 mb-3">lock</span>
            <p className="text-xs text-center text-muted dark:text-gray-500 font-mono leading-relaxed">
              Simulation controls are restricted to <strong className="text-gray-400">admin</strong> accounts.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkMap;
