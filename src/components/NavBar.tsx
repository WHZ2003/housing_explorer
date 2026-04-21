import React from 'react';
import { MapPin, Settings, LayoutList, Clock, Heart, BarChart2 } from 'lucide-react';

export type Page = 'main' | 'settings' | 'batch' | 'favorites';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  compareCount: number;
  onOpenCompare: () => void;
}

const NAV_ITEMS: Array<{ page: Page; label: string; Icon: React.FC<{ className?: string }> }> = [
  { page: 'main',      label: 'Search',    Icon: MapPin },
  { page: 'batch',     label: 'Batch',     Icon: LayoutList },
  { page: 'favorites', label: 'Saved',     Icon: Heart },
  { page: 'settings',  label: 'Settings',  Icon: Settings },
];

export const NavBar: React.FC<Props> = ({ currentPage, onNavigate, compareCount, onOpenCompare }) => {
  return (
    <header className="flex-shrink-0 h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 z-30">
      {/* Brand */}
      <div className="flex items-center gap-2 min-w-0">
        <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="font-semibold text-gray-900 text-sm truncate">
          Harvard Housing Explorer
        </span>
        <span className="hidden sm:flex items-center gap-1 ml-2 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
          <Clock className="w-2.5 h-2.5" />
          9 AM commute
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-0.5">
        {NAV_ITEMS.map(({ page, label, Icon }) => {
          const active = currentPage === page;
          return (
            <button
              key={page}
              onClick={() => onNavigate(page)}
              className={[
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
              ].join(' ')}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          );
        })}

        {/* Compare tray button — only visible when items are selected */}
        {compareCount > 0 && (
          <button
            onClick={onOpenCompare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors ml-1.5"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            Compare
            <span className="bg-white/30 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
              {compareCount}
            </span>
          </button>
        )}
      </nav>
    </header>
  );
};
