
import React from 'react';
import { AuthUser } from '../contexts/AuthContext';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  alertsCount?: number;
  currentUser: AuthUser | null;
  isAdmin: boolean;
  onLogout: () => void;
}

/** Intelli IPS brand cube SVG — matches the isometric cube logo */
const IntelliLogo: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 256 256"
    xmlns="http://www.w3.org/2000/svg"
    style={{ flexShrink: 0 }}
  >
    {/* Top face */}
    <polygon points="128,38 210,80 128,122 46,80" fill="#FFFFFF" stroke="#1a1a4e" strokeWidth="8" strokeLinejoin="round"/>
    {/* Left face */}
    <polygon points="46,80 128,122 128,216 46,174" fill="#F0F0F8" stroke="#1a1a4e" strokeWidth="8" strokeLinejoin="round"/>
    {/* Right face */}
    <polygon points="128,122 210,80 210,174 128,216" fill="#4A6FD4" stroke="#1a1a4e" strokeWidth="8" strokeLinejoin="round"/>
    {/* Eye on top */}
    <g transform="translate(128,80)">
      <ellipse cx="0" cy="0" rx="28" ry="15" fill="#1a1a4e"/>
      <ellipse cx="0" cy="0" rx="20" ry="9" fill="#FFFFFF"/>
      {/* 4-point star spark */}
      <polygon points="0,-7 2,-2 7,0 2,2 0,7 -2,2 -7,0 -2,-2" fill="#1a1a4e"/>
    </g>
  </svg>
);

const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  alertsCount,
  currentUser,
  isAdmin,
  onLogout,
}) => {
  const allNavItems = [
    { id: 'dashboard', label: 'Overview', icon: 'dashboard', adminOnly: false },
    { id: 'network', label: 'Network & Sim', icon: 'hub', highlight: 'blue', adminOnly: false },
    { id: 'threat-feed', label: 'Prevention Feed', icon: 'shield_locked', highlight: 'red', adminOnly: false },
    { id: 'alerts', label: 'Actions Log', icon: 'notifications', badge: alertsCount, adminOnly: false },
    { id: 'logs', label: 'Event Logs', icon: 'dvr', adminOnly: false },
    { id: 'reports', label: 'Analytics', icon: 'analytics', adminOnly: false },
  ];

  // Filter based on role
  const navItems = allNavItems.filter(item => !item.adminOnly || isAdmin);

  const displayName = currentUser?.username ?? 'Guest';
  const roleLabel = currentUser?.role === 'admin' ? 'Administrator' : 'Security Analyst';
  const roleIcon = currentUser?.role === 'admin' ? 'admin_panel_settings' : 'manage_accounts';
  const avatarInitials = displayName.slice(0, 2).toUpperCase();

  return (
    <aside className="w-60 bg-background dark:bg-background-dark border-r border-surface dark:border-surface-highlight flex-col hidden md:flex z-20 shrink-0">
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-surface dark:border-surface-highlight gap-3 shrink-0">
        <IntelliLogo size={30} />
        <div>
          <h1 className="font-black text-sm tracking-tight uppercase text-main dark:text-white leading-none">Intelli IPS</h1>
          <p className="text-[10px] text-muted dark:text-gray-500 font-mono leading-none mt-0.5">Intrusion Prevention</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        <p className="text-[10px] font-bold text-muted dark:text-gray-600 uppercase tracking-widest px-3 pb-2">Navigation</p>
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          const isRed = item.highlight === 'red';
          const isBlue = item.highlight === 'blue';
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left relative outline-none ${
                isActive
                  ? 'bg-surface-highlight dark:bg-surface-highlight text-main dark:text-white'
                  : 'text-muted dark:text-gray-400 hover:text-main dark:hover:text-white hover:bg-surface-highlight dark:hover:bg-surface-highlight'
              }`}
            >
              {/* Active indicator stripe */}
              {isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-main dark:bg-white"></span>}
              {isRed && !isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500"></span>}
              {isBlue && !isActive && <span className="absolute left-0 top-0 bottom-0 w-0.5 bg-blue-500/60"></span>}

              <span
                className={`material-symbols-outlined text-[20px] pixel-icon shrink-0 transition-colors ${
                  isActive ? 'text-main dark:text-white' :
                  isRed ? 'text-red-400 animate-pulse' :
                  isBlue ? 'text-blue-400' :
                  'text-muted dark:text-gray-500'
                }`}
                style={{ fontVariationSettings: isActive ? "'FILL' 1" : "" }}
              >
                {item.icon}
              </span>
              <span className="font-medium text-[13px]">{item.label}</span>
              {item.badge != null && item.badge > 0 && (
                <span className="ml-auto bg-red-600 text-white text-[10px] font-mono px-1.5 py-0.5 min-w-[20px] text-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-2 border-t border-surface dark:border-surface-highlight space-y-0.5">
        {/* Settings — admin only */}
        {isAdmin && (
          <button
            onClick={() => onTabChange('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors outline-none ${
              currentTab === 'settings'
                ? 'bg-surface-highlight dark:bg-surface-highlight text-main dark:text-white'
                : 'text-muted dark:text-gray-400 hover:text-main dark:hover:text-white hover:bg-surface-highlight dark:hover:bg-surface-highlight'
            }`}
          >
            <span
              className="material-symbols-outlined text-[20px] pixel-icon shrink-0"
              style={{ fontVariationSettings: currentTab === 'settings' ? "'FILL' 1" : "" }}
            >
              settings
            </span>
            <span className="font-medium text-[13px]">Settings</span>
          </button>
        )}

        {/* Logout button */}
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 transition-colors outline-none text-muted dark:text-gray-500 hover:text-red-400 hover:bg-red-950/20"
        >
          <span className="material-symbols-outlined text-[20px] pixel-icon shrink-0">logout</span>
          <span className="font-medium text-[13px]">Sign Out</span>
        </button>

        {/* User card */}
        <div className="mt-1 flex items-center gap-3 px-3 py-2.5 bg-surface/60 dark:bg-surface-dark/60 border border-surface dark:border-surface-highlight">
          {/* Avatar with initials */}
          <div className="size-7 bg-black dark:bg-white flex items-center justify-center text-white dark:text-black text-[10px] font-black shrink-0 select-none">
            {avatarInitials}
          </div>
          <div className="flex flex-col overflow-hidden flex-1 min-w-0">
            <p className="text-[12px] font-bold text-main dark:text-white truncate capitalize">{displayName}</p>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[10px] text-muted dark:text-gray-500">{roleIcon}</span>
              <p className="text-[10px] text-muted dark:text-gray-500 truncate font-mono">{roleLabel}</p>
            </div>
          </div>
          {currentUser?.role === 'admin' && (
            <span className="text-[8px] font-bold text-blue-400 border border-blue-500/30 px-1 py-0.5 shrink-0">ADMIN</span>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
