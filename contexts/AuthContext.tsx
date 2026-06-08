/**
 * Intelli IPS — Local Authentication Context
 * Stores credentials in localStorage. Supports user and admin roles.
 * Default accounts seeded on first load:
 *   admin / admin123  (role: admin)
 *   user  / user123   (role: user)
 */

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  username: string;
  role: UserRole;
}

interface StoredUser {
  username: string;
  passwordHash: string; // simple XOR-based obfuscation — not for prod, for local demo
  role: UserRole;
  displayName?: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isAdmin: boolean;
  login: (username: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  users: StoredUser[];
  addUser: (username: string, password: string, role: UserRole, displayName?: string) => { ok: boolean; error?: string };
  deleteUser: (username: string) => { ok: boolean; error?: string };
  changePassword: (username: string, newPassword: string) => { ok: boolean; error?: string };
}

const STORE_KEY = 'ips_users_v1';
const SESSION_KEY = 'ips_session_v1';
const XOR_KEY = 42;

// Simple obfuscation — not cryptographic, just makes passwords non-readable in localStorage
function obfuscate(str: string): string {
  return btoa(str.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY)).join(''));
}

function deobfuscate(hash: string): string {
  try {
    return atob(hash).split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ XOR_KEY)).join('');
  } catch {
    return '';
  }
}

const DEFAULT_USERS: StoredUser[] = [
  {
    username: 'admin',
    passwordHash: obfuscate('admin123'),
    role: 'admin',
    displayName: 'System Administrator',
  },
  {
    username: 'user',
    passwordHash: obfuscate('user123'),
    role: 'user',
    displayName: 'Security Analyst',
  },
];

function loadUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return DEFAULT_USERS;
    const parsed = JSON.parse(raw) as StoredUser[];
    // Ensure default admin always exists
    const hasAdmin = parsed.some(u => u.role === 'admin');
    if (!hasAdmin) return [...DEFAULT_USERS, ...parsed];
    return parsed;
  } catch {
    return DEFAULT_USERS;
  }
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(users));
}

function loadSession(): AuthUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function saveSession(user: AuthUser | null) {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<StoredUser[]>(() => {
    const loaded = loadUsers();
    // Seed defaults if nothing stored
    saveUsers(loaded);
    return loaded;
  });
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => loadSession());

  const isAdmin = currentUser?.role === 'admin';

  const login = useCallback((username: string, password: string): { ok: boolean; error?: string } => {
    const stored = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!stored) return { ok: false, error: 'User not found' };
    if (deobfuscate(stored.passwordHash) !== password) return { ok: false, error: 'Incorrect password' };
    const session: AuthUser = { username: stored.username, role: stored.role };
    setCurrentUser(session);
    saveSession(session);
    return { ok: true };
  }, [users]);

  const logout = useCallback(() => {
    setCurrentUser(null);
    saveSession(null);
  }, []);

  const addUser = useCallback((
    username: string, password: string, role: UserRole, displayName?: string
  ): { ok: boolean; error?: string } => {
    if (!username.trim()) return { ok: false, error: 'Username cannot be empty' };
    if (!password || password.length < 4) return { ok: false, error: 'Password must be at least 4 characters' };
    const exists = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (exists) return { ok: false, error: `Username '${username}' already exists` };
    const newUser: StoredUser = {
      username: username.trim(),
      passwordHash: obfuscate(password),
      role,
      displayName: displayName || username.trim(),
    };
    const updated = [...users, newUser];
    setUsers(updated);
    saveUsers(updated);
    return { ok: true };
  }, [users]);

  const deleteUser = useCallback((username: string): { ok: boolean; error?: string } => {
    const target = users.find(u => u.username === username);
    if (!target) return { ok: false, error: 'User not found' };
    if (target.role === 'admin') {
      const admins = users.filter(u => u.role === 'admin');
      if (admins.length <= 1) return { ok: false, error: 'Cannot delete the last admin account' };
    }
    if (currentUser?.username === username) {
      setCurrentUser(null);
      saveSession(null);
    }
    const updated = users.filter(u => u.username !== username);
    setUsers(updated);
    saveUsers(updated);
    return { ok: true };
  }, [users, currentUser]);

  const changePassword = useCallback((username: string, newPassword: string): { ok: boolean; error?: string } => {
    if (!newPassword || newPassword.length < 4) return { ok: false, error: 'Password must be at least 4 characters' };
    const updated = users.map(u =>
      u.username === username ? { ...u, passwordHash: obfuscate(newPassword) } : u
    );
    setUsers(updated);
    saveUsers(updated);
    return { ok: true };
  }, [users]);

  return (
    <AuthContext.Provider value={{ currentUser, isAdmin, login, logout, users, addUser, deleteUser, changePassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export default AuthContext;
