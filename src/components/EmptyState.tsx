import React from 'react';
import { Navigation, Clock } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { en } from '../i18n/en';

export const EmptyState: React.FC = () => {
  const { activeDestinations } = useAppContext();
  return (
  <div className="card p-6 space-y-5">
    {/* Icon */}
    <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50 mx-auto">
      <Navigation className="w-6 h-6 text-blue-500" />
    </div>

    {/* Text */}
    <div className="text-center space-y-1">
      <h3 className="text-base font-semibold text-gray-900">
        {en.empty.title}
      </h3>
      <p className="text-sm text-gray-500 leading-relaxed">
        {en.empty.subtitle}
      </p>
    </div>

    {/* Destination list */}
    <div className="space-y-1.5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {en.empty.destinations}
      </p>
      {activeDestinations.map((dest) => (
        <div
          key={dest.id}
          className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
        >
          <div
            className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
            style={{ backgroundColor: dest.color }}
          >
            {dest.shortLabel.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-800">{dest.name}</p>
            <p className="text-xs text-gray-400 truncate">{dest.address}</p>
          </div>
        </div>
      ))}
    </div>

    {/* Mode legend */}
    <div className="flex items-center justify-center gap-5 pt-1 border-t border-gray-100">
      {(['driving', 'transit', 'walking'] as const).map((mode) => (
        <div key={mode} className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500 capitalize">{mode}</span>
        </div>
      ))}
    </div>
  </div>
  );
};
