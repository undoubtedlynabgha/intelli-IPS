import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter both username and password.');
      return;
    }
    setLoading(true);
    setError(null);

    // Simulate async delay for UX
    await new Promise(r => setTimeout(r, 400));
    const result = login(username.trim(), password);
    setLoading(false);

    if (!result.ok) {
      setError(result.error ?? 'Login failed');
      setShake(true);
      setTimeout(() => setShake(false), 600);
      setPassword('');
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black overflow-hidden"
      style={{ fontFamily: "'Inter', 'Outfit', system-ui, sans-serif" }}
    >
      {/* Animated background grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}
      />

      {/* Glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-emerald-600/8 rounded-full blur-3xl pointer-events-none" />

      {/* Login card */}
      <div
        className={`relative w-full max-w-sm mx-4 transition-transform duration-100 ${shake ? 'animate-bounce' : ''}`}
        style={shake ? { animation: 'shake 0.5s ease-in-out' } : {}}
      >
        {/* Card glow border */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-transparent to-emerald-500/10 rounded-2xl blur-md -m-px pointer-events-none" />

        <div className="relative bg-[#0a0a0a]/90 backdrop-blur-md border border-white/10 p-8 shadow-2xl rounded-2xl">

          {/* Header */}
          <div className="flex flex-col items-center gap-4 mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-[#4A6FD4]/20 blur-xl rounded-full" />
              <div className="relative w-14 h-14 bg-gradient-to-tr from-[#1a1a4e] to-[#4A6FD4] border border-[#4A6FD4]/30 rounded-2xl flex items-center justify-center shadow-2xl">
                <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                  security
                </span>
              </div>
            </div>
            <div className="text-center">
              <h1 className="text-xl font-black text-white tracking-tight uppercase">Intelli IPS</h1>
              <p className="text-xs text-gray-500 font-mono mt-1">Intrusion Prevention System</p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Username</label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[16px] text-gray-600 pointer-events-none">
                  person
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={e => { setUsername(e.target.value); setError(null); }}
                  placeholder="admin or user"
                  autoFocus
                  autoComplete="username"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-750 text-sm h-10 pl-9 pr-4 rounded-xl outline-none focus:border-[#4A6FD4]/50 focus:bg-white/8 transition-all font-mono"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Password</label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-3 text-[16px] text-gray-600 pointer-events-none">
                  lock
                </span>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(null); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-white/5 border border-white/10 text-white placeholder-gray-750 text-sm h-10 pl-9 pr-10 rounded-xl outline-none focus:border-[#4A6FD4]/50 focus:bg-white/8 transition-all font-mono"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 text-gray-600 hover:text-gray-300 transition-colors outline-none"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {showPass ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-500/30 text-red-400 text-xs font-mono rounded-xl animate-in fade-in duration-200">
                <span className="material-symbols-outlined text-[14px] shrink-0">dangerous</span>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-[#4A6FD4] hover:bg-[#3A5ECA] text-white text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2 shadow-lg rounded-xl"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>
                  Authenticating…
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">login</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Hint */}
          <div className="mt-6 pt-5 border-t border-white/5">
            <p className="text-[10px] text-gray-700 font-mono text-center leading-relaxed">
              Default accounts: <span className="text-gray-500">admin / admin123</span> · <span className="text-gray-500">user / user123</span>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-8px); }
          40%       { transform: translateX(8px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
};

export default LoginScreen;
