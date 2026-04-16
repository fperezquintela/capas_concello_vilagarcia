import React, { useState } from 'react';
import axios from 'axios';
import { Shield, Loader2, User, Lock } from 'lucide-react';

const Login = ({ setAuth }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await axios.post('/login', { username, password });
      setAuth(res.data.token, res.data.user);
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#A41C3A] relative overflow-hidden font-sans">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-3xl animate-pulse delay-700"></div>

      <div className="w-full max-w-md p-8 relative z-10 animate-fade-in">
        <div className="glass-panel p-10 rounded-3xl border border-white/20 shadow-2xl bg-white/10 backdrop-blur-2xl">
          <div className="text-center mb-10">
            <div className="mx-auto w-32 mb-6 pointer-events-none">
              <img src="/logo.png" alt="Logo" className="w-full h-auto" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight uppercase border-b-2 border-white/20 pb-4 inline-block">
              Capas Vilagarcía
            </h1>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div>
              <label className="block text-[10px] font-bold text-white/70 uppercase tracking-widest mb-2 ml-1">Usuario</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={18} />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="w-full glass-input pl-12 pr-4 py-4 bg-white/10 border-white/20 text-white placeholder-white/30 rounded-2xl focus:bg-white/20 transition-all font-semibold"
                  placeholder="Introduce usuario"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-white/70 uppercase tracking-widest mb-2 ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" size={18} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full glass-input pl-12 pr-4 py-4 bg-white/10 border-white/20 text-white placeholder-white/30 rounded-2xl focus:bg-white/20 transition-all font-semibold"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-black/30 border border-white/20 rounded-xl text-white text-sm text-center animate-shake">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-white text-[#A41C3A] hover:bg-white/90 py-4 mt-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center"
            >
              {loading ? <Loader2 className="animate-spin" size={24} /> : 'Entrar'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <button 
              onClick={() => {
                localStorage.removeItem('manual_login_required');
                window.location.reload();
              }}
              className="text-white/60 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              Volver como Invitado
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
