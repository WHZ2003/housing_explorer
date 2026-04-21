import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  RotateCcw,
  Clock,
  MapPin,
  ChevronDown,
  ChevronUp,
  Check,
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { TravelModeSelector } from '../components/TravelModeSelector';
import type { Destination } from '../types';
import { DESTINATION_COLORS } from '../constants/destinations';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function totalWeight(destinations: Destination[]): number {
  return destinations.filter(d => d.enabled).reduce((s, d) => s + d.weight, 0);
}

function pct(dest: Destination, dests: Destination[]): number {
  const total = totalWeight(dests);
  if (!total || !dest.enabled) return 0;
  return Math.round((dest.weight / total) * 100);
}

// ---------------------------------------------------------------------------
// Add Destination form
// ---------------------------------------------------------------------------

const EMPTY_FORM = { name: '', shortLabel: '', address: '' };

const AddDestinationForm: React.FC<{ onAdd: () => void }> = ({ onAdd }) => {
  const { addDestination } = useAppContext();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.address.trim()) {
      setError('Name and address are required.');
      return;
    }
    addDestination({
      name: form.name.trim(),
      shortLabel: form.shortLabel.trim() || form.name.trim().slice(0, 4).toUpperCase(),
      address: form.address.trim(),
      lat: 0,
      lng: 0,
      weight: 25,
      enabled: true,
    });
    setForm(EMPTY_FORM);
    setError('');
    setOpen(false);
    onAdd();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium mt-2"
      >
        <Plus className="w-4 h-4" />
        Add destination
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 p-4 border border-blue-100 bg-blue-50/50 rounded-xl space-y-3"
    >
      <p className="text-xs font-semibold text-blue-800">New destination</p>

      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <input
            type="text"
            placeholder="Name (e.g. Harvard Chan School)"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <input
            type="text"
            placeholder="Short (≤6)"
            maxLength={6}
            value={form.shortLabel}
            onChange={e => setForm(f => ({ ...f, shortLabel: e.target.value }))}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <input
        type="text"
        placeholder="Address (e.g. 677 Huntington Ave, Boston, MA 02115)"
        value={form.address}
        onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white placeholder-gray-400 focus:outline-none focus:border-blue-400"
      />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          className="flex items-center gap-1.5 text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700"
        >
          <Check className="w-3.5 h-3.5" />
          Add
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setForm(EMPTY_FORM); setError(''); }}
          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 bg-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Destination row
// ---------------------------------------------------------------------------

interface DestRowProps {
  dest: Destination;
  allDests: Destination[];
}

