'use client';

import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Download,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Info,
  ShieldCheck,
  Check,
  ChevronRight,
  FileText,
  Building2,
  Mail,
  MapPin,
  HelpCircle,
} from 'lucide-react';
import {
  customerService,
  CustomerImportPreviewData,
  CustomerImportRow,
  CustomerImportResultResponse,
} from '@/services/admin/customerService';

interface CustomerImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'result';

interface FieldDefinition {
  key: string;
  label: string;
  required: boolean;
  description: string;
  example: string;
}

const TARGET_FIELDS: FieldDefinition[] = [
  {
    key: 'name',
    label: 'Customer Name',
    required: true,
    description: 'Full name or primary contact person. If blank, Company Name will be used.',
    example: 'Jane Smith',
  },
  {
    key: 'email',
    label: 'Email Address',
    required: true,
    description: 'Unique login email address for the customer.',
    example: 'jane.smith@example.com.au',
  },
  {
    key: 'company_name',
    label: 'Company Name',
    required: false,
    description: 'Trading or business company name.',
    example: 'Acme Printing & Signage',
  },
  {
    key: 'phone',
    label: 'Phone Number',
    required: false,
    description: 'Contact phone or mobile number.',
    example: '0412 345 678',
  },
  {
    key: 'street_address',
    label: 'Street Address',
    required: false,
    description: 'Delivery or billing street address (Line 1).',
    example: '123 George Street',
  },
  {
    key: 'city_suburb',
    label: 'City / Suburb',
    required: false,
    description: 'Australian suburb or city.',
    example: 'Sydney',
  },
  {
    key: 'state',
    label: 'State / Territory',
    required: false,
    description: 'Australian State (NSW, VIC, QLD, WA, SA, TAS, ACT, NT).',
    example: 'NSW',
  },
  {
    key: 'postcode',
    label: 'Postcode',
    required: false,
    description: '4-digit Australian postcode (e.g. 2000, 3000, 0800).',
    example: '2000',
  },
  {
    key: 'country',
    label: 'Country',
    required: false,
    description: 'Defaults to AU (converts "Australia" to "AU").',
    example: 'Australia',
  },
];

