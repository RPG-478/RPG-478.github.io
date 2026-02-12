import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ACHIEVEMENTS } from '../data/achievements';

// ===== Sparkle SVG path (4-pointed star) =====
const SPARKLE_PATH =
  'M26.5 25.5C19.0043 33.3697 0 34 0 34C0 34 19.1013 35.3684 26.5 43.5C33.234 50.901 34 68 34 68C34 68 36.9884 50.7065 44.5 43.5C51.6431 36.647 68 34 68 34C68 34 51.6947 32.0939 44.5 25.5C36.5605 18.2235 34 0 34 0C34 0 33.6591 17.9837 26.5 25.5Z';

interface Sparkle {
  id: string;
  x: number; // % from center-ish
  y: number; // % from center-ish
  size: number;
  color: string;
  delay: number;
  duration: number;
}

const COLORS = ['#FFC700', '#FFD700', '#FFAA00', '#FFE066', '#FFFFFF', '#FFA0FF', '#60A5FA'];

function generateSparkles(count: number): Sparkle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}-${Date.now()}`,
    x: (Math.random() - 0.5) * 80,
    y: (Math.random() - 0.5) * 60,
    size: Math.random() * 16 + 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    delay: Math.random() * 0.6,
    duration: 0.6 + Math.random() * 0.5,
  }));
}

// ===== TitleUnlockOverlay =====
interface TitleUnlockOverlayProps {
  title: string | null;
}

export const TitleUnlockOverlay: React.FC<TitleUnlockOverlayProps> = ({ title }) => {
  const [visible, setVisible] = useState(false);
  const [displayTitle, setDisplayTitle] = useState<string | null>(null);
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    if (title) {
      setDisplayTitle(title);
      setVisible(true);
      setPhase('enter');
      setSparkles(generateSparkles(20));

      const enterTimer = setTimeout(() => setPhase('show'), 100);
      const exitTimer = setTimeout(() => setPhase('exit'), 2800);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        setDisplayTitle(null);
      }, 3500);

      return () => {
        clearTimeout(enterTimer);
        clearTimeout(exitTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [title]);

  if (!visible || !displayTitle) return null;

  return (
    <div
      className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center"
      style={{
        perspective: '600px',
      }}
    >
      {/* Background dim overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)',
          opacity: phase === 'show' ? 1 : phase === 'enter' ? 0 : 0,
          transition: 'opacity 0.4s ease-out',
        }}
      />

      {/* Sparkle particles */}
      {sparkles.map((sp) => (
        <div
          key={sp.id}
          className="absolute"
          style={{
            left: `calc(50% + ${sp.x}%)`,
            top: `calc(50% + ${sp.y}%)`,
            width: sp.size,
            height: sp.size,
            animation: `sparkle-appear ${sp.duration}s ease-out ${sp.delay}s both`,
          }}
        >
          <svg
            width={sp.size}
            height={sp.size}
            viewBox="0 0 68 68"
            fill="none"
            style={{
              animation: `sparkle-spin ${sp.duration * 1.5}s linear ${sp.delay}s both`,
              filter: `drop-shadow(0 0 4px ${sp.color})`,
            }}
          >
            <path d={SPARKLE_PATH} fill={sp.color} />
          </svg>
        </div>
      ))}

      {/* Glowing ring burst */}
      <div
        className="absolute"
        style={{
          width: 200,
          height: 200,
          borderRadius: '50%',
          border: '2px solid rgba(255, 199, 0, 0.6)',
          boxShadow: '0 0 40px rgba(255, 199, 0, 0.3), inset 0 0 40px rgba(255, 199, 0, 0.1)',
          animation: phase !== 'enter' ? 'ring-burst 1s ease-out 0.1s both' : 'none',
          opacity: phase === 'exit' ? 0 : 1,
          transition: 'opacity 0.5s',
        }}
      />

      {/* Title card */}
      <div
        className="relative flex flex-col items-center gap-2"
        style={{
          transform:
            phase === 'enter'
              ? 'scale(0.3) translateY(30px) rotateX(20deg)'
              : phase === 'show'
              ? 'scale(1) translateY(0) rotateX(0deg)'
              : 'scale(0.8) translateY(-20px) rotateX(-10deg)',
          opacity: phase === 'enter' ? 0 : phase === 'show' ? 1 : 0,
          transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out',
        }}
      >
        {/* Sub label */}
        <div
          className="text-[10px] tracking-[0.3em] uppercase font-mono"
          style={{
            color: '#FFC700',
            textShadow: '0 0 10px rgba(255, 199, 0, 0.5)',
            animation: 'text-glow 2s ease-in-out infinite alternate',
          }}
        >
          ★ TITLE UNLOCKED ★
        </div>

        {/* Main title */}
        <div
          className="text-2xl md:text-3xl font-black tracking-tight text-center"
          style={{
            background: 'linear-gradient(135deg, #FFC700 0%, #FFFFFF 40%, #FFC700 60%, #FFE066 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 20px rgba(255, 199, 0, 0.5))',
          }}
        >
          {displayTitle}
        </div>

        {/* Decorative line */}
        <div
          className="h-[1px] mt-1"
          style={{
            width: phase === 'show' ? 200 : 0,
            background: 'linear-gradient(90deg, transparent, #FFC700, transparent)',
            transition: 'width 0.6s ease-out 0.3s',
          }}
        />
      </div>
    </div>
  );
};

// ===== TitleGallery =====

interface TitleGalleryProps {
  unlockedKeys: Set<string>;
  onClose: () => void;
}

export const TitleGallery: React.FC<TitleGalleryProps> = ({ unlockedKeys, onClose }) => {
  const [closing, setClosing] = useState(false);
  const unlockedCount = ACHIEVEMENTS.filter((t) => unlockedKeys.has(t.key)).length;

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, 300);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center pointer-events-auto"
      style={{
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(6px)',
        opacity: closing ? 0 : 1,
        transition: 'opacity 0.3s',
      }}
      onClick={handleClose}
    >
      <div
        className="relative w-[90vw] max-w-md max-h-[80vh] overflow-y-auto rounded-xl border border-gray-700 bg-gray-950/95 p-5"
        style={{
          transform: closing ? 'scale(0.9) translateY(20px)' : 'scale(1) translateY(0)',
          transition: 'transform 0.3s',
          boxShadow: '0 0 60px rgba(255, 199, 0, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-yellow-400 font-mono tracking-wide">🏆 称号一覧</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {unlockedCount} / {ACHIEVEMENTS.length} 解放済み
            </p>
          </div>
          <button
            className="text-gray-500 hover:text-white transition-colors text-xl leading-none px-2"
            onClick={handleClose}
          >
            ✕
          </button>
        </div>

        {/* Title list */}
        <div className="flex flex-col gap-2">
          {ACHIEVEMENTS.map((t) => {
            const unlocked = unlockedKeys.has(t.key);
            return (
              <div
                key={t.key}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg border transition-all ${
                  unlocked
                    ? 'border-yellow-700/50 bg-yellow-900/20'
                    : 'border-gray-800 bg-gray-900/40 opacity-50'
                }`}
              >
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm"
                  style={{
                    background: unlocked
                      ? 'linear-gradient(135deg, #FFC700, #FFE066)'
                      : '#1a1a1a',
                    color: unlocked ? '#000' : '#333',
                    boxShadow: unlocked ? '0 0 12px rgba(255, 199, 0, 0.3)' : 'none',
                  }}
                >
                  {unlocked ? '★' : '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-bold font-mono ${unlocked ? 'text-yellow-300' : 'text-gray-600'}`}
                  >
                    {unlocked ? t.label : '???'}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">
                    {unlocked ? t.requirement : '条件を満たすと解放されます'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="mt-4 pt-3 border-t border-gray-800">
          <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                  width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%`,
                background: 'linear-gradient(90deg, #FFC700, #FFE066)',
                boxShadow: '0 0 8px rgba(255, 199, 0, 0.4)',
              }}
            />
          </div>
          <p className="text-[10px] text-gray-600 text-center mt-1">
              COMPLETION: {((unlockedCount / ACHIEVEMENTS.length) * 100).toFixed(0)}%
          </p>
        </div>
      </div>
    </div>
  );
};
