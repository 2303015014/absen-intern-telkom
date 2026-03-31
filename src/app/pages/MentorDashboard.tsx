import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { 
  Users, BookOpen, ClipboardCheck, LogOut, Search, CheckCircle,
  Upload, MapPin, Clock, FileText, Plus, Edit, Trophy, Eye,
  Menu, X, Loader2, Trash2, Save, Download, Sparkles, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import telkomLogo from "../../assets/logotelkom.png";
import * as api from '../lib/api';

interface InternData {
  name: string;
  role: string;
  totalPoints: number;
  quizCount: number;
  todayAttendance: any;
}

export default function MentorDashboard() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mentorName] = useState(() => localStorage.getItem('mentorName') || '');
  const [interns, setInterns] = useState<InternData[]>([]);
  const [selectedIntern, setSelectedIntern] = useState<InternData | null>(null);
  const [internAttendance, setInternAttendance] = useState<any[]>([]);
  const [internQuizResults, setInternQuizResults] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'attendance' | 'materials' | 'quiz'>('attendance');
  const [detailView, setDetailView] = useState<'attendance' | 'quiz'>('attendance');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [materials, setMaterials] = useState<any[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [uploadingMaterial, setUploadingMaterial] = useState(false);
  const [materialTitle, setMaterialTitle] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<number | null>(null);
  const [newQuestion, setNewQuestion] = useState({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
  const [showAddQuestion, setShowAddQuestion] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiProgressMsg, setAiProgressMsg] = useState('');
  const [showAiConfirm, setShowAiConfirm] = useState<any[]>([]);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    if (!mentorName) { navigate('/'); return; }
    loadData();
  }, [mentorName, navigate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [internsData, matsData, quizData] = await Promise.all([
        api.getInterns(),
        api.getMaterials(),
        api.getQuizQuestions(),
      ]);
      setInterns(internsData.interns || []);
      setMaterials(matsData.materials || []);
      setQuizQuestions(quizData.questions || []);
      if (internsData.interns?.length > 0 && !selectedIntern) {
        selectIntern(internsData.interns[0]);
      }
    } catch (err) {
      console.error('Load data error:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectIntern = async (intern: InternData) => {
    setSelectedIntern(intern);
    setLoadingDetail(true);
    try {
      const [attData, quizData] = await Promise.all([
        api.getAttendance(intern.name),
        api.getQuizResults(intern.name),
      ]);
      setInternAttendance(attData.attendance || []);
      setInternQuizResults(quizData.results || []);
    } catch (err) {
      console.error('Load intern detail error:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApprove = async (att: any) => {
    // Tambahkan penjaga ini agar TypeScript tahu datanya aman
    if (!selectedIntern || !selectedIntern.name) return;

    try {
      await api.approveAttendance(selectedIntern.name, att.date, mentorName);
      
      att.status = 'approved';
      att.approvedBy = mentorName;
      setInternAttendance([...internAttendance]);
      
      // Cara update state yang benar
      if (selectedIntern.todayAttendance?.date === att.date) {
        setSelectedIntern({
          ...selectedIntern,
          todayAttendance: att
        });
      }
    } catch (err) {
      console.error('Approve error:', err);
      alert('Gagal approve kehadiran');
    }
  };

  const handleUploadMaterial = async (file: File) => {
    if (!materialTitle.trim()) { alert('Masukkan judul materi'); return; }
    setUploadingMaterial(true);
    try {
      const result = await api.uploadMaterial(materialTitle.trim(), file);
      if (result.error) { alert(result.error); return; }
      setMaterials(prev => [...prev, result.material]);
      setMaterialTitle('');
      alert('Materi berhasil diupload! Intern sekarang bisa mengakses materi ini.');
      const matsData = await api.getMaterials();
      setMaterials(matsData.materials || []);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload gagal');
    } finally {
      setUploadingMaterial(false);
    }
  };

  const handleDeleteMaterial = async (id: number) => {
    if (!confirm('Hapus materi ini?')) return;
    try {
      await api.deleteMaterial(id);
      setMaterials(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleSaveQuestions = async () => {
    setSavingQuiz(true);
    try {
      await api.updateQuizQuestions(quizQuestions);
      alert('Soal quiz berhasil disimpan!');
    } catch (err) {
      console.error('Save quiz error:', err);
      alert('Gagal menyimpan quiz');
    } finally {
      setSavingQuiz(false);
    }
  };

  const addNewQuestion = () => {
    if (!newQuestion.question.trim()) return;
    const q = {
      id: Date.now(),
      question: newQuestion.question,
      options: newQuestion.options,
      correctAnswer: newQuestion.correctAnswer,
    };
    setQuizQuestions(prev => [...prev, q]);
    setNewQuestion({ question: '', options: ['', '', '', ''], correctAnswer: 0 });
    setShowAddQuestion(false);
  };

  const deleteQuestion = (id: number) => {
    setQuizQuestions(prev => prev.filter(q => q.id !== id));
  };

  const filteredInterns = interns.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInternStatus = (intern: InternData) => {
    const att = intern.todayAttendance;
    if (!att) return 'absent';
    if (att.status === 'approved') return 'approved';
    if (att.status === 'pending') return 'pending';
    if (att.clockIn && !att.clockOut) return 'clocked-in';
    return 'clocked-in';
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'approved': return 'Approved';
      case 'pending': return 'Pending';
      case 'clocked-in': return 'Clock In';
      case 'absent': return 'Tidak Hadir';
      default: return s;
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'approved': return 'bg-green-100 text-green-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'clocked-in': return 'bg-blue-100 text-blue-700';
      case 'absent': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const stats = {
    total: interns.length,
    present: interns.filter(i => getInternStatus(i) !== 'absent').length,
    pending: interns.filter(i => getInternStatus(i) === 'pending').length,
    absent: interns.filter(i => getInternStatus(i) === 'absent').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#800000] mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div className="flex h-screen overflow-hidden">
        {/* Mobile overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
          )}
        </AnimatePresence>

        {/* Sidebar */}
        <div className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-white/80 backdrop-blur-2xl border-r border-gray-200/50 shadow-[4px_0_24px_rgba(0,0,0,0.04)] flex flex-col transform transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white border border-gray-100 flex items-center justify-center p-1.5 shadow-sm">
                <img src={telkomLogo} alt="Telkom" className="w-full h-full object-contain" />
              </div>
              <div className="flex-1">
                <h2 className="text-gray-900 text-sm" style={{ fontWeight: 700 }}>Absen & Quiz</h2>
                <p className="text-xs text-gray-500">Mentor: {mentorName}</p>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 rounded-xl hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
          </div>

          <nav className="flex-1 p-3 space-y-1">
            {[
              { key: 'attendance' as const, icon: ClipboardCheck, label: 'Monitor Absensi' },
              { key: 'materials' as const, icon: BookOpen, label: 'Materi Belajar' },
              { key: 'quiz' as const, icon: Edit, label: 'Kelola Quiz' },
            ].map(item => (
              <button key={item.key}
                onClick={() => { setActiveTab(item.key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all text-sm ${
                  activeTab === item.key
                    ? 'bg-gradient-to-r from-[#800000] to-[#cc0000] text-white shadow-[0_4px_16px_rgba(128,0,0,0.2)]'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                style={{ fontWeight: activeTab === item.key ? 600 : 500 }}>
                <item.icon className="w-5 h-5" />{item.label}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-3" style={{ fontWeight: 600 }}>HARI INI</p>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-xl bg-green-50">
                <p className="text-lg text-green-700" style={{ fontWeight: 700 }}>{stats.present}</p>
                <p className="text-[10px] text-green-600">Hadir</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-yellow-50">
                <p className="text-lg text-yellow-700" style={{ fontWeight: 700 }}>{stats.pending}</p>
                <p className="text-[10px] text-yellow-600">Pending</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-red-50">
                <p className="text-lg text-red-700" style={{ fontWeight: 700 }}>{stats.absent}</p>
                <p className="text-[10px] text-red-600">Absen</p>
              </div>
            </div>
          </div>

          <div className="p-3 border-t border-gray-100">
            <button onClick={() => { localStorage.clear(); navigate('/'); }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-600 hover:bg-red-50 transition-all text-sm" style={{ fontWeight: 500 }}>
              <LogOut className="w-5 h-5" />Keluar
            </button>
          </div>
        </div>

        {/* Main */}
        <div className="flex-1 overflow-auto">
          <div className="lg:hidden flex items-center gap-3 p-4 border-b border-gray-100 bg-white/80 backdrop-blur-xl sticky top-0 z-30">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl hover:bg-gray-100">
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 p-1">
              <img src={telkomLogo} alt="Telkom" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm text-gray-900" style={{ fontWeight: 600 }}>Absen & Quiz — Mentor</span>
          </div>

          {/* ATTENDANCE TAB */}
          {activeTab === 'attendance' && (
            <div className="p-4 lg:p-8">
              <div className="mb-6">
                <h1 className="text-2xl lg:text-3xl text-gray-900 mb-1" style={{ fontWeight: 700 }}>Monitor Absensi</h1>
                <p className="text-gray-500 text-sm">Review dan approve kehadiran intern</p>
              </div>

              {interns.length === 0 ? (
                <div className="rounded-[24px] p-12 bg-white/70 border border-white/80 text-center">
                  <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-gray-500">Belum ada intern yang terdaftar</p>
                  <p className="text-gray-400 text-xs mt-1">Intern akan muncul setelah mereka login</p>
                </div>
              ) : (
                <div className="grid lg:grid-cols-3 gap-5">
                  {/* Intern list */}
                  <div className="lg:col-span-1">
                    <div className="rounded-[24px] p-4 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
                      <div className="relative mb-3">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Cari nama intern..."
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100 focus:outline-none focus:ring-2 focus:ring-[#800000]/20 text-sm" />
                      </div>
                      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
                        {filteredInterns.map((intern, idx) => {
                          const status = getInternStatus(intern);
                          const isSel = selectedIntern?.name === intern.name;
                          return (
                            <button key={idx} onClick={() => selectIntern(intern)}
                              className={`w-full p-3.5 rounded-2xl text-left transition-all ${
                                isSel ? 'bg-gradient-to-r from-[#800000] to-[#cc0000] text-white shadow-md' : 'bg-white/60 hover:bg-white text-gray-900'
                              }`}>
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-xs ${isSel ? 'bg-white/20' : 'bg-gray-100'}`} style={{ fontWeight: 700 }}>
                                  {intern.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm truncate" style={{ fontWeight: 600 }}>{intern.name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${isSel ? 'bg-white/20 !text-white' : statusColor(status)}`} style={{ fontWeight: 600 }}>
                                      {statusLabel(status)}
                                    </span>
                                    <span className={`text-[10px] ${isSel ? 'text-white/70' : 'text-gray-400'}`}>{intern.totalPoints} pts</span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Detail */}
                  <div className="lg:col-span-2">
                    {selectedIntern ? (
                      loadingDetail ? (
                        <div className="rounded-[24px] p-12 bg-white/70 border border-white/80 text-center">
                          <Loader2 className="w-6 h-6 animate-spin text-[#800000] mx-auto mb-2" />
                          <p className="text-gray-500 text-sm">Memuat detail...</p>
                        </div>
                      ) : (
                        <motion.div key={selectedIntern.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                          {/* Header */}
                          <div className="rounded-[24px] p-5 bg-white/70 border border-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#800000] to-[#cc0000] flex items-center justify-center text-white text-lg" style={{ fontWeight: 700 }}>
                                  {selectedIntern.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                                </div>
                                <div>
                                  <h3 className="text-lg text-gray-900" style={{ fontWeight: 700 }}>{selectedIntern.name}</h3>
                                  <p className="text-gray-500 text-sm">Magang — SDA GSPO • {selectedIntern.totalPoints} pts</p>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2 mt-4">
                              {(['attendance', 'quiz'] as const).map(tab => (
                                <button key={tab} onClick={() => setDetailView(tab)}
                                  className={`flex-1 py-2 rounded-xl text-sm transition-all ${
                                    detailView === tab ? 'bg-[#800000] text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                  }`} style={{ fontWeight: 600 }}>
                                  {tab === 'attendance' ? <><ClipboardCheck className="w-4 h-4 inline mr-1.5" />Absensi ({internAttendance.length})</> : <><Trophy className="w-4 h-4 inline mr-1.5" />Quiz ({internQuizResults.length})</>}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Attendance detail */}
                          {detailView === 'attendance' && (
                            <div className="space-y-3">
                              {internAttendance.length === 0 ? (
                                <div className="rounded-[24px] p-8 bg-white/70 border border-white/80 text-center">
                                  <p className="text-gray-500 text-sm">Belum ada data absensi</p>
                                </div>
                              ) : (
                                internAttendance.sort((a: any, b: any) => b.date.localeCompare(a.date)).map((att: any, idx: number) => (
                                  <div key={idx} className="rounded-[24px] p-5 bg-white/70 border border-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.04)]">
                                    <div className="flex items-center justify-between mb-3">
                                      <p className="text-gray-900 text-sm" style={{ fontWeight: 700 }}>
                                        {new Date(att.date + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                                      </p>
                                      <span className={`px-2.5 py-1 rounded-full text-[10px] ${statusColor(att.status)}`} style={{ fontWeight: 600 }}>
                                        {att.status === 'approved' ? `Approved by ${att.approvedBy || 'Mentor'}` : statusLabel(att.status)}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mb-3">
                                      <div className="flex items-center gap-2 text-sm">
                                        <Clock className="w-4 h-4 text-blue-500" />
                                        <span className="text-gray-600">In: <span style={{ fontWeight: 600 }}>{att.clockIn}</span></span>
                                      </div>
                                      {att.clockOut && (
                                        <div className="flex items-center gap-2 text-sm">
                                          <Clock className="w-4 h-4 text-orange-500" />
                                          <span className="text-gray-600">Out: <span style={{ fontWeight: 600 }}>{att.clockOut}</span></span>
                                        </div>
                                      )}
                                    </div>

                                    {att.locationIn?.address && (
                                      <div className="flex items-start gap-2 text-xs text-gray-500 mb-3">
                                        <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-green-500" />
                                        <span>{att.locationIn.address}</span>
                                      </div>
                                    )}

                                    {/* Photos */}
                                    <div className="flex gap-2 mb-3">
                                      {att.photoIn && (
                                        <div className="flex-1">
                                          <p className="text-[10px] text-gray-400 mb-1">Foto Clock In</p>
                                          <img src={att.photoIn} alt="Clock In" className="w-full h-48 object-contain rounded-xl bg-gray-100" />
                                        </div>
                                      )}
                                      {att.photoOut && (
                                        <div className="flex-1">
                                          <p className="text-[10px] text-gray-400 mb-1">Foto Clock Out</p>
                                          <img src={att.photoOut} alt="Clock Out" className="w-full h-48 object-contain rounded-xl bg-gray-100" />
                                        </div>
                                      )}
                                    </div>

                                    {att.report && (
                                      <div className="p-3 rounded-xl bg-gray-50 text-sm text-gray-600 mb-3">
                                        <p className="text-[10px] text-gray-400 mb-1" style={{ fontWeight: 600 }}>Laporan:</p>
                                        {att.report}
                                      </div>
                                    )}

                                    {att.status === 'pending' && (
                                      <button onClick={() => handleApprove(att)}
                                        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white text-sm flex items-center justify-center gap-2 transition-all hover:shadow-md"
                                        style={{ fontWeight: 600 }}>
                                        <CheckCircle className="w-4 h-4" /> Approve Kehadiran
                                      </button>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}

                          {/* Quiz detail */}
                          {detailView === 'quiz' && (
                            <div className="space-y-4">
                              {internQuizResults.length === 0 ? (
                                <div className="rounded-[24px] p-8 bg-white/70 border border-white/80 text-center">
                                  <p className="text-gray-500 text-sm">Belum ada riwayat quiz</p>
                                </div>
                              ) : (
                                <>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="rounded-[20px] p-4 bg-white/70 border border-white/80 text-center">
                                      <p className="text-gray-400 text-xs mb-1">Total Poin</p>
                                      <p className="text-2xl text-[#800000]" style={{ fontWeight: 700 }}>{selectedIntern.totalPoints}</p>
                                    </div>
                                    <div className="rounded-[20px] p-4 bg-white/70 border border-white/80 text-center">
                                      <p className="text-gray-400 text-xs mb-1">Quiz</p>
                                      <p className="text-2xl text-gray-900" style={{ fontWeight: 700 }}>{internQuizResults.length}</p>
                                    </div>
                                    <div className="rounded-[20px] p-4 bg-white/70 border border-white/80 text-center">
                                      <p className="text-gray-400 text-xs mb-1">Rata-rata</p>
                                      <p className="text-2xl text-green-600" style={{ fontWeight: 700 }}>
                                        {Math.round(internQuizResults.reduce((a: number, r: any) => a + (r.percentage || 0), 0) / internQuizResults.length)}%
                                      </p>
                                    </div>
                                  </div>
                                  <div className="rounded-[24px] p-5 bg-white/70 border border-white/80">
                                    <h4 className="text-gray-900 text-sm mb-4" style={{ fontWeight: 700 }}>Riwayat Quiz</h4>
                                    <div className="space-y-2">
                                      {internQuizResults.sort((a: any, b: any) => b.completedAt?.localeCompare(a.completedAt || '')).map((r: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                                          <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs text-white ${(r.percentage || 0) >= 80 ? 'bg-green-500' : (r.percentage || 0) >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ fontWeight: 700 }}>
                                              {idx + 1}
                                            </div>
                                            <div>
                                              <p className="text-sm text-gray-900" style={{ fontWeight: 600 }}>{r.score}/{r.totalQuestions} benar</p>
                                              <p className="text-[10px] text-gray-400">
                                                {r.completedAt ? new Date(r.completedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                              </p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className={`text-sm ${(r.percentage || 0) >= 80 ? 'text-green-600' : (r.percentage || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'}`} style={{ fontWeight: 700 }}>
                                              {r.percentage}%
                                            </p>
                                            <p className="text-[10px] text-gray-400">+{r.pointsEarned} pts</p>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )
                    ) : (
                      <div className="rounded-[24px] p-12 bg-white/70 border border-white/80 text-center">
                        <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500 text-sm">Pilih intern untuk melihat detail</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MATERIALS TAB */}
          {activeTab === 'materials' && (
            <div className="p-4 lg:p-8">
              <div className="mb-6">
                <h1 className="text-2xl lg:text-3xl text-gray-900 mb-1" style={{ fontWeight: 700 }}>Materi Belajar</h1>
                <p className="text-gray-500 text-sm">Upload dan kelola materi PDF untuk intern</p>
              </div>
              <div className="grid lg:grid-cols-2 gap-5">
                {/* Upload */}
                <div className="rounded-[24px] p-6 bg-white/70 border border-white/80">
                  <div className="text-center mb-4">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-[#800000]/5 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-[#800000]/40" />
                    </div>
                    <h3 className="text-gray-900 text-sm" style={{ fontWeight: 700 }}>Upload Materi PDF</h3>
                    <p className="text-xs text-gray-500 mt-1">Materi akan otomatis tersedia untuk intern</p>
                  </div>
                  <div className="space-y-3">
                    <input type="text" value={materialTitle} onChange={(e) => setMaterialTitle(e.target.value)}
                      placeholder="Judul materi..."
                      className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-[#800000]/20" />
                    <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) handleUploadMaterial(e.target.files[0]); }} />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingMaterial || !materialTitle.trim()}
                      className={`w-full py-2.5 rounded-xl bg-gradient-to-r from-[#800000] to-[#cc0000] text-white text-sm transition-all flex items-center justify-center gap-2 ${!materialTitle.trim() || uploadingMaterial ? 'opacity-50' : ''}`}
                      style={{ fontWeight: 600 }}>
                      {uploadingMaterial ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploadingMaterial ? 'Mengupload...' : 'Pilih File PDF'}
                    </button>
                  </div>
                </div>

                {/* List */}
                <div className="rounded-[24px] p-5 bg-white/70 border border-white/80">
                  <h3 className="text-gray-900 mb-4 text-sm" style={{ fontWeight: 700 }}>Materi Terupload ({materials.length})</h3>
                  {materials.length === 0 ? (
                    <p className="text-gray-400 text-sm text-center py-6">Belum ada materi</p>
                  ) : (
                    <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
                      {materials.map((m: any) => (
                        <div key={m.id} className="p-3.5 rounded-2xl bg-gray-50 hover:bg-gray-100 transition-all flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5 text-red-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 text-sm truncate" style={{ fontWeight: 600 }}>{m.title}</p>
                            <p className="text-gray-400 text-xs">{m.fileSize} • {m.uploadedAt ? new Date(m.uploadedAt).toLocaleDateString('id-ID') : ''}</p>
                          </div>
                          {m.url && (
                            <a href={m.url} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-white transition-all">
                              <Eye className="w-4 h-4 text-gray-400" />
                            </a>
                          )}
                          <button onClick={() => handleDeleteMaterial(m.id)} className="p-2 rounded-lg hover:bg-red-50 transition-all">
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* QUIZ TAB */}
          {activeTab === 'quiz' && (
            <div className="p-4 lg:p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-2xl lg:text-3xl text-gray-900 mb-1" style={{ fontWeight: 700 }}>Kelola Quiz</h1>
                  <p className="text-gray-500 text-sm">Buat dan update soal quiz ({quizQuestions.length} soal)</p>
                </div>
                <button onClick={handleSaveQuestions} disabled={savingQuiz}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-500 to-green-600 text-white text-sm flex items-center gap-2 transition-all hover:shadow-md"
                  style={{ fontWeight: 600 }}>
                  {savingQuiz ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Simpan
                </button>
              </div>

              <div className="rounded-[24px] p-5 bg-white/70 border border-white/80">
                <button onClick={() => setShowAddQuestion(true)}
                  className="w-full py-3 rounded-2xl border-2 border-dashed border-[#800000]/30 text-[#800000] text-sm flex items-center justify-center gap-2 mb-5 transition-all hover:border-[#800000]/60 hover:bg-[#800000]/5"
                  style={{ fontWeight: 600 }}>
                  <Plus className="w-5 h-5" /> Tambah Soal Manual
                </button>

                {/* Add question form */}
                {showAddQuestion && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                    className="mb-5 p-4 rounded-2xl bg-blue-50 border border-blue-100 space-y-3">
                    <input type="text" value={newQuestion.question} onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                      placeholder="Tulis pertanyaan..." className="w-full px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    {newQuestion.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="radio" name="correct" checked={newQuestion.correctAnswer === i}
                          onChange={() => setNewQuestion({ ...newQuestion, correctAnswer: i })}
                          className="accent-green-600" />
                        <input type="text" value={opt}
                          onChange={(e) => { const opts = [...newQuestion.options]; opts[i] = e.target.value; setNewQuestion({ ...newQuestion, options: opts }); }}
                          placeholder={`Opsi ${String.fromCharCode(65 + i)}`}
                          className="flex-1 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm focus:outline-none" />
                      </div>
                    ))}
                    <div className="flex gap-2">
                      <button onClick={() => setShowAddQuestion(false)}
                        className="flex-1 py-2 rounded-xl bg-gray-200 text-gray-700 text-sm" style={{ fontWeight: 600 }}>Batal</button>
                      <button onClick={addNewQuestion}
                        className="flex-1 py-2 rounded-xl bg-blue-500 text-white text-sm" style={{ fontWeight: 600 }}>Tambah</button>
                    </div>
                  </motion.div>
                )}

                {quizQuestions.length === 0 && (
                  <div className="text-center py-10">
                    <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">Belum ada soal. Gunakan Generate AI atau tambah manual.</p>
                  </div>
                )}

                <div className="space-y-3">
                  {quizQuestions.map((q: any, idx: number) => (
                    <div key={q.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <p className="text-gray-900 text-sm" style={{ fontWeight: 600 }}>
                          <span className="inline-block w-6 h-6 rounded-lg bg-[#800000]/10 text-[#800000] text-xs text-center leading-6 mr-2" style={{ fontWeight: 700 }}>{idx + 1}</span>
                          {q.question}
                        </p>
                        <button onClick={() => deleteQuestion(q.id)}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-red-400 transition-all shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="space-y-1 ml-8">
                        {q.options.map((opt: string, i: number) => (
                          <p key={i} className={`text-xs px-2 py-1 rounded-lg ${i === q.correctAnswer ? 'bg-green-50 text-green-700' : 'text-gray-500'}`}
                            style={{ fontWeight: i === q.correctAnswer ? 600 : 400 }}>
                            {i === q.correctAnswer ? '✓ ' : ''}{String.fromCharCode(65 + i)}. {opt}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}