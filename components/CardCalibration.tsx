import React, { useState } from 'react';

// Calibration reference objects
type CalibMode = 'ruler' | 'coin';

interface CoinOption {
  label: string;
  diameterMm: number;
}

const COINS: CoinOption[] = [
  { label: '1円玉', diameterMm: 20.0 },
  { label: '5円玉', diameterMm: 22.0 },
  { label: '10円玉', diameterMm: 23.5 },
  { label: '50円玉', diameterMm: 21.0 },
  { label: '100円玉', diameterMm: 22.6 },
  { label: '500円玉', diameterMm: 26.5 },
];

const RULER_CM = 5; // 定規で合わせる長さ

interface CalibrationProps {
  onCalibrate: (pxPerCm: number) => void;
  onCancel: () => void;
  initialPxPerCm: number;
}

export const CardCalibration: React.FC<CalibrationProps> = ({
  onCalibrate,
  onCancel,
  initialPxPerCm,
}) => {
  const [mode, setMode] = useState<CalibMode>('ruler');
  const [scale, setScale] = useState(1.0);
  const [selectedCoin, setSelectedCoin] = useState(0);

  // Ruler: display a line that should be exactly RULER_CM cm
  const rulerLengthPx = RULER_CM * initialPxPerCm * scale;

  // Coin: display a circle that should match the selected coin
  const coin = COINS[selectedCoin];
  const coinDiameterPx = (coin.diameterMm / 10) * initialPxPerCm * scale;

  const handleConfirm = () => {
    let realPxPerCm: number;
    if (mode === 'ruler') {
      // rulerLengthPx represents RULER_CM cm
      realPxPerCm = rulerLengthPx / RULER_CM;
    } else {
      // coinDiameterPx represents coin.diameterMm mm = coin.diameterMm/10 cm
      realPxPerCm = coinDiameterPx / (coin.diameterMm / 10);
    }
    onCalibrate(realPxPerCm);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 select-none">
      {/* Title */}
      <div className="text-white text-center mb-4">
        <h2 className="text-lg font-bold mb-1">📐 キャリブレーション</h2>
        <p className="text-xs text-gray-400 leading-relaxed max-w-[280px]">
          実物に合わせてスライダーで調整してください
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 mb-4">
        <button
          className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${
            mode === 'ruler'
              ? 'bg-yellow-600 text-black'
              : 'bg-gray-800 text-gray-400 border border-gray-600'
          }`}
          onClick={() => { setMode('ruler'); setScale(1.0); }}
        >
          📏 定規
        </button>
        <button
          className={`px-4 py-1.5 rounded text-xs font-bold transition-colors ${
            mode === 'coin'
              ? 'bg-yellow-600 text-black'
              : 'bg-gray-800 text-gray-400 border border-gray-600'
          }`}
          onClick={() => { setMode('coin'); setScale(1.0); }}
        >
          🪙 硬貨
        </button>
      </div>

      {/* Reference display */}
      <div className="flex flex-col items-center justify-center min-h-[120px]">
        {mode === 'ruler' ? (
          /* === RULER MODE === */
          <div className="flex flex-col items-center">
            {/* The ruler line */}
            <div className="relative" style={{ width: `${rulerLengthPx}px` }}>
              {/* Main line */}
              <div className="h-[2px] bg-yellow-400 w-full" />
              {/* End markers */}
              <div className="absolute left-0 top-[-8px] w-[2px] h-[18px] bg-yellow-400" />
              <div className="absolute right-0 top-[-8px] w-[2px] h-[18px] bg-yellow-400" />
              {/* Tick marks every 1cm */}
              {Array.from({ length: RULER_CM - 1 }, (_, i) => {
                const pos = ((i + 1) / RULER_CM) * 100;
                return (
                  <div
                    key={i}
                    className="absolute top-[-4px] w-[1px] h-[10px] bg-yellow-400/60"
                    style={{ left: `${pos}%` }}
                  />
                );
              })}
              {/* Labels */}
              <div className="absolute left-0 top-[14px] text-[9px] text-yellow-400/70 -translate-x-1/2">0</div>
              <div className="absolute right-0 top-[14px] text-[9px] text-yellow-400/70 translate-x-[-50%]">{RULER_CM}</div>
            </div>
            <div className="mt-6 text-xs text-gray-500 font-mono">
              この線を定規で <span className="text-yellow-400 font-bold">{RULER_CM}cm</span> に合わせてください
            </div>
          </div>
        ) : (
          /* === COIN MODE === */
          <div className="flex flex-col items-center">
            {/* Coin selector */}
            <div className="flex flex-wrap gap-1 mb-4 justify-center max-w-[280px]">
              {COINS.map((c, i) => (
                <button
                  key={i}
                  className={`px-2 py-1 rounded text-[10px] transition-colors ${
                    i === selectedCoin
                      ? 'bg-yellow-600 text-black font-bold'
                      : 'bg-gray-800 text-gray-400 border border-gray-700'
                  }`}
                  onClick={() => { setSelectedCoin(i); setScale(1.0); }}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {/* The coin circle */}
            <div
              className="border-2 border-dashed border-yellow-400 rounded-full flex items-center justify-center transition-all duration-100"
              style={{
                width: `${coinDiameterPx}px`,
                height: `${coinDiameterPx}px`,
                boxShadow: '0 0 15px rgba(250,204,21,0.15)',
              }}
            >
              <div className="text-yellow-400/30 text-[9px] font-mono text-center leading-tight">
                <div>{coin.label}</div>
                <div>{coin.diameterMm}mm</div>
              </div>
            </div>
            <div className="mt-3 text-xs text-gray-500 font-mono">
              <span className="text-yellow-400 font-bold">{coin.label}</span> を円に重ねてサイズを合わせてください
            </div>
          </div>
        )}
      </div>

      {/* Slider */}
      <div className="mt-4 w-full max-w-xs px-4">
        <div className="flex items-center gap-3">
          <button
            className="text-yellow-400 text-xl font-bold px-2 py-1 bg-gray-800 rounded active:bg-gray-700"
            onClick={() => setScale(s => Math.max(0.5, +(s - 0.005).toFixed(3)))}
          >
            −
          </button>
          <input
            type="range"
            min={0.5}
            max={1.8}
            step={0.005}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="flex-1 accent-yellow-400 h-2"
          />
          <button
            className="text-yellow-400 text-xl font-bold px-2 py-1 bg-gray-800 rounded active:bg-gray-700"
            onClick={() => setScale(s => Math.min(1.8, +(s + 0.005).toFixed(3)))}
          >
            +
          </button>
        </div>
        <div className="text-center text-gray-600 text-[10px] mt-1 font-mono">
          {((scale - 1) * 100) >= 0 ? '+' : ''}{((scale - 1) * 100).toFixed(1)}%
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-5 flex gap-4">
        <button
          onClick={onCancel}
          className="px-5 py-2 bg-gray-800 text-gray-400 rounded border border-gray-600 text-sm active:bg-gray-700"
        >
          キャンセル
        </button>
        <button
          onClick={handleConfirm}
          className="px-5 py-2 bg-yellow-600 text-black rounded font-bold text-sm active:bg-yellow-500"
        >
          ✓ OK
        </button>
      </div>
    </div>
  );
};
