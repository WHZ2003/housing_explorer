import React from 'react';
import { AlertCircle, ExternalLink } from 'lucide-react';
import { en } from '../i18n/en';

export const ApiKeyBanner: React.FC = () => (
  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 flex gap-4 items-start">
    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-amber-900">
        {en.errors.noApiKey}
      </p>
      <p className="text-sm text-amber-700 mt-1 leading-relaxed">
        {en.errors.noApiKeyDetail}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href="https://developers.google.com/maps/get-started"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800
                     bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          Get a Maps API key
          <ExternalLink className="w-3 h-3" />
        </a>
        <span className="inline-flex items-center text-xs text-amber-600 px-2">
          → copy <code className="mx-1 px-1 py-0.5 bg-amber-100 rounded font-mono">.env.example</code> to{' '}
          <code className="mx-1 px-1 py-0.5 bg-amber-100 rounded font-mono">.env</code> and add your key
        </span>
      </div>
    </div>
  </div>
);
