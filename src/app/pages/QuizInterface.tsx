import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Check, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import telkomLogo from "../../assets/logotelkom.png";
import * as api from '../lib/api';

interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
}

export default function QuizInterface() {
  const navigate = useNavigate();
  const [internName] = useState(() => localStorage.getItem('internName') || '');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [answers, setAnswers] = useState<{ questionId: number; selected: number; correct: boolean }[]>([]);

  useEffect(() => {
    if (!internName) { navigate('/'); return; }
    const load = async () => {
      try {
        const data = await api.getQuizQuestions();
        setQuestions(data.questions || []);
      } catch (err) {
        console.error('Load quiz error:', err);
      } finally {
        setLoadingQuestions(false);
      }
    };
    load();
  }, [internName, navigate]);

  const handleAnswerSelect = (answerIndex: number) => {
    if (isAnswered) return;
    setSelectedAnswer(answerIndex);
    setIsAnswered(true);

    const isCorrect = answerIndex === questions[currentQuestion].correctAnswer;
    if (isCorrect) setScore(s => s + 1);

    setAnswers(prev => [...prev, {
      questionId: questions[currentQuestion].id,
      selected: answerIndex,
      correct: isCorrect,
    }]);

    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(c => c + 1);
        setSelectedAnswer(null);
        setIsAnswered(false);
      } else {
        handleFinish(isCorrect ? score + 1 : score);
      }
    }, 1500);
  };

  const handleFinish = async (finalScore: number) => {
    setSubmitting(true);
    try {
      await api.submitQuizResult(internName, finalScore, questions.length, answers);
      // Update local user data
      const stored = localStorage.getItem('internData');
      if (stored) {
        const user = JSON.parse(stored);
        user.totalPoints = (user.totalPoints || 0) + finalScore * 20;
        user.quizCount = (user.quizCount || 0) + 1;
        localStorage.setItem('internData', JSON.stringify(user));
      }
    } catch (err) {
      console.error('Submit quiz error:', err);
    } finally {
      setSubmitting(false);
      setShowResults(true);
    }
  };

  const restartQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setScore(0);
    setShowResults(false);
    setAnswers([]);
  };

  if (loadingQuestions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#800000] mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Memuat soal quiz...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-100 p-6">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Belum ada soal quiz tersedia.</p>
          <button onClick={() => navigate('/intern')}
            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#800000] to-[#cc0000] text-white" style={{ fontWeight: 600 }}>
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;

  if (showResults) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-6" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-lg">
          <div className="rounded-[32px] p-8 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_8px_32px_rgba(0,0,0,0.08)] text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-[#800000] to-[#cc0000] flex items-center justify-center">
              <span className="text-3xl text-white" style={{ fontWeight: 700 }}>{percentage}%</span>
            </div>
            <h2 className="text-3xl text-gray-900 mb-2" style={{ fontWeight: 700 }}>Quiz Selesai!</h2>
            <p className="text-gray-600 mb-6">Skor kamu {score} dari {questions.length} soal</p>

            <div className="rounded-2xl bg-gradient-to-r from-[#800000]/10 to-[#cc0000]/10 p-4 mb-6">
              <p className="text-[#800000] text-sm mb-1">Poin diperoleh</p>
              <p className="text-3xl text-[#800000]" style={{ fontWeight: 700 }}>+{score * 20}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="rounded-2xl bg-green-50 p-4 border border-green-100">
                <p className="text-green-600 text-sm mb-1">Benar</p>
                <p className="text-3xl text-green-700" style={{ fontWeight: 700 }}>{score}</p>
              </div>
              <div className="rounded-2xl bg-red-50 p-4 border border-red-100">
                <p className="text-red-600 text-sm mb-1">Salah</p>
                <p className="text-3xl text-red-700" style={{ fontWeight: 700 }}>{questions.length - score}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={restartQuiz}
                className="flex-1 py-4 rounded-2xl bg-white/80 border border-gray-200 text-gray-700 hover:bg-white transition-all" style={{ fontWeight: 600 }}>
                Coba Lagi
              </button>
              <button onClick={() => navigate('/intern')}
                className="flex-1 py-4 rounded-2xl bg-gradient-to-r from-[#800000] to-[#cc0000] text-white transition-all" style={{ fontWeight: 600 }}>
                Kembali
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  const question = questions[currentQuestion];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#800000] to-[#cc0000] text-white p-6 rounded-b-[32px] shadow-[0_8px_32px_rgba(128,0,0,0.2)]">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <button onClick={() => navigate('/intern')}
              className="p-2.5 rounded-2xl bg-white/10 backdrop-blur-xl hover:bg-white/20 transition-all">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-white/90 p-1 flex items-center justify-center">
              <img src={telkomLogo} alt="Telkom" className="w-full h-full object-contain" />
            </div>
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-2xl" style={{ fontWeight: 700 }}>Quiz Challenge</h2>
              <p className="text-white/80 text-sm">Soal {currentQuestion + 1} dari {questions.length}</p>
            </div>
            <div className="text-right">
              <p className="text-white/70 text-xs">Skor</p>
              <p className="text-2xl" style={{ fontWeight: 700 }}>{score}</p>
            </div>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }} className="h-full bg-white rounded-full" />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="max-w-2xl mx-auto p-6">
        <AnimatePresence mode="wait">
          <motion.div key={currentQuestion}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
            <div className="rounded-[28px] p-8 bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_4px_24px_rgba(0,0,0,0.05)] mb-6">
              <h3 className="text-xl text-gray-900 leading-relaxed" style={{ fontWeight: 700 }}>
                {question.question}
              </h3>
            </div>

            <div className="space-y-4">
              {question.options.map((option, index) => {
                const isCorrect = index === question.correctAnswer;
                const isSelected = index === selectedAnswer;
                const showFeedback = isAnswered && isSelected;
                const showCorrectHighlight = isAnswered && isCorrect && !isSelected;

                return (
                  <motion.button key={index}
                    whileHover={!isAnswered ? { scale: 1.02, x: 4 } : {}}
                    whileTap={!isAnswered ? { scale: 0.98 } : {}}
                    onClick={() => handleAnswerSelect(index)}
                    disabled={isAnswered}
                    className={`w-full p-6 rounded-[24px] text-left transition-all duration-300 flex items-center gap-4
                      ${!isAnswered ? 'bg-white/70 backdrop-blur-2xl border border-white/80 hover:border-[#800000]/30 cursor-pointer' : ''}
                      ${showFeedback && isCorrect ? 'bg-green-100 border-2 border-green-500 shadow-[0_0_24px_rgba(34,197,94,0.15)]' : ''}
                      ${showFeedback && !isCorrect ? 'bg-red-100 border-2 border-red-500 shadow-[0_0_24px_rgba(239,68,68,0.15)]' : ''}
                      ${showCorrectHighlight ? 'bg-green-50 border-2 border-green-400' : ''}
                      ${isAnswered && !isSelected && !isCorrect ? 'opacity-40' : ''}
                    `}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0
                      ${!isAnswered ? 'bg-gray-100 text-gray-700' : ''}
                      ${showFeedback && isCorrect ? 'bg-green-500 text-white' : ''}
                      ${showFeedback && !isCorrect ? 'bg-red-500 text-white' : ''}
                      ${showCorrectHighlight ? 'bg-green-500 text-white' : ''}
                    `} style={{ fontWeight: 700 }}>
                      {showFeedback || showCorrectHighlight ? (
                        isCorrect ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />
                      ) : String.fromCharCode(65 + index)}
                    </div>
                    <span className={`flex-1
                      ${showFeedback && isCorrect ? 'text-green-900' : ''}
                      ${showFeedback && !isCorrect ? 'text-red-900' : ''}
                      ${showCorrectHighlight ? 'text-green-800' : ''}
                      ${!isAnswered ? 'text-gray-900' : ''}
                    `} style={{ fontWeight: 500 }}>{option}</span>
                  </motion.button>
                );
              })}
            </div>

            <AnimatePresence>
              {isAnswered && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className={`mt-6 p-5 rounded-[24px] backdrop-blur-2xl border-2
                    ${selectedAnswer === question.correctAnswer
                      ? 'bg-green-100/80 border-green-500/50'
                      : 'bg-red-100/80 border-red-500/50'}`}>
                  <p className={`text-center text-sm ${selectedAnswer === question.correctAnswer ? 'text-green-900' : 'text-red-900'}`}
                    style={{ fontWeight: 600 }}>
                    {selectedAnswer === question.correctAnswer
                      ? '✓ Benar! Jawaban tepat!'
                      : `✗ Salah. Jawaban yang benar: ${String.fromCharCode(65 + question.correctAnswer)}. ${question.options[question.correctAnswer]}`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
