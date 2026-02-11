import React, { useState } from 'react';

// ISO/IEC 7810 ID-1: standard credit/IC card dimensions
const CREDIT_CARD_WIDTH_CM = 8.56;
const CREDIT_CARD_HEIGHT_CM = 5.398;

interface CardCalibrationProps {
  onCalibrate: (pxPerCm: number) => void;
  onCancel: () => void;
  initialPxPerCm: number; // CSS-based auto estimate
}

export const CardCalibration: React.FC<CardCalibrationProps> = ({
  onCalibrate,
  onCancel,
  initialPxPerCm,
}) => {
  const [scale, setScale] = useState(1.0);

  const cardWidthPx = CREDIT_CARD_WIDTH_CM * initialPxPerCm * scale;
  const cardHeightPx = CREDIT_CARD_HEIGHT_CM * initialPxPerCm * scale;

  const handleConfirm = () => {
    // The displayed card at current scale represents 8.56cm width
    // Therefore: real px per cm = displayed width in px / 8.56
    const realPxPerCm = cardWidthPx / CREDIT_CARD_WIDTH_CM;
    onCalibrate(realPxPerCm);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 select-none">
      {/* Title */}
      <div className="text-white text-center mb-6">
        <h2 className="text-lg font-bold mb-2">📐 カード・キャリブレーション</h2>
        <p className="text-sm text-gray-400 leading-relaxed max-w-xs">
          カード（クレジットカード・ICカード・Suica 等）を
          <br />
          画面に当てて、枠を実物のサイズに合わせてください
        </p>
      </div>

      {/* Card outline */}
      <div
        className="border-2 border-dashed border-yellow-400 rounded-lg relative flex items-center justify-center transition-all duration-100"
        style={{
          width: `${cardWidthPx}px`,
          height: `${cardHeightPx}px`,
          boxShadow: '0 0 20px rgba(250,204,21,0.2)',
        }}
      >
        {/* Corner markers */}
        <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-yellow-300" />
        <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-yellow-300" />
        <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-yellow-300" />
        <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-yellow-300" />

        {/* Center label */}
        <div className="text-yellow-400/40 text-xs font-mono text-center">
          <div>CARD</div>
          <div className="text-[9px] mt-1">85.6 × 54.0 mm</div>
        </div>
      </div>

      {/* Dimensions display */}
      <div className="mt-3 text-xs text-gray-500 font-mono">
        {cardWidthPx.toFixed(0)} × {cardHeightPx.toFixed(0)} px
      </div>

      {/* Slider */}
      <div className="mt-4 w-full max-w-xs px-4">
        <div className="flex items-center gap-3">
          <button
            className="text-yellow-400 text-xl font-bold px-2 py-1 bg-gray-800 rounded active:bg-gray-700"
            onClick={() => setScale(s => Math.max(0.5, s - 0.01))}
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
            onClick={() => setScale(s => Math.min(1.8, s + 0.01))}
          >
            +
          </button>
        </div>
        <div className="text-center text-gray-600 text-[10px] mt-2 font-mono">
          調整: {((scale - 1) * 100).toFixed(0)}%
        </div>
      </div>

      {/* Buttons */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-2 bg-gray-800 text-gray-400 rounded border border-gray-600 text-sm active:bg-gray-700"
        >
          キャンセル
        </button>
        <button
          onClick={handleConfirm}
          className="px-6 py-2 bg-yellow-600 text-black rounded font-bold text-sm active:bg-yellow-500"
        >
          ✓ これで OK
        </button>
      </div>
    </div>
  );
};
