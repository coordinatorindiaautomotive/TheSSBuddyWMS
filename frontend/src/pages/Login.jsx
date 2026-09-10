import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, ArrowRight } from 'lucide-react';
import thessbuddyLogo from '/thessbuddy_logo.png?url';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f7fa] flex items-center justify-center p-4 relative overflow-hidden">
      <div className="w-full max-w-md bg-white p-8 rounded-3xl shadow-xl border border-slate-200 relative z-10">
        <div className="text-center mb-8">
          <img src={thessbuddyLogo} alt="TheSSBuddy" className="h-16 w-auto object-contain mx-auto mb-3" />
          <h2 className="text-2xl font-black text-[#003366] tracking-tight">TheSSBuddy Portal</h2>
          <p className="text-xs text-slate-500 font-bold mt-1">Your Intelligent Business Companion</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Username <span className="text-red-500 font-bold ml-0.5">*</span></label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-sm text-slate-800 placeholder-slate-400 font-semibold"
                placeholder="Enter username"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">Password <span className="text-red-500 font-bold ml-0.5">*</span></label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full glass-input pl-10 pr-4 py-2.5 rounded-xl text-sm text-slate-800 placeholder-slate-400 font-semibold"
                placeholder="Enter password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#004c8f] hover:bg-[#003a6d] text-white font-bold text-sm tracking-wide shadow-md flex items-center justify-center gap-2 transition-all mt-6 cursor-pointer"
          >
            {loading ? 'Authenticating...' : (
              <>
                <span>Sign In to Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-8 pt-6 border-t border-slate-200 text-[10px] text-slate-400 font-semibold">
          Designed By Shailendra Singh
        </div>
      </div>
    </div>
  );
}