const DestinationRow: React.FC<DestRowProps> = ({ dest, allDests }) => {
  const { updateDestination, removeDestination } = useAppContext();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: dest.name, shortLabel: dest.shortLabel, address: dest.address });

  const isDefault = ['hms', 'seas', 'sec', 'csail'].includes(dest.id);
  const weightPct = pct(dest, allDests);

  const saveEdit = () => {
    if (!draft.name.trim() || !draft.address.trim()) return;
    updateDestination(dest.id, {
      name: draft.name.trim(),
      shortLabel: draft.shortLabel.trim() || draft.name.trim().slice(0, 4).toUpperCase(),
      address: draft.address.trim(),
    });
    setEditing(false);
  };

  return (
    <div
      className={[
        'border rounded-xl p-3.5 transition-all',
        dest.enabled ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 opacity-60',
      ].join(' ')}
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Enable toggle */}
        <button
          onClick={() => updateDestination(dest.id, { enabled: !dest.enabled })}
          className={[
            'w-8 h-4.5 rounded-full relative transition-colors flex-shrink-0',
            dest.enabled ? 'bg-blue-600' : 'bg-gray-200',
          ].join(' ')}
          style={{ height: 18, width: 32 }}
          aria-label={dest.enabled ? 'Disable' : 'Enable'}
        >
          <span
            className={[
              'absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform',
              dest.enabled ? 'translate-x-[14px]' : 'translate-x-0.5',
            ].join(' ')}
          />
        </button>

        {/* Color dot */}
        <div
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: dest.color }}
        />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{dest.name}</p>
          <p className="text-xs text-gray-400 truncate">{dest.address}</p>
        </div>

        {/* Weight % */}
        {dest.enabled && (
          <span className="text-xs font-medium text-gray-500 flex-shrink-0">{weightPct}%</span>
        )}

        {/* Edit / delete */}
        <button
          onClick={() => { setEditing(!editing); setDraft({ name: dest.name, shortLabel: dest.shortLabel, address: dest.address }); }}
          className="text-gray-300 hover:text-gray-600 transition-colors flex-shrink-0"
          aria-label="Edit"
        >
          {editing ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {!isDefault && (
          <button
            onClick={() => removeDestination(dest.id)}
            className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0"
            aria-label="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Weight slider */}
      {dest.enabled && (
        <div className="mt-3 flex items-center gap-3">
          <span className="text-[11px] text-gray-400 w-12 flex-shrink-0">Priority</span>
          <input
            type="range"
            min={1}
            max={100}
            value={dest.weight}
            onChange={e => updateDestination(dest.id, { weight: Number(e.target.value) })}
            className="flex-1 h-1.5 accent-blue-600 cursor-pointer"
          />
          <span className="text-[11px] font-mono text-gray-500 w-6 text-right flex-shrink-0">
            {dest.weight}
          </span>
        </div>
      )}

      {/* Edit form */}
      {editing && (
        <div className="mt-3 space-y-2 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <input
                type="text"
                value={draft.name}
                onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
                placeholder="Name"
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400"
              />
            </div>
            <input
              type="text"
              value={draft.shortLabel}
              onChange={e => setDraft(d => ({ ...d, shortLabel: e.target.value }))}
              placeholder="Short"
              maxLength={6}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400"
            />
          </div>
          <input
            type="text"
            value={draft.address}
            onChange={e => setDraft(d => ({ ...d, address: e.target.value }))}
            placeholder="Address"
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-2">
            <button
              onClick={saveEdit}
              className="text-xs font-semibold bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-gray-500 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>

          {/* Color picker */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[11px] text-gray-400">Color</span>
            {DESTINATION_COLORS.map(c => (
              <button
                key={c}
                onClick={() => updateDestination(dest.id, { color: c })}
                className={[
                  'w-5 h-5 rounded-full border-2 transition-all',
                  dest.color === c ? 'border-gray-700 scale-110' : 'border-transparent hover:scale-110',
                ].join(' ')}
                style={{ backgroundColor: c }}
                aria-label={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Settings page
// ---------------------------------------------------------------------------

export const SettingsPage: React.FC = () => {
  const { destinations, enabledModes, resetDestinations } = useAppContext();
  const enabledDests = destinations.filter(d => d.enabled);
  const total = totalWeight(destinations);
  const [addKey, setAddKey] = useState(0); // force re-render form after add

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-10">

      {/* ── Travel Modes ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Travel Modes</h2>
        <p className="text-sm text-gray-500 mb-4">
          Only selected modes are fetched and displayed. At least one must be active.
        </p>
        <TravelModeSelector />
        <p className="mt-2 text-xs text-gray-400">
          Active: {enabledModes.join(', ')}
        </p>
      </section>

      {/* ── Commute Assumptions ── */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 mb-1">Commute Assumptions</h2>
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Weekday 9:00 AM departure</p>
            <p className="text-xs text-amber-700 mt-1">
              All commute calculations use the next weekday at 9:00 AM — not "leave now".
              This gives schedule-based transit times and traffic-aware driving estimates
              representative of a real morning commute.
            </p>
          </div>
        </div>
      </section>

      {/* ── Destinations ── */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-gray-900">Destinations</h2>
          <button
            onClick={resetDestinations}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reset to defaults
          </button>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {enabledDests.length} of {destinations.length} enabled.
          {' '}Priority sliders control relative weighting in the score
          (total weight = {total}).
        </p>

        {/* Weight distribution bar */}
        {enabledDests.length > 0 && (
          <div className="flex rounded-full overflow-hidden h-2 mb-5">
            {enabledDests.map(d => (
              <div
                key={d.id}
                style={{ width: `${pct(d, destinations)}%`, backgroundColor: d.color }}
                title={`${d.shortLabel}: ${pct(d, destinations)}%`}
              />
            ))}
          </div>
        )}

        <div className="space-y-2">
          {destinations.map(d => (
            <DestinationRow key={d.id} dest={d} allDests={destinations} />
          ))}
        </div>

        <AddDestinationForm key={addKey} onAdd={() => setAddKey(k => k + 1)} />

        {destinations.length === 0 && (
          <div className="flex items-center gap-2 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl">
            <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
            <p className="text-xs text-red-700">
              No destinations defined. Add at least one to calculate commute times.
            </p>
          </div>
        )}
      </section>
    </div>
  );
};