export default function CustomerImportModal({
  isOpen,
  onClose,
  onImportSuccess,
}: CustomerImportModalProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [skipDuplicates, setSkipDuplicates] = useState<boolean>(true);

  const [previewData, setPreviewData] = useState<CustomerImportPreviewData | null>(null);
  const [resultData, setResultData] = useState<CustomerImportResultResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Preview filtering & search
  const [previewFilter, setPreviewFilter] = useState<'all' | 'valid' | 'skipped' | 'invalid'>('all');
  const [searchPreview, setSearchPreview] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtered rows for preview table (unconditional hook declaration)
  const filteredPreviewRows = useMemo(() => {
    if (!previewData || !previewData.preview_rows) return [];

    let rows = previewData.preview_rows;

    if (previewFilter !== 'all') {
      rows = rows.filter((r) => r.status === previewFilter);
    }

    if (searchPreview.trim() !== '') {
      const q = searchPreview.toLowerCase().trim();
      rows = rows.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.email?.toLowerCase().includes(q) ||
          r.company?.toLowerCase().includes(q) ||
          r.reason?.toLowerCase().includes(q)
      );
    }

    return rows;
  }, [previewData, previewFilter, searchPreview]);

  // Reset state to initial
  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setFileName('');
    setMapping({});
    setSkipDuplicates(true);
    setPreviewData(null);
    setResultData(null);
    setError(null);
    setLoading(false);
    setPreviewFilter('all');
    setSearchPreview('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  // Handle CSV file selection
  const handleFileSelect = async (selectedFile: File) => {
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv') && selectedFile.type !== 'text/csv') {
      setError('Please select a valid CSV (.csv) file.');
      return;
    }

    setFile(selectedFile);
    setFileName(selectedFile.name);
    setError(null);
    setLoading(true);

    try {
      // Run initial preview to read headers and auto-detect mappings
      const res = await customerService.previewImport(selectedFile, undefined, skipDuplicates);
      if (res.success && res.data) {
        setPreviewData(res.data);
        setMapping(res.data.mapping || {});
        setStep('mapping');
      } else {
        setError('Failed to parse CSV headers. Please verify file encoding is UTF-8.');
      }
    } catch (err: any) {
      console.error('CSV parse error:', err);
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to upload and parse CSV file.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Download sample CSV template
  const handleDownloadSample = () => {
    const sampleContent =
      'Name,Company name,Street Address,City/Suburb,State,Country,Postcode,Phone,Email\n' +
      'Jane Citizen,Pacific Printworks,100 George Street,Sydney,NSW,Australia,2000,0412345678,jane.citizen@example.com.au\n' +
      'John Miller,Melbourne Graphics,250 Collins Street,Melbourne,VIC,Australia,3000,0498765432,john.miller@example.com.au\n' +
      'Sarah Connor,Cyberdyne Signs,742 Evergreen Tce,Darwin,NT,Australia,0800,0400112233,sarah.connor@example.com.au\n' +
      'Alex Taylor,Brisbane Displays,10 Queen Street,Brisbane,QLD,Australia,4000,0422334455,alex.taylor@example.com.au';

    const blob = new Blob([sampleContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'customers-import-sample-au.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Proceed from mapping to preview with updated mappings
  const handleRunPreview = async () => {
    if (!file) return;

    // Check required email field is mapped
    if (!mapping['email']) {
      setError('Please map the required Email field to proceed.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await customerService.previewImport(file, mapping, skipDuplicates);
      if (res.success && res.data) {
        setPreviewData(res.data);
        setStep('preview');
      } else {
        setError('Failed to validate CSV rows.');
      }
    } catch (err: any) {
      console.error('Validation error:', err);
      setError(
        err.response?.data?.message ||
          err.message ||
          'Failed to validate customer rows.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Execute actual database import
  const handleExecuteImport = async () => {
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const res = await customerService.executeImport(file, mapping, skipDuplicates);
      if (res.success) {
        setResultData(res);
        setStep('result');
        onImportSuccess();
      } else {
        setError(res.message || 'Import operation failed.');
      }
    } catch (err: any) {
      console.error('Import execution error:', err);
      setError(
        err.response?.data?.message ||
          err.message ||
          'Database error occurred during customer import.'
      );
    } finally {
      setLoading(false);
    }
  };

  // Download skipped / invalid rows report
  const handleDownloadReport = () => {
    if (resultData?.report_csv) {
      customerService.downloadImportReport(
        resultData.report_csv,
        `customer-import-issues-${new Date().toISOString().slice(0, 10)}.csv`
      );
    } else if (previewData) {
      // Generate client-side report from preview data if needed
      const issues = [...(previewData.skipped_rows || []), ...(previewData.invalid_rows || [])];
      let csv = 'Row Number,Status,Name,Company,Email,Phone,Street Address,City/Suburb,State,Postcode,Country,Reason\n';
      issues.forEach((r) => {
        csv += `"${r.row_number}","${r.status.toUpperCase()}","${r.name || ''}","${r.company || ''}","${r.email || ''}","${r.phone || ''}","${r.street_address || ''}","${r.city_suburb || ''}","${r.state || ''}","${r.postcode || ''}","${r.country || 'AU'}","${(r.reason || (r.errors ? r.errors.join(' | ') : '')).replace(/"/g, '""')}"\n`;
      });
      customerService.downloadImportReport(csv, `customer-preview-issues-${new Date().toISOString().slice(0, 10)}.csv`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* ─── Header ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/95 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Import Customers from CSV
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  AU Format
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Bulk add customers, trade accounts, and Australian delivery addresses
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── Step Breadcrumbs ──────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-3 bg-slate-950/60 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-md ${
                step === 'upload'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 bg-slate-800/50'
              }`}
            >
              1. Upload CSV
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span
              className={`flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-md ${
                step === 'mapping'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : step === 'preview' || step === 'result'
                  ? 'text-sky-400 bg-sky-500/10 border border-sky-500/20'
                  : 'text-slate-500 bg-slate-800/30'
              }`}
            >
              2. Field Mapping
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span
              className={`flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-md ${
                step === 'preview'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : step === 'result'
                  ? 'text-sky-400 bg-sky-500/10 border border-sky-500/20'
                  : 'text-slate-500 bg-slate-800/30'
              }`}
            >
              3. Validation & Preview
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span
              className={`flex items-center gap-1.5 font-medium px-2.5 py-1 rounded-md ${
                step === 'result'
                  ? 'bg-emerald-500 text-white shadow-sm'
                  : 'text-slate-500 bg-slate-800/30'
              }`}
            >
              4. Complete
            </span>
          </div>

          <button
            type="button"
            onClick={handleDownloadSample}
            className="hidden sm:inline-flex items-center gap-1.5 text-slate-400 hover:text-sky-400 text-xs font-medium transition"
            title="Download CSV sample template"
          >
            <Download className="w-3.5 h-3.5" />
            Sample CSV Template
          </button>
        </div>

        {/* ─── Error Alert Banner ─────────────────────────────────── */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold text-rose-200">Import issue: </span>
              {error}
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ─── Main Modal Content (Steps) ────────────────────────── */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                className="border-2 border-dashed border-slate-700 hover:border-sky-500/70 rounded-2xl p-8 sm:p-12 text-center bg-slate-950/40 hover:bg-slate-950/60 transition cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />

                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition">
                  {loading ? (
                    <RefreshCw className="w-8 h-8 animate-spin text-sky-400" />
                  ) : (
                    <Upload className="w-8 h-8" />
                  )}
                </div>

                <h3 className="text-base font-semibold text-white mb-1.5">
                  {loading ? 'Reading and analyzing CSV...' : 'Click or drag CSV file to upload'}
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                  Accepts UTF-8 formatted CSV files exported from accounting systems, ERPs, or spreadsheets.
                </p>

                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 group-hover:bg-sky-600 group-hover:text-white group-hover:border-transparent transition">
                  <FileSpreadsheet className="w-4 h-4" />
                  Select .CSV File
                </div>
              </div>

              {/* Supported Columns & Specifications */}
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Australian Customer Import Standard
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] text-slate-400">
                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="font-semibold text-slate-300 block mb-1">
                      Accepted Columns:
                    </span>
                    Name, Company name, Street Address, City/Suburb, State, Country, Postcode, Phone, Email
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="font-semibold text-slate-300 block mb-1">
                      Automatic Conversions:
                    </span>
                    &ldquo;Australia&rdquo; is automatically normalized to AU. Full state names (e.g. Victoria) are mapped to 2-3 letter codes.
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800">
                    <span className="font-semibold text-slate-300 block mb-1">
                      Data Protection:
                    </span>
                    Duplicates are skipped by default. Unused columns like &ldquo;Open balance&rdquo; or &ldquo;Attachments&rdquo; are safely ignored.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: FIELD MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h3 className="text-sm font-semibold text-white">Map CSV Columns to System Fields</h3>
                  <p className="text-xs text-slate-400">
                    File: <span className="text-sky-400 font-medium">{fileName}</span> ({previewData?.total_rows || 0} rows detected)
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Change File
                </button>
              </div>

              {/* Mapping Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800 font-medium">
                    <tr>
                      <th className="py-2.5 px-4 w-1/3">System Field</th>
                      <th className="py-2.5 px-4 w-1/3">CSV Header Column</th>
                      <th className="py-2.5 px-4">Sample / Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {TARGET_FIELDS.map((field) => {
                      const currentVal = mapping[field.key] || '';
                      return (
                        <tr key={field.key} className="hover:bg-slate-800/30 transition">
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-200 flex items-center gap-1.5">
                              {field.label}
                              {field.required ? (
                                <span className="text-[10px] text-rose-400 font-normal">
                                  (Required)
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500 font-normal">
                                  (Optional)
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {field.description}
                            </div>
                          </td>

                          <td className="py-3 px-4">
                            <select
                              value={currentVal}
                              onChange={(e) => {
                                const val = e.target.value;
                                setMapping((prev) => ({
                                  ...prev,
                                  [field.key]: val,
                                }));
                              }}
                              className={`w-full text-xs rounded-lg bg-slate-900 border px-3 py-2 transition focus:outline-none focus:ring-1 ${
                                currentVal
                                  ? 'border-sky-500/50 text-sky-200 focus:ring-sky-500'
                                  : field.required
                                  ? 'border-rose-500/50 text-rose-300 focus:ring-rose-500'
                                  : 'border-slate-800 text-slate-400 focus:ring-slate-700'
                              }`}
                            >
                              <option value="">-- Do not map / Ignore --</option>
                              {previewData?.headers.map((h) => (
                                <option key={h} value={h}>
                                  {h}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            <span className="text-slate-500">e.g. </span>
                            <span className="text-slate-300 font-mono">{field.example}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Import Options */}
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="skip_duplicates_toggle"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-sky-500"
                />
                <label htmlFor="skip_duplicates_toggle" className="text-xs text-slate-300 cursor-pointer select-none">
                  <span className="font-semibold text-white block mb-0.5">
                    Skip duplicate emails by default (Recommended)
                  </span>
                  If an email already exists in your store or appears earlier in the CSV, that row will be safely skipped and reported instead of overwriting existing customer records.
                </label>
              </div>
            </div>
          )}

          {/* STEP 3: PREVIEW & VALIDATION */}
          {step === 'preview' && previewData && (
            <div className="space-y-5">
              {/* Metric Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                    Total Rows
                  </div>
                  <div className="text-xl font-bold text-white mt-1">
                    {previewData.total_rows}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Ready to Import
                  </div>
                  <div className="text-xl font-bold text-emerald-300 mt-1">
                    {previewData.valid_count}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Duplicates (Skipped)
                  </div>
                  <div className="text-xl font-bold text-amber-300 mt-1">
                    {previewData.skipped_count}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <div className="text-[11px] font-medium text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Invalid / Errors
                  </div>
                  <div className="text-xl font-bold text-rose-300 mt-1">
                    {previewData.invalid_count}
                  </div>
                </div>
              </div>

              {/* Filters & Search */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('all')}
                    className={`px-3 py-1 rounded-md transition font-medium ${
                      previewFilter === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    All ({previewData.total_rows})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('valid')}
                    className={`px-3 py-1 rounded-md transition font-medium ${
                      previewFilter === 'valid'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Ready ({previewData.valid_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('skipped')}
                    className={`px-3 py-1 rounded-md transition font-medium ${
                      previewFilter === 'skipped'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Skipped ({previewData.skipped_count})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewFilter('invalid')}
                    className={`px-3 py-1 rounded-md transition font-medium ${
                      previewFilter === 'invalid'
                        ? 'bg-rose-500/20 text-rose-300'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Errors ({previewData.invalid_count})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={searchPreview}
                    onChange={(e) => setSearchPreview(e.target.value)}
                    placeholder="Search rows..."
                    className="text-xs rounded-lg bg-slate-950 border border-slate-800 px-3 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />

                  {(previewData.skipped_count > 0 || previewData.invalid_count > 0) && (
                    <button
                      type="button"
                      onClick={handleDownloadReport}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                      title="Download preview issue report"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-400" />
                      Report CSV
                    </button>
                  )}
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 sticky top-0 z-10 font-medium">
                      <tr>
                        <th className="py-2 px-3 w-14">Row</th>
                        <th className="py-2 px-3 w-28">Status</th>
                        <th className="py-2 px-3">Customer Details</th>
                        <th className="py-2 px-3">Address & Location</th>
                        <th className="py-2 px-3">Validation / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredPreviewRows.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-500">
                            No rows matching the selected filter.
                          </td>
                        </tr>
                      ) : (
                        filteredPreviewRows.map((r) => (
                          <tr key={r.row_number} className="hover:bg-slate-800/30 transition">
                            <td className="py-2.5 px-3 font-mono text-slate-500 text-[11px]">
                              #{r.row_number}
                            </td>

                            <td className="py-2.5 px-3">
                              {r.status === 'valid' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  <Check className="w-3 h-3" />
                                  Ready
                                </span>
                              )}
                              {r.status === 'skipped' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  <AlertTriangle className="w-3 h-3" />
                                  Skipped
                                </span>
                              )}
                              {r.status === 'invalid' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  <AlertCircle className="w-3 h-3" />
                                  Invalid
                                </span>
                              )}
                            </td>

                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-200">
                                {r.name || '<No Name>'}
                              </div>
                              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Mail className="w-3 h-3 text-slate-500" />
                                {r.email || '—'}
                              </div>
                              {r.company && (
                                <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <Building2 className="w-3 h-3 text-slate-500" />
                                  {r.company}
                                </div>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-[11px] text-slate-300">
                              {r.street_address ? (
                                <>
                                  <div>{r.street_address}</div>
                                  <div className="text-slate-400">
                                    {r.city_suburb}, {r.state} {r.postcode} ({r.country || 'AU'})
                                  </div>
                                </>
                              ) : (
                                <span className="text-slate-500 italic">No address provided</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3 text-[11px]">
                              {r.status === 'valid' ? (
                                <span className="text-emerald-400/90">Validated for customer role</span>
                              ) : (
                                <span className={r.status === 'skipped' ? 'text-amber-400/90' : 'text-rose-400/90'}>
                                  {r.reason || (r.errors ? r.errors.join(' • ') : 'Validation issue')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: RESULT */}
          {step === 'result' && resultData && (
            <div className="space-y-6 py-4 text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white mb-1">
                  Customer Import Completed Successfully
                </h3>
                <p className="text-xs text-slate-400">
                  {resultData.message}
                </p>
              </div>

              {/* Stats Box */}
              <div className="grid grid-cols-3 gap-3 text-left">
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">
                    Imported
                  </div>
                  <div className="text-2xl font-bold text-emerald-400 mt-1">
                    {resultData.imported_count}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">
                    Skipped
                  </div>
                  <div className="text-2xl font-bold text-amber-400 mt-1">
                    {resultData.skipped_count}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider">
                    Invalid
                  </div>
                  <div className="text-2xl font-bold text-rose-400 mt-1">
                    {resultData.invalid_count}
                  </div>
                </div>
              </div>

              {/* Report Download Button */}
              {(resultData.skipped_count > 0 || resultData.invalid_count > 0) && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-left flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      Download Skipped / Invalid Rows Report
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Includes line numbers and failure reasons for each skipped customer.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadReport}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition flex-shrink-0 shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download CSV
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Footer Controls ───────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/95 sticky bottom-0 z-10">
          <div>
            {step === 'mapping' && (
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Upload
              </button>
            )}

            {step === 'preview' && (
              <button
                type="button"
                onClick={() => setStep('mapping')}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Mapping
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {step !== 'result' ? (
              <>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                >
                  Cancel
                </button>

                {step === 'mapping' && (
                  <button
                    type="button"
                    onClick={handleRunPreview}
                    disabled={loading || !mapping['email']}
                    className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition shadow-sm disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      <>
                        Preview & Validate
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                )}

                {step === 'preview' && (
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    disabled={loading || !previewData || previewData.valid_count === 0}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm disabled:opacity-60"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Importing Customers...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Import {previewData?.valid_count || 0} Customers
                      </>
                    )}
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleClose}
                className="px-5 py-2 text-xs font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition shadow-sm"
              >
                Done & Refresh Customers
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
