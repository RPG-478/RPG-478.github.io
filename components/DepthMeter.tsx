import React from 'react';
import { SplitRecord } from '../types';

interface DepthMeterProps {
  depth: number; // In pixels
  velocity: number; // In pixels per frame (approx)
  highScore: number; // In pixels
  runTime: number; // ms
  splits: SplitRecord[];
  aveSpeed: number; // m/s
  maxSpeed: number; // m/s
  totalDistance: number; // m
  maxAccel: number; // m/s^2
  scrollCount: number;
  pxToCm: number;
  inertiaEnabled: boolean;
  onInertiaEnabledChange: (value: boolean) => void;
  isCalibrated: boolean;
  onCalibrateClick: () => void;
  onResetCalibration: () => void;
}

const formatDistance = (pixels: number, pxToCm: number): string => {
  const cm = pixels * pxToCm;
  if (cm < 100) {
    return `${cm.toFixed(1)} cm`;
  } else {
    return `${(cm / 100).toFixed(2)} m`;
  }
};

const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const decimals = Math.floor((ms % 1000) / 10); // 2 digits
  return `${seconds}.${decimals.toString().padStart(2, '0')}s`;
};

const formatSpeed = (pxPerFrame: number, pxToCm: number): string => {
  // Assume ~60 FPS for calculation
  const cmPerFrame = pxPerFrame * pxToCm;
  const cmPerSec = cmPerFrame * 60;
  
  if (cmPerSec < 100) {
    return `${cmPerSec.toFixed(1)} cm/s`;
  } else {
    // m/s
    return `${(cmPerSec / 100).toFixed(2)} m/s`;
  }
};

const formatKmh = (pxPerFrame: number, pxToCm: number): string => {
  const cmPerFrame = pxPerFrame * pxToCm;
  const cmPerSec = cmPerFrame * 60;
  const kmh = (cmPerSec / 100000) * 3600;
  return `${kmh.toFixed(1)} km/h`;
};

export const DepthMeter: React.FC<DepthMeterProps> = ({
  depth,
  velocity,
  highScore,
  runTime,
  splits,
  aveSpeed,
  maxSpeed,
  totalDistance,
  maxAccel,
  scrollCount,
  pxToCm,
  inertiaEnabled,
  onInertiaEnabledChange,
  isCalibrated,
  onCalibrateClick,
  onResetCalibration
}) => {
  return (
    <>
      {/* LEFT HUD: Depth & Record */}
      <div className="fixed top-4 left-4 z-50 font-mono text-sm md:text-base pointer-events-none select-none">
        <div className="flex flex-col gap-1">
          <div className="bg-black/80 border border-red-500 text-red-500 px-3 py-1 rounded shadow-[0_0_10px_rgba(239,68,68,0.3)]">
            DEPTH: {formatDistance(depth, pxToCm)}
          </div>
          <div className="bg-black/80 border border-gray-600 text-gray-400 px-3 py-1 rounded text-xs">
            BEST: {formatDistance(highScore, pxToCm)}
          </div>
        </div>
      </div>

        {/* RIGHT HUD: Speed, Time, Splits, Stats */}
        <div className="fixed top-4 right-4 z-50 flex flex-col items-end gap-2 font-mono select-none">
        {/* Timer */}
        <div className="flex flex-col items-end">
          <div className="text-xs text-gray-500 mb-1">RUN TIME</div>
          <div className={`text-3xl md:text-4xl font-bold tracking-tighter ${runTime > 0 ? 'text-white' : 'text-gray-700'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatTime(runTime)}
          </div>
        </div>

        {/* Speedometer */}
        <div className="flex items-center gap-2 mt-2 bg-black/60 backdrop-blur px-3 py-2 rounded-lg border-r-2 border-yellow-500">
           <div className="text-right">
            <div className="text-xl text-yellow-400 font-bold leading-none">{formatSpeed(velocity, pxToCm)}</div>
            <div className="text-[10px] text-yellow-600 leading-none mt-1">{formatKmh(velocity, pxToCm)}</div>
           </div>
           <div className="text-xs text-gray-500 rotate-90 origin-center tracking-widest">SPD</div>
        </div>

        {/* 追加: スクロール統計（シンプル） */}
        <div className="flex flex-col gap-1 mt-2 bg-black/70 px-3 py-2 rounded-lg border border-gray-700 text-xs min-w-[160px]">
          <div className="flex justify-between"><span>AVE SPEED</span><span className="font-mono">{aveSpeed.toFixed(2)} m/s</span></div>
          <div className="flex justify-between"><span>MAX SPEED</span><span className="font-mono">{maxSpeed.toFixed(2)} m/s</span></div>
          <div className="flex justify-between"><span>TOTAL DIST</span><span className="font-mono">{totalDistance.toFixed(2)} m</span></div>
          <div className="flex justify-between"><span>MAX ACCEL</span><span className="font-mono">{maxAccel.toFixed(2)} m/s²</span></div>
          <div className="flex justify-between"><span>SCROLL COUNT</span><span className="font-mono">{scrollCount}</span></div>
        </div>

        <div className="mt-2 bg-black/70 px-3 py-2 rounded-lg border border-gray-700 text-xs min-w-[160px] pointer-events-auto flex flex-col gap-2">
          {/* Calibration status & button */}
          <div className="flex items-center justify-between gap-2">
            <span className={isCalibrated ? 'text-green-400' : 'text-gray-500'}>
              {isCalibrated ? '✓ 補正済み' : '自動推定'}
            </span>
            {isCalibrated ? (
              <button
                className="text-[10px] text-red-400 border border-red-800 rounded px-2 py-0.5 active:bg-red-900/40"
                onClick={onResetCalibration}
              >
                RESET
              </button>
            ) : null}
          </div>
          <button
            className="w-full py-1.5 bg-yellow-600/80 text-black rounded font-bold text-xs active:bg-yellow-500 transition-colors"
            onClick={onCalibrateClick}
          >
            📐 CALIBRATE
          </button>
          <label className="flex items-center justify-between gap-2">
            <span>INERTIA</span>
            <input
              type="checkbox"
              checked={inertiaEnabled}
              onChange={(e) => onInertiaEnabledChange(e.target.checked)}
            />
          </label>
        </div>

        {/* Splits / Laps */}
        <div className="mt-4 flex flex-col gap-1 items-end w-32">
          {splits.map((split) => (
            <div key={split.distanceCm} className="flex justify-between w-full text-xs bg-black/80 border-b border-gray-800 px-2 py-1 text-green-400 animate-[pulse_0.5s_ease-out]">
              <span>{split.distanceCm >= 100 ? `${split.distanceCm/100}m` : `${split.distanceCm}cm`}</span>
              <span className="font-bold">{formatTime(split.timeMs)}</span>
            </div>
          ))}
          {splits.length === 0 && runTime > 0 && (
            <div className="text-[10px] text-gray-600 italic">NEXT: 1m</div>
          )}
        </div>

        </div>
    </>
  );
};