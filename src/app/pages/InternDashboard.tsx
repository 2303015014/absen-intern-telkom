import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { 
  Camera, MapPin, Clock, Calendar, LogOut, Trophy, FileText, 
  CheckCircle, XCircle, Loader2, BookOpen, Download, Eye, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import telkomLogo from "../../assets/logotelkom.png";
import * as api from '../lib/api';
import jsPDF from 'jspdf';

interface AttendanceRecord {
  date: string;
  clockIn?: string;
  clockOut?: string;
  locationIn?: { lat: number; lng: number; address: string };
  locationOut?: { lat: number; lng: number; address: string };
  photoIn?: string;
  photoOut?: string;
  report?: string;
  status: string;
}

export default function InternDashboard() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [internName] = useState(() => localStorage.getItem('internName') || '');
  const [userData, setUserData] = useState<any>(null);
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [dailyReport, setDailyReport] = useState('');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [cameraMode, setCameraMode] = useState<'clockin' | 'clockout'>('clockin');
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [materials, setMaterials] = useState<any[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [logbookMonth, setLogbookMonth] = useState(new Date().getMonth());
  const [logbookYear, setLogbookYear] = useState(new Date().getFullYear());
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null);
  const [pdfLoadError, setPdfLoadError] = useState(false);

  const now = new Date();
  const [currentTime, setCurrentTime] = useState(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
  const currentDate = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const greeting = now.getHours() < 12 ? 'Selamat Pagi' : now.getHours() < 17 ? 'Selamat Siang' : 'Selamat Sore';

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (!internName) { navigate('/'); return; }
    const stored = localStorage.getItem('internData');
    if (stored) setUserData(JSON.parse(stored));
  }, [internName, navigate]);

  // Load data
  useEffect(() => {
    if (!internName) return;
    const load = async () => {
      setLoadingData(true);
      try {
        // Get location
        const loc = await api.getAccurateLocation();
        setCurrentLocation(loc);

        // Get attendance history
        const attData = await api.getAttendance(internName);
        const records = attData.attendance || [];
        setAttendanceHistory(records);

        // Check today
        const today = new Date().toISOString().split('T')[0];
        const todayRec = records.find((r: AttendanceRecord) => r.date === today);
        if (todayRec) setTodayAttendance(todayRec);

        // Load materials
        const matsData = await api.getMaterials();
        setMaterials(matsData.materials || []);
      } catch (err) {
        console.error('Load data error:', err);
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [internName]);

  const isClockedIn = todayAttendance?.clockIn && !todayAttendance?.clockOut;
  const isFullyDone = todayAttendance?.clockIn && todayAttendance?.clockOut;

  // Calendar data
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthName = now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const attendanceDates = attendanceHistory.map(a => {
    const d = new Date(a.date);
    return d.getMonth() === month ? d.getDate() : -1;
  }).filter(d => d > 0);

  const startCamera = useCallback(async (mode: 'clockin' | 'clockout') => {
    setCameraMode(mode);
    setCapturedBlob(null);
    setCapturedPreview(null);
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } 
      });
      setCameraStream(stream);
      setCameraUnavailable(false);
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 200);
    } catch (err: any) {
      console.log('Camera error:', err);
      setCameraUnavailable(true);
      setShowCamera(true);
      if (err.name === 'NotAllowedError') {
        setCameraError('Akses kamera ditolak. Izinkan akses kamera di pengaturan browser Anda, lalu coba lagi.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('Kamera tidak ditemukan. Pastikan perangkat Anda memiliki kamera.');
      } else {
        setCameraError('Kamera tidak tersedia. Buka aplikasi ini langsung di browser (bukan dalam iframe) untuk mengaktifkan kamera.');
      }
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Compress image
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Resize to max 640px
        const maxW = 640;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              setCapturedBlob(blob);
              setCapturedPreview(URL.createObjectURL(blob));
            }
          }, 'image/jpeg', 0.5);
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  }, []);

  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
  }, [cameraStream]);

  const capturePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current && videoRef.current.videoWidth > 0) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        // Add timestamp + location overlay
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
        ctx.fillStyle = '#fff';
        ctx.font = '14px system-ui';
        const ts = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
        ctx.fillText(ts, 10, canvas.height - 15);
        if (currentLocation) {
          ctx.fillText(`📍 ${currentLocation.address.substring(0, 50)}`, 10, canvas.height - 28);
        }
        // Compress to ~200KB
        canvas.toBlob((blob) => {
          if (blob) {
            setCapturedBlob(blob);
            setCapturedPreview(URL.createObjectURL(blob));
          }
        }, 'image/jpeg', 0.5);
      }
    }
    stopCamera();
  }, [stopCamera, currentLocation]);

  const handleClockIn = async () => {
    if (!currentLocation) {
      const loc = await api.getAccurateLocation();
      setCurrentLocation(loc);
    }
    setLoading(true);
    try {
      const loc = currentLocation || { lat: 0, lng: 0, address: 'Unknown' };
      const result = await api.clockIn(
        internName, String(loc.lat), String(loc.lng), loc.address, capturedBlob
      );
      if (result.error) { alert(result.error); setLoading(false); return; }
      setTodayAttendance(result.attendance);
      setCapturedBlob(null);
      setCapturedPreview(null);
      setSuccessMsg(`Clock In berhasil! Lokasi: ${loc.address.substring(0, 50)}...`);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      alert('Clock In gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!dailyReport.trim()) { alert('Harap isi laporan kegiatan harian!'); return; }
    if (!currentLocation) {
      const loc = await api.getAccurateLocation();
      setCurrentLocation(loc);
    }
    setLoading(true);
    try {
      const loc = currentLocation || { lat: 0, lng: 0, address: 'Unknown' };
      const result = await api.clockOut(
        internName, String(loc.lat), String(loc.lng), loc.address, dailyReport, capturedBlob
      );
      if (result.error) { alert(result.error); setLoading(false); return; }
      setTodayAttendance(result.attendance);
      setCapturedBlob(null);
      setCapturedPreview(null);
      setDailyReport('');
      setSuccessMsg('Clock Out berhasil! Laporan harian tersimpan.');
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    } catch (err: any) {
      alert('Clock Out gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Find selected day's attendance
  const selectedDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  const selectedAttendance = attendanceHistory.find(a => a.date === selectedDate);

  if (loadingData) {
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
      <canvas ref={canvasRef} className="hidden" />

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div initial={{ opacity: 0, y: -50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -50 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-green-500 text-white shadow-[0_8px_32px_rgba(34,197,94,0.3)] flex items-center gap-2 max-w-sm">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm" style={{ fontWeight: 600 }}>{successMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-gradient-to-r from-[#800000] to-[#cc0000] text-white px-6 pt-6 pb-8 rounded-b-[32px] shadow-[0_8px_32px_rgba(128,0,0,0.2)]">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/95 flex items-center justify-center p-1.5 shadow-lg">
                <img src={telkomLogo} alt="Telkom" className="w-full h-full object-contain" />
              </div>
              <div>
                <p className="text-white/70 text-xs">{greeting},</p>
                <h2 className="text-lg text-white" style={{ fontWeight: 700 }}>{internName}</h2>
              </div>
            </div>
            <button onClick={() => { localStorage.clear(); navigate('/'); }}
              className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-xl hover:bg-white/20 transition-all">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1 rounded-full text-xs ${
              isFullyDone ? 'bg-blue-500/30 text-blue-200' :
              isClockedIn ? 'bg-green-500/30 text-green-200' : 'bg-white/15 text-white/70'
            }`} style={{ fontWeight: 600 }}>
              {isFullyDone ? '● Sudah Selesai' : isClockedIn ? '● Sudah Clock In' : '○ Belum Clock In'}
            </div>
            {todayAttendance?.clockIn && (
              <span className="text-white/60 text-xs">sejak {todayAttendance.clockIn}</span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-5 space-y-5 pb-24">
        {/* Time & Date */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-[24px] p-5 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs mb-1">{currentDate}</p>
              <p className="text-3xl text-[#800000]" style={{ fontWeight: 700 }}>{currentTime}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#800000]/5 flex items-center justify-center">
              <Clock className="w-6 h-6 text-[#800000]/40" />
            </div>
          </div>
          {/* Location */}
          {currentLocation && (
            <div className="flex items-start gap-2 mt-3 pt-3 border-t border-gray-100">
              <MapPin className="w-4 h-4 text-[#800000] shrink-0 mt-0.5" />
              <p className="text-gray-500 text-xs leading-relaxed">{currentLocation.address}</p>
            </div>
          )}
        </motion.div>

        {/* Calendar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-[24px] p-5 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-[#800000]" />
            <h3 className="text-gray-900" style={{ fontWeight: 700 }}>{monthName}</h3>
            <span className="ml-auto text-xs text-gray-400">{attendanceDates.length} hari hadir</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'].map((day) => (
              <div key={day} className="text-center text-[10px] text-gray-400 pb-1" style={{ fontWeight: 600 }}>{day}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === now.getDate();
              const hasAtt = attendanceDates.includes(day);
              const isSel = day === selectedDay;
              return (
                <button key={day} onClick={() => setSelectedDay(day)}
                  className={`aspect-square rounded-xl flex items-center justify-center text-xs transition-all
                    ${isSel ? 'bg-gradient-to-br from-[#800000] to-[#cc0000] text-white shadow-md scale-110' : ''}
                    ${isToday && !isSel ? 'ring-2 ring-[#800000]/30 bg-[#800000]/10 text-[#800000]' : ''}
                    ${hasAtt && !isSel && !isToday ? 'bg-green-100 text-green-700' : ''}
                    ${!hasAtt && !isSel && !isToday ? 'text-gray-400 hover:bg-gray-50' : ''}
                  `}
                  style={{ fontWeight: hasAtt || isToday || isSel ? 600 : 400 }}>
                  {day}
                </button>
              );
            })}
          </div>

          {selectedAttendance && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Clock In</span>
                <span className="text-gray-900" style={{ fontWeight: 600 }}>{selectedAttendance.clockIn}</span>
              </div>
              {selectedAttendance.clockOut && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Clock Out</span>
                  <span className="text-gray-900" style={{ fontWeight: 600 }}>{selectedAttendance.clockOut}</span>
                </div>
              )}
              {selectedAttendance.locationIn && (
                <div className="flex items-start gap-2 text-xs text-gray-500">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-[#800000]" />
                  <span>{selectedAttendance.locationIn.address}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                  selectedAttendance.status === 'approved' ? 'bg-green-100 text-green-700' :
                  selectedAttendance.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`} style={{ fontWeight: 600 }}>
                  {selectedAttendance.status === 'approved' ? 'Approved' : 
                   selectedAttendance.status === 'pending' ? 'Pending Approval' : 'Clocked In'}
                </span>
              </div>
              {selectedAttendance.report && (
                <div className="p-3 rounded-xl bg-gray-50 text-sm text-gray-600">{selectedAttendance.report}</div>
              )}
            </motion.div>
          )}
        </motion.div>

        {/* Clock In/Out */}
        {!isFullyDone && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-[24px] p-5 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
            <h3 className="text-gray-900 mb-4" style={{ fontWeight: 700 }}>
              {isClockedIn ? 'Clock Out — Foto & Laporan' : 'Clock In — Foto Absen'}
            </h3>

            {/* Camera / Preview */}
            <div className="relative rounded-2xl overflow-hidden mb-4 bg-gray-900 aspect-[4/3]">
              {showCamera && cameraUnavailable ? (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 p-6">
                  <div className="text-center">
                    <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p className="text-white text-sm mb-2" style={{ fontWeight: 600 }}>Kamera Tidak Tersedia</p>
                    <p className="text-white/60 text-xs leading-relaxed mb-4">{cameraError}</p>
                    <div className="flex gap-2">
                      <button onClick={stopCamera}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 text-white text-xs" style={{ fontWeight: 600 }}>
                        Tutup
                      </button>
                      <button onClick={() => { stopCamera(); startCamera(cameraMode); }}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-[#800000] text-white text-xs" style={{ fontWeight: 600 }}>
                        Coba Lagi
                      </button>
                    </div>
                  </div>
                </div>
              ) : showCamera ? (
                <div className="absolute inset-0">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-end justify-center pb-6">
                    <button onClick={capturePhoto}
                      className="w-16 h-16 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-105 transition-transform">
                      <div className="w-14 h-14 rounded-full border-4 border-[#800000]" />
                    </button>
                  </div>
                  <button onClick={stopCamera} className="absolute top-3 right-3 p-2 rounded-xl bg-black/40 text-white">
                    <XCircle className="w-5 h-5" />
                  </button>
                  {/* GPS overlay */}
                  {currentLocation && (
                    <div className="absolute bottom-2 left-2 right-16 px-3 py-1.5 rounded-lg bg-black/50 text-white text-[10px] flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      <span className="truncate">{currentLocation.address}</span>
                    </div>
                  )}
                </div>
              ) : capturedPreview ? (
                <div className="absolute inset-0">
                  {capturedPreview !== 'demo' ? (
                    <img src={capturedPreview} alt="Captured" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-green-800 to-green-900">
                      <CheckCircle className="w-16 h-16 text-green-400" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3 px-3 py-1 rounded-xl bg-green-500/90 text-white text-xs" style={{ fontWeight: 600 }}>
                    Foto siap
                  </div>
                  <button onClick={() => { setCapturedBlob(null); setCapturedPreview(null); }}
                    className="absolute top-3 left-3 px-3 py-1 rounded-xl bg-black/40 text-white text-xs">
                    Ulang
                  </button>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                  <div className="text-center">
                    <Camera className="w-12 h-12 text-white/20 mx-auto mb-2" />
                    <p className="text-white/40 text-sm">Klik tombol untuk membuka kamera</p>
                  </div>
                </div>
              )}
            </div>

            {/* Location info */}
            <div className="space-y-2 mb-4">
              <div className="flex items-start gap-2 text-sm text-gray-500">
                <MapPin className="w-4 h-4 text-[#800000] shrink-0 mt-0.5" />
                <span className="text-xs">{currentLocation?.address || 'Mendeteksi lokasi...'}</span>
              </div>
            </div>

            {/* Actions */}
            {!showCamera && !capturedPreview && (
              <button onClick={() => startCamera(isClockedIn ? 'clockout' : 'clockin')}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#800000] to-[#cc0000] text-white transition-all flex items-center justify-center gap-2"
                style={{ fontWeight: 600 }}>
                <Camera className="w-5 h-5" /> Buka Kamera
              </button>
            )}

            {capturedPreview && !isClockedIn && (
              <button onClick={handleClockIn} disabled={loading}
                className={`w-full py-3.5 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 text-white transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-60' : ''}`}
                style={{ fontWeight: 600 }}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                {loading ? 'Memproses...' : 'Konfirmasi Clock In'}
              </button>
            )}
          </motion.div>
        )}

        {/* Daily Report - when clocked in */}
        {isClockedIn && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-[24px] p-5 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-5 h-5 text-[#800000]" />
              <h3 className="text-gray-900" style={{ fontWeight: 700 }}>Laporan Kegiatan Harian</h3>
            </div>
            <p className="text-gray-400 text-xs mb-3">Wajib diisi sebelum Clock Out</p>
            <textarea value={dailyReport} onChange={(e) => setDailyReport(e.target.value)}
              placeholder="Tuliskan kegiatan yang Anda kerjakan hari ini..."
              className="w-full h-28 px-4 py-3 rounded-2xl bg-white/80 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#800000]/20 resize-none text-sm" />

            {capturedPreview && dailyReport.trim() && (
              <button onClick={handleClockOut} disabled={loading}
                className={`w-full mt-3 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white transition-all flex items-center justify-center gap-2 ${loading ? 'opacity-60' : ''}`}
                style={{ fontWeight: 600 }}>
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                {loading ? 'Memproses...' : 'Konfirmasi Clock Out'}
              </button>
            )}

            {!capturedPreview && dailyReport.trim() && (
              <button onClick={() => startCamera('clockout')}
                className="w-full mt-3 py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-red-500 text-white transition-all flex items-center justify-center gap-2"
                style={{ fontWeight: 600 }}>
                <Camera className="w-5 h-5" /> Foto untuk Clock Out
              </button>
            )}
          </motion.div>
        )}

        {/* Done message */}
        {isFullyDone && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-[24px] p-5 bg-green-50 border border-green-100 text-center">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-green-800 text-sm" style={{ fontWeight: 600 }}>Absensi hari ini sudah selesai!</p>
            <p className="text-green-600 text-xs mt-1">Clock In: {todayAttendance?.clockIn} — Clock Out: {todayAttendance?.clockOut}</p>
          </motion.div>
        )}

        {/* Materi Belajar */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="rounded-[24px] p-5 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-[#800000]" />
            <h3 className="text-gray-900" style={{ fontWeight: 700 }}>Materi Belajar</h3>
            <span className="ml-auto text-xs text-gray-400">{materials.length} materi</span>
          </div>
          {materials.length === 0 ? (
            <div className="text-center py-6">
              <BookOpen className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-gray-400 text-sm">Belum ada materi dari mentor</p>
            </div>
          ) : (
            <div className="space-y-2.5">
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
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setPdfLoadError(false); setPdfViewer({ url: m.url, title: m.title }); }}
                        className="p-2.5 rounded-xl bg-[#800000]/10 hover:bg-[#800000]/20 transition-all"
                        title="Buka PDF">
                        <Eye className="w-4 h-4 text-[#800000]" />
                      </button>
                      <a href={m.url} download
                        className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all"
                        title="Download PDF">
                        <Download className="w-4 h-4 text-gray-500" />
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Download Logbook PDF */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
          className="rounded-[24px] p-5 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.05)]">
          <div className="flex items-center gap-2 mb-4">
            <Download className="w-5 h-5 text-[#800000]" />
            <h3 className="text-gray-900" style={{ fontWeight: 700 }}>Rekap Logbook Bulanan</h3>
          </div>
          <p className="text-gray-400 text-xs mb-3">Download rekap absensi & laporan harian dalam PDF</p>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => {
              if (logbookMonth === 0) { setLogbookMonth(11); setLogbookYear(y => y - 1); }
              else setLogbookMonth(m => m - 1);
            }} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all">
              <ChevronLeft className="w-4 h-4 text-gray-600" />
            </button>
            <div className="flex-1 text-center">
              <p className="text-gray-900 text-sm" style={{ fontWeight: 600 }}>
                {new Date(logbookYear, logbookMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            <button onClick={() => {
              if (logbookMonth === 11) { setLogbookMonth(0); setLogbookYear(y => y + 1); }
              else setLogbookMonth(m => m + 1);
            }} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-all">
              <ChevronRight className="w-4 h-4 text-gray-600" />
            </button>
          </div>
          <button
            onClick={async () => {
              setGeneratingPdf(true);
              try {
                const monthRecords = attendanceHistory.filter(a => {
                  const d = new Date(a.date);
                  return d.getMonth() === logbookMonth && d.getFullYear() === logbookYear;
                }).sort((a, b) => a.date.localeCompare(b.date));

                const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
                const pageW = doc.internal.pageSize.getWidth();
                const margin = 15;
                let y = 20;

                // Header
                doc.setFontSize(16);
                doc.setFont('helvetica', 'bold');
                doc.text('REKAP LOGBOOK MAGANG', pageW / 2, y, { align: 'center' });
                y += 7;
                doc.setFontSize(11);
                doc.text('PT Telkom Indonesia - SDA GSPO', pageW / 2, y, { align: 'center' });
                y += 10;

                doc.setFontSize(10);
                doc.setFont('helvetica', 'normal');
                doc.text(`Nama: ${internName}`, margin, y);
                y += 5;
                const monthLabel = new Date(logbookYear, logbookMonth).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
                doc.text(`Periode: ${monthLabel}`, margin, y);
                y += 5;
                doc.text(`Total Kehadiran: ${monthRecords.length} hari`, margin, y);
                y += 10;

                // Table header
                doc.setFont('helvetica', 'bold');
                doc.setFillColor(128, 0, 0);
                doc.rect(margin, y, pageW - margin * 2, 8, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(8);
                doc.text('No', margin + 2, y + 5.5);
                doc.text('Tanggal', margin + 12, y + 5.5);
                doc.text('Clock In', margin + 45, y + 5.5);
                doc.text('Clock Out', margin + 65, y + 5.5);
                doc.text('Status', margin + 88, y + 5.5);
                doc.text('Laporan Kegiatan', margin + 108, y + 5.5);
                y += 10;
                doc.setTextColor(0, 0, 0);

                if (monthRecords.length === 0) {
                  doc.setFont('helvetica', 'italic');
                  doc.setFontSize(10);
                  doc.text('Tidak ada data kehadiran pada bulan ini.', pageW / 2, y + 10, { align: 'center' });
                } else {
                  monthRecords.forEach((rec, idx) => {
                    if (y > 270) {
                      doc.addPage();
                      y = 20;
                    }
                    const dateStr = new Date(rec.date + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
                    const bg = idx % 2 === 0 ? 245 : 255;
                    doc.setFillColor(bg, bg, bg);
                    const rowH = rec.report ? Math.max(8, Math.ceil((rec.report.length || 0) / 40) * 4 + 4) : 8;
                    doc.rect(margin, y, pageW - margin * 2, rowH, 'F');
                    doc.setFont('helvetica', 'normal');
                    doc.setFontSize(7);
                    doc.text(String(idx + 1), margin + 2, y + 5);
                    doc.text(dateStr, margin + 12, y + 5);
                    doc.text(rec.clockIn || '-', margin + 45, y + 5);
                    doc.text(rec.clockOut || '-', margin + 65, y + 5);
                    const statusText = rec.status === 'approved' ? 'Approved' : rec.status === 'pending' ? 'Pending' : 'Clocked In';
                    doc.text(statusText, margin + 88, y + 5);
                    if (rec.report) {
                      const lines = doc.splitTextToSize(rec.report, 68);
                      doc.text(lines.slice(0, 3), margin + 108, y + 5);
                    }
                    y += rowH + 1;
                  });
                }

                // Footer
                y += 10;
                if (y > 270) { doc.addPage(); y = 20; }
                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(150, 150, 150);
                doc.text(`Digenerate pada ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`, margin, y);

                doc.save(`Logbook_${internName.replace(/\s+/g, '_')}_${monthLabel.replace(/\s+/g, '_')}.pdf`);
                setSuccessMsg('Logbook berhasil didownload!');
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 3000);
              } catch (err) {
                console.error('PDF generation error:', err);
                alert('Gagal membuat PDF logbook');
              } finally {
                setGeneratingPdf(false);
              }
            }}
            disabled={generatingPdf}
            className={`w-full py-3 rounded-2xl bg-gradient-to-r from-[#800000] to-[#cc0000] text-white text-sm flex items-center justify-center gap-2 transition-all hover:shadow-md ${generatingPdf ? 'opacity-60' : ''}`}
            style={{ fontWeight: 600 }}>
            {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generatingPdf ? 'Membuat PDF...' : 'Download Logbook PDF'}
          </button>
        </motion.div>

        {/* Quiz Widget */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          onClick={() => navigate('/quiz')}
          className="rounded-[24px] p-5 bg-gradient-to-br from-[#800000] to-[#cc0000] text-white shadow-[0_8px_32px_rgba(128,0,0,0.15)] cursor-pointer hover:shadow-[0_12px_48px_rgba(128,0,0,0.25)] transition-all active:scale-[0.98]">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xl flex items-center justify-center">
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg" style={{ fontWeight: 700 }}>Quiz Challenge</h3>
              <p className="text-white/70 text-xs">Uji pengetahuan buku saku SDA GSPO</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 backdrop-blur-xl p-3 border border-white/20">
              <p className="text-white/70 text-xs mb-0.5">Total Poin</p>
              <p className="text-2xl" style={{ fontWeight: 700 }}>{userData?.totalPoints || 0}</p>
            </div>
            <div className="rounded-2xl bg-white/10 backdrop-blur-xl p-3 border border-white/20">
              <p className="text-white/70 text-xs mb-0.5">Quiz Selesai</p>
              <p className="text-2xl" style={{ fontWeight: 700 }}>{userData?.quizCount || 0}</p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-white/80">
            <span>Ketuk untuk mulai quiz baru →</span>
          </div>
        </motion.div>
      </div>

      {/* PDF Viewer Modal */}
      <AnimatePresence>
        {pdfViewer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            {/* Modal Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-[#800000] to-[#cc0000] text-white shrink-0">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate" style={{ fontWeight: 600 }}>{pdfViewer.title}</p>
                <p className="text-white/60 text-xs">Materi Belajar</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={pdfViewer.url}
                  download
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all"
                  title="Download PDF">
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => setPdfViewer(null)}
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 transition-all"
                  title="Tutup">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* PDF Content */}
            <div className="flex-1 relative overflow-hidden">
              {pdfLoadError ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 gap-4 p-6">
                  <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-red-500" />
                  </div>
                  <div className="text-center">
                    <p className="text-gray-900 text-sm mb-1" style={{ fontWeight: 600 }}>PDF tidak bisa ditampilkan di sini</p>
                    <p className="text-gray-400 text-xs mb-4">Browser membatasi tampilan PDF dari sumber eksternal. Gunakan tombol download untuk membuka file.</p>
                  </div>
                  <div className="flex gap-3 w-full max-w-xs">
                    <a
                      href={pdfViewer.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-3 rounded-2xl bg-[#800000] text-white text-sm flex items-center justify-center gap-2"
                      style={{ fontWeight: 600 }}>
                      <Eye className="w-4 h-4" /> Buka di Tab Baru
                    </a>
                    <a
                      href={pdfViewer.url}
                      download
                      className="flex-1 py-3 rounded-2xl bg-gray-200 text-gray-700 text-sm flex items-center justify-center gap-2"
                      style={{ fontWeight: 600 }}>
                      <Download className="w-4 h-4" /> Download
                    </a>
                  </div>
                </div>
              ) : (
                <iframe
                  key={pdfViewer.url}
                  src={`https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(pdfViewer.url)}`}
                  className="w-full h-full border-none"
                  title={pdfViewer.title}
                  onError={() => setPdfLoadError(true)}
                  allow="fullscreen"
                />
              )}
            </div>

            {/* Bottom bar with fallback */}
            {!pdfLoadError && (
              <div className="px-4 py-2 bg-gray-900 text-white/50 text-xs text-center shrink-0">
                Jika PDF tidak muncul, klik{' '}
                <button
                  onClick={() => setPdfLoadError(true)}
                  className="underline text-white/70">
                  di sini untuk opsi lain
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}