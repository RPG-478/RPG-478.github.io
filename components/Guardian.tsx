import React, { useMemo } from 'react';
import { GuardianResponse } from '../types';

interface GuardianProps {
  data: GuardianResponse;
  intensity: number; // 0 to 1 based on scroll velocity
}

export const Guardian: React.FC<GuardianProps> = ({ data, intensity }) => {
  
  const moodColor = useMemo(() => {
    switch (data.mood) {
      case 'neutral': return 'text-blue-400 border-blue-400 shadow-blue-500/50';
      case 'annoyed': return 'text-yellow-400 border-yellow-400 shadow-yellow-500/50';
      case 'mocking': return 'text-purple-400 border-purple-400 shadow-purple-500/50';
      case 'angry': return 'text-red-500 border-red-500 shadow-red-500/50';
      case 'impressed': return 'text-green-400 border-green-400 shadow-green-500/50';
      default: return 'text-white border-white';
    }
  }, [data.mood]);

  const scale = 1 + (intensity * 0.2);
  const glitch = intensity > 0.5 ? 'shake-hard' : '';

  return (
    <div className={`relative z-10 flex flex-col items-center justify-center p-8 transition-all duration-100 ease-linear ${glitch}`}
         style={{ transform: `scale(${scale})` }}>
      
      {/* The Eye / Core */}
      <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center bg-black/80 backdrop-blur-md shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-colors duration-300 ${moodColor}`}>
        <div className={`w-4 h-4 rounded-full bg-current transition-all duration-75`}
             style={{ 
               transform: `translate(${Math.random() * intensity * 10}px, ${Math.random() * intensity * 10}px)`,
               width: `${16 + intensity * 20}px`,
               height: `${16 + intensity * 20}px`
             }} 
        />
      </div>

      {/* The Voice */}
      <div className={`mt-8 max-w-md text-center font-bold text-xl md:text-2xl tracking-widest uppercase transition-colors duration-300 bg-black/50 p-4 rounded border ${moodColor}`}>
        "{data.message}"
      </div>
      
      {intensity > 0.1 && (
        <div className="mt-2 text-xs text-gray-500 animate-pulse">
          RESISTANCE ACTIVE: {(intensity * 100).toFixed(0)}%
        </div>
      )}
    </div>
  );
};
