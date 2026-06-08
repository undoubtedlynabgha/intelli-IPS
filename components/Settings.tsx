
import React, { useState } from 'react';
import { Device } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface SettingsProps {
  onNotify: (msg: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
  onAddDevice: (device: Device) => void;
  onRemoveDevice?: (id: string) => void;
  devices?: Device[];
  ipsApi?: any;
  backendConnected?: boolean;
}

const Settings: React.FC<SettingsProps> = ({
  onNotify,
  onAddDevice,
  onRemoveDevice,
  devices = [],
  ipsApi,
  backendConnected = false,
}) => {
  const { theme, toggleTheme } = useTheme();
  const [deviceName, setDeviceName] = useState('');
  const [deviceType, setDeviceType] = useState('sensors');
  const [deviceIp, setDeviceIp] = useState(`192.168.1.${Math.floor(Math.random() * 150) + 100}`);
  const [deviceAllowed, setDeviceAllowed] = useState(true);

  const getProtocolForType = (type: string): string => {
    switch (type) {
      case 'sensors':
      case 'thermostat':
      case 'precision_manufacturing':
      case 'power':
        return 'MQTT';
      case 'lock':
      case 'lightbulb':
      case 'speaker':
        return 'CoAP';
      default:
        return 'HTTP';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName) {
      onNotify('Device label is required', 'error');
      return;
    }
    const ipPattern = /^192\.168\.\d+\.\d+$|^10\.\d+\.\d+\.\d+$/;
    if (!ipPattern.test(deviceIp)) {
      onNotify('Please enter a valid IP address (e.g. 192.168.1.50)', 'error');
      return;
    }
    const hex = '0123456789ABCDEF';
    const randByte = () => hex[Math.floor(Math.random() * 16)] + hex[Math.floor(Math.random() * 16)];
    const generatedMac = `AA:BB:CC:${randByte()}:${randByte()}:${randByte()}`;
    const newDevice: Device = {
      id: `IOT_${Math.floor(Math.random() * 9000) + 1000}`,
      name: deviceName,
      type: deviceType as any,
      ip: deviceIp,
      mac: generatedMac,
      status: 'online',
      allowed: deviceAllowed
    };
    onAddDevice(newDevice);
    setDeviceName('');
    setDeviceType('sensors');
    setDeviceIp(`192.168.1.${Math.floor(Math.random() * 150) + 100}`);
    setDeviceAllowed(true);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-background dark:bg-black p-6 md:p-8">
      <div className="max-w-3xl mx-auto space-y-10">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tight text-main dark:text-white">System Configuration</h1>
          <p className="text-muted dark:text-gray-500 text-xs font-mono mt-1 uppercase tracking-widest">Manage devices, policies, and display preferences</p>
        </div>

        {/* Appearance */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-muted dark:text-gray-400 text-[18px]">palette</span>
            <h2 className="text-main dark:text-white font-bold text-sm uppercase tracking-widest">Appearance</h2>
            <div className="h-px flex-1 bg-surface dark:bg-surface-highlight"></div>
          </div>
          <div className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-main dark:text-white uppercase">Display Theme</p>
              <p className="text-xs text-muted dark:text-gray-500 mt-1 font-mono">Currently: {theme === 'light' ? 'Light Mode' : 'Dark Mode'}</p>
            </div>
            <button
              onClick={() => {
                toggleTheme();
                onNotify(`Switched to ${theme === 'light' ? 'dark' : 'light'} theme`, 'success');
              }}
              className={`w-12 h-6 relative transition-colors duration-300 rounded-full ${theme === 'dark' ? 'bg-blue-600' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-0.5 size-5 bg-white rounded-full transition-all duration-300 shadow-md ${theme === 'dark' ? 'left-6' : 'left-0.5'}`}></div>
            </button>
          </div>
        </section>

        {/* Add Device */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-muted dark:text-gray-400 text-[18px]">add_circle</span>
            <h2 className="text-main dark:text-white font-bold text-sm uppercase tracking-widest">Commission New Device</h2>
            <div className="h-px flex-1 bg-surface dark:bg-surface-highlight"></div>
          </div>
          <p className="text-muted dark:text-gray-500 text-xs font-mono uppercase tracking-widest">Authorize a new IoT node into the secure network mesh</p>

          <form onSubmit={handleSubmit} className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted dark:text-gray-400 uppercase tracking-wider">Device Label</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={e => setDeviceName(e.target.value)}
                  placeholder="e.g. PRESSURE_VALVE_01"
                  className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight focus:border-black dark:focus:border-white text-main dark:text-white text-sm h-9 px-3 outline-none transition-all font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-muted dark:text-gray-400 uppercase tracking-wider">Device Class</label>
                <select
                  value={deviceType}
                  onChange={e => setDeviceType(e.target.value)}
                  className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight focus:border-black dark:focus:border-white text-main dark:text-white text-sm h-9 px-3 outline-none transition-all"
                >
                  <option value="sensors">Sensor Array</option>
                  <option value="videocam">Surveillance Node</option>
                  <option value="lock">Security Lock</option>
                  <option value="router">Network Gateway</option>
                  <option value="thermostat">HVAC Control</option>
                  <option value="speaker">Smart Speaker</option>
                  <option value="power">Smart Plug</option>
                  <option value="tv">Smart TV</option>
                  <option value="kitchen">Smart Refrigerator</option>
                  <option value="precision_manufacturing">Industrial PLC</option>
                </select>
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-bold text-muted dark:text-gray-400 uppercase tracking-wider">IP Address (Static)</label>
                <input
                  type="text"
                  value={deviceIp}
                  onChange={e => setDeviceIp(e.target.value)}
                  className="w-full bg-background dark:bg-black border border-surface dark:border-surface-highlight focus:border-black dark:focus:border-white text-main dark:text-white text-sm h-9 px-3 outline-none transition-all font-mono"
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="form-allowed"
                  checked={deviceAllowed}
                  onChange={e => setDeviceAllowed(e.target.checked)}
                  className="size-4 bg-background dark:bg-black border border-surface dark:border-surface-highlight cursor-pointer accent-black dark:accent-white"
                />
                <label htmlFor="form-allowed" className="text-xs text-muted dark:text-gray-400 font-bold uppercase cursor-pointer select-none">
                  Whitelist — Allow traffic by default
                </label>
              </div>
            </div>
            <button
              type="submit"
              className="w-full bg-black dark:bg-white text-white dark:text-black font-black uppercase text-xs h-10 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all flex items-center justify-center gap-2 outline-none tracking-wider"
            >
              <span className="material-symbols-outlined text-[17px]">add_circle</span>
              Commission Device
            </button>
          </form>
        </section>

        {/* Device Management */}
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-muted dark:text-gray-400 text-[18px]">devices</span>
            <h2 className="text-main dark:text-white font-bold text-sm uppercase tracking-widest">Device Access Control</h2>
            <div className="h-px flex-1 bg-surface dark:bg-surface-highlight"></div>
          </div>
          <p className="text-muted dark:text-gray-500 text-xs font-mono uppercase tracking-widest">Manage traffic permissions per node — allow or prevent connections</p>

          <div className="bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-highlight dark:bg-surface-highlight text-muted dark:text-gray-400 uppercase font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Node</th>
                    <th className="px-4 py-3">Type / IP</th>
                    <th className="px-4 py-3 text-center">Allowed</th>
                    <th className="px-4 py-3">IPS Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-highlight dark:divide-surface-highlight text-main dark:text-gray-300">
                  {devices.map(device => {
                    const handleBlock = async () => {
                      if (!backendConnected || !ipsApi) {
                        onNotify(`Preventing traffic from ${device.name} (demo)...`, 'warning');
                        return;
                      }
                      try {
                        onNotify(`Blocking connection for ${device.name}...`, 'warning');
                        await ipsApi.blockDevice(device.id);
                        onNotify(`Traffic from ${device.name} prevented.`, 'success');
                      } catch (err) {
                        onNotify(err instanceof Error ? err.message : 'Block failed', 'error');
                      }
                    };

                    const handleUnblock = async () => {
                      if (!backendConnected || !ipsApi) {
                        onNotify(`Allowing traffic from ${device.name} (demo)...`, 'info');
                        return;
                      }
                      try {
                        onNotify(`Restoring connection for ${device.name}...`, 'info');
                        await ipsApi.unblockDevice(device.id);
                        onNotify(`Traffic from ${device.name} now allowed.`, 'success');
                      } catch (err) {
                        onNotify(err instanceof Error ? err.message : 'Unblock failed', 'error');
                      }
                    };

                    return (
                      <tr key={device.id} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-main dark:text-white">{device.name}</div>
                          <div className="text-[10px] text-muted dark:text-gray-500 font-mono">{device.id}</div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <div className="uppercase text-muted dark:text-gray-400">{device.type}</div>
                          <div className="text-[10px] text-muted dark:text-gray-500">{device.ip || 'N/A'}</div>
                        </td>
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
                                await ipsApi.toggleDeviceAllow(device.id, checked);
                                onNotify(`${device.name} ${checked ? 'allowed' : 'denied'}.`, 'success');
                              } catch (err) {
                                onNotify(err instanceof Error ? err.message : 'Toggle failed', 'error');
                              }
                            }}
                            className="size-4 cursor-pointer accent-black dark:accent-white"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-bold uppercase ${
                            device.status === 'blocked' ? 'bg-red-950/50 text-red-400 border-red-500/50' :
                            device.status === 'threat' ? 'bg-orange-950/50 text-orange-400 border-orange-500/50 animate-pulse' :
                            'bg-emerald-950/30 text-emerald-400 border-emerald-500/30'
                          }`}>
                            <span className={`size-1.5 rounded-full ${
                              device.status === 'blocked' ? 'bg-red-500' :
                              device.status === 'threat' ? 'bg-orange-500' :
                              'bg-emerald-500'
                            }`}></span>
                            {device.status === 'blocked' ? 'Prevented' : device.status === 'threat' ? 'Threat' : 'Allowed'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {device.status === 'blocked' ? (
                              <button
                                onClick={handleUnblock}
                                className="bg-emerald-700/80 hover:bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 transition-colors uppercase outline-none border border-emerald-600/30"
                              >
                                Allow
                              </button>
                            ) : (
                              <button
                                onClick={handleBlock}
                                className="bg-red-700/80 hover:bg-red-600 text-white text-[10px] font-bold px-3 py-1.5 transition-colors uppercase outline-none border border-red-600/30"
                              >
                                Prevent
                              </button>
                            )}
                            {device.type !== 'router' && (
                              <button
                                onClick={async () => {
                                  if (window.confirm(`Decommission node ${device.name}?`)) {
                                    try {
                                      if (onRemoveDevice) {
                                        await onRemoveDevice(device.id);
                                      }
                                    } catch (err) {
                                      onNotify(err instanceof Error ? err.message : 'Remove failed', 'error');
                                    }
                                  }
                                }}
                                title="Decommission device"
                                className="bg-surface hover:bg-red-950/20 hover:text-red-400 border border-surface dark:border-surface-highlight hover:border-red-500/30 text-muted dark:text-gray-400 p-1.5 transition-colors outline-none cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[15px] pixel-icon">delete</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Info callout pointing to Network tab */}
        <div className="flex items-start gap-3 p-4 bg-blue-950/20 border border-blue-500/20">
          <span className="material-symbols-outlined text-blue-400 text-[20px] shrink-0">info</span>
          <div>
            <p className="text-xs font-bold text-blue-400 uppercase mb-1">Simulation Lab</p>
            <p className="text-xs text-muted dark:text-gray-500 font-mono">
              The attack simulation and network lab controls have been moved to the{' '}
              <strong className="text-main dark:text-white">Network Monitor</strong> tab.
              Open the "Simulation" panel from the Network view's toolbar.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Settings;
