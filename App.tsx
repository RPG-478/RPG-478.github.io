import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { DepthMeter } from './components/DepthMeter';
import { CardCalibration } from './components/CardCalibration';
import { SplitRecord } from './types';

// Constants for physics
const FRICTION = 0.96; 
const GRAVITY = 0.8; 
const GRAVITY_DEPTH_SCALE = 0.0001;
const GRAVITY_MAX = 3.0;
const IDLE_GRAVITY_DELAY_MS = 2000;
const MOVING_EPS = 0.1;
const SCROLL_MULTIPLIER = 1.0; 
const DEFAULT_LINE_HEIGHT_PX = 16;
const MAX_VELOCITY = 3000; // Visual normalization only (not a hard cap)
// Default: assume 96 CSS px = 1 inch = 2.54 cm → ~37.8 px per cm
const DEFAULT_PX_PER_CM = 96 / 2.54;

// Milestones for splits (in cm)
const MILESTONES_CM = [100, 500, 1000, 5000, 10000]; // 1m, 5m, 10m, 50m, 100m

const App: React.FC = () => {
  // Game State
  const [depth, setDepth] = useState(0); // in Pixels
  const [velocity, setVelocity] = useState(0);
  const [highScore, setHighScore] = useState(0); // in Pixels
  const [runTime, setRunTime] = useState(0); // ms
  const [splits, setSplits] = useState<SplitRecord[]>([]);
  // 追加: 平均速度・最大速度・加速度・スクロールレベル・スクロール指数
  const [aveSpeed, setAveSpeed] = useState(0); // m/s
  const [maxSpeed, setMaxSpeed] = useState(0); // m/s
  const [totalDistance, setTotalDistance] = useState(0); // m
  const [maxAccel, setMaxAccel] = useState(0); // m/s^2
  const [currentSpeedMps, setCurrentSpeedMps] = useState(0); // m/s
  const [scrollCount, setScrollCount] = useState(0); // 回数
  const [viewportHeightPx, setViewportHeightPx] = useState(0);
  const [inertiaEnabled, setInertiaEnabled] = useState(true);
  const [lineHeightPx, setLineHeightPx] = useState(DEFAULT_LINE_HEIGHT_PX);

  // Calibration system
  const [autoPxPerCm, setAutoPxPerCm] = useState(DEFAULT_PX_PER_CM);
  const [calibratedPxPerCm, setCalibratedPxPerCm] = useState<number | null>(null);
  const [showCalibration, setShowCalibration] = useState(false);
  const [titleToast, setTitleToast] = useState<string | null>(null);

  // 速度・加速度計測用
  const lastVelocity = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const totalDistanceRef = useRef(0); // meters
  const inputDeltaRef = useRef(0);
  const lastScrollDir = useRef(0);
  const titleTimeoutRef = useRef<number | null>(null);
  const unlockedTitlesRef = useRef<Set<string>>(new Set());
  const lastThousandRef = useRef(0);
  const lastMoveTimeRef = useRef<number | null>(null);

  // Refs for physics loop to avoid closure staleness
  const depthRef = useRef(0);
  const velocityRef = useRef(0);
  const requestRef = useRef<number>();
  
  // Timing Refs
  const runStartTimeRef = useRef<number | null>(null);
  const passedMilestonesRef = useRef<Set<number>>(new Set());

  // Load persisted settings
  useEffect(() => {
    const saved = localStorage.getItem('immovable_highscore_px');
    if (saved) setHighScore(parseInt(saved, 10));
    const savedInertia = localStorage.getItem('immovable_inertia_enabled');
    if (savedInertia === 'true' || savedInertia === 'false') {
      setInertiaEnabled(savedInertia === 'true');
    }
    const savedCal = localStorage.getItem('immovable_calibrated_px_per_cm');
    if (savedCal) {
      const v = parseFloat(savedCal);
      if (Number.isFinite(v) && v > 0) setCalibratedPxPerCm(v);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('immovable_inertia_enabled', inertiaEnabled ? 'true' : 'false');
  }, [inertiaEnabled]);

  // Auto-detect CSS px per cm using the browser's CSS cm unit
  // This is approximate (CSS cm != physical cm) but a good starting point
  useEffect(() => {
    const el = document.createElement('div');
    el.style.width = '10cm';
    el.style.position = 'absolute';
    el.style.visibility = 'hidden';
    document.body.appendChild(el);
    const pxPer10Cm = el.offsetWidth;
    document.body.removeChild(el);
    if (pxPer10Cm > 0) {
      setAutoPxPerCm(pxPer10Cm / 10);
    }
  }, []);

  useEffect(() => {
    const updateViewport = () => setViewportHeightPx(window.innerHeight || 0);
    updateViewport();
    window.addEventListener('resize', updateViewport);
    return () => window.removeEventListener('resize', updateViewport);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const computed = window.getComputedStyle(root);
    const parsed = parseFloat(computed.lineHeight);
    if (Number.isFinite(parsed) && parsed > 0) {
      setLineHeightPx(parsed);
    } else {
      setLineHeightPx(DEFAULT_LINE_HEIGHT_PX);
    }
  }, []);

  // pxToCm: use calibrated value if available, else auto-detected CSS cm
  const pxToCm = useMemo(() => {
    const pxPerCm = calibratedPxPerCm ?? autoPxPerCm;
    return 1 / pxPerCm;
  }, [calibratedPxPerCm, autoPxPerCm]);

  // Calibration handlers
  const handleCalibration = useCallback((pxPerCm: number) => {
    setCalibratedPxPerCm(pxPerCm);
    localStorage.setItem('immovable_calibrated_px_per_cm', pxPerCm.toString());
    setShowCalibration(false);
  }, []);

  const handleResetCalibration = useCallback(() => {
    setCalibratedPxPerCm(null);
    localStorage.removeItem('immovable_calibrated_px_per_cm');
  }, []);

  const showTitleToast = useCallback((label: string) => {
    setTitleToast(label);
    if (titleTimeoutRef.current !== null) {
      window.clearTimeout(titleTimeoutRef.current);
    }
    titleTimeoutRef.current = window.setTimeout(() => {
      setTitleToast(null);
      titleTimeoutRef.current = null;
    }, 2500);
  }, []);

  const checkTitleUnlocks = useCallback((currentM: number) => {
    const unlockOnce = (key: string, label: string) => {
      if (unlockedTitlesRef.current.has(key)) return;
      unlockedTitlesRef.current.add(key);
      showTitleToast(label);
    };

    if (currentM >= 77.7) unlockOnce('77.7', '77.7m通過');
    if (currentM >= 100) unlockOnce('100', '100m通過');
    if (currentM >= 500) unlockOnce('500', '500m通過');
    if (currentM >= 10000) unlockOnce('10000', '10km通過');

    const thousand = Math.floor(currentM / 1000);
    if (thousand > lastThousandRef.current) {
      for (let k = lastThousandRef.current + 1; k <= thousand; k += 1) {
        if (k === 10) continue;
        unlockOnce(`k${k}`, `${k}km通過`);
      }
      lastThousandRef.current = thousand;
    }
  }, [showTitleToast]);

  useEffect(() => {
    return () => {
      if (titleTimeoutRef.current !== null) {
        window.clearTimeout(titleTimeoutRef.current);
      }
    };
  }, []);

  // Persistent loop for physics (Gravity & Friction)
  const animate = useCallback((time: number) => {
    // 1. Physics Calculations
    const lastTime = lastTimeRef.current;
    const dtSec = lastTime ? Math.max((time - lastTime) / 1000, 1 / 120) : 1 / 60;
    lastTimeRef.current = time;

    const directDelta = inertiaEnabled ? 0 : inputDeltaRef.current;
    if (!inertiaEnabled) {
      inputDeltaRef.current = 0;
      velocityRef.current = directDelta;
    }

    // スクロール回数（方向変化でカウント）
    const dir = Math.sign(velocityRef.current);
    if (dir !== 0 && dir !== lastScrollDir.current) {
      setScrollCount(c => c + 1);
      lastScrollDir.current = dir;
    }

    // 連続加速時間
    const pxPerFrame = Math.abs(velocityRef.current);
    const pxPerSec = pxPerFrame / dtSec;
    const lastPxPerSec = lastVelocity.current;
    const accelVal = Math.abs(pxPerSec - lastPxPerSec) / dtSec; // px/s^2
    lastVelocity.current = pxPerSec;
    const isMoving = Math.abs(velocityRef.current) > MOVING_EPS || Math.abs(directDelta) > MOVING_EPS;
    if (isMoving) {
      lastMoveTimeRef.current = time;
    }

    const idleMs = lastMoveTimeRef.current === null ? 0 : time - lastMoveTimeRef.current;
    const allowGravity = idleMs >= IDLE_GRAVITY_DELAY_MS;

    if (inertiaEnabled) {
      velocityRef.current *= FRICTION;

      // Gravity logic
      if (allowGravity && depthRef.current > 0) {
        const dynamicGravity = Math.min(
          GRAVITY + (depthRef.current * GRAVITY_DEPTH_SCALE),
          GRAVITY_MAX
        );
        depthRef.current -= dynamicGravity;
        if (depthRef.current < 0) depthRef.current = 0;
      }

      depthRef.current += velocityRef.current;
    } else {
      if (directDelta !== 0) {
        depthRef.current += directDelta;
        if (depthRef.current < 0) depthRef.current = 0;
      }
      if (directDelta === 0) velocityRef.current = 0;

      if (allowGravity && depthRef.current > 0) {
        const dynamicGravity = Math.min(
          GRAVITY + (depthRef.current * GRAVITY_DEPTH_SCALE),
          GRAVITY_MAX
        );
        depthRef.current -= dynamicGravity;
        if (depthRef.current < 0) depthRef.current = 0;
      }
    }

    // Hard floor / Reset
    if (depthRef.current <= 0) {
        depthRef.current = 0;
        velocityRef.current = 0;
        
        // Reset Timer if grounded
        if (runStartTimeRef.current !== null) {
            runStartTimeRef.current = null;
            setRunTime(0);
            setSplits([]);
            passedMilestonesRef.current.clear();
          totalDistanceRef.current = 0;
          setAveSpeed(0);
          setMaxSpeed(0);
          setTotalDistance(0);
          setMaxAccel(0);
          setCurrentSpeedMps(0);
          setTitleToast(null);
          unlockedTitlesRef.current.clear();
          lastThousandRef.current = 0;
          lastMoveTimeRef.current = null;
        }
    } else {
        // Start Timer if just took off
        if (runStartTimeRef.current === null) {
            runStartTimeRef.current = time;
            passedMilestonesRef.current.clear();
            setSplits([]);
          totalDistanceRef.current = 0;
          setAveSpeed(0);
          setMaxSpeed(0);
          setTotalDistance(0);
          setMaxAccel(0);
        }
    }

    // 2. Timer & Split Logic
    let currentRunTime = 0;
    if (runStartTimeRef.current !== null) {
        currentRunTime = time - runStartTimeRef.current;
        setRunTime(currentRunTime);

        // Check Milestones
        const currentCm = depthRef.current * pxToCm;
      const currentM = currentCm / 100;
      checkTitleUnlocks(currentM);
        
        MILESTONES_CM.forEach(milestone => {
            if (currentCm >= milestone && !passedMilestonesRef.current.has(milestone)) {
                passedMilestonesRef.current.add(milestone);
                setSplits(prev => [...prev, { distanceCm: milestone, timeMs: currentRunTime }].sort((a,b) => b.distanceCm - a.distanceCm));
            }
        });
    }

    // 3. Update React State for UI
    setDepth(depthRef.current);
    setVelocity(Math.abs(velocityRef.current));

    // 距離・速度統計（実移動量ベース）
    const frameDistancePx = Math.abs(velocityRef.current);
    const frameDistanceM = (frameDistancePx * pxToCm) / 100;
    totalDistanceRef.current += frameDistanceM;

    const currentSpeedMps = (pxPerSec * pxToCm) / 100;
    const currentAccelMps2 = (accelVal * pxToCm) / 100;

    setCurrentSpeedMps(currentSpeedMps);
    setTotalDistance(totalDistanceRef.current);
    setMaxSpeed(prev => Math.max(prev, currentSpeedMps));
    setMaxAccel(prev => Math.max(prev, currentAccelMps2));

    if (runStartTimeRef.current && currentRunTime > 0) {
      setAveSpeed(totalDistanceRef.current / (currentRunTime / 1000));
    } else {
      setAveSpeed(0);
    }

    // Check High Score
    if (depthRef.current > parseInt(localStorage.getItem('immovable_highscore_px') || '0', 10)) {
        localStorage.setItem('immovable_highscore_px', Math.floor(depthRef.current).toString());
        setHighScore(Math.floor(depthRef.current));
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [inertiaEnabled, pxToCm, checkTitleUnlocks]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // Input Handling
  useEffect(() => {
    const normalizeWheelDelta = (e: WheelEvent) => {
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) return e.deltaY * lineHeightPx;
      if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) return e.deltaY * (viewportHeightPx || window.innerHeight || 0);
      return e.deltaY;
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = normalizeWheelDelta(e);
      if (inertiaEnabled) {
        // Game mode: scaled down for physics feel
        velocityRef.current += delta * SCROLL_MULTIPLIER * 0.15;
      } else {
        // Direct measurement: full pixel delta
        inputDeltaRef.current += delta;
      }
    };

    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
        touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const touchY = e.touches[0].clientY;
        const delta = touchStartY - touchY;
        touchStartY = touchY;
        if (inertiaEnabled) {
          // Game mode: scaled for physics feel
          velocityRef.current += delta * SCROLL_MULTIPLIER * 0.25;
        } else {
          // Direct measurement: 1:1 physical finger mapping
          inputDeltaRef.current += delta;
        }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [inertiaEnabled, lineHeightPx, viewportHeightPx]);

  // Visual Effects Calculations
  const normVelocity = Math.min(velocity / MAX_VELOCITY, 1);
  const bgOffset = depth % 200; 
  const shakeIntensity = Math.min(velocity / 10, 15); 

  // Memoize static particles
  const particles = useMemo(() => [...Array(40)].map((_, i) => ({
      left: Math.random() * 100,
      width: Math.random() * 2 + 1,
      height: Math.random() * 20 + 5,
      speed: Math.random() * 0.5 + 0.5,
      delay: Math.random() * 2
  })), []);

  return (
    <div 
      className="relative w-full h-full flex flex-col items-center justify-center bg-black overflow-hidden transition-colors duration-200"
      style={{
        backgroundColor: normVelocity > 0.9 ? '#222' : '#000'
      }}
    >
        {/* Layer 1: The Void (Base Grid) */}
        <div 
            className="absolute inset-0 pointer-events-none opacity-30"
            style={{
                backgroundImage: `
                    linear-gradient(rgba(${100 + normVelocity * 155}, ${255 - normVelocity * 200}, ${255}, ${0.1 + normVelocity * 0.5}) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(${100 + normVelocity * 155}, ${255 - normVelocity * 200}, ${255}, ${0.1 + normVelocity * 0.5}) 1px, transparent 1px)
                `,
                backgroundSize: '40px 40px',
                backgroundPosition: `0px -${bgOffset}px`,
                filter: `blur(${normVelocity * 2}px)`,
                transform: `scale(${1 + normVelocity * 0.1})`
            }}
        />

        {/* Layer 2: Nebula / Aura Glow */}
        <div 
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
                opacity: 0.2 + normVelocity * 0.8,
                background: normVelocity < 0.5 
                    ? `radial-gradient(circle at center, rgba(76, 29, 149, ${normVelocity}) 0%, transparent 70%)` 
                    : normVelocity < 0.8
                        ? `radial-gradient(circle at center, rgba(220, 38, 38, ${normVelocity}) 0%, transparent 70%)` 
                        : `radial-gradient(circle at center, rgba(255, 215, 0, ${normVelocity}) 0%, transparent 80%)` 
            }}
        />

        {/* Layer 3: Speed Lines / Warp Stars */}
        <div className="absolute inset-0 pointer-events-none perspective-1000">
            {particles.map((p, i) => {
                const stretch = 1 + (velocity * 0.5); 
                const opacity = Math.min(0.2 + (velocity / 100), 1);
                return (
                    <div 
                        key={i}
                        className="absolute bg-white rounded-full"
                        style={{
                            left: `${p.left}%`,
                            width: `${p.width}px`,
                            height: `${p.height * stretch}px`,
                            opacity: opacity,
                            top: `${((Date.now() * p.speed * (1 + normVelocity * 5)) + (i * 100)) % window.innerHeight}px`,
                            transform: 'translateZ(0)',
                            boxShadow: normVelocity > 0.8 ? `0 0 ${10 * normVelocity}px 2px rgba(255, 255, 255, 0.8)` : 'none'
                        }}
                    />
                );
            })}
        </div>

        {/* Layer 4: Vignette */}
        <div 
            className="absolute inset-0 pointer-events-none"
            style={{
                background: `radial-gradient(circle, transparent 40%, black 120%)`,
                opacity: 0.5 + normVelocity * 0.5,
                transform: `scale(${1 - normVelocity * 0.1})`
            }}
        />

      {/* Card Calibration Overlay */}
      {showCalibration && (
        <CardCalibration
          initialPxPerCm={autoPxPerCm}
          onCalibrate={handleCalibration}
          onCancel={() => setShowCalibration(false)}
        />
      )}

      {titleToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[90] px-4 py-2 rounded-full bg-black/80 border border-yellow-600 text-yellow-300 text-xs font-mono shadow-[0_0_16px_rgba(250,204,21,0.3)]">
          TITLE UNLOCKED: {titleToast}
        </div>
      )}

      <DepthMeter 
        depth={depth} 
        currentSpeedMps={currentSpeedMps}
        highScore={highScore} 
        runTime={runTime}
        splits={splits}
        aveSpeed={aveSpeed}
        maxSpeed={maxSpeed}
        totalDistance={totalDistance}
        maxAccel={maxAccel}
        scrollCount={scrollCount}
        pxToCm={pxToCm}
        inertiaEnabled={inertiaEnabled}
        onInertiaEnabledChange={setInertiaEnabled}
        isCalibrated={calibratedPxPerCm !== null}
        onCalibrateClick={() => setShowCalibration(true)}
        onResetCalibration={handleResetCalibration}
      />

      {/* Main Content Container */}
      <div 
        style={{ transform: `translate(${Math.random() * shakeIntensity}px, ${Math.random() * shakeIntensity}px)` }}
        className="relative z-10 w-full max-w-2xl px-4"
      >
        {/* Visual Progress Bar */}
        <div className={`mt-12 w-full h-4 bg-gray-900 rounded-full overflow-hidden border border-gray-800 transition-all duration-300 ${normVelocity > 0.8 ? 'shadow-[0_0_20px_rgba(255,215,0,0.6)]' : ''}`}>
           <div 
             className="h-full bg-gradient-to-r from-red-600 via-yellow-500 to-white transition-all duration-75 ease-out"
             style={{ width: `${Math.min(normVelocity * 100, 100)}%` }}
           />
        </div>
        <p className={`text-center text-xs mt-2 font-mono transition-colors duration-200 ${normVelocity > 0.8 ? 'text-yellow-300 animate-pulse font-bold' : 'text-gray-500'}`}>
           {normVelocity > 0.9 ? '⚠️ REALITY TEARING IMMINENT ⚠️' : 'PHYSICAL DISPLACEMENT ATTEMPT DETECTED'}
        </p>
      </div>

      <div 
        className="absolute inset-0 pointer-events-none bg-white mix-blend-overlay"
        style={{ opacity: Math.max(0, (normVelocity - 0.8) * 5) }}
      />

      {/* Footer Links */}
      <div className="absolute bottom-4 left-0 right-0 z-30 flex justify-center pointer-events-auto">
        <div className="flex items-center gap-3 rounded-full border border-gray-800 bg-black/70 px-3 py-1 text-xs font-mono text-gray-300 shadow-[0_0_12px_rgba(0,0,0,0.6)]">
          <a href="/guide.html" target="_blank" rel="noopener" className="hover:text-white transition-colors">GUIDE</a>
          <span className="text-gray-600">|</span>
          <a href="/terms.html" target="_blank" rel="noopener" className="hover:text-white transition-colors">TERMS</a>
          <span className="text-gray-600">|</span>
          <a href="/privacy.html" target="_blank" rel="noopener" className="hover:text-white transition-colors">PRIVACY</a>
        </div>
      </div>

      <div className="absolute bottom-12 text-gray-500 font-mono text-xs animate-bounce opacity-60">
         ▼ SCROLL TO PROVE EXISTENCE ▼
      </div>
      
    </div>
  );
};

export default App;