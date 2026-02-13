import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { DepthMeter } from './components/DepthMeter';
import { CardCalibration } from './components/CardCalibration';
import { TitleUnlockOverlay, TitleGallery } from './components/TitleUnlockOverlay';
import { ACHIEVEMENTS } from './data/achievements';
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
const UNLOCKED_TITLES_STORAGE_KEY = 'immovable_unlocked_titles_v1';
const RUN_STATE_STORAGE_KEY = 'immovable_run_state_v1';

interface PersistedRunState {
  depth: number;
  velocity: number;
  runTime: number;
  splits: SplitRecord[];
  passedMilestones: number[];
  aveSpeed: number;
  maxSpeed: number;
  totalDistance: number;
  maxAccel: number;
  currentSpeedMps: number;
  scrollCount: number;
  unlockedTitles: string[];
  savedAt: number;
}

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
  const [showTitleGallery, setShowTitleGallery] = useState(false);
  const [unlockedTitles, setUnlockedTitles] = useState<Set<string>>(new Set());
  const [pendingResume, setPendingResume] = useState<PersistedRunState | null>(null);

  // 速度・加速度計測用
  const lastVelocity = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const totalDistanceRef = useRef(0); // meters
  const inputDeltaRef = useRef(0);
  const lastScrollDir = useRef(0);
  const titleTimeoutRef = useRef<number | null>(null);
  const unlockedTitlesRef = useRef<Set<string>>(new Set());
  const lastMoveTimeRef = useRef<number | null>(null);
  const runTimeRef = useRef(0);
  const splitsRef = useRef<SplitRecord[]>([]);
  const aveSpeedRef = useRef(0);
  const maxSpeedRef = useRef(0);
  const maxAccelRef = useRef(0);
  const totalDistanceStatRef = useRef(0);
  const currentSpeedMpsRef = useRef(0);
  const scrollCountRef = useRef(0);
  const lastRunPersistAtRef = useRef(0);

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

    try {
      const savedTitles = localStorage.getItem(UNLOCKED_TITLES_STORAGE_KEY);
      if (savedTitles) {
        const parsed = JSON.parse(savedTitles);
        if (Array.isArray(parsed)) {
          const restored = new Set(parsed.filter((item) => typeof item === 'string'));
          unlockedTitlesRef.current = restored;
          setUnlockedTitles(new Set(restored));
        }
      }
    } catch {
      localStorage.removeItem(UNLOCKED_TITLES_STORAGE_KEY);
    }

    try {
      const savedRunState = localStorage.getItem(RUN_STATE_STORAGE_KEY);
      if (savedRunState) {
        const parsed = JSON.parse(savedRunState) as PersistedRunState;
        if (parsed && Number.isFinite(parsed.depth) && parsed.depth > 0) {
          setPendingResume(parsed);
        }
      }
    } catch {
      localStorage.removeItem(RUN_STATE_STORAGE_KEY);
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
    }, 3600);
  }, []);

  const persistRunState = useCallback(() => {
    if (depthRef.current <= 0) return;

    const payload: PersistedRunState = {
      depth: depthRef.current,
      velocity: velocityRef.current,
      runTime: runTimeRef.current,
      splits: splitsRef.current,
      passedMilestones: Array.from(passedMilestonesRef.current),
      aveSpeed: aveSpeedRef.current,
      maxSpeed: maxSpeedRef.current,
      totalDistance: totalDistanceStatRef.current,
      maxAccel: maxAccelRef.current,
      currentSpeedMps: currentSpeedMpsRef.current,
      scrollCount: scrollCountRef.current,
      unlockedTitles: Array.from(unlockedTitlesRef.current),
      savedAt: Date.now(),
    };

    try {
      localStorage.setItem(RUN_STATE_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore quota/storage errors
    }
  }, []);

  const clearRunState = useCallback(() => {
    localStorage.removeItem(RUN_STATE_STORAGE_KEY);
  }, []);

  const handleResumeRun = useCallback(() => {
    if (!pendingResume) return;

    const now = performance.now();

    depthRef.current = Math.max(0, pendingResume.depth);
    velocityRef.current = pendingResume.velocity;
    runStartTimeRef.current = now - Math.max(0, pendingResume.runTime);
    lastTimeRef.current = null;
    lastMoveTimeRef.current = now;

    const restoredSplits = Array.isArray(pendingResume.splits) ? pendingResume.splits : [];
    const restoredMilestones = Array.isArray(pendingResume.passedMilestones) ? pendingResume.passedMilestones : [];
    const restoredTitles = Array.isArray(pendingResume.unlockedTitles)
      ? pendingResume.unlockedTitles.filter((key) => typeof key === 'string')
      : [];

    passedMilestonesRef.current = new Set(restoredMilestones);
    splitsRef.current = restoredSplits;
    runTimeRef.current = Math.max(0, pendingResume.runTime);
    aveSpeedRef.current = Math.max(0, pendingResume.aveSpeed || 0);
    maxSpeedRef.current = Math.max(0, pendingResume.maxSpeed || 0);
    totalDistanceRef.current = Math.max(0, pendingResume.totalDistance || 0);
    totalDistanceStatRef.current = Math.max(0, pendingResume.totalDistance || 0);
    maxAccelRef.current = Math.max(0, pendingResume.maxAccel || 0);
    currentSpeedMpsRef.current = Math.max(0, pendingResume.currentSpeedMps || 0);
    scrollCountRef.current = Math.max(0, pendingResume.scrollCount || 0);
    unlockedTitlesRef.current = new Set(restoredTitles);

    setDepth(depthRef.current);
    setVelocity(Math.abs(velocityRef.current));
    setRunTime(runTimeRef.current);
    setSplits(restoredSplits);
    setAveSpeed(aveSpeedRef.current);
    setMaxSpeed(maxSpeedRef.current);
    setTotalDistance(totalDistanceStatRef.current);
    setMaxAccel(maxAccelRef.current);
    setCurrentSpeedMps(currentSpeedMpsRef.current);
    setScrollCount(scrollCountRef.current);
    setUnlockedTitles(new Set(unlockedTitlesRef.current));

    try {
      localStorage.setItem(UNLOCKED_TITLES_STORAGE_KEY, JSON.stringify(Array.from(unlockedTitlesRef.current)));
    } catch {
      // ignore
    }

    setPendingResume(null);
  }, [pendingResume]);

  const handleStartFresh = useCallback(() => {
    clearRunState();
    setPendingResume(null);
  }, [clearRunState]);

  const checkTitleUnlocks = useCallback((currentM: number) => {
    const unlockOnce = (key: string, label: string) => {
      if (unlockedTitlesRef.current.has(key)) return;
      unlockedTitlesRef.current.add(key);
      setUnlockedTitles(new Set(unlockedTitlesRef.current));
      try {
        localStorage.setItem(UNLOCKED_TITLES_STORAGE_KEY, JSON.stringify(Array.from(unlockedTitlesRef.current)));
      } catch {
        // ignore quota/storage errors
      }
      showTitleToast(label);
    };

    ACHIEVEMENTS.forEach((achievement) => {
      if (currentM >= achievement.meters) {
        unlockOnce(achievement.key, achievement.label);
      }
    });
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
      setScrollCount(c => {
        const next = c + 1;
        scrollCountRef.current = next;
        return next;
      });
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
            runTimeRef.current = 0;
            setRunTime(0);
            splitsRef.current = [];
            setSplits([]);
            passedMilestonesRef.current.clear();
          totalDistanceRef.current = 0;
          totalDistanceStatRef.current = 0;
          aveSpeedRef.current = 0;
          maxSpeedRef.current = 0;
          maxAccelRef.current = 0;
          currentSpeedMpsRef.current = 0;
          scrollCountRef.current = 0;
          setAveSpeed(0);
          setMaxSpeed(0);
          setTotalDistance(0);
          setMaxAccel(0);
          setCurrentSpeedMps(0);
          setTitleToast(null);
          clearRunState();
          lastMoveTimeRef.current = null;
        }
    } else {
        // Start Timer if just took off
        if (runStartTimeRef.current === null) {
            runStartTimeRef.current = time;
            passedMilestonesRef.current.clear();
            splitsRef.current = [];
            setSplits([]);
          totalDistanceRef.current = 0;
          totalDistanceStatRef.current = 0;
          runTimeRef.current = 0;
          aveSpeedRef.current = 0;
          maxSpeedRef.current = 0;
          maxAccelRef.current = 0;
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
      runTimeRef.current = currentRunTime;
        setRunTime(currentRunTime);

        // Check Milestones
        const currentCm = depthRef.current * pxToCm;
      const currentM = currentCm / 100;
      checkTitleUnlocks(currentM);
        
        MILESTONES_CM.forEach(milestone => {
            if (currentCm >= milestone && !passedMilestonesRef.current.has(milestone)) {
                passedMilestonesRef.current.add(milestone);
                setSplits(prev => {
                  const next = [...prev, { distanceCm: milestone, timeMs: currentRunTime }].sort((a,b) => b.distanceCm - a.distanceCm);
                  splitsRef.current = next;
                  return next;
                });
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
    currentSpeedMpsRef.current = currentSpeedMps;
    setTotalDistance(totalDistanceRef.current);
    totalDistanceStatRef.current = totalDistanceRef.current;

    const nextMaxSpeed = Math.max(maxSpeedRef.current, currentSpeedMps);
    maxSpeedRef.current = nextMaxSpeed;
    setMaxSpeed(nextMaxSpeed);

    const nextMaxAccel = Math.max(maxAccelRef.current, currentAccelMps2);
    maxAccelRef.current = nextMaxAccel;
    setMaxAccel(nextMaxAccel);

    if (runStartTimeRef.current && currentRunTime > 0) {
      const averageSpeed = totalDistanceRef.current / (currentRunTime / 1000);
      aveSpeedRef.current = averageSpeed;
      setAveSpeed(averageSpeed);
    } else {
      aveSpeedRef.current = 0;
      setAveSpeed(0);
    }

    if (depthRef.current > 0 && time - lastRunPersistAtRef.current >= 500) {
      lastRunPersistAtRef.current = time;
      persistRunState();
    }

    // Check High Score
    if (depthRef.current > parseInt(localStorage.getItem('immovable_highscore_px') || '0', 10)) {
        localStorage.setItem('immovable_highscore_px', Math.floor(depthRef.current).toString());
        setHighScore(Math.floor(depthRef.current));
    }

    requestRef.current = requestAnimationFrame(animate);
  }, [inertiaEnabled, pxToCm, checkTitleUnlocks, clearRunState, persistRunState]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  // Input Handling
  useEffect(() => {
    const isOverlayOpen = showTitleGallery || showCalibration || pendingResume !== null;

    const normalizeWheelDelta = (e: WheelEvent) => {
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) return e.deltaY * lineHeightPx;
      if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) return e.deltaY * (viewportHeightPx || window.innerHeight || 0);
      return e.deltaY;
    };

    const handleWheel = (e: WheelEvent) => {
      if (isOverlayOpen) return;
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
      if (isOverlayOpen) return;
        touchStartY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isOverlayOpen) return;
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
  }, [inertiaEnabled, lineHeightPx, viewportHeightPx, showTitleGallery, showCalibration, pendingResume]);

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

      {/* Title Unlock Overlay with sparkles */}
      <TitleUnlockOverlay title={titleToast} />

      {/* Title Gallery Modal */}
      {showTitleGallery && (
        <TitleGallery
          unlockedKeys={unlockedTitles}
          onClose={() => setShowTitleGallery(false)}
        />
      )}

      {pendingResume && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm pointer-events-auto">
          <div className="w-[90vw] max-w-md rounded-xl border border-gray-700 bg-gray-950/95 p-5 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
            <h2 className="text-lg font-bold text-yellow-400 font-mono">途中セーブを検出</h2>
            <p className="mt-2 text-sm text-gray-300">
              前回の記録（{((pendingResume.depth * pxToCm) / 100).toFixed(2)} m / {Math.floor(pendingResume.runTime / 1000)}s）から再開できます。
            </p>
            <div className="mt-4 flex gap-2">
              <button
                className="flex-1 rounded bg-yellow-500 px-3 py-2 text-sm font-bold text-black hover:bg-yellow-400 transition-colors"
                onClick={handleResumeRun}
              >
                再開する
              </button>
              <button
                className="flex-1 rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-gray-200 hover:bg-gray-800 transition-colors"
                onClick={handleStartFresh}
              >
                最初から
              </button>
            </div>
          </div>
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
        unlockedTitleCount={unlockedTitles.size}
        onTitleGalleryClick={() => setShowTitleGallery(true)}
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