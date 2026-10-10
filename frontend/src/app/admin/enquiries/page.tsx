'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageSquareText,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Calendar,
  Mail,
  Phone,
  Package,
  Layers,
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  Trash2,
  Paperclip,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '@/services/api/client';

interface CustomerEnquiryItem {
  id: number;
  reference: string;
  name: string;
  email: string;
  phone?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  specifications?: {
    size?: string;
    gsm?: string;
    paper_stock?: string;
    printing_sides?: string;
    finishing?: string;
    folding?: string;
    [key: string]: any;
  } | null;
  delivery_location?: string | null;
  additional_requirements?: string | null;
  source_url?: string | null;
  attachment_path?: string | null;
  attachment_original_name?: string | null;
  attachment_mime_type?: string | null;
  attachment_size_bytes?: number | null;
  attachment_url?: string | null;
  status: 'new' | 'contacted' | 'quoted' | 'converted' | 'closed';
  admin_notes?: string | null;
  ip_address?: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeClass: string; selectClass: string }
> = {
  new: {
    label: 'New Enquiry',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    selectClass: 'border-emerald-300 text-emerald-800 bg-emerald-50',
  },
  contacted: {
    label: 'Contacted',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    selectClass: 'border-blue-300 text-blue-800 bg-blue-50',
  },
  quoted: {
    label: 'Quoted',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
    selectClass: 'border-purple-300 text-purple-800 bg-purple-50',
  },
  converted: {
    label: 'Converted',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    selectClass: 'border-amber-300 text-amber-800 bg-amber-50',
  },
  closed: {
    label: 'Closed',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    selectClass: 'border-slate-300 text-slate-700 bg-slate-50',
  },
};

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<CustomerEnquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState<Record<string, number>>({
    all: 0,
    new: 0,
    contacted: 0,
    quoted: 0,
    converted: 0,
    closed: 0,
  });

  // Selected enquiry for detail modal
  const [selectedEnquiry, setSelectedEnquiry] = useState<CustomerEnquiryItem | null>(null);
  const [detailNotes, setDetailNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesFeedback, setNotesFeedback] = useState<string | null>(null);

  const fetchEnquiries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (activeTab !== 'all') {
        params.status = activeTab;
      }
      if (search.trim()) {
        params.search = search.trim();
      }

      const response = await apiClient.get('/admin/enquiries', { params });
      if (response.data?.success) {
        setEnquiries(response.data.data || []);
        if (response.data.stats) {
          setStats(response.data.stats);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to load customer enquiries.');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const handleStatusChange = async (enquiryId: number, newStatus: string) => {
    try {
      // Optimistic update
      setEnquiries((prev) =>
        prev.map((e) => (e.id === enquiryId ? { ...e, status: newStatus as any } : e))
      );
      if (selectedEnquiry && selectedEnquiry.id === enquiryId) {
        setSelectedEnquiry((prev) => prev ? { ...prev, status: newStatus as any } : null);
      }

      await apiClient.patch(`/admin/enquiries/${enquiryId}`, {
        status: newStatus,
      });

      // Refresh stats
      fetchEnquiries();
    } catch (err) {
      alert('Failed to update enquiry status.');
      fetchEnquiries();
    }
  };

  const handleOpenDetail = (enquiry: CustomerEnquiryItem) => {
    setSelectedEnquiry(enquiry);
    setDetailNotes(enquiry.admin_notes || '');
    setNotesFeedback(null);
  };

  const handleSaveNotes = async () => {
    if (!selectedEnquiry) return;
    setSavingNotes(true);
    setNotesFeedback(null);
    try {
      const res = await apiClient.patch(`/admin/enquiries/${selectedEnquiry.id}`, {
        admin_notes: detailNotes,
      });
      if (res.data?.success) {
        setNotesFeedback('Notes saved successfully.');
        setEnquiries((prev) =>
          prev.map((e) => (e.id === selectedEnquiry.id ? { ...e, admin_notes: detailNotes } : e))
        );
        setSelectedEnquiry((prev) => prev ? { ...prev, admin_notes: detailNotes } : null);
      }
    } catch (err) {
      setNotesFeedback('Failed to save internal notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDeleteEnquiry = async (enquiryId: number) => {
    if (!confirm('Are you sure you want to permanently delete this customer enquiry?')) return;
    try {
      await apiClient.delete(`/admin/enquiries/${enquiryId}`);
      if (selectedEnquiry && selectedEnquiry.id === enquiryId) {
        setSelectedEnquiry(null);
      }
      fetchEnquiries();
    } catch (err) {
      alert('Failed to delete enquiry.');
    }
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-7xl">
      {/* Top Title & Refresh */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Customer Quote Enquiries
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
              {stats.all} Total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review incoming customer quote requests captured from public storefront shopping actions.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchEnquiries()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'all', label: 'All Enquiries', count: stats.all },
          { id: 'new', label: 'New', count: stats.new },
          { id: 'contacted', label: 'Contacted', count: stats.contacted },
          { id: 'quoted', label: 'Quoted', count: stats.quoted },
          { id: 'converted', label: 'Converted', count: stats.converted },
          { id: 'closed', label: 'Closed', count: stats.closed },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name, email, phone, reference, or product..."
            className="w-full pl-9 pr-4 py-2 bg-white rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-2xs"
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
            <p className="text-xs font-semibold">Loading customer enquiries...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-600 space-y-3">
            <AlertCircle className="w-8 h-8 mx-auto" />
            <p className="text-xs font-bold">{error}</p>
          </div>
        ) : enquiries.length === 0 ? (
          <div className="py-20 text-center space-y-3 text-slate-400">
            <MessageSquareText className="w-10 h-10 mx-auto text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No customer enquiries found</p>
            <p className="text-xs text-slate-400">Enquiries submitted by storefront visitors will appear here automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Product & Qty</th>
                  <th className="py-3 px-4">Specifications</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {enquiries.map((enq) => {
                  const statusConf = STATUS_CONFIG[enq.status] || STATUS_CONFIG.new;
                  const specs = enq.specifications || {};

                  return (
                    <tr key={enq.id} className="hover:bg-slate-50/60 transition group">
                      {/* Reference */}
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="bg-slate-100 px-2 py-1 rounded text-slate-800 border border-slate-200">
                          {enq.reference}
                        </span>
                      </td>

                      {/* Customer Details */}
                      <td className="py-3.5 px-4 space-y-0.5">
                        <div className="font-bold text-slate-900">{enq.name}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <a href={`mailto:${enq.email}`} className="hover:text-sky-600">
                            {enq.email}
                          </a>
                        </div>
                        {enq.phone && (
                          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <a href={`tel:${enq.phone}`} className="hover:text-sky-600">
                              {enq.phone}
                            </a>
                          </div>
                        )}
                      </td>

                      {/* Product & Qty */}
                      <td className="py-3.5 px-4 space-y-0.5 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{enq.product_name || 'Custom Print Job'}</div>
                        <div className="text-[11px] text-slate-500">
                          Qty: <span className="font-bold text-slate-700">{enq.quantity ?? 'Unspecified'}</span>
                        </div>
                      </td>

                      {/* Specifications */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          {specs.gsm && (
                            <span className="px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 font-semibold border border-sky-200">
                              {specs.gsm}
                            </span>
                          )}
                          {specs.printing_sides && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {specs.printing_sides}
                            </span>
                          )}
                          {specs.size && (
                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {specs.size}
                            </span>
                          )}
                          {specs.finishing && specs.finishing !== 'Standard Finish' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium border border-amber-200">
                              {specs.finishing}
                            </span>
                          )}
                          {specs.folding && specs.folding !== 'No Folding' && (
                            <span className="px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-medium border border-purple-200">
                              {specs.folding}
                            </span>
                          )}
                        </div>
                        {enq.attachment_path && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-sky-600 font-medium">
                            <Paperclip className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[140px]">{enq.attachment_original_name || 'Artwork Attached'}</span>
                          </div>
                        )}
                      </td>

                      {/* Status Selector */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <select
                          value={enq.status}
                          onChange={(e) => handleStatusChange(enq.id, e.target.value)}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500 ${statusConf.selectClass}`}
                        >
                          <option value="new">New Enquiry</option>
                          <option value="contacted">Contacted</option>
                          <option value="quoted">Quoted</option>
                          <option value="converted">Converted</option>
                          <option value="closed">Closed</option>
                        </select>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        {new Date(enq.created_at).toLocaleDateString('en-AU', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(enq)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs transition"
                          >
                            Inspect
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEnquiry(enq.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                            title="Delete Enquiry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Inspection Modal */}
      {selectedEnquiry && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
        >
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/20 text-sky-200 font-bold">
                    {selectedEnquiry.reference}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${STATUS_CONFIG[selectedEnquiry.status]?.badgeClass}`}>
                    {STATUS_CONFIG[selectedEnquiry.status]?.label}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white mt-1">
                  Enquiry Details: {selectedEnquiry.product_name || 'Print Quote'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEnquiry(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 sm:p-6 space-y-6 overflow-y-auto flex-1">
              {/* Customer Info Card */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Customer Name</span>
                  <span className="font-bold text-slate-900 text-sm">{selectedEnquiry.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Email Address</span>
                  <a href={`mailto:${selectedEnquiry.email}`} className="font-bold text-sky-600 hover:underline">
                    {selectedEnquiry.email}
                  </a>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Phone Number</span>
                  <span className="font-semibold text-slate-800">{selectedEnquiry.phone || 'Not provided'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Delivery Suburb / Postcode</span>
                  <span className="font-semibold text-slate-800">{selectedEnquiry.delivery_location || 'Not specified'}</span>
                </div>
              </div>

              {/* Product Specifications */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-sky-600" />
                  <span>Product Specifications</span>
                </h4>

                <div className="p-4 rounded-2xl border border-slate-200 bg-white grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Requested Quantity</span>
                    <span className="font-bold text-slate-900 text-sm">{selectedEnquiry.quantity ?? 'Custom'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Paper Stock / GSM</span>
                    <span className="font-bold text-slate-900">{selectedEnquiry.specifications?.gsm || 'Standard'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Printing Sides</span>
                    <span className="font-bold text-slate-900">{selectedEnquiry.specifications?.printing_sides || 'Double-Sided'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Size / Format</span>
                    <span className="font-bold text-slate-900">{selectedEnquiry.specifications?.size || 'Standard'}</span>
                  </div>
                </div>
              </div>

              {/* Additional Requirements / Customer Notes */}
              {selectedEnquiry.additional_requirements && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                    Customer Instructions
                  </span>
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                    {selectedEnquiry.additional_requirements}
                  </div>
                </div>
              )}

              {/* Attachment File */}
              {selectedEnquiry.attachment_url && (
                <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-sky-900 font-semibold">
                    <Paperclip className="w-4 h-4 text-sky-600" />
                    <span>{selectedEnquiry.attachment_original_name || 'Artwork Attachment'}</span>
                    {selectedEnquiry.attachment_size_bytes && (
                      <span className="text-[11px] text-sky-600 font-normal">
                        ({Math.round(selectedEnquiry.attachment_size_bytes / 1024)} KB)
                      </span>
                    )}
                  </div>

                  <a
                    href={selectedEnquiry.attachment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </a>
                </div>
              )}

              {/* Status Update & Internal Notes */}
              <div className="space-y-3 pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Internal Prepress & Sales Notes
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 font-medium">Status:</span>
                    <select
                      value={selectedEnquiry.status}
                      onChange={(e) => handleStatusChange(selectedEnquiry.id, e.target.value)}
                      className="px-2 py-1 rounded-lg text-xs font-bold border border-slate-300 bg-white"
                    >
                      <option value="new">New Enquiry</option>
                      <option value="contacted">Contacted</option>
                      <option value="quoted">Quoted</option>
                      <option value="converted">Converted</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={detailNotes}
                  onChange={(e) => setDetailNotes(e.target.value)}
                  placeholder="Record quote amounts, contact notes, turnaround commitments, or supplier notes..."
                  className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />

                <div className="flex items-center justify-between">
                  {notesFeedback ? (
                    <span className="text-xs text-emerald-600 font-semibold">{notesFeedback}</span>
                  ) : (
                    <span className="text-[11px] text-slate-400">Internal notes are visible only to administrators.</span>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition disabled:opacity-50"
                  >
                    {savingNotes ? 'Saving…' : 'Save Internal Notes'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
