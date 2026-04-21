import React from 'react';
import { Car, Train, Footprints } from 'lucide-react';
import type { TravelMode } from '../types';
import { useAppContext } from '../context/AppContext';

const MODES: Array<{ mode: TravelMode; label: string; Icon: React.FC<{ className?: string }> }> = [
  { mode: 'driving', label: 'Driving', Icon: Car },
  { mode: 'transit', label: 'Transit', Icon: Train },
  { mode: 'walking', label: 'Walking', Icon: Footprints },
];

interface Props {
  compact?: boolean; // smaller chips for the sidebar
}

export const TravelModeSelector: React.FC<Props> = ({ compact = false }) => {
  const { enabledModes, toggleMode } = useAppContext();

  return (
    <div className={`flex gap-1.5 ${compact ? '' : 'flex-wrap'}`}>
      {MODES.map(({ mode, label, Icon }) => {
        const active = enabledModes.includes(mode);
        const isLast = enabledModes.length === 1 && active;
        return (
          <button
            key={mode}
            onClick={() => toggleMode(mode)}
            disabled={isLast}
            title={isLast ? 'At least one mode must be enabled' : undefined}
            className={[
              'flex items-center gap-1.5 rounded-lg border font-medium transition-all select-none',
              compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              active
                ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700',
              isLast ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
            ].join(' ')}
          >
            <Icon className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            {label}
          </button>
        );
      })}
    </div>
  );
};
