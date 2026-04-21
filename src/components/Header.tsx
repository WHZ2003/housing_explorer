import React from 'react';
import { MapPin } from 'lucide-react';
import { en } from '../i18n/en';

export const Header: React.FC = () => (
  <header className="bg-white border-b border-gray-100 sticky top-0 z-30 backdrop-blur-sm bg-white/95">
    <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center gap-3">
      <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600 flex-shrink-0">
        <MapPin className="w-5 h-5 text-white" />
      </div>
      <div>
        <h1 className="text-base font-semibold text-gray-900 leading-tight tracking-tight">
          {en.app.title}
        </h1>
        <p className="text-xs text-gray-500 leading-tight mt-0.5">
          {en.app.subtitle}
        </p>
      </div>
      <div className="ml-auto hidden sm:flex items-center gap-1.5">
        <span className="text-xs text-gray-400 font-medium">Powered by</span>
        <span className="text-xs font-semibold text-blue-600">Google Maps</span>
      </div>
    </div>
  </header>
);
