
import React from 'react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  alertsCount?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange, alertsCount }) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'threat-feed', label: 'Prevention Feed', icon: 'shield_locked', glow: true },
    { id: 'alerts', label: 'Actions Log', icon: 'notifications', badge: alertsCount },
    { id: 'network', label: 'Network Map', icon: 'public' },
    { id: 'logs', label: 'Logs', icon: 'dvr' },
    { id: 'reports', label: 'Reports', icon: 'analytics' },
  ];

  return (
    <aside className="w-64 bg-background dark:bg-background-dark border-r border-surface dark:border-surface-highlight flex-col hidden md:flex z-20">
      <div className="h-16 flex items-center px-6 border-b border-surface dark:border-surface-highlight gap-3">
        <div className="size-8 bg-black dark:bg-white flex items-center justify-center text-white dark:text-black shadow-lg">
          <span className="material-symbols-outlined text-[20px] pixel-icon" style={{ filter: 'contrast(200%)' }}>security</span>
        </div>
        <h1 className="font-bold text-lg tracking-tight uppercase text-main dark:text-white">Intelli IPS</h1>
      </div>

      
      <div className="flex-1 overflow-y-auto py-6 px-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={`w-full nav-item flex items-center gap-3 px-3 py-2.5 transition-colors group relative ${
              currentTab === item.id 
                ? 'bg-surface-highlight dark:bg-surface-highlight text-main dark:text-white border border-black/10 dark:border-white/10' 
                : 'text-muted dark:text-gray-400 hover:text-main dark:hover:text-white hover:bg-surface-highlight dark:hover:bg-surface-highlight'
            }`}
          >
            <span 
              className={`material-symbols-outlined pixel-icon ${currentTab === item.id ? 'fill-1' : 'group-hover:text-white'} ${item.glow && currentTab !== item.id ? 'text-red-400 animate-pulse' : ''}`}
              style={{ fontVariationSettings: currentTab === item.id ? "'FILL' 1" : "" }}
            >
              {item.icon}
            </span>
            <span className="font-medium text-sm">{item.label}</span>
            {item.badge && (
              <span className="ml-auto bg-red-600 dark:bg-red-600 text-white dark:text-white text-xs font-mono px-2 py-0.5">
                {item.badge}
              </span>
            )}
            {item.glow && currentTab !== item.id && (
              <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500"></span>
            )}
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-surface-highlight">
        <button 
          onClick={() => onTabChange('settings')}
          className={`w-full nav-item flex items-center gap-3 px-3 py-2.5 transition-colors group ${
            currentTab === 'settings' ? 'bg-surface-highlight dark:bg-surface-highlight text-main dark:text-white' : 'text-muted dark:text-gray-400 hover:text-main dark:hover:text-white hover:bg-surface-highlight dark:hover:bg-surface-highlight'
          }`}
        >
          <span className="material-symbols-outlined group-hover:text-white transition-colors pixel-icon">settings</span>
          <span className="font-medium text-sm">Settings</span>
        </button>
        <div className="mt-3 flex items-center gap-3 px-3 py-3 bg-surface dark:bg-surface-dark border border-surface dark:border-surface-highlight">
          <div 
            className="size-8 bg-cover bg-center grayscale contrast-125 bg-gray-600"
            style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuCxQRE6doRiSUMMjwH3HOjVuHhTDrbZNzRaZLjy2IZfTDOLYGO6EDdtSKXlvILdeu0if4uCwwzCXJKlkwjONbFtPaCM7Wo_8l9Dko5CPTzSIkRxkq86Uz94ooqn5x8K54NMki9jWHSnObEwO9qLHhlVLtlkGIem8JWtiSDc_R0-07fk2VVyiR5V6YfXFit_buN9-mougkpJQzkh9ZuadtYGcT-RYLfKLVwRIuZ_MLh2SNX0hEuA8xE7gZdXFkYOaL25mV6odvYh-0ia')` }}
          />
          <div className="flex flex-col overflow-hidden text-left">
            <p className="text-sm font-medium text-main dark:text-white truncate">A AlNabgha</p>
            <p className="text-xs text-muted dark:text-gray-500 truncate font-mono">Sec. Analyst</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
