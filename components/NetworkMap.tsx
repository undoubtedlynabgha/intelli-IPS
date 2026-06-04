
import React, { useState, useEffect } from 'react';
import { Device } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface NetworkMapProps {
  isScanning?: boolean;
  onNotify: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  devices: Device[];
  externalSelectedId?: string | null;
  onClearExternalSelect?: () => void;
  ipsApi?: any;
  backendConnected?: boolean;
}

const NetworkMap: React.FC<NetworkMapProps> = ({ 
  isScanning, 
  onNotify, 
  devices, 
  externalSelectedId, 
  onClearExternalSelect,
  ipsApi,
  backendConnected 
}) => {
  const { theme } = useTheme();
  const [zoomLevel, setZoomLevel] = useState(100);
  const [showNodePanel, setShowNodePanel] = useState(true);
  const [selectedNode, setSelectedNode] = useState('CAM_EXT_04');

  useEffect(() => {
    if (externalSelectedId) {
      setSelectedNode(externalSelectedId);
      setShowNodePanel(true);
      onClearExternalSelect?.();
    }
  }, [externalSelectedId, onClearExternalSelect]);

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

  const selectNode = (id: string) => {
    setSelectedNode(id);
    setShowNodePanel(true);
  };

  // Absolute positions on a 1000x800 canvas
  const activeNodes = React.useMemo(() => {
    // Gateway is always at the center
    const nonGatewayDevices = devices.filter(d => d.name !== 'IoT_Gateway_Main');

    return devices.map(d => {
      if (d.name === 'IoT_Gateway_Main') {
        return { ...d, x: 500, y: 400 };
      }
      
      const index = nonGatewayDevices.findIndex(dd => dd.id === d.id);
      
      // Ring configuration: Ring 0 has capacity 6, Ring 1 has capacity 12, etc.
      let remaining = index;
      let ringNum = 0;
      let ringCapacity = 6;
      let radius = 180;
      while (remaining >= ringCapacity) {
        remaining -= ringCapacity;
        ringNum++;
        ringCapacity = 6 + ringNum * 6; // Ring 0: 6, Ring 1: 12, Ring 2: 18, etc.
        radius = 180 + ringNum * 110;   // Ring 0: 180, Ring 1: 290, Ring 2: 400, etc.
      }
      const ringIndex = remaining;
      const angleOffset = ringNum * 15; // rotate each subsequent ring slightly to prevent alignment lines overlapping too much
      const angle = angleOffset + (ringIndex * (360 / ringCapacity));
      const rad = (angle * Math.PI) / 180;
      
      const x = 500 + radius * Math.cos(rad);
      const y = 400 + radius * Math.sin(rad);
      
      return { ...d, x, y };
    });
  }, [devices]);

  const meshLinks = React.useMemo(() => {
    const links: Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      status: string;
      isGateway: boolean;
    }> = [];
    const nonGateway = activeNodes.filter(n => n.name !== 'IoT_Gateway_Main');
    
    // Draw lines to gateway
    nonGateway.forEach(n => {
      links.push({
        id: `gw-${n.id}`,
        x1: 500,
        y1: 400,
        x2: n.x,
        y2: n.y,
        status: n.status,
        isGateway: true
      });
    });

    // Draw mesh lines: connect each node to its nearest neighbors (excluding gateway)
    nonGateway.forEach((n) => {
      const others = nonGateway.filter(o => o.id !== n.id);
      if (others.length === 0) return;
      
      const sortedByDist = others.map(o => {
        const dx = o.x - n.x;
        const dy = o.y - n.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return { node: o, dist };
      }).sort((a, b) => a.dist - b.dist);
      
      // Connect to the nearest neighbor
      const nearest = sortedByDist[0].node;
      let linkStatus = 'online';
      if (n.status === 'blocked' || nearest.status === 'blocked') {
        linkStatus = 'blocked';
      } else if (n.status === 'threat' || nearest.status === 'threat') {
        linkStatus = 'threat';
      }
      
      const linkId = [n.id, nearest.id].sort().join('-');
      if (!links.some(l => l.id === linkId)) {
        links.push({
          id: linkId,
          x1: n.x,
          y1: n.y,
          x2: nearest.x,
          y2: nearest.y,
          status: linkStatus,
          isGateway: false
        });
      }
      
      // Connect to second nearest if exists
      if (sortedByDist.length > 1) {
        const secondNearest = sortedByDist[1].node;
        let linkStatus2 = 'online';
        if (n.status === 'blocked' || secondNearest.status === 'blocked') {
          linkStatus2 = 'blocked';
        } else if (n.status === 'threat' || secondNearest.status === 'threat') {
          linkStatus2 = 'threat';
        }
        
        const linkId2 = [n.id, secondNearest.id].sort().join('-');
        if (!links.some(l => l.id === linkId2)) {
          links.push({
            id: linkId2,
            x1: n.x,
            y1: n.y,
            x2: secondNearest.x,
            y2: secondNearest.y,
            status: linkStatus2,
            isGateway: false
          });
        }
      }
    });
    
    return links;
  }, [activeNodes]);


  const selectedDeviceData = devices.find(d => d.name === selectedNode);

  return (
    <div className="flex-1 relative overflow-hidden flex flex-col bg-background dark:bg-[#050505]">
      <div className="h-12 border-b border-surface dark:border-surface-highlight bg-surface/50 dark:bg-surface-dark/50 flex items-center px-6 gap-6 backdrop-blur-sm z-20">
        <div className="flex items-center gap-6 text-xs font-mono text-muted dark:text-gray-400">
          <span className="flex items-center gap-2"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> Online ({devices.filter(d => d.status === 'online').length})</span>
          <span className="flex items-center gap-2 text-orange-400">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></span> 
            Threats ({devices.filter(d => d.status === 'threat').length})
          </span>
          <span className="flex items-center gap-2 text-red-500">
            <span className="w-2 h-2 bg-red-600 rounded-full"></span> 
            Blocked ({devices.filter(d => d.status === 'blocked').length})
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-muted dark:text-gray-500 uppercase font-bold mr-2 tracking-widest">ZOOM: {zoomLevel}%</span>
          <button onClick={() => handleZoom(20)} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 text-muted dark:text-gray-400 hover:text-main dark:hover:text-white outline-none">
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
          <button onClick={() => handleZoom(-20)} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 text-muted dark:text-gray-400 hover:text-main dark:hover:text-white outline-none">
            <span className="material-symbols-outlined text-[20px]">remove</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background dark:bg-[#050505] p-4 flex items-center justify-center relative">
        <div 
          style={{
            width: `${1000 * (zoomLevel / 100)}px`,
            height: `${800 * (zoomLevel / 100)}px`,
            transition: 'width 0.2s, height 0.2s',
          }}
          className="relative overflow-hidden border border-surface dark:border-surface-highlight bg-white dark:bg-[#070707] shadow-inner"
        >
          <div 
            style={{
              width: '1000px',
              height: '800px',
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: '0 0',
              transition: 'transform 0.2s',
            }}
            className="absolute inset-0"
          >
            {/* Dynamic Grid Background adapt to Light/Dark Mode */}
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none" 
              style={{ 
                backgroundImage: `linear-gradient(${theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)'} 1px, transparent 1px), linear-gradient(90deg, ${theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)'} 1px, transparent 1px)`, 
                backgroundSize: '40px 40px' 
              }}
            ></div>
            
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              {meshLinks.map(link => {
                let strokeColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
                if (link.status === 'blocked') {
                  strokeColor = 'rgba(239, 68, 68, 0.8)';
                } else if (link.status === 'threat') {
                  strokeColor = 'rgba(249, 115, 22, 0.8)';
                } else if (!link.isGateway) {
                  strokeColor = theme === 'dark' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(5, 150, 105, 0.25)'; // thin green/emerald for mesh pathways
                }
                
                let strokeDash = '0';
                if (link.status === 'threat') {
                  strokeDash = '4,4';
                } else if (!link.isGateway) {
                  strokeDash = '2,4'; // dotted for mesh links
                }
                
                const strokeWidth = link.status === 'blocked' 
                  ? (link.isGateway ? '2.5' : '1.5') 
                  : (link.isGateway ? '1.5' : '1.0');
                  
                return (
                  <line 
                    key={link.id}
                    x1={link.x1} y1={link.y1} 
                    x2={link.x2} y2={link.y2} 
                    stroke={strokeColor} 
                    strokeDasharray={strokeDash}
                    strokeWidth={strokeWidth} 
                  />
                );
              })}
            </svg>

            <div className="absolute inset-0 w-full h-full pointer-events-none">
              {activeNodes.map((node) => (
                <div 
                  key={node.id}
                  className="absolute pointer-events-auto flex flex-col items-center gap-2 group cursor-pointer"
                  style={{ top: `${node.y}px`, left: `${node.x}px`, transform: 'translate(-50%, -50%)' }}
                  onClick={() => selectNode(node.name)}
                >
                  {node.name === 'IoT_Gateway_Main' ? (
                    <div className={`w-16 h-16 bg-black dark:bg-white border-4 border-surface dark:border-surface-dark transition-all duration-300 flex items-center justify-center relative hover:scale-110 ${selectedNode === node.name ? 'shadow-[0_0_30px_rgba(0,0,0,0.4)] dark:shadow-[0_0_30px_rgba(255,255,255,0.4)] ring-2 ring-black dark:ring-white ring-offset-4 ring-offset-background dark:ring-offset-black' : 'shadow-[0_0_40px_rgba(0,0,0,0.15)] dark:shadow-[0_0_40px_rgba(255,255,255,0.15)]'}`}>
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
                      <div className={`w-12 h-12 bg-surface dark:bg-surface-dark border-2 border-orange-500 flex items-center justify-center relative transition-all duration-300 group-hover:scale-110 ${selectedNode === node.name ? 'shadow-[0_0_30px_rgba(249,115,22,0.8)] border-orange-400' : 'shadow-[0_0_20px_rgba(249,115,22,0.5)]'}`}>
                        <span className="material-symbols-outlined text-xl text-orange-500 pixel-icon">{node.type}</span>
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 border border-background dark:border-black flex items-center justify-center">
                          <span className="material-symbols-outlined text-[10px] text-white dark:text-black font-bold pixel-icon">priority_high</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={`w-10 h-10 bg-surface dark:bg-surface-dark border flex items-center justify-center transition-all duration-300 group-hover:bg-surface-highlight dark:group-hover:bg-surface-highlight group-hover:scale-110 ${selectedNode === node.name ? 'border-black dark:border-white shadow-[0_0_15px_rgba(0,0,0,0.3)] dark:shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'border-surface dark:border-surface-highlight'}`}>
                      <span className={`material-symbols-outlined text-lg pixel-icon transition-colors ${selectedNode === node.name ? 'text-main dark:text-white' : 'text-muted dark:text-gray-400 group-hover:text-main dark:group-hover:text-white'}`}>{node.type}</span>
                    </div>
                  )}
                  <span className={`text-[10px] font-mono font-bold whitespace-nowrap bg-background/80 dark:bg-black/80 px-2 py-0.5 border transition-all ${
                    node.status === 'threat' ? (selectedNode === node.name ? 'text-red-400 border-red-500 bg-red-950/20' : 'text-red-500 border-red-900/50') : 
                    node.name === 'IoT_Gateway_Main' ? (selectedNode === node.name ? 'text-main dark:text-white border-black dark:border-white bg-black/10 dark:bg-white/10' : 'text-main dark:text-white border-black/20 dark:border-white/20') : 
                    (selectedNode === node.name ? 'text-main dark:text-white border-black dark:border-white bg-black/5 dark:bg-white/5' : 'text-muted dark:text-gray-500 border-surface dark:border-surface-highlight group-hover:text-main dark:group-hover:text-white group-hover:border-black/20 dark:group-hover:border-white/20')
                  }`}>
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

        {showNodePanel && selectedDeviceData && (
          <div className="absolute top-6 right-6 w-80 bg-background/95 dark:bg-black/95 backdrop-blur-md border border-surface dark:border-surface-highlight shadow-2xl flex flex-col z-30 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className={`p-3 border-b flex justify-between items-center ${selectedDeviceData.status === 'threat' ? 'bg-red-900/20 border-red-500/30' : 'bg-surface dark:bg-surface-dark border-surface dark:border-surface-highlight'}`}>
              <div className="flex items-center gap-2">
                <span className={`material-symbols-outlined text-sm pixel-icon ${selectedDeviceData.status === 'threat' ? 'text-orange-500' : selectedDeviceData.status === 'blocked' ? 'text-red-500' : 'text-main dark:text-white'}`}>
                    {selectedDeviceData.status === 'threat' ? 'warning' : selectedDeviceData.status === 'blocked' ? 'block' : 'info'}
                </span>
                <span className={`text-xs font-bold uppercase tracking-wider font-mono ${selectedDeviceData.status === 'threat' ? 'text-orange-500' : selectedDeviceData.status === 'blocked' ? 'text-red-500' : 'text-main dark:text-white'}`}>
                    {selectedDeviceData.status === 'threat' ? 'Suspicious Node' : selectedDeviceData.status === 'blocked' ? 'Prevention: Blocked' : 'Node Information'}
                </span>
              </div>
              <button onClick={() => setShowNodePanel(false)} className="text-muted dark:text-gray-500 hover:text-main dark:hover:text-white p-1 outline-none">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="p-4 space-y-5">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 bg-surface dark:bg-surface-dark border flex items-center justify-center shrink-0 ${selectedDeviceData.status === 'threat' ? 'border-red-500' : 'border-surface dark:border-surface-highlight'}`}>
                  <span className="material-symbols-outlined text-main dark:text-white pixel-icon">{selectedDeviceData.type}</span>
                </div>
                <div>
                  <h3 className="text-main dark:text-white text-sm font-bold uppercase">{selectedDeviceData.name}</h3>
                  <p className="text-xs text-muted dark:text-gray-400 font-mono mt-0.5">Device: {selectedDeviceData.type}</p>
                  <p className="text-xs text-muted dark:text-gray-500 font-mono">IP: {selectedDeviceData.ip || '0.0.0.0'}</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-end">
                  <div className="text-[10px] font-bold text-muted dark:text-gray-400 uppercase tracking-wider">Intelli IPS Mitigation Status</div>
                  <div className={`text-[10px] font-mono ${selectedDeviceData.status === 'threat' ? 'text-orange-500' : selectedDeviceData.status === 'blocked' ? 'text-red-500' : 'text-emerald-500'}`}>
                    {selectedDeviceData.status === 'threat' ? 'Monitoring: High Risk' : selectedDeviceData.status === 'blocked' ? 'Rule: Forced Drop' : 'State: Protected'}
                  </div>
                </div>
                {selectedDeviceData.status === 'blocked' ? (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-xs text-main dark:text-gray-300 font-mono leading-relaxed">
                        <span className="text-red-400 font-bold block mb-1">&gt; INTELLI IPS BLOCK ACTIVE</span>
                        Node disconnected by auto-policy. Protocol violation in MQTT layer detected.
                    </div>
                ) : selectedDeviceData.status === 'threat' ? (
                    <div className="p-3 bg-orange-500/10 border border-orange-500/20 text-xs text-main dark:text-gray-300 font-mono leading-relaxed">
                        <span className="text-orange-400 font-bold block mb-1">&gt; ANOMALY DETECTED</span>
                        Unexpected outbound traffic spike. AI suggests imminent exfiltration.
                    </div>
                ) : (
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/10 text-xs text-muted dark:text-gray-400 font-mono leading-relaxed">
                        <span className="text-emerald-400 font-bold block mb-1">&gt; SYSTEM NOMINAL</span>
                        Node behaving within baseline parameters. Latency: 12ms.
                    </div>
                )}
              </div>

              <div className="pt-2 border-t border-surface dark:border-surface-highlight">
                {selectedDeviceData.status === 'blocked' ? (
                  <button 
                    onClick={() => handleUnblock(selectedDeviceData.id, selectedDeviceData.name)}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-2 transition-colors uppercase flex items-center justify-center gap-2 outline-none"
                  >
                    <span className="material-symbols-outlined text-[16px] pixel-icon">check_circle</span> Unblock Connection
                  </button>
                ) : (
                  <button 
                    onClick={() => handleIsolate(selectedDeviceData.id, selectedDeviceData.name)}
                    className="w-full bg-black dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-black text-xs font-bold py-2.5 px-2 border border-black dark:border-white transition-colors uppercase flex items-center justify-center gap-2 outline-none"
                  >
                    <span className="material-symbols-outlined text-[16px] pixel-icon">block</span> Block Connection
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NetworkMap;
