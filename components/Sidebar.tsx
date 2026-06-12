
import React from 'react';
import { AuthUser } from '../contexts/AuthContext';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  alertsCount?: number;
  currentUser: AuthUser | null;
  isAdmin: boolean;
  onLogout: () => void;
  onUpgradeClick?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
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
  onUpgradeClick,
  mobileOpen,
  onCloseMobile,
}) => {
  const allNavItems = [
    { id: 'dashboard', label: 'Overview', icon: 'dashboard', adminOnly: false },
    { id: 'network', label: 'Network & Sim', icon: 'hub', highlight: 'blue', adminOnly: false },
    { id: 'threat-feed', label: 'Prevention Feed', icon: 'shield_locked', highlight: 'red', adminOnly: false },
    { id: 'copilot', label: 'Security Copilot', icon: 'auto_awesome', highlight: 'blue', adminOnly: false },
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
    <aside className={`w-60 bg-background dark:bg-background-dark border-r border-surface dark:border-surface-highlight flex-col z-50 shrink-0 fixed md:relative inset-y-0 left-0 transition-transform duration-300 md:translate-x-0 ${
      mobileOpen ? 'translate-x-0 flex' : '-translate-x-full md:flex hidden'
    }`}>
      {/* Logo */}
      <div className="h-14 flex items-center px-5 border-b border-surface dark:border-surface-highlight gap-3 shrink-0">
        <IntelliLogo size={30} />
        <div>
          <h1 className="font-black text-sm tracking-tight uppercase text-main dark:text-white leading-none">Intelli IPS</h1>
          <p className="text-[10px] text-muted dark:text-gray-500 font-mono leading-none mt-0.5">Intrusion Prevention</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
        <p className="text-[10px] font-bold text-muted dark:text-gray-600 uppercase tracking-widest px-3 pb-2">Navigation</p>
        {navItems.map((item) => {
          const isActive = currentTab === item.id;
          const isRed = item.highlight === 'red';
          const isBlue = item.highlight === 'blue';
          return (
            <button
              key={item.id}
              onClick={() => {
                onTabChange(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={`w-[calc(100%-16px)] mx-2 flex items-center gap-3 px-3.5 py-2.5 transition-all text-left relative outline-none rounded-xl ${
                isActive
                  ? 'bg-primary/15 text-primary dark:bg-primary/20 dark:text-blue-300 font-semibold'
                  : 'text-muted dark:text-gray-400 hover:text-main dark:hover:text-white hover:bg-surface-highlight/60'
              }`}
            >
              {/* Active / Highlight indicator stripe inside capsule */}
              {isActive && <span className="absolute left-1 top-2.5 bottom-2.5 w-1 bg-primary rounded-full"></span>}
              {isRed && !isActive && <span className="absolute left-1 top-2.5 bottom-2.5 w-1 bg-red-500 rounded-full"></span>}
              {isBlue && !isActive && <span className="absolute left-1 top-2.5 bottom-2.5 w-1 bg-blue-500/60 rounded-full"></span>}

              <span
                className={`material-symbols-outlined text-[20px] pixel-icon shrink-0 transition-colors ${
                  isActive ? 'text-primary dark:text-blue-300' :
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
                <span className="ml-auto bg-red-600 text-white text-[10px] font-mono px-1.5 py-0.5 min-w-[20px] text-center rounded-full">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-2 border-t border-surface dark:border-surface-highlight space-y-1">
        {/* Settings — admin only */}
        {isAdmin && (
          <button
            onClick={() => {
              onTabChange('settings');
              if (onCloseMobile) onCloseMobile();
            }}
            className={`w-[calc(100%-16px)] mx-2 flex items-center gap-3 px-3.5 py-2.5 transition-all outline-none rounded-xl ${
              currentTab === 'settings'
                ? 'bg-primary/15 text-primary dark:bg-primary/20 dark:text-blue-300 font-semibold relative'
                : 'text-muted dark:text-gray-400 hover:text-main dark:hover:text-white hover:bg-surface-highlight/60'
            }`}
          >
            {currentTab === 'settings' && <span className="absolute left-1 top-2.5 bottom-2.5 w-1 bg-primary rounded-full"></span>}
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
          className="w-[calc(100%-16px)] mx-2 flex items-center gap-3 px-3.5 py-2 transition-all outline-none text-muted dark:text-gray-500 hover:text-red-400 hover:bg-red-950/20 rounded-xl"
        >
          <span className="material-symbols-outlined text-[20px] pixel-icon shrink-0">logout</span>
          <span className="font-medium text-[13px]">Sign Out</span>
        </button>

        {/* User card */}
        <div className="mt-2 mx-2 flex items-center gap-3 px-3 py-2.5 bg-surface/40 dark:bg-surface-dark/40 border border-surface/50 dark:border-surface-highlight/50 rounded-2xl">
          {/* Avatar with initials */}
          <div className="size-8 bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-white text-[11px] font-black shrink-0 select-none rounded-full">
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
            <span className="text-[8px] font-bold text-blue-400 border border-blue-500/30 px-1 py-0.5 shrink-0 rounded">ADMIN</span>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
