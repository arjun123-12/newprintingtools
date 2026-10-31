'use client';

import React, { useState, useEffect, useMemo, FormEvent, ChangeEvent } from 'react';
import { apiClient } from '@/services/api/client';
import { useAuth } from '@/context/AuthContext';
import { isSuperAdmin } from '@/utils/adminPermissions';

interface ProductInfo {
  id: string;
  name: string;
  slug?: string;
  sku?: string;
  featured_image_url?: string | null;
  width_mm?: number | null;
  height_mm?: number | null;
}

interface OrderItemInfo {
  id: string;
  artwork_id?: string;
  product_name: string;
  product_sku?: string;
  quantity: number;
  unit_price_inc_gst?: string | null;
  total_price_inc_gst?: string | null;
  options_snapshot?: any;
  production_status: string;
}

interface OrderInfo {
  id: string;
  order_number: string;
  status: string;
  payment_status?: string | null;
  subtotal_ex_gst?: string | null;
  gst_amount?: string | null;
  total_inc_gst?: string | null;
  created_at: string;
  admin_notes?: string | null;
}

interface DesignerUser {
  id: number;
  name: string;
  email: string;
  role_preset?: string | null;
  is_super_admin?: boolean;
}

interface ArtworkVersionItem {
  id: string;
  version_number: number;
  file_name?: string | null;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  thumbnail_url?: string | null;
  proof_pdf_url?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  dpi?: number | null;
  color_profile?: string | null;
  is_approved: boolean;
  change_summary?: string | null;
  created_at: string;
  uploader?: {
    id: number;
    name: string;
    email: string;
  } | null;
}

interface ArtworkReviewItem {
  id: string;
  version_number: number;
  action: string;
  notes?: string | null;
  created_at: string;
  reviewer?: {
    id: number;
    name: string;
    email: string;
  } | null;
}

interface PreflightMetrics {
  file_present: boolean;
  file_size_bytes?: number | null;
  file_size_formatted?: string;
  mime_type?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  target_width_mm?: number | null;
  target_height_mm?: number | null;
  estimated_dpi?: number | null;
  dpi_status?: 'passed' | 'warning' | 'failed' | 'unverified';
  color_profile?: string;
  color_profile_verified?: boolean;
  color_profile_status?: 'verified' | 'warning' | 'unreadable';
  bleed_detected_mm?: number;
  has_bleed?: boolean;
}

interface PreflightCheck {
  name: string;
  status: 'passed' | 'warning' | 'failed' | 'unverified';
  message: string;
}

interface PreflightResult {
  passed: boolean;
  status: 'preflight_passed' | 'preflight_warning' | 'preflight_failed';
  flags: string[];
  warnings: string[];
  errors: string[];
  checks: PreflightCheck[];
  metrics: PreflightMetrics;
}

interface ArtworkSubmission {
  id: string;
  order_id?: string | null;
  product_id?: string | null;
  assigned_designer_id?: number | null;
  name: string;
  file_name?: string | null;
  source_type: string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  storage_disk?: string;
  storage_path?: string | null;
  thumbnail_url?: string | null;
  proof_pdf_url?: string | null;
  width_px?: number | null;
  height_px?: number | null;
  dpi?: number | null;
  bleed?: number | null;
  safe_area?: number | null;
  status: string; // preflight status
  review_status: string; // pending_review, changes_requested, approved, rejected
  proof_status: string; // none, generated, customer_approved
  proof_generated_at?: string | null;
  approved_at?: string | null;
  current_version: number;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
  product?: ProductInfo | null;
  user?: {
    id: number;
    name: string;
    email: string;
    company_name?: string | null;
    phone?: string | null;
  } | null;
  assigned_designer?: DesignerUser | null;
  approved_by_user?: {
    id: number;
    name: string;
    email: string;
  } | null;
  order?: OrderInfo | null;
  order_items?: OrderItemInfo[];
  versions?: ArtworkVersionItem[];
  reviews?: ArtworkReviewItem[];
  preflight_results?: PreflightResult | null;
}

interface QueueStats {
  total: number;
  pending_review: number;
  changes_requested: number;
  approved: number;
  preflight_issues: number;
  unassigned: number;
}

