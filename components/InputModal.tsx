import React, { useState } from 'react';
import { X, Mic, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';

interface InputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
}

export const InputModal: React.FC<InputModalProps> = ({ isOpen, onClose, onSave }) => {
  const [content, setContent] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setIsProcessing(true);
    try {
      await onSave(content);
      setContent('');
      onClose();
    } catch (error) {
      console.error(error);
      alert('Failed to save entry. Check if the backend is running.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            New Entry
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What did you work on? E.g., 'Implemented JWT auth middleware using Node.js and Redis for session management...'"
            className="w-full h-40 p-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-all outline-none text-slate-700 placeholder:text-slate-400"
            autoFocus
          />

          <div className="flex items-center justify-between text-slate-500">
            <div className="flex space-x-2">
              <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Attach Image (Demo)">
                <ImageIcon className="w-5 h-5" />
              </button>
              <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors" title="Voice Input (Demo)">
                <Mic className="w-5 h-5" />
              </button>
            </div>
            <span className="text-xs">AI will auto-tag</span>
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isProcessing || !content.trim()}
            className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-lg shadow-indigo-200 transition-all flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              'Save Log'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
