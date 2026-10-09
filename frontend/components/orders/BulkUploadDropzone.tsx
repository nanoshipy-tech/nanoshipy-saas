import React, { useCallback, useState } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { Spinner } from '../ui/Spinner';

interface BulkUploadDropzoneProps {
  onUpload: (file: File) => Promise<void>;
  loading: boolean;
}

export const BulkUploadDropzone: React.FC<BulkUploadDropzoneProps> = ({ onUpload, loading }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateAndSetFile = (file: File) => {
    setError(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !['csv', 'xlsx', 'xls'].includes(ext)) {
      setError('Invalid file type. Only .csv, .xlsx, and .xls files are allowed.');
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = () => {
    if (selectedFile) {
      onUpload(selectedFile);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/30 p-3 rounded-lg flex items-center space-x-2 text-sm">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition ${dragActive ? 'border-[#8410DC] bg-purple-50/50 dark:bg-purple-950/20' : 'border-slate-300 dark:border-white/[0.08] hover:border-slate-400 dark:hover:border-white/[0.15] bg-white dark:bg-[#131620]'}`}
      >
        <input
          type="file"
          id="import-file-input"
          accept=".csv, .xlsx, .xls"
          onChange={handleFileChange}
          className="hidden"
          disabled={loading}
        />
        <label htmlFor="import-file-input" className="cursor-pointer flex flex-col items-center">
          <UploadCloud className={`h-12 w-12 mb-3 transition ${dragActive ? 'text-[#8410DC]' : 'text-slate-400 dark:text-slate-500'}`} />
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Drag & drop your file here</span>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">Accepts CSV, XLSX or XLS formats</span>
        </label>
      </div>

      {selectedFile && (
        <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-indigo-900/30 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <FileSpreadsheet className="h-6 w-6 text-[#8410DC] dark:text-[#D6A8FF] shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{selectedFile.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
          <button
            onClick={handleUploadSubmit}
            disabled={loading}
            className="bg-gradient-to-r from-[#5B069A] to-[#8410DC] hover:from-[#4d0582] hover:to-[#730ec2] text-white font-semibold text-xs py-2 px-4 rounded-lg shadow transition flex items-center space-x-2 disabled:bg-indigo-300 cursor-pointer shrink-0 outline-none"
          >
            {loading ? (
              <>
                <Spinner className="h-3 w-3 text-white" />
                <span>Importing...</span>
              </>
            ) : (
              <span>Process File</span>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
