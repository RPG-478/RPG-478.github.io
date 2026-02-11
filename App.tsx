import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { DepthMeter } from './components/DepthMeter';
import { SplitRecord } from './types';

// Constants for physics
const FRICTION = 0.96; 
const GRAVITY = 0.8; 
const SCROLL_MULTIPLIER = 1.0; 
const DEFAULT_LINE_HEIGHT_PX = 16;
const MAX_VELOCITY = 3000; // Visual normalization only (not a hard cap)
// Fallback conversion for display if no calibration is available
const DEFAULT_PX_TO_CM = 2.54 / 96;
const DEFAULT_SCREEN_HEIGHT_CM = 15;

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
  const [scrollCount, setScrollCount] = useState(0); // 回数
  const [screenHeightCm, setScreenHeightCm] = useState(DEFAULT_SCREEN_HEIGHT_CM);
  const [viewportHeightPx, setViewportHeightPx] = useState(0);
  const [inertiaEnabled, setInertiaEnabled] = useState(true);
  const [distanceScale, setDistanceScale] = useState(1);
  const [lineHeightPx, setLineHeightPx] = useState(DEFAULT_LINE_HEIGHT_PX);

  // 速度・加速度計測用
  const lastVelocity = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const totalDistanceRef = useRef(0); // meters
  const inputDeltaRef = useRef(0);
  const lastScrollDir = useRef(0);
  const accelStreak = useRef(0);
  const maxAccelStreakSec = useRef(0);

  // Refs for physics loop to avoid closure staleness
  const depthRef = useRef(0);
  const velocityRef = useRef(0);
  const requestRef = useRef<number>();
  
  // Timing Refs
  const runStartTimeRef = useRef<number | null>(null);
  const passedMilestonesRef = useRef<Set<number>>(new Set());

  // Load high score
  useEffect(() => {
    const saved = localStorage.getItem('immovable_highscore_px');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('immovable_screen_height_cm');
    if (saved) setScreenHeightCm(parseFloat(saved));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('immovable_distance_scale');
    if (saved) setDistanceScale(parseFloat(saved));
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('immovable_inertia_enabled');
    if (saved === 'true' || saved === 'false') {
      setInertiaEnabled(saved === 'true');
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('immovable_inertia_enabled', inertiaEnabled ? 'true' : 'false');
  }, [inertiaEnabled]);

  useEffect(() => {
    if (!Number.isFinite(distanceScale)) return;
    localStorage.setItem('immovable_distance_scale', distanceScale.toString());
  }, [distanceScale]);

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

  const pxToCm = useMemo(() => {
    if (viewportHeightPx > 0) return (screenHeightCm / viewportHeightPx) * distanceScale;
    return DEFAULT_PX_TO_CM;
  }, [screenHeightCm, viewportHeightPx, distanceScale]);

  const handleScreenHeightChange = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    const clamped = Math.min(Math.max(value, 5), 50);
    setScreenHeightCm(clamped);
    localStorage.setItem('immovable_screen_height_cm', clamped.toString());
  }, []);

  const handleDistanceScaleChange = useCallback((value: number) => {
    if (!Number.isFinite(value)) return;
    const clamped = Math.min(Math.max(value, 0.2), 5);
    setDistanceScale(clamped);
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
    if (accelVal > 10) {
      accelStreak.current += dtSec;
      if (accelStreak.current > maxAccelStreakSec.current) maxAccelStreakSec.current = accelStreak.current;
    } else {
      accelStreak.current = 0;
    }

    if (inertiaEnabled) {
      velocityRef.current *= FRICTION;

      // Gravity logic
      if (depthRef.current > 0) {
          const dynamicGravity = GRAVITY + (depthRef.current * 0.0005);
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
  }, [inertiaEnabled, pxToCm]);

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
      const applied = delta * SCROLL_MULTIPLIER * 0.15;
      if (inertiaEnabled) {
        velocityRef.current += applied;
      } else {
        inputDeltaRef.current += applied;
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
        const applied = delta * SCROLL_MULTIPLIER * 0.25;
        if (inertiaEnabled) {
          velocityRef.current += applied;
        } else {
          inputDeltaRef.current += applied;
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

      <DepthMeter 
        depth={depth} 
        velocity={velocity}
        highScore={highScore} 
        runTime={runTime}
        splits={splits}
        aveSpeed={aveSpeed}
        maxSpeed={maxSpeed}
        totalDistance={totalDistance}
        maxAccel={maxAccel}
        scrollCount={scrollCount}
        pxToCm={pxToCm}
        screenHeightCm={screenHeightCm}
        onScreenHeightCmChange={handleScreenHeightChange}
        inertiaEnabled={inertiaEnabled}
        onInertiaEnabledChange={setInertiaEnabled}
        distanceScale={distanceScale}
        onDistanceScaleChange={handleDistanceScaleChange}
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

      <div className="absolute bottom-8 text-gray-600 font-mono text-xs animate-bounce opacity-50">
         ▼ SCROLL TO PROVE EXISTENCE ▼
      </div>
      
    </div>
  );
};

export default App;