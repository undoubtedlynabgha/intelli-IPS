
import React, { useState } from 'react';
import { Device } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import SimulationLab from './SimulationLab';
import { AttackType } from '../services/ipsApi';

interface SettingsProps {
  onNotify: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onAddDevice: (device: Device) => void;
  devices?: Device[];
  ipsApi?: any;
  backendConnected?: boolean;
  simulationRunning?: boolean;
  activeAttack?: string | null;
  mlTrained?: boolean;
  onStartSimulation?: () => Promise<unknown>;
  onStopSimulation?: () => Promise<unknown>;
  onTriggerAttack?: (type: AttackType) => Promise<unknown>;
}

const Settings: React.FC<SettingsProps> = ({
  onNotify,
  onAddDevice,
  devices = [],
  ipsApi,
  backendConnected = false,
  simulationRunning = false,
  activeAttack = null,
  mlTrained = false,
  onStartSimulation,
  onStopSimulation,
  onTriggerAttack,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [formData, setFormData] = useState({
    name: '',
    type: 'sensors',
    ip: `192.168.1.${Math.floor(Math.random() * 150) + 100}`,
    allowed: true
  });

  const getProtocolForType = (type: string): string => {
    switch (type) {
      case 'sensors':
      case 'thermostat':
      case 'precision_manufacturing':
        return 'MQTT';
      case 'lock':
      case 'lightbulb':
        return 'CoAP';
      default:
        return 'HTTP';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) {
        onNotify('Device Label is required', 'error');
        return;
    }

    // IP address validation
    const ipPattern = /^192\.168\.1\.\d+$/;
    if (!ipPattern.test(formData.ip)) {
      onNotify('Please enter a valid IP address (e.g. 192.168.1.50)', 'error');
      return;
    }

    // Generate a unique MAC address
    const hex = '0123456789ABCDEF';
    const randByte = () => hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
    const generatedMac = `AA:BB:CC:${randByte()}:${randByte()}:${randByte()}`;

    const newDevice: Device = {
        id: `IOT_${Math.floor(Math.random() * 9000) + 1000}`,
        name: formData.name,
        type: formData.type as any,
        ip: formData.ip,
        mac: generatedMac,
        status: 'online',
        protocol: getProtocolForType(formData.type),
        allowed: formData.allowed
    };
    onAddDevice(newDevice);
    setFormData({ 
      name: '', 
      type: 'sensors', 
      ip: `192.168.1.${Math.floor(Math.random() * 150) + 100}`,
      allowed: true
    });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background dark:bg-black p-6 md:p-8 font-mono">
      <div className="max-w-4xl mx-auto space-y-12">
        
        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-main dark:text-white font-black text-xl uppercase tracking-tighter">Appearance</h2>
            <div className="h-px flex-1 bg-surface dark:bg-surface-highlight"></div>
          </div>
          <p className="text-muted dark:text-gray-500 text-xs uppercase tracking-widest">Customize the visual theme of the application</p>
          
          <div className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm text-main dark:text-white font-bold uppercase">Theme</span>
                <p className="text-xs text-muted dark:text-gray-500 mt-1">Switch between light and dark mode</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted dark:text-gray-500 uppercase font-mono">{theme === 'light' ? 'Light' : 'Dark'}</span>
                <button
                  onClick={() => {
                    toggleTheme();
                    onNotify(`Switched to ${theme === 'light' ? 'dark' : 'light'} theme`, 'success');
                  }}
                  className={`w-14 h-7 relative transition-colors duration-300 rounded-full ${
                    theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'
                  }`}
                >
                  <div className={`absolute top-1 size-5 bg-white rounded-full transition-all duration-300 shadow-md ${
                    theme === 'dark' ? 'left-7' : 'left-1'
                  }`}></div>
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-main dark:text-white font-black text-xl uppercase tracking-tighter">Add New Device to Network</h2>
            <div className="h-px flex-1 bg-surface dark:bg-surface-highlight"></div>
          </div>
          <p className="text-muted dark:text-gray-500 text-xs uppercase tracking-widest">Authorize new device connection into the secure network</p>
          
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Device Label / Name</label>
              <input 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. PRESSURE_VALVE_01"
                className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight focus:border-black dark:focus:border-white focus:ring-0 text-main dark:text-white text-sm h-10 px-3 transition-all outline-none" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Device Class</label>
              <select 
                value={formData.type}
                onChange={e => setFormData({...formData, type: e.target.value})}
                className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight focus:border-black dark:focus:border-white focus:ring-0 text-main dark:text-white text-sm h-10 px-3 transition-all outline-none"
              >
                <option value="sensors">Sensor Array</option>
                <option value="videocam">Surveillance Node</option>
                <option value="lock">Security Lock</option>
                <option value="router">Network Gateway</option>
                <option value="thermostat">HVAC Control</option>
                <option value="precision_manufacturing">Industrial PLC</option>
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase">IP Address (Static Preferred - Auto Suggested)</label>
              <input 
                value={formData.ip}
                onChange={e => setFormData({...formData, ip: e.target.value})}
                className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight focus:border-black dark:focus:border-white focus:ring-0 text-main dark:text-white text-sm h-10 px-3 transition-all outline-none" 
              />
            </div>
            <div className="flex items-center gap-2 md:col-span-2 py-2">
              <input 
                type="checkbox"
                id="form-allowed"
                checked={formData.allowed}
                onChange={e => setFormData({...formData, allowed: e.target.checked})}
                className="size-4 bg-background dark:bg-black border border-surface dark:border-surface-highlight text-main focus:ring-1 focus:ring-black dark:focus:ring-white cursor-pointer accent-black dark:accent-white"
              />
              <label htmlFor="form-allowed" className="text-xs text-muted dark:text-gray-400 font-bold uppercase cursor-pointer select-none">
                Whitelist Device (Authorize Connection)
              </label>
            </div>
            <div className="md:col-span-2 pt-4">
              <button 
                type="submit"
                className="w-full bg-black dark:bg-white text-white dark:text-black font-black uppercase text-sm h-12 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all flex items-center justify-center gap-2 outline-none"
              >
                <span className="material-symbols-outlined">add_circle</span>
                Add Device to Network
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-main dark:text-white font-black text-xl uppercase tracking-tighter">Connected Device Management</h2>
            <div className="h-px flex-1 bg-surface dark:bg-surface-highlight"></div>
          </div>
          <p className="text-muted dark:text-gray-500 text-xs uppercase tracking-widest">Active nodes in the secure network. Block or unblock connection status below</p>
          
          <div className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-highlight dark:bg-surface-highlight text-main dark:text-white uppercase font-bold">
                  <tr>
                    <th className="px-4 py-3">Device Name / ID</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">IP Address</th>
                    <th className="px-4 py-3 text-center">Allowed</th>
                    <th className="px-4 py-3">Security Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-highlight dark:divide-surface-highlight text-main dark:text-gray-300">
                  {devices.map(device => {
                    const handleIsolate = async () => {
                      if (!backendConnected || !ipsApi) {
                        onNotify(`Blocking node ${device.name} (demo)...`, 'warning');
                        return;
                      }
                      try {
                        onNotify(`Blocking connection for ${device.name}...`, 'warning');
                        await ipsApi.blockDevice(device.id);
                        onNotify(`Blocked device ${device.name}.`, 'success');
                      } catch (err) {
                        onNotify(err instanceof Error ? err.message : 'Block failed', 'error');
                      }
                    };

                    const handleUnblock = async () => {
                      if (!backendConnected || !ipsApi) {
                        onNotify(`Unblocking node ${device.name} (demo)...`, 'info');
                        return;
                      }
                      try {
                        onNotify(`Unblocking connection for ${device.name}...`, 'info');
                        await ipsApi.unblockDevice(device.id);
                        onNotify(`Unblocked device ${device.name}.`, 'success');
                      } catch (err) {
                        onNotify(err instanceof Error ? err.message : 'Unblock failed', 'error');
                      }
                    };

                    return (
                      <tr key={device.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-bold">
                          <div>{device.name}</div>
                          <div className="text-[10px] text-muted dark:text-gray-500 font-normal">ID: {device.id}</div>
                        </td>
                        <td className="px-4 py-3 uppercase text-muted dark:text-gray-400">{device.type}</td>
                        <td className="px-4 py-3">{device.ip}</td>
                        <td className="px-4 py-3 text-center">
                          <input 
                            type="checkbox"
                            checked={device.allowed !== false}
                            onChange={async (e) => {
                              const checked = e.target.checked;
                              if (!backendConnected || !ipsApi) {
                                onNotify(`${checked ? 'Whitelisted' : 'Blacklisted'} ${device.name} (demo).`, 'info');
                                return;
                              }
                              try {
                                onNotify(`${checked ? 'Authorizing' : 'Un-authorizing'} device ${device.name}...`, 'info');
                                await ipsApi.toggleDeviceAllow(device.id, checked);
                                onNotify(`Device ${device.name} allowed status updated.`, 'success');
                              } catch (err) {
                                onNotify(err instanceof Error ? err.message : 'Whitelist toggle failed', 'error');
                              }
                            }}
                            className="size-4 bg-background dark:bg-black border border-surface dark:border-surface-highlight text-main focus:ring-1 focus:ring-black dark:focus:ring-white cursor-pointer accent-black dark:accent-white"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-bold uppercase ${
                            device.status === 'blocked' ? 'bg-red-950 text-red-400 border-red-500' :
                            device.status === 'threat' ? 'bg-orange-950 text-orange-400 border-orange-500 animate-pulse' :
                            'bg-emerald-950 text-emerald-400 border-emerald-500'
                          }`}>
                            <span className={`size-1.5 rounded-full ${
                              device.status === 'blocked' ? 'bg-red-500' :
                              device.status === 'threat' ? 'bg-orange-500' :
                              'bg-emerald-500'
                            }`}></span>
                            {device.status === 'blocked' ? 'Blocked' : device.status === 'threat' ? 'Threat Detected' : 'Online'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {device.status === 'blocked' ? (
                            <button
                              onClick={handleUnblock}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 transition-colors uppercase outline-none"
                            >
                              Unblock
                            </button>
                          ) : (
                            <button
                              onClick={handleIsolate}
                              className="bg-red-600 hover:bg-red-500 text-white text-[10px] font-bold px-3 py-1.5 transition-colors uppercase outline-none"
                            >
                              Block
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-6">
          <div className="flex items-center gap-4">
            <h2 className="text-main dark:text-white font-black text-xl uppercase tracking-tighter">Network Simulation Lab</h2>
            <div className="h-px flex-1 bg-surface dark:bg-surface-highlight"></div>
          </div>
          <p className="text-muted dark:text-gray-500 text-xs uppercase tracking-widest">
            Intelli IPS Simulation Environment — IoT Traffic, Attack Injection & Hybrid Threat Prevention
          </p>
          <div className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-6">
            <SimulationLab
              connected={backendConnected}
              running={simulationRunning}
              activeAttack={activeAttack}
              mlTrained={mlTrained}
              onStart={async () => { await onStartSimulation?.(); }}
              onStop={async () => { await onStopSimulation?.(); }}
              onAttack={async (t, targetId, attackerId, rate) => { await onTriggerAttack?.(t, targetId, attackerId, rate); }}
              onNotify={onNotify}
              devices={devices}
            />
          </div>
        </section>
      </div>
    </div>
  );
};

export default Settings;
