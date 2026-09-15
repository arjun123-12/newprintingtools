'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileImage,
  Upload,
  Loader2,
  X,
  Layers,
  Type,
  Image as ImageIcon,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Maximize2,
} from 'lucide-react';
import { CanvasManager } from '../canvas/CanvasManager';
import {
  parsePsdFile,
  uploadPsdLayerAssets,
  ImportedPsdDocument,
} from '../services/psdImportService';

export interface PsdImportButtonProps {
  canvasManager: CanvasManager | null;
  maxSizeMb?: number;
  className?: string;
  buttonLabel?: string;
  variant?: 'button' | 'dropzone-button' | 'compact';
  onImportComplete?: () => void;
}

export const PsdImportButton: React.FC<PsdImportButtonProps> = ({
  canvasManager,
  maxSizeMb = 50,
  className = '',
  buttonLabel = 'Import PSD',
  variant = 'button',
  onImportComplete,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const notificationTimerRef = useRef<number | null>(null);

  const [isReading, setIsReading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [pendingDoc, setPendingDoc] = useState<ImportedPsdDocument | null>(null);
  const [fitToArtwork, setFitToArtwork] = useState(true);
  const [clearCanvas, setClearCanvas] = useState(false);

  const showNotification = useCallback(
    (type: 'success' | 'error', text: string) => {
      setNotification({ type, text });
      if (notificationTimerRef.current !== null) {
        window.clearTimeout(notificationTimerRef.current);
      }
      notificationTimerRef.current = window.setTimeout(() => {
        setNotification((prev) => (prev?.text === text ? null : prev));
        notificationTimerRef.current = null;
      }, 5000);
    },
    []
  );

  useEffect(() => () => {
    if (notificationTimerRef.current !== null) {
      window.clearTimeout(notificationTimerRef.current);
    }
  }, []);

  const resetFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleCloseModal = useCallback(() => {
    if (isImporting) return;
    setPendingDoc(null);
    setStatusMessage('');
    resetFileInput();
  }, [isImporting, resetFileInput]);

  const openFilePicker = useCallback(() => {
    if (isReading || isImporting) return;
    if (!canvasManager) {
      showNotification('error', 'The artwork canvas is not ready yet. Wait a moment and try again.');
      return;
    }
    // Allows selecting the same PSD again after an earlier failure/cancel.
    resetFileInput();
    fileInputRef.current?.click();
  }, [canvasManager, isReading, isImporting, resetFileInput, showNotification]);

  const handleFileSelect = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const maxSizeBytes = maxSizeMb * 1024 * 1024;

      if (!canvasManager) {
        showNotification('error', 'The artwork canvas is not ready yet. Wait a moment and try again.');
        resetFileInput();
        return;
      }

      if (!file.name.toLowerCase().endsWith('.psd')) {
        showNotification('error', 'Please choose a standard Photoshop .psd file. PSB files are not supported.');
        resetFileInput();
        return;
      }

      if (file.size > maxSizeBytes) {
        showNotification(
          'error',
          `The PSD file exceeds the maximum size limit of ${maxSizeMb} MB.`
        );
        resetFileInput();
        return;
      }

      setIsReading(true);
      setStatusMessage('Reading and parsing Photoshop file...');

      try {
        const doc = await parsePsdFile(file, file.name, { maxSizeBytes });
        setPendingDoc(doc);
        setStatusMessage('');
      } catch (err: any) {
        const msg = err?.message || 'Could not parse the selected PSD file.';
        showNotification('error', msg);
        resetFileInput();
      } finally {
        setIsReading(false);
      }
    },
    [canvasManager, maxSizeMb, showNotification, resetFileInput]
  );

  const handleConfirmImport = useCallback(async () => {
    if (!pendingDoc || isImporting) return;
    if (!canvasManager) {
      showNotification('error', 'The artwork canvas is not ready. Close this dialog and try again.');
      return;
    }

    setIsImporting(true);
    setStatusMessage('Uploading layer assets to server storage...');

    try {
      // 1. Upload extracted raster layers to permanent storage
      const uploadedDoc = await uploadPsdLayerAssets(
        pendingDoc,
        (current, total) => {
          setStatusMessage(
            `Uploading layer assets (${current}/${total})...`
          );
        }
      );

      // 2. Build canvas artwork through CanvasManager
      setStatusMessage('Building artwork objects on canvas...');
      await canvasManager.importPsdDocument(uploadedDoc, {
        fitToArtwork,
        clearCanvas,
      });

      showNotification(
        'success',
        `Successfully imported "${pendingDoc.name}" (${pendingDoc.totalLayers} layers).`
      );

      setPendingDoc(null);
      resetFileInput();

      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to complete PSD artwork import.';
      showNotification('error', msg);
    } finally {
      setIsImporting(false);
      setStatusMessage('');
    }
  }, [
    canvasManager,
    pendingDoc,
    isImporting,
    fitToArtwork,
    clearCanvas,
    showNotification,
    resetFileInput,
    onImportComplete,
  ]);

  return (
    <>
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".psd,image/vnd.adobe.photoshop,application/x-photoshop,application/photoshop"
        onChange={handleFileSelect}
        disabled={isReading || isImporting}
        className="hidden"
      />

      {/* Button Variants */}
      {variant === 'compact' ? (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isReading || isImporting}
          title={`Import Photoshop PSD (up to ${maxSizeMb} MB)`}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${isReading || isImporting
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800'
            } ${className}`}
        >
          {isReading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <FileImage className="w-3.5 h-3.5 text-indigo-600" />
          )}
          <span>{isReading ? 'Reading…' : buttonLabel}</span>
        </button>
      ) : variant === 'dropzone-button' ? (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isReading || isImporting}
          className={`flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-700 text-xs font-bold hover:bg-indigo-100 transition shadow-2xs ${isReading || isImporting ? 'opacity-60 cursor-not-allowed' : ''
            } ${className}`}
        >
          {isReading ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
          ) : (
            <FileImage className="w-4 h-4 text-indigo-600" />
          )}
          <span>{isReading ? 'Reading PSD…' : buttonLabel}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={openFilePicker}
          disabled={isReading || isImporting}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition shadow-xs ${isReading || isImporting
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
            } ${className}`}
        >
          {isReading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Upload className="w-4 h-4" />
          )}
          <span>{isReading ? 'Reading PSD…' : buttonLabel}</span>
        </button>
      )}

      {/* Non-blocking Floating Notification */}
      {notification && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-xs font-semibold shadow-2xl transition-all animate-in fade-in slide-in-from-top-3 ${notification.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
            }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{notification.text}</span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="ml-2 hover:opacity-80"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Pre-Import Breakdown Confirmation Modal */}
      {pendingDoc && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700">
                  <FileImage className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Import Photoshop Document
                  </h3>
                  <p className="text-[11px] text-gray-500 truncate max-w-[260px]">
                    {pendingDoc.name}
                  </p>
                </div>
              </div>

              {!isImporting && (
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              {/* Document Dimensions */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs">
                <span className="font-medium text-gray-600">PSD Canvas</span>
                <span className="font-bold text-gray-900">
                  {pendingDoc.width} × {pendingDoc.height} px
                  {pendingDoc.dpi ? ` @ ${pendingDoc.dpi} DPI` : ''}
                </span>
              </div>

              {/* Layer Summary Stats */}
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 bg-gray-50/70">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                    <Layers className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400">
                      Total Layers
                    </div>
                    <div className="font-bold text-gray-900">
                      {pendingDoc.totalLayers}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 bg-gray-50/70">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                    <Type className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400">
                      Editable Text
                    </div>
                    <div className="font-bold text-gray-900">
                      {pendingDoc.editableTextCount}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 bg-gray-50/70">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                    <ImageIcon className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400">
                      Raster Layers
                    </div>
                    <div className="font-bold text-gray-900">
                      {pendingDoc.rasterCount}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 bg-gray-50/70">
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                    <Sliders className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="text-[10px] uppercase font-bold text-gray-400">
                      Rasterized
                    </div>
                    <div className="font-bold text-gray-900">
                      {pendingDoc.rasterizedCount}
                    </div>
                  </div>
                </div>
              </div>

              {/* Informational notice for rasterized features */}
              {pendingDoc.rasterizedCount > 0 && (
                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/60 text-[11px] text-amber-800">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Photoshop fidelity mode:</span>{' '}
                    {pendingDoc.rasterizedCount} layer
                    {pendingDoc.rasterizedCount > 1 ? 's' : ''} containing smart
                    objects, layer effects, masks or warped text will be imported
                    as sharp pixel layers preserving their original appearance.
                  </div>
                </div>
              )}

              {/* Import Options Checkboxes */}
              <div className="space-y-2 pt-1 border-t border-gray-100">
                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={fitToArtwork}
                    onChange={(e) => setFitToArtwork(e.target.checked)}
                    disabled={isImporting}
                    className="w-4 h-4 rounded-sm text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span>Fit proportionally to artwork dimensions (recommended)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={clearCanvas}
                    onChange={(e) => setClearCanvas(e.target.checked)}
                    disabled={isImporting}
                    className="w-4 h-4 rounded-sm text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <span>Clear existing artwork elements before import</span>
                </label>
              </div>

              {/* Progress State */}
              {isImporting && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-800 font-semibold animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                  <span>{statusMessage || 'Processing PSD import…'}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 px-5 py-4 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isImporting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-200 transition disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-xs disabled:opacity-50"
              >
                {isImporting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isImporting ? 'Importing…' : 'Import to Canvas'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
