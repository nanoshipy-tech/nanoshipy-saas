'use client';

import React, { useMemo } from 'react';
import { Check, Shield, HelpCircle, CheckSquare, Square } from 'lucide-react';

export interface AdminModuleConfig {
  moduleKey: string;
  label: string;
  group: string;
  description: string;
  actions: string[]; // e.g. ['view', 'create', 'edit', 'delete', 'export', 'approve']
}

interface AdminPermissionMatrixProps {
  catalog: AdminModuleConfig[];
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  readOnly?: boolean;
}

const ACTION_COLUMNS = [
  { key: 'view', label: 'View', color: 'text-blue-600' },
  { key: 'create', label: 'Create', color: 'text-emerald-600' },
  { key: 'edit', label: 'Edit', color: 'text-amber-600' },
  { key: 'delete', label: 'Delete', color: 'text-rose-600' },
  { key: 'export', label: 'Export', color: 'text-purple-600' },
  { key: 'approve', label: 'Approve', color: 'text-indigo-600' },
];

export const AdminPermissionMatrix: React.FC<AdminPermissionMatrixProps> = ({
  catalog,
  selectedKeys,
  onChange,
  readOnly = false,
}) => {
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  // Group modules by group
  const groupedModules = useMemo(() => {
    const groups: Record<string, AdminModuleConfig[]> = {};
    catalog.forEach((mod) => {
      const g = mod.group || 'General';
      if (!groups[g]) groups[g] = [];
      groups[g].push(mod);
    });
    return groups;
  }, [catalog]);

  const toggleKey = (key: string, isView: boolean, moduleKey: string, allowedActions: string[]) => {
    if (readOnly) return;

    const next = new Set(selectedSet);
    const isCurrentlyChecked = next.has(key);

    if (isCurrentlyChecked) {
      next.delete(key);
      // If unchecking 'view', uncheck all actions for this module
      if (isView) {
        allowedActions.forEach((act) => {
          next.delete(`${moduleKey}.${act}`);
        });
      }
    } else {
      next.add(key);
      // If checking any action, automatically ensure 'view' is checked
      if (!isView) {
        next.add(`${moduleKey}.view`);
      }
    }

    onChange(Array.from(next));
  };

  const toggleModuleAll = (mod: AdminModuleConfig) => {
    if (readOnly) return;
    const allKeys = mod.actions.map((act) => `${mod.moduleKey}.${act}`);
    const allChecked = allKeys.every((k) => selectedSet.has(k));

    const next = new Set(selectedSet);
    if (allChecked) {
      allKeys.forEach((k) => next.delete(k));
    } else {
      allKeys.forEach((k) => next.add(k));
    }
    onChange(Array.from(next));
  };

  const toggleGroupAll = (modules: AdminModuleConfig[]) => {
    if (readOnly) return;
    const groupKeys: string[] = [];
    modules.forEach((mod) => {
      mod.actions.forEach((act) => {
        groupKeys.push(`${mod.moduleKey}.${act}`);
      });
    });

    const allChecked = groupKeys.every((k) => selectedSet.has(k));
    const next = new Set(selectedSet);

    if (allChecked) {
      groupKeys.forEach((k) => next.delete(k));
    } else {
      groupKeys.forEach((k) => next.add(k));
    }
    onChange(Array.from(next));
  };

  const selectAll = () => {
    if (readOnly) return;
    const allKeys: string[] = [];
    catalog.forEach((mod) => {
      mod.actions.forEach((act) => {
        allKeys.push(`${mod.moduleKey}.${act}`);
      });
    });
    onChange(Array.from(new Set(allKeys)));
  };

  const clearAll = () => {
    if (readOnly) return;
    onChange([]);
  };

  const totalPossiblePerms = useMemo(() => {
    let count = 0;
    catalog.forEach((m) => (count += m.actions.length));
    return count;
  }, [catalog]);

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Active Permissions:
            </span>
            <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 rounded-full">
              {selectedKeys.length} / {totalPossiblePerms}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors shadow-sm"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Permission Groups */}
      {Object.entries(groupedModules).map(([groupName, modules]) => {
        const groupKeys: string[] = [];
        modules.forEach((mod) => {
          mod.actions.forEach((act) => {
            groupKeys.push(`${mod.moduleKey}.${act}`);
          });
        });
        const groupSelectedCount = groupKeys.filter((k) => selectedSet.has(k)).length;
        const allGroupSelected = groupKeys.length > 0 && groupSelectedCount === groupKeys.length;

        return (
          <div
            key={groupName}
            className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm"
          >
            {/* Group Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-900 dark:text-white text-sm">
                  {groupName}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                  {groupSelectedCount} / {groupKeys.length}
                </span>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => toggleGroupAll(modules)}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {allGroupSelected ? 'Deselect Group' : 'Select Group'}
                </button>
              )}
            </div>

            {/* Modules Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-400">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 uppercase font-semibold text-[11px] text-slate-500">
                  <tr>
                    <th scope="col" className="px-5 py-3 min-w-[200px]">
                      Module & Scope
                    </th>
                    {ACTION_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        scope="col"
                        className={`px-3 py-3 text-center min-w-[70px] ${col.color}`}
                      >
                        {col.label}
                      </th>
                    ))}
                    {!readOnly && (
                      <th scope="col" className="px-3 py-3 text-right min-w-[80px]">
                        Quick
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {modules.map((mod) => {
                    const modAllKeys = mod.actions.map((act) => `${mod.moduleKey}.${act}`);
                    const modAllSelected = modAllKeys.every((k) => selectedSet.has(k));

                    return (
                      <tr
                        key={mod.moduleKey}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {mod.label}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-sm mt-0.5">
                            {mod.description}
                          </div>
                        </td>

                        {ACTION_COLUMNS.map((col) => {
                          const hasAction = mod.actions.includes(col.key);
                          if (!hasAction) {
                            return (
                              <td key={col.key} className="px-3 py-3.5 text-center text-slate-300 dark:text-slate-700">
                                —
                              </td>
                            );
                          }

                          const permKey = `${mod.moduleKey}.${col.key}`;
                          const isChecked = selectedSet.has(permKey);

                          return (
                            <td key={col.key} className="px-3 py-3.5 text-center">
                              <label className="inline-flex items-center justify-center cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={readOnly}
                                  onChange={() =>
                                    toggleKey(permKey, col.key === 'view', mod.moduleKey, mod.actions)
                                  }
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 dark:bg-slate-800 dark:border-slate-700 dark:checked:bg-indigo-500 cursor-pointer disabled:opacity-50"
                                />
                              </label>
                            </td>
                          );
                        })}

                        {!readOnly && (
                          <td className="px-3 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => toggleModuleAll(mod)}
                              className="text-[11px] text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            >
                              {modAllSelected ? 'Clear' : 'All'}
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
};
