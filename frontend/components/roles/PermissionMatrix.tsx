'use client';

import React from 'react';
import { Shield, CheckSquare, Square } from 'lucide-react';

export type PermissionCatalogue = Record<string, { key: string; description: string }[]>;

interface Props {
  catalogue: PermissionCatalogue;
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
}

const ACTION_ORDER = ['view', 'create', 'edit', 'delete', 'export', 'manage', 'action', 'bulk_upload', 'label_generate', 'cancel'];

export const PermissionMatrix = ({ catalogue, selectedKeys, onChange, disabled = false }: Props) => {
  const selectedSet = new Set(selectedKeys);

  const handleToggle = (key: string, moduleName: string, allModuleKeys: string[]) => {
    if (disabled) return;
    const next = new Set(selectedKeys);
    const isChecked = next.has(key);

    const isViewKey = key.endsWith('.view');

    if (isChecked) {
      next.delete(key);
      // If unchecking view, also uncheck other actions in this module
      if (isViewKey) {
        allModuleKeys.forEach((k) => {
          if (!k.endsWith('.view')) next.delete(k);
        });
      }
    } else {
      next.add(key);
      // If checking any action, automatically ensure view is checked if view exists
      const viewKey = allModuleKeys.find((k) => k.endsWith('.view'));
      if (viewKey) {
        next.add(viewKey);
      }
    }

    onChange(Array.from(next));
  };

  const handleToggleModule = (moduleName: string, keysInModule: string[]) => {
    if (disabled) return;
    const allSelected = keysInModule.every((k) => selectedSet.has(k));
    const next = new Set(selectedKeys);

    if (allSelected) {
      keysInModule.forEach((k) => next.delete(k));
    } else {
      keysInModule.forEach((k) => next.add(k));
    }
    onChange(Array.from(next));
  };

  const handleSelectAll = () => {
    if (disabled) return;
    const allKeys: string[] = [];
    Object.values(catalogue).forEach((perms) => {
      perms.forEach((p) => allKeys.push(p.key));
    });
    onChange(Array.from(new Set(allKeys)));
  };

  const handleClearAll = () => {
    if (disabled) return;
    onChange([]);
  };

  const totalKeys = Object.values(catalogue).reduce((acc, perms) => acc + perms.length, 0);

  return (
    <div className="space-y-6">
      {/* Global Toolbar */}
      {!disabled && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/[0.08] rounded-xl">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#8410DC] dark:text-[#D6A8FF]" />
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Active Permissions:
            </span>
            <span className="px-2 py-0.5 text-[11px] font-bold bg-purple-100 text-[#5B069A] dark:bg-purple-950/80 dark:text-[#D6A8FF] rounded-full">
              {selectedKeys.length} / {totalKeys}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="px-2.5 py-1 text-xs font-medium bg-[#8410DC] hover:bg-[#6B0CB5] text-white rounded-lg transition shadow-xs"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-2.5 py-1 text-xs font-medium bg-white hover:bg-slate-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-white/[0.08] rounded-lg transition"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Module Cards */}
      {Object.entries(catalogue).map(([moduleName, perms]) => {
        const keysInModule = perms.map((p) => p.key);
        const allSelected = keysInModule.every((k) => selectedSet.has(k));
        const selectedCount = keysInModule.filter((k) => selectedSet.has(k)).length;

        // Sort perms according to ACTION_ORDER
        const sortedPerms = [...perms].sort((a, b) => {
          const actA = a.key.split('.').pop() || '';
          const actB = b.key.split('.').pop() || '';
          const idxA = ACTION_ORDER.indexOf(actA);
          const idxB = ACTION_ORDER.indexOf(actB);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.key.localeCompare(b.key);
        });

        return (
          <div
            key={moduleName}
            className="border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden bg-white dark:bg-[#131620] shadow-xs"
          >
            <div className="flex justify-between items-center px-4 py-3 bg-slate-50/70 dark:bg-white/[0.02] border-b border-slate-100 dark:border-white/[0.06]">
              <div className="flex items-center gap-2.5">
                <h3 className="text-sm font-semibold capitalize text-slate-800 dark:text-white">
                  {moduleName.replace(/^user\./, '').replace(/_/g, ' ')}
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/[0.08] text-slate-600 dark:text-slate-300">
                  {selectedCount} / {keysInModule.length}
                </span>
              </div>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleToggleModule(moduleName, keysInModule)}
                  className="text-xs font-medium text-[#8410DC] hover:text-[#5B069A] dark:text-[#D6A8FF] dark:hover:text-purple-300 outline-none"
                >
                  {allSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedPerms.map((p) => {
                const isChecked = selectedSet.has(p.key);
                const actionName = p.key.split('.').pop() || '';

                return (
                  <label
                    key={p.key}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border transition cursor-pointer select-none ${
                      isChecked
                        ? 'border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20'
                        : 'border-slate-100 dark:border-white/[0.04] hover:bg-slate-50/50 dark:hover:bg-white/[0.02]'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-white/[0.12] text-[#8410DC] focus:ring-purple-500 disabled:opacity-50 bg-white dark:bg-[#0f1117] cursor-pointer"
                      checked={isChecked}
                      onChange={() => handleToggle(p.key, moduleName, keysInModule)}
                      disabled={disabled}
                    />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                          {actionName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono truncate">
                          ({p.key})
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {p.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
