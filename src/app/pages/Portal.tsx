import { useState } from 'react';
import { useNavigate } from 'react-router';
import { User, UserCog } from 'lucide-react';
import { motion } from 'motion/react';
import telkomLogo from "../../assets/logotelkom.png";
import { login } from '../lib/api';

export default function Portal() {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<'intern' | 'mentor' | null>(null);
  const [formData, setFormData] = useState({ name: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!formData.name.trim()) { setError('Masukkan nama lengkap Anda.'); return; }
    
    setLoading(true);
    try {
      const data = await login(formData.name, formData.password, selectedRole!);
      if (data.error) { setError(data.error); setLoading(false); return; }
      
      localStorage.setItem(`${selectedRole}Name`, formData.name.trim());
      localStorage.setItem(`${selectedRole}Data`, JSON.stringify(data.user));
      navigate(selectedRole === 'intern' ? '/intern' : '/mentor');
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif' }}>
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#800000] via-[#a00000] to-[#600000]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(204,0,0,0.3)_0%,transparent_50%)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6">
        {/* Logo & Title */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-28 h-28 mx-auto mb-6 rounded-[28px] bg-white/95 backdrop-blur-xl border border-white/40 flex items-center justify-center shadow-[0_8px_40px_rgba(0,0,0,0.15)] p-3">
            <img src={telkomLogo} alt="Telkom Indonesia" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl md:text-4xl text-white mb-2 tracking-tight" style={{ fontWeight: 700 }}>Absen & Quiz</h1>
          <p className="text-white/80 text-base">SDA GSPO — Magang Mandiri</p>
          <p className="text-white/60 text-sm mt-1">Telkom STO Gambir</p>
        </motion.div>

        {!selectedRole ? (
          /* Role Selection Cards */
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="grid md:grid-cols-2 gap-6 w-full max-w-2xl"
          >
            {/* Intern Card */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedRole('intern')}
              className="group relative rounded-[32px] p-8 bg-white/10 backdrop-blur-2xl border border-white/20 hover:border-white/40 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.16)]"
            >
              <div className="flex flex-col items-center text-center space-y-5">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center group-hover:from-white/30 group-hover:to-white/10 transition-all duration-300 shadow-lg">
                  <User className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl text-white mb-2" style={{ fontWeight: 700 }}>Masuk sebagai Intern</h3>
                  <p className="text-white/70 text-sm">Absensi, laporan harian & quiz</p>
                </div>
              </div>
            </motion.button>

            {/* Mentor Card */}
            <motion.button
              whileHover={{ scale: 1.02, y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedRole('mentor')}
              className="group relative rounded-[32px] p-8 bg-white/10 backdrop-blur-2xl border border-white/20 hover:border-white/40 transition-all duration-300 shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:shadow-[0_16px_48px_rgba(0,0,0,0.16)]"
            >
              <div className="flex flex-col items-center text-center space-y-5">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center group-hover:from-white/30 group-hover:to-white/10 transition-all duration-300 shadow-lg">
                  <UserCog className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl text-white mb-2" style={{ fontWeight: 700 }}>Masuk sebagai Mentor</h3>
                  <p className="text-white/70 text-sm">Pantau absensi & kelola materi</p>
                </div>
              </div>
            </motion.button>
          </motion.div>
        ) : (
          /* Login Form */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md"
          >
            <div className="rounded-[32px] p-8 bg-white/10 backdrop-blur-2xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)]">
              <div className="flex items-center justify-center mb-6">
                {selectedRole === 'intern' ? (
                  <User className="w-12 h-12 text-white" />
                ) : (
                  <UserCog className="w-12 h-12 text-white" />
                )}
              </div>
              
              <h2 className="text-2xl text-white text-center mb-2" style={{ fontWeight: 700 }}>
                {selectedRole === 'intern' ? 'Login Intern' : 'Login Mentor'}
              </h2>
              <p className="text-white/60 text-sm text-center mb-8">
                {selectedRole === 'intern' 
                  ? 'Gunakan nama lengkap & password dari mentor' 
                  : 'Gunakan nama lengkap & password mentor'}
              </p>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 rounded-2xl bg-red-500/20 border border-red-400/30 text-red-200 text-sm text-center"
                >
                  {error}
                </motion.div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label className="block text-white/90 mb-2 text-sm">Nama Lengkap</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-5 py-3.5 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
                    placeholder="Nama Lengkap"
                    required
                  />
                </div>

                <div>
                  <label className="block text-white/90 mb-2 text-sm">Password</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-5 py-3.5 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/40 transition-all"
                    placeholder="Masukkan password"
                    required
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => { setSelectedRole(null); setError(''); }}
                    className="flex-1 px-6 py-3.5 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 text-white hover:bg-white/20 transition-all duration-200"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className={`flex-1 px-6 py-3.5 rounded-2xl bg-white text-[#800000] hover:shadow-[0_8px_24px_rgba(255,255,255,0.2)] transition-all duration-200 ${loading ? 'opacity-60' : ''}`} style={{ fontWeight: 600 }}
                  >
                    {loading ? 'Memproses...' : 'Masuk'}
                  </button>
                </div>
              </form>
            </div>

            <p className="text-center text-white/50 text-xs mt-6">
              {selectedRole === 'intern' 
                ? 'Password intern: interntelkomgspo' 
                : ''}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}