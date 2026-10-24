/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { runPhase3Tests, TestResult } from '../tests/phase3-tests.ts';
import { X, ShieldCheck, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface TestSuiteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TestSuiteModal({ isOpen, onClose }: TestSuiteModalProps) {
  const [testRun, setTestRun] = useState<{ passed: boolean; results: TestResult[] } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTestRun(runPhase3Tests());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full p-5 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              Knowledge Graph Verification Suite ({testRun?.results.length ?? 0} Acceptance Tests)
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status banner */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
          <div className="flex items-center space-x-2">
            {testRun?.passed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <XCircle className="w-4 h-4 text-rose-400" />
            )}
            <span className="text-xs font-mono font-medium text-slate-200">
              {testRun?.passed ? 'ALL AUDIT TESTS PASSED (100%)' : 'TESTS FAILED'}
            </span>
          </div>
          <button
            onClick={() => setTestRun(runPhase3Tests())}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono transition"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Re-run</span>
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {testRun?.results.map((r, i) => (
            <div
              key={i}
              className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex items-start justify-between"
            >
              <div className="space-y-1 pr-4">
                <div className="flex items-center space-x-2">
                  {r.passed ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span className="text-xs font-semibold text-slate-200 font-mono">
                    {r.name}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 pl-5.5 font-mono">{r.message}</p>
              </div>
              <span
                className={`text-[9.5px] px-2 py-0.5 rounded font-mono uppercase font-bold shrink-0 ${
                  r.passed
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                }`}
              >
                {r.passed ? 'PASSED' : 'FAILED'}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 font-mono"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
