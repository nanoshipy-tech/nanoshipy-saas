import React, { useState } from 'react';
import { RefreshCw, Trash2, X, AlertTriangle } from 'lucide-react';

interface BulkNdrActionBarProps {
  selectedCount: number;
  onClearSelection: () => void;
  onBulkAction: (actionType: 'reattempt' | 'mark_rto', notes: string) => Promise<void>;
  loading: boolean;
}

export function BulkNdrActionBar({ selectedCount, onClearSelection, onBulkAction, loading }: BulkNdrActionBarProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [actionType, setActionType] = useState<'reattempt' | 'mark_rto'>('reattempt');
  const [notes, setNotes] = useState('');

  if (selectedCount === 0) return null;

  const handleActionClick = (type: 'reattempt' | 'mark_rto') => {
    setActionType(type);
    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    await onBulkAction(actionType, notes.trim());
    setNotes('');
    setShowConfirm(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <div className="bg-[#131620] border border-white/[0.08] text-white rounded-2xl shadow-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 backdrop-blur-md">
        
        {/* Left info */}
        <div className="flex items-center space-x-3">
          <div className="h-6 w-6 rounded-full bg-[#8410DC] flex items-center justify-center text-xs font-bold font-mono">
            {selectedCount}
          </div>
          <div>
            <p className="text-xs font-bold">Exceptions Selected</p>
            <p className="text-[10px] text-slate-400">Perform a bulk dispatch action on these exceptions.</p>
          </div>
        </div>

        {/* Action Buttons */}
        {!showConfirm ? (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleActionClick('reattempt')}
              disabled={loading}
              className="flex items-center space-x-1.5 bg-[#8410DC] hover:bg-indigo-750 text-xs font-bold px-3 py-2 rounded-xl transition shadow-md outline-none"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Bulk Reattempt</span>
            </button>
            <button
              onClick={() => handleActionClick('mark_rto')}
              disabled={loading}
              className="flex items-center space-x-1.5 bg-rose-600 hover:bg-rose-700 text-xs font-bold px-3 py-2 rounded-xl transition shadow-md outline-none"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Bulk RTO</span>
            </button>
            <button
              onClick={onClearSelection}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition outline-none"
              title="Cancel Selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          /* Confirm Overlay Form */
          <div className="flex flex-1 flex-col md:flex-row items-center gap-3 w-full">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={`Enter notes for bulk ${actionType === 'reattempt' ? 'reattempt' : 'RTO'}...`}
              className="flex-1 text-xs bg-[#0f1117] border border-white/[0.08] rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500 outline-none"
            />
            <div className="flex items-center space-x-2 shrink-0">
              <button
                onClick={handleConfirmSubmit}
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700 text-xs font-bold px-3.5 py-2 rounded-xl transition outline-none"
              >
                {loading ? 'Processing...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="bg-white/[0.04] hover:bg-white/[0.08] text-xs font-bold px-3.5 py-2 rounded-xl transition text-slate-300 outline-none"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