export default function AdminArtworkQueuePage() {
  const { user: currentUser } = useAuth();
  const isSuper = isSuperAdmin(currentUser);

  // Data states
  const [artworks, setArtworks] = useState<ArtworkSubmission[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    total: 0,
    pending_review: 0,
    changes_requested: 0,
    approved: 0,
    preflight_issues: 0,
    unassigned: 0,
  });
  const [designersList, setDesignersList] = useState<DesignerUser[]>([]);
  const [isDesignerView, setIsDesignerView] = useState(false);

  // UI / Filter states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<string>('all');
  const [preflightFilter, setPreflightFilter] = useState<string>('all');
  const [designerFilter, setDesignerFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Selected Submission Modal / Drawer
  const [selectedArtwork, setSelectedArtwork] = useState<ArtworkSubmission | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [livePreflight, setLivePreflight] = useState<PreflightResult | null>(null);

  // Action Modals
  const [isChangeRequestOpen, setIsChangeRequestOpen] = useState(false);
  const [changeNotes, setChangeNotes] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedDesignerId, setSelectedDesignerId] = useState<number | 'unassigned'>('unassigned');

  const [isUploadVersionOpen, setIsUploadVersionOpen] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionSummary, setVersionSummary] = useState('');

  // Fetch queue data
  const fetchQueue = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: any = {
        page: currentPage,
        search: searchQuery || undefined,
        review_status: reviewStatusFilter !== 'all' ? reviewStatusFilter : undefined,
        preflight_status: preflightFilter !== 'all' ? preflightFilter : undefined,
        designer_id: designerFilter !== 'all' ? designerFilter : undefined,
      };

      const res = await apiClient.get('/admin/artwork-queue', { params });
      if (res.data?.success) {
        setArtworks(res.data.data.data || []);
        setTotalPages(res.data.data.last_page || 1);
        if (res.data.stats) setStats(res.data.stats);
        if (typeof res.data.is_designer_view === 'boolean') {
          setIsDesignerView(res.data.is_designer_view);
        }
      }
    } catch (err: any) {
      console.error('Failed to load artwork queue:', err);
      setError(err?.response?.data?.message || 'Failed to load artwork queue. Check your network or permissions.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch available designers for assignment
  const fetchDesigners = async () => {
    try {
      const res = await apiClient.get('/admin/artwork-queue/designers');
      if (res.data?.success) {
        setDesignersList(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load designers list:', err);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [currentPage, reviewStatusFilter, preflightFilter, designerFilter]);

  useEffect(() => {
    fetchDesigners();
  }, []);

  // Handle Search Debounce
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchQueue();
  };

  // Open artwork inspection drawer
  const openDetail = async (item: ArtworkSubmission) => {
    setSelectedArtwork(item);
    setLivePreflight(item.preflight_results || null);
    try {
      setDetailLoading(true);
      const res = await apiClient.get(`/admin/artwork-queue/${item.id}`);
      if (res.data?.success) {
        setSelectedArtwork(res.data.data);
        if (res.data.live_preflight) {
          setLivePreflight(res.data.live_preflight);
        }
      }
    } catch (err: any) {
      console.error('Error fetching artwork details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Trigger file download
  const handleDownload = async (artworkId: string, fileName?: string | null) => {
    try {
      const res = await apiClient.get(`/admin/artwork-queue/${artworkId}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName || 'submitted_artwork.pdf');
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Download failed or file not accessible.');
    }
  };

  // Approve artwork
  const handleApprove = async (artworkId: string) => {
    if (!confirm('Are you sure you want to approve this artwork submission for print production?')) return;
    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/admin/artwork-queue/${artworkId}/approve`, {
        notes: 'Artwork approved for print press by administrator.',
      });
      if (res.data?.success) {
        setActionSuccess('Artwork approved! Order production status moved to prepress.');
        fetchQueue();
        if (selectedArtwork?.id === artworkId) {
          openDetail(res.data.data);
        }
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to approve artwork.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Generate Customer Proof
  const handleGenerateProof = async (artworkId: string) => {
    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/admin/artwork-queue/${artworkId}/generate-proof`, {
        notes: 'Proof generated and queued for customer review.',
      });
      if (res.data?.success) {
        setActionSuccess('Customer proof generated and recorded in timeline.');
        fetchQueue();
        if (selectedArtwork?.id === artworkId) {
          openDetail(res.data.data);
        }
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to generate proof.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Request Changes Submit
  const submitChangeRequest = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedArtwork) return;
    if (changeNotes.trim().length < 5) {
      alert('Please enter at least 5 characters detailing required changes.');
      return;
    }
    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/admin/artwork-queue/${selectedArtwork.id}/request-changes`, {
        notes: changeNotes.trim(),
      });
      if (res.data?.success) {
        setActionSuccess('Revision requested. Customer will be notified with your notes.');
        setIsChangeRequestOpen(false);
        setChangeNotes('');
        fetchQueue();
        openDetail(res.data.data);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to submit change request.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Assign Designer Submit
  const submitAssignDesigner = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedArtwork) return;
    try {
      setActionSubmitting(true);
      const designerId = selectedDesignerId === 'unassigned' ? null : selectedDesignerId;
      const res = await apiClient.post(`/admin/artwork-queue/${selectedArtwork.id}/assign-designer`, {
        designer_id: designerId,
      });
      if (res.data?.success) {
        setActionSuccess(res.data.message || 'Designer assigned successfully.');
        setIsAssignModalOpen(false);
        fetchQueue();
        openDetail(res.data.data);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to assign designer.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Upload Revised Version Submit
  const submitUploadVersion = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedArtwork || !versionFile) {
      alert('Please select a file to upload.');
      return;
    }
    try {
      setActionSubmitting(true);
      const formData = new FormData();
      formData.append('file', versionFile);
      if (versionSummary.trim()) {
        formData.append('change_summary', versionSummary.trim());
      }

      const res = await apiClient.post(`/admin/artwork-queue/${selectedArtwork.id}/upload-version`, formData);
      if (res.data?.success) {
        setActionSuccess('Revised version uploaded and preflight analysis re-run.');
        setIsUploadVersionOpen(false);
        setVersionFile(null);
        setVersionSummary('');
        fetchQueue();
        openDetail(res.data.data);
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Failed to upload revised version.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Run live preflight inspection
  const handleRunPreflight = async (artworkId: string) => {
    try {
      setActionSubmitting(true);
      const res = await apiClient.post(`/admin/artwork-queue/${artworkId}/preflight`);
      if (res.data?.success) {
        setLivePreflight(res.data.data);
        setActionSuccess('Preflight verification refreshed.');
        fetchQueue();
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Preflight inspection failed.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Preflight badge helper
  const renderPreflightBadge = (status: string) => {
    switch (status) {
      case 'preflight_passed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Preflight Passed
          </span>
        );
      case 'preflight_warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            Warnings Detected
          </span>
        );
      case 'preflight_failed':
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            Preflight Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Unverified
          </span>
        );
    }
  };

  // Review status badge helper
  const renderReviewStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Approved for Press
          </span>
        );
      case 'changes_requested':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-300 border border-violet-500/30">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Changes Requested
          </span>
        );
      case 'pending_review':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto bg-slate-950 text-slate-100 min-h-screen">
      {/* Toast Notification */}
      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-emerald-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-bold px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-rose-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-bold px-2 py-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Artwork Preflight & Review Queue</h1>
            {isDesignerView && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Designer Mode (Assigned Submissions)
              </span>
            )}
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Preflight check submitted artwork, inspect resolution & color space, generate customer proofs, and sign off for production.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchQueue()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <svg className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh Queue
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 backdrop-blur">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Submissions</div>
          <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
          <div className="text-[11px] text-slate-500 mt-1">Total in Queue</div>
        </div>

        <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <div className="text-xs font-medium text-amber-400 uppercase tracking-wider">Pending Review</div>
          <div className="text-2xl font-bold text-amber-300 mt-1">{stats.pending_review}</div>
          <div className="text-[11px] text-amber-500/80 mt-1">Awaiting Sign-off</div>
        </div>

        <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5">
          <div className="text-xs font-medium text-rose-400 uppercase tracking-wider">Preflight Issues</div>
          <div className="text-2xl font-bold text-rose-300 mt-1">{stats.preflight_issues}</div>
          <div className="text-[11px] text-rose-500/80 mt-1">Warnings & Failed Checks</div>
        </div>

        <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5">
          <div className="text-xs font-medium text-violet-400 uppercase tracking-wider">Changes Requested</div>
          <div className="text-2xl font-bold text-violet-300 mt-1">{stats.changes_requested}</div>
          <div className="text-[11px] text-violet-500/80 mt-1">Customer Revision Needed</div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 col-span-2 md:col-span-1">
          <div className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Approved for Press</div>
          <div className="text-2xl font-bold text-emerald-300 mt-1">{stats.approved}</div>
          <div className="text-[11px] text-emerald-500/80 mt-1">Ready for Imposition</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between p-4 rounded-xl bg-slate-900 border border-slate-800">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <svg className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by order number (e.g. PO-2026-10491), product, customer, or filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {/* Review Status Filter */}
          <select
            value={reviewStatusFilter}
            onChange={(e) => {
              setReviewStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-950 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">Review Status: All</option>
            <option value="pending_review">Pending Review</option>
            <option value="changes_requested">Changes Requested</option>
            <option value="approved">Approved for Press</option>
          </select>

          {/* Preflight Health Filter */}
          <select
            value={preflightFilter}
            onChange={(e) => {
              setPreflightFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-950 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
          >
            <option value="all">Preflight: All Checks</option>
            <option value="preflight_passed">Passed Only</option>
            <option value="preflight_warning">Warnings Detected</option>
            <option value="preflight_failed">Failed / Errors</option>
          </select>

          {/* Designer Filter (Admins Only) */}
          {!isDesignerView && (
            <select
              value={designerFilter}
              onChange={(e) => {
                setDesignerFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-950 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-sky-500"
            >
              <option value="all">Designers: All</option>
              <option value="me">Assigned to Me</option>
              <option value="unassigned">Unassigned Only</option>
              {designersList.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Main Table Container */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center space-y-4">
            <div className="inline-block w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm text-slate-400">Loading preflight queue submissions...</p>
          </div>
        ) : artworks.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 text-slate-500 flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-white">No Artwork Submissions Found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No submissions match your active search or filters. Clear your filters or check back when new orders are placed.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setReviewStatusFilter('all');
                setPreflightFilter('all');
                setDesignerFilter('all');
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Artwork & File</th>
                  <th className="py-3.5 px-4">Order & Customer</th>
                  <th className="py-3.5 px-4">Product & Print Specs</th>
                  <th className="py-3.5 px-4">Preflight Diagnostics</th>
                  <th className="py-3.5 px-4">Review Status</th>
                  <th className="py-3.5 px-4">Assigned Designer</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-normal">
                {artworks.map((item) => {
                  const fileSizeFormatted = item.file_size_bytes
                    ? `${(item.file_size_bytes / 1024 / 1024).toFixed(2)} MB`
                    : 'Unknown size';
                  const fileExt = item.file_name ? item.file_name.split('.').pop()?.toUpperCase() : 'PDF';

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => openDetail(item)}
                    >
                      {/* 1. Artwork Thumbnail & File */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-12 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                            {item.thumbnail_url ? (
                              <img
                                src={item.thumbnail_url}
                                alt={item.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                            ) : (
                              <svg className="w-6 h-6 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            )}
                            <span className="absolute bottom-0.5 right-0.5 px-1 py-0.2 rounded bg-black/80 text-[9px] font-mono font-bold text-sky-400">
                              v{item.current_version}
                            </span>
                          </div>
                          <div className="space-y-0.5 min-w-0 max-w-[180px]">
                            <div className="font-semibold text-white truncate group-hover:text-sky-400 transition-colors">
                              {item.name || 'Untitled Artwork'}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono truncate">
                              {item.file_name || 'No file attached'}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 font-mono">{fileExt}</span>
                              <span>{fileSizeFormatted}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Order & Customer */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-sky-400 font-mono">
                            {item.order?.order_number || 'Direct Upload'}
                          </div>
                          <div className="text-slate-300 truncate max-w-[160px]">
                            {item.user?.company_name || item.user?.name || 'Guest Customer'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[160px]">
                            {item.user?.email}
                          </div>
                          {/* Show price if Admin, hidden for scoped designer */}
                          {!isDesignerView && item.order?.total_inc_gst && (
                            <div className="text-[10px] text-emerald-400 font-medium">
                              ${item.order.total_inc_gst} AUD
                            </div>
                          )}
                        </div>
                      </td>

                      {/* 3. Product & Print Specs */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5 max-w-[180px]">
                          <div className="font-medium text-slate-200 truncate">
                            {item.product?.name || 'Standard Print Item'}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {item.product?.width_mm && item.product?.height_mm ? (
                              <span>Target: {item.product.width_mm} × {item.product.height_mm} mm</span>
                            ) : (
                              <span>Target: Size not set</span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Canvas: {item.width_px || '–'} × {item.height_px || '–'} px
                          </div>
                        </div>
                      </td>

                      {/* 4. Preflight Diagnostics */}
                      <td className="py-4 px-4">
                        <div className="space-y-1.5">
                          <div>{renderPreflightBadge(item.status)}</div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                            {/* DPI Pill */}
                            {item.dpi ? (
                              <span className={`px-1.5 py-0.5 rounded font-mono font-medium ${item.dpi >= 300
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : item.dpi >= 150
                                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}>
                                {item.dpi} DPI
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                DPI Unverified
                              </span>
                            )}

                            {/* Bleed Pill */}
                            {item.bleed && item.bleed >= 2.0 ? (
                              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {item.bleed}mm Bleed
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                No Bleed
                              </span>
                            )}

                            {/* Proof status pill */}
                            {item.proof_status === 'generated' && (
                              <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                Proof Ready
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 5. Review Status */}
                      <td className="py-4 px-4">
                        {renderReviewStatusBadge(item.review_status)}
                      </td>

                      {/* 6. Assigned Designer */}
                      <td className="py-4 px-4">
                        {item.assigned_designer ? (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-sky-900/60 border border-sky-700/50 text-sky-300 font-bold flex items-center justify-center text-[10px]">
                              {item.assigned_designer.name.charAt(0)}
                            </div>
                            <div className="truncate max-w-[120px]">
                              <div className="text-slate-200 truncate">{item.assigned_designer.name}</div>
                              <div className="text-[10px] text-slate-500 truncate">{item.assigned_designer.role_preset || 'Staff'}</div>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* 7. Action Buttons */}
                      <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openDetail(item)}
                            title="Inspect Preflight & History"
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>

                          <button
                            onClick={() => handleDownload(item.id, item.file_name)}
                            title="Download Submitted File"
                            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-sky-400 hover:bg-slate-700 transition"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </button>

                          {item.review_status !== 'approved' && (
                            <button
                              onClick={() => handleApprove(item.id)}
                              disabled={actionSubmitting}
                              title="Approve for Production"
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-950 border-t border-slate-800 text-xs text-slate-400">
            <div>
              Page <span className="text-white font-semibold">{currentPage}</span> of{' '}
              <span className="text-white font-semibold">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition"
              >
                Previous
              </button>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 disabled:opacity-40 hover:bg-slate-700 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ARTWORK INSPECTION SLIDEOVER / MODAL */}
      {/* ========================================================================= */}
      {selectedArtwork && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-4xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-950/70 sticky top-0 z-10 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-sky-400 font-bold">
                    {selectedArtwork.order?.order_number || 'Direct Upload'}
                  </span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs text-slate-400 font-mono">
                    Version {selectedArtwork.current_version}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white mt-1">
                  {selectedArtwork.name || 'Artwork Submission'}
                </h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {renderReviewStatusBadge(selectedArtwork.review_status)}
                  {renderPreflightBadge(selectedArtwork.status)}
                  {selectedArtwork.proof_status === 'generated' && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Proof Generated
                    </span>
                  )}
                </div>
              </div>

              <button
                onClick={() => setSelectedArtwork(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Quick Action Toolbar */}
            <div className="p-4 bg-slate-950/40 border-b border-slate-800 flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleDownload(selectedArtwork.id, selectedArtwork.file_name)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition"
              >
                <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download File
              </button>

              <button
                onClick={() => handleGenerateProof(selectedArtwork.id)}
                disabled={actionSubmitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-xs font-medium text-indigo-300 transition"
              >
                <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generate Customer Proof
              </button>

              <button
                onClick={() => setIsChangeRequestOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/30 text-xs font-medium text-violet-300 transition"
              >
                <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                Request Changes
              </button>

              {selectedArtwork.review_status !== 'approved' && (
                <button
                  onClick={() => handleApprove(selectedArtwork.id)}
                  disabled={actionSubmitting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve for Press
                </button>
              )}

              <button
                onClick={() => handleRunPreflight(selectedArtwork.id)}
                disabled={actionSubmitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition ml-auto"
              >
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Re-scan Preflight
              </button>
            </div>

            {/* Modal Body: Two Column Layout */}
            <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Visual Preview & Preflight Checks (7 cols) */}
              <div className="lg:col-span-7 space-y-6">
                {/* Visual Preview Box */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold uppercase tracking-wider">Artwork Preview</span>
                    <span className="font-mono text-slate-500">{selectedArtwork.file_name}</span>
                  </div>

                  <div className="relative min-h-[260px] rounded-lg bg-slate-900 border border-slate-800/80 flex items-center justify-center overflow-hidden p-2">
                    {selectedArtwork.thumbnail_url ? (
                      <img
                        src={selectedArtwork.thumbnail_url}
                        alt={selectedArtwork.name}
                        className="max-h-[380px] w-auto max-w-full rounded object-contain shadow-2xl"
                      />
                    ) : (
                      <div className="text-center p-8 space-y-2 text-slate-500">
                        <svg className="w-12 h-12 mx-auto text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-xs">Preview image not available for raw vector / missing file.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preflight Checks Breakdown */}
                <div className="p-5 rounded-xl border border-slate-800 bg-slate-950 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      Preflight Analysis & Technical Checks
                    </h3>
                    {livePreflight && renderPreflightBadge(livePreflight.status)}
                  </div>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Calculated DPI</div>
                      <div className="text-base font-bold text-white mt-0.5 font-mono">
                        {livePreflight?.metrics?.estimated_dpi ? (
                          <span className={livePreflight.metrics.estimated_dpi >= 300 ? 'text-emerald-400' : 'text-amber-400'}>
                            {livePreflight.metrics.estimated_dpi} DPI
                          </span>
                        ) : (
                          <span className="text-slate-500 font-normal">Unverified</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">at target print size</div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Color Space</div>
                      <div className="text-base font-bold text-white mt-0.5">
                        {livePreflight?.metrics?.color_profile ? (
                          <span className={livePreflight.metrics.color_profile === 'CMYK' ? 'text-emerald-400' : 'text-amber-400'}>
                            {livePreflight.metrics.color_profile}
                          </span>
                        ) : (
                          <span className="text-slate-500 font-normal">Unreadable</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {livePreflight?.metrics?.color_profile_verified ? 'Header Verified' : 'Manual RIP check'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Bleed Margin</div>
                      <div className="text-base font-bold text-white mt-0.5 font-mono">
                        {livePreflight?.metrics?.bleed_detected_mm !== undefined ? (
                          <span className={livePreflight.metrics.bleed_detected_mm >= 2 ? 'text-emerald-400' : 'text-amber-400'}>
                            {livePreflight.metrics.bleed_detected_mm} mm
                          </span>
                        ) : (
                          <span className="text-slate-500 font-normal">0.0 mm</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500">min. 2.0mm standard</div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Image Pixels</div>
                      <div className="text-xs font-semibold text-slate-200 mt-1 font-mono">
                        {livePreflight?.metrics?.width_px && livePreflight?.metrics?.height_px
                          ? `${livePreflight.metrics.width_px} × ${livePreflight.metrics.height_px} px`
                          : 'Unknown'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">Target Print Size</div>
                      <div className="text-xs font-semibold text-slate-200 mt-1 font-mono">
                        {livePreflight?.metrics?.target_width_mm && livePreflight?.metrics?.target_height_mm
                          ? `${livePreflight.metrics.target_width_mm} × ${livePreflight.metrics.target_height_mm} mm`
                          : 'Not specified'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="text-[10px] text-slate-400 uppercase">File Size & Format</div>
                      <div className="text-xs font-semibold text-slate-200 mt-1 truncate">
                        {livePreflight?.metrics?.file_size_formatted || '–'} ({livePreflight?.metrics?.mime_type || 'file'})
                      </div>
                    </div>
                  </div>

                  {/* Detailed Itemized Checks */}
                  {livePreflight?.checks && livePreflight.checks.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-slate-800">
                      <div className="text-xs font-semibold text-slate-300">Detailed Verification Log</div>
                      <div className="space-y-2">
                        {livePreflight.checks.map((c, idx) => (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-lg border text-xs flex items-start gap-2.5 ${c.status === 'passed'
                                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-200'
                                : c.status === 'warning'
                                  ? 'bg-amber-500/5 border-amber-500/20 text-amber-200'
                                  : c.status === 'failed'
                                    ? 'bg-rose-500/5 border-rose-500/20 text-rose-200'
                                    : 'bg-slate-900 border-slate-800 text-slate-300'
                              }`}
                          >
                            <span className="shrink-0 mt-0.5">
                              {c.status === 'passed' && (
                                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              {c.status === 'warning' && (
                                <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                              )}
                              {c.status === 'failed' && (
                                <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              )}
                              {c.status === 'unverified' && (
                                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              )}
                            </span>
                            <div className="flex-1">
                              <span className="font-semibold">{c.name}: </span>
                              <span>{c.message}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Order Reference, Designer, Versions, Timeline (5 cols) */}
              <div className="lg:col-span-5 space-y-6">
                {/* Order & Customer Summary */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    Order & Customer Details
                  </h3>

                  <div className="space-y-2 text-xs divide-y divide-slate-800/80">
                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Order Reference</span>
                      <span className="font-mono font-semibold text-sky-400">
                        {selectedArtwork.order?.order_number || 'Direct Upload'}
                      </span>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Customer Name</span>
                      <span className="text-slate-200 font-medium">
                        {selectedArtwork.user?.company_name || selectedArtwork.user?.name || 'Guest Customer'}
                      </span>
                    </div>

                    <div className="flex justify-between py-1">
                      <span className="text-slate-500">Email</span>
                      <span className="text-slate-300">{selectedArtwork.user?.email || '–'}</span>
                    </div>

                    {selectedArtwork.user?.phone && (
                      <div className="flex justify-between py-1">
                        <span className="text-slate-500">Phone</span>
                        <span className="text-slate-300">{selectedArtwork.user.phone}</span>
                      </div>
                    )}

                    {/* Pricing details ONLY visible if full admin (hidden for scoped designer) */}
                    {!isDesignerView && selectedArtwork.order?.total_inc_gst && (
                      <>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Order Total (inc. GST)</span>
                          <span className="text-emerald-400 font-bold">${selectedArtwork.order.total_inc_gst} AUD</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Payment Status</span>
                          <span className="text-emerald-400 uppercase font-semibold text-[10px]">
                            {selectedArtwork.order.payment_status || 'Paid'}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Admin notes ONLY visible if full admin */}
                    {!isDesignerView && selectedArtwork.admin_notes && (
                      <div className="pt-2">
                        <div className="text-[11px] font-semibold text-amber-400">Admin Internal Notes:</div>
                        <p className="text-xs text-slate-300 mt-1 p-2 bg-slate-900 rounded border border-slate-800">
                          {selectedArtwork.admin_notes}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Designer Assignment Box */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Assigned Designer
                    </h3>
                    {!isDesignerView && (
                      <button
                        onClick={() => {
                          setSelectedDesignerId(selectedArtwork.assigned_designer_id || 'unassigned');
                          setIsAssignModalOpen(true);
                        }}
                        className="text-xs text-sky-400 hover:text-sky-300 font-semibold"
                      >
                        Change
                      </button>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                    {selectedArtwork.assigned_designer ? (
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-sky-950 border border-sky-600 text-sky-300 font-bold flex items-center justify-center text-xs">
                          {selectedArtwork.assigned_designer.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-white">{selectedArtwork.assigned_designer.name}</div>
                          <div className="text-[11px] text-slate-400">{selectedArtwork.assigned_designer.email}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 italic">No designer currently assigned.</div>
                    )}

                    {!isDesignerView && !selectedArtwork.assigned_designer && (
                      <button
                        onClick={() => {
                          setSelectedDesignerId('unassigned');
                          setIsAssignModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded text-[11px] font-semibold"
                      >
                        Assign Now
                      </button>
                    )}
                  </div>
                </div>

                {/* Version History */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Version History ({selectedArtwork.versions?.length || 1})
                    </h3>
                    <button
                      onClick={() => setIsUploadVersionOpen(true)}
                      className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Upload New
                    </button>
                  </div>

                  <div className="space-y-2">
                    {selectedArtwork.versions && selectedArtwork.versions.length > 0 ? (
                      selectedArtwork.versions.map((ver) => (
                        <div
                          key={ver.id}
                          className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${ver.version_number === selectedArtwork.current_version
                              ? 'bg-sky-500/5 border-sky-500/30'
                              : 'bg-slate-900 border-slate-800'
                            }`}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">v{ver.version_number}</span>
                              <span className="text-slate-400 truncate max-w-[140px] font-mono">
                                {ver.file_name}
                              </span>
                              {ver.is_approved && (
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 text-[9px] font-bold">
                                  Approved
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              {ver.change_summary || 'Initial submission'} • {new Date(ver.created_at).toLocaleDateString()}
                            </div>
                          </div>
                          {ver.file_name && (
                            <button
                              onClick={() => handleDownload(selectedArtwork.id, ver.file_name)}
                              className="p-1 text-slate-400 hover:text-white"
                              title="Download version"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </button>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 italic">Version 1 (Initial file)</div>
                    )}
                  </div>
                </div>

                {/* Review Timeline */}
                <div className="p-4 rounded-xl border border-slate-800 bg-slate-950 space-y-3">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <svg className="w-4 h-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    Review History & Timeline
                  </h3>

                  <div className="space-y-3 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
                    {selectedArtwork.reviews && selectedArtwork.reviews.length > 0 ? (
                      selectedArtwork.reviews.map((rev) => (
                        <div key={rev.id} className="relative pl-7 text-xs space-y-1">
                          <div className="absolute left-1.5 top-1.5 w-3 h-3 rounded-full bg-slate-700 border-2 border-slate-950"></div>
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="font-semibold text-slate-200 capitalize">
                              {rev.action.replace('_', ' ')} (v{rev.version_number})
                            </span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(rev.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {rev.reviewer && (
                            <div className="text-[10px] text-slate-400">By: {rev.reviewer.name}</div>
                          )}
                          {rev.notes && (
                            <div className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-300 text-xs mt-1">
                              {rev.notes}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-500 italic pl-6">No review events logged yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REQUEST CHANGES MODAL */}
      {/* ========================================================================= */}
      {isChangeRequestOpen && selectedArtwork && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Request Customer Revisions
              </h3>
              <button
                onClick={() => setIsChangeRequestOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Detail the exact print specifications that require correction. This note will be recorded in the review timeline and notified to the customer.
            </p>

            {/* Quick snippet buttons */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-slate-500 font-medium">Quick Prepress Templates:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setChangeNotes('Resolution is low. Please upload high-resolution 300 DPI vector artwork or PDF print file.')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                >
                  Low DPI (300 DPI needed)
                </button>
                <button
                  type="button"
                  onClick={() => setChangeNotes('Artwork is missing 2mm bleed. Please extend background graphics to the bleed margin to avoid white cut borders.')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                >
                  Missing 2mm Bleed
                </button>
                <button
                  type="button"
                  onClick={() => setChangeNotes('Text is placed outside the safe area zone. Please pull critical logos and copy at least 3mm inward from cut line.')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                >
                  Safe Area Incursion
                </button>
                <button
                  type="button"
                  onClick={() => setChangeNotes('Color profile is RGB. Please convert your file to CMYK Fogra39 to avoid unexpected color shifts on press.')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px]"
                >
                  RGB to CMYK Conversion
                </button>
              </div>
            </div>

            <form onSubmit={submitChangeRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Revision Instructions for Client *
                </label>
                <textarea
                  rows={4}
                  required
                  value={changeNotes}
                  onChange={(e) => setChangeNotes(e.target.value)}
                  placeholder="Explain exactly what file format, resolution, or bleed margin is required..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-violet-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsChangeRequestOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow transition disabled:opacity-50"
                >
                  {actionSubmitting ? 'Recording...' : 'Send Change Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ASSIGN DESIGNER MODAL */}
      {/* ========================================================================= */}
      {isAssignModalOpen && selectedArtwork && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                Assign Staff Designer
              </h3>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Assigned designers will see this submission in their restricted queue. Admins retain full visibility across all submissions.
            </p>

            <form onSubmit={submitAssignDesigner} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Select Staff Designer
                </label>
                <select
                  value={selectedDesignerId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedDesignerId(val === 'unassigned' ? 'unassigned' : Number(val));
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  <option value="unassigned">-- Unassigned (Available in Pool) --</option>
                  {designersList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.email}) - {d.role_preset || 'Staff'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition disabled:opacity-50"
                >
                  {actionSubmitting ? 'Saving...' : 'Update Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* UPLOAD REVISED VERSION MODAL */}
      {/* ========================================================================= */}
      {isUploadVersionOpen && selectedArtwork && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Revised Print Asset (v{selectedArtwork.current_version + 1})
              </h3>
              <button
                onClick={() => setIsUploadVersionOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Upload an updated PDF, TIFF, or AI file. The preflight check will run automatically on the new version.
            </p>

            <form onSubmit={submitUploadVersion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Choose Replacement File * (PDF, TIFF, AI, PSD, JPEG, PNG - max 100MB)
                </label>
                <input
                  type="file"
                  required
                  accept=".pdf,.tif,.tiff,.ai,.psd,.jpg,.jpeg,.png,.eps"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    if (e.target.files && e.target.files[0]) {
                      setVersionFile(e.target.files[0]);
                    }
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-300 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Change Summary / Revision Notes
                </label>
                <input
                  type="text"
                  value={versionSummary}
                  onChange={(e) => setVersionSummary(e.target.value)}
                  placeholder="e.g. Corrected CMYK black levels, added 3mm bleed margin"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadVersionOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionSubmitting || !versionFile}
                  className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition disabled:opacity-50"
                >
                  {actionSubmitting ? 'Uploading & Analyzing...' : 'Upload Version'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
