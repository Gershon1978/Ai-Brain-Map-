/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GraphPayload } from '../types/graph.ts';
import { importGraph } from '../services/graph-export.ts';
import seedEvidence from '../data/seed-evidence.json';
import { X, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (payload: GraphPayload) => void;
}

export function ImportModal({ isOpen, onClose, onImportSuccess }: ImportModalProps) {
  const [inputText, setInputText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [validationSuccess, setValidationSuccess] = useState(false);

  if (!isOpen) return null;

  const handleValidateAndImport = () => {
    setErrors([]);
    setValidationSuccess(false);

    // Build chunk lookup map from seedEvidence
    const chunkLookup: Record<string, string> = {};
    const chunksObj = (seedEvidence as unknown as { chunks?: Record<string, { text: string }> }).chunks || {};
    for (const [k, v] of Object.entries(chunksObj)) {
      chunkLookup[k] = v.text;
    }

    const result = importGraph(inputText, chunkLookup);
    if (!result.valid || !result.payload) {
      setErrors(result.errors);
    } else {
      setValidationSuccess(true);
      setTimeout(() => {
        onImportSuccess(result.payload!);
        onClose();
      }, 500);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setInputText(String(event.target?.result || ''));
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-sky-400" />
            <h3 className="text-sm font-semibold text-slate-100">
              Import Mechanical Graph (Strict Validation)
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Paste JSON / JSONL graph data below or upload a file. The importer strictly enforces schema validity, quote substrings, and refuses any unknown relation types outside the ontology.
        </p>

        <div className="space-y-2">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder='Paste JSON or JSONL lines here...'
            rows={8}
            className="w-full text-xs font-mono p-3 bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
          />

          <div className="flex items-center justify-between text-xs">
            <input
              type="file"
              accept=".json,.jsonl,.txt"
              onChange={handleFileUpload}
              className="text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border file:border-slate-700 file:text-xs file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
            />
          </div>
        </div>

        {/* Errors view */}
        {errors.length > 0 && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 space-y-1.5 max-h-36 overflow-y-auto">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>Import Refused ({errors.length} validation issues):</span>
            </div>
            <ul className="list-disc pl-5 text-[11px] font-mono text-rose-200 space-y-0.5">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {validationSuccess && (
          <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800/80 flex items-center space-x-2 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Validation Passed! Ingesting graph...</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded text-xs font-medium bg-slate-800 text-slate-300 hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={handleValidateAndImport}
            disabled={!inputText.trim()}
            className="px-4 py-1.5 rounded text-xs font-medium bg-sky-600 text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Validate & Import
          </button>
        </div>
      </div>
    </div>
  );
}
