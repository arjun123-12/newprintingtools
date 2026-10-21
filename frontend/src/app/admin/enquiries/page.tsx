'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare,
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
  Send,
  Copy,
  Check,
  Sparkles,
  User,
  Eye,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '@/services/api/client';

interface EnquiryMessage {
  id: number;
  customer_enquiry_id: number;
  sender_type: 'customer' | 'admin';
  sender_name?: string | null;
  message?: string | null;
  attachment_path?: string | null;
  attachment_original_name?: string | null;
  attachment_mime_type?: string | null;
  attachment_size_bytes?: number | null;
  attachment_url?: string | null;
  formatted_date?: string;
  time_ago?: string;
  created_at: string;
}

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
  access_token?: string | null;
  conversation_url?: string | null;
  last_message_at?: string | null;
  messages?: EnquiryMessage[];
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

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageMime(mime?: string | null, filename?: string | null): boolean {
  if (mime && mime.startsWith('image/')) return true;
  if (!filename) return false;
  const ext = filename.split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '');
}

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
  const [activeDetailTab, setActiveDetailTab] = useState<'conversation' | 'details' | 'notes'>('conversation');
  const [detailNotes, setDetailNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesFeedback, setNotesFeedback] = useState<string | null>(null);

  // Chat conversation state
  const [messages, setMessages] = useState<EnquiryMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [adminReplyText, setAdminReplyText] = useState('');
  const [adminReplyFile, setAdminReplyFile] = useState<File | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyAlert, setReplyAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const adminFileInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (activeDetailTab === 'conversation') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeDetailTab]);

  const fetchMessages = async (enquiryId: number) => {
    setLoadingMessages(true);
    try {
      const res = await apiClient.get(`/admin/enquiries/${enquiryId}/messages`);
      if (res.data?.success) {
        setMessages(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load enquiry messages', err);
    } finally {
      setLoadingMessages(false);
    }
  };

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
    setActiveDetailTab('conversation');
    setReplyAlert(null);
    setAdminReplyText('');
    setAdminReplyFile(null);
    if (adminFileInputRef.current) {
      adminFileInputRef.current.value = '';
    }
    fetchMessages(enquiry.id);
  };

  const handleAdminFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 25MB size limit
    const maxSizeBytes = 25 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setReplyAlert({ type: 'error', text: 'Attachment exceeds the 25MB limit.' });
      if (adminFileInputRef.current) adminFileInputRef.current.value = '';
      return;
    }

    // Supported formats
    const allowed = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'ai', 'eps', 'psd', 'tif', 'tiff'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowed.includes(ext)) {
      setReplyAlert({ type: 'error', text: 'Unsupported format. Allowed: PDF, PNG, JPG, WebP, AI, EPS, PSD, TIFF.' });
      if (adminFileInputRef.current) adminFileInputRef.current.value = '';
      return;
    }

    setReplyAlert(null);
    setAdminReplyFile(file);
  };

  const handleRemoveAdminFile = () => {
    setAdminReplyFile(null);
    if (adminFileInputRef.current) {
      adminFileInputRef.current.value = '';
    }
  };

  const handleSendAdminReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnquiry) return;

    const trimmed = adminReplyText.trim();
    if (!trimmed && !adminReplyFile) {
      setReplyAlert({ type: 'error', text: 'Please enter a message or attach a file.' });
      return;
    }

    setSendingReply(true);
    setReplyAlert(null);

    try {
      const formData = new FormData();
      if (trimmed) formData.append('message', trimmed);
      if (adminReplyFile) formData.append('attachment', adminReplyFile);

      const res = await apiClient.post(`/admin/enquiries/${selectedEnquiry.id}/messages`, formData);

      if (res.data?.success) {
        const newMsg: EnquiryMessage = res.data.data;
        setMessages((prev) => [...prev, newMsg]);
        setAdminReplyText('');
        handleRemoveAdminFile();
        setReplyAlert({ type: 'success', text: 'Reply saved to database and email notification sent to customer.' });
        setTimeout(() => setReplyAlert(null), 5000);

        // Update status in local state if it changed to contacted
        if (res.data.enquiry_status && selectedEnquiry.status !== res.data.enquiry_status) {
          const newStatus = res.data.enquiry_status;
          setSelectedEnquiry((prev) => prev ? { ...prev, status: newStatus } : null);
          setEnquiries((prev) => prev.map((e) => e.id === selectedEnquiry.id ? { ...e, status: newStatus } : e));
        }
      } else {
        throw new Error(res.data?.message || 'Failed to send reply.');
      }
    } catch (err: any) {
      const valErrors = err.response?.data?.errors;
      if (valErrors) {
        const first = Object.values(valErrors).flat()[0];
        setReplyAlert({ type: 'error', text: String(first) });
      } else {
        setReplyAlert({ type: 'error', text: err.response?.data?.message || err.message || 'Failed to send reply.' });
      }
    } finally {
      setSendingReply(false);
    }
  };

  const handleCopyCustomerLink = () => {
    if (!selectedEnquiry?.conversation_url) return;
    navigator.clipboard.writeText(selectedEnquiry.conversation_url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
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
            Review incoming customer quote requests and converse directly with customers via live chat & notifications.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchEnquiries()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-2xs cursor-pointer"
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
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-300 bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs transition cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>Conversation</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteEnquiry(enq.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
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

      {/* Detail & Conversation Inspection Modal */}
      {selectedEnquiry && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto"
        >
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-white/20 text-sky-200 font-bold">
                    {selectedEnquiry.reference}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${STATUS_CONFIG[selectedEnquiry.status]?.badgeClass}`}>
                    {STATUS_CONFIG[selectedEnquiry.status]?.label}
                  </span>
                  <span className="text-xs text-slate-400 hidden sm:inline">
                    · {selectedEnquiry.name} ({selectedEnquiry.email})
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {selectedEnquiry.product_name || 'Print Quote Enquiry'}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEnquiry(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Navigation */}
            <div className="px-5 sm:px-6 pt-3 bg-slate-100/70 border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveDetailTab('conversation')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 ${
                  activeDetailTab === 'conversation'
                    ? 'bg-white text-sky-700 border-sky-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border-transparent'
                }`}
              >
                <MessageSquareText className="w-4 h-4 text-sky-600" />
                <span>Conversation with Customer</span>
                {messages.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-100 text-sky-800 font-bold">
                    {messages.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveDetailTab('details')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 ${
                  activeDetailTab === 'details'
                    ? 'bg-white text-sky-700 border-sky-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border-transparent'
                }`}
              >
                <Package className="w-4 h-4 text-slate-500" />
                <span>Details & Specs</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveDetailTab('notes')}
                className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition cursor-pointer border-b-2 ${
                  activeDetailTab === 'notes'
                    ? 'bg-white text-sky-700 border-sky-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 border-transparent'
                }`}
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Internal Notes & Status</span>
              </button>
            </div>

            {/* Modal Body / Active Tab Views */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-6">
              {/* TAB 1: CONVERSATION WITH CUSTOMER */}
              {activeDetailTab === 'conversation' && (
                <div className="space-y-4">
                  {/* Top quick banner with customer contact & conversation link */}
                  <div className="p-3.5 rounded-2xl bg-sky-50/70 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{selectedEnquiry.name}</span>
                        <span className="text-slate-400">·</span>
                        <a href={`mailto:${selectedEnquiry.email}`} className="text-sky-700 hover:underline">
                          {selectedEnquiry.email}
                        </a>
                        {selectedEnquiry.phone && (
                          <>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-600">{selectedEnquiry.phone}</span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Direct conversation thread. Replies send email notifications containing the secure access link.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {selectedEnquiry.conversation_url && (
                        <>
                          <button
                            type="button"
                            onClick={handleCopyCustomerLink}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-300 bg-white hover:bg-sky-50 text-sky-700 font-bold text-xs transition cursor-pointer shadow-2xs"
                            title="Copy customer secure direct link"
                          >
                            {copiedLink ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700">Copied!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Copy Link</span>
                              </>
                            )}
                          </button>
                          <a
                            href={selectedEnquiry.conversation_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs transition"
                            title="Open customer view in new tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Messages Thread */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200 min-h-[300px] max-h-[380px] overflow-y-auto space-y-4">
                    {loadingMessages ? (
                      <div className="py-16 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Loader2 className="w-6 h-6 animate-spin text-sky-600" />
                        <span className="text-xs">Loading conversation history...</span>
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="py-14 text-center space-y-2 text-slate-400">
                        <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-xs font-semibold text-slate-600">No chat messages recorded yet</p>
                        <p className="text-[11px] text-slate-400">
                          Use the composer below to start the conversation or send an official quote to the customer.
                        </p>
                      </div>
                    ) : (
                      messages.map((msg) => {
                        const isAdmin = msg.sender_type === 'admin';
                        const hasAttachment = Boolean(msg.attachment_url);
                        const isImage = isImageMime(msg.attachment_mime_type, msg.attachment_original_name);

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                          >
                            {/* Sender Badge & Time */}
                            <div
                              className={`flex items-center gap-1.5 mb-1 text-[11px] text-slate-500 ${
                                isAdmin ? 'flex-row-reverse' : 'flex-row'
                              }`}
                            >
                              <span className="font-bold flex items-center gap-1 text-slate-700">
                                {isAdmin ? (
                                  <>
                                    <Sparkles className="w-3 h-3 text-sky-600" />
                                    <span>{msg.sender_name || 'Admin Team'}</span>
                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-200 text-slate-800 font-bold">
                                      Staff
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <User className="w-3 h-3 text-emerald-600" />
                                    <span>{msg.sender_name || selectedEnquiry.name}</span>
                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-800 font-bold">
                                      Customer
                                    </span>
                                  </>
                                )}
                              </span>
                              <span>·</span>
                              <span className="text-[10px] text-slate-400">
                                {msg.formatted_date || msg.created_at}
                              </span>
                            </div>

                            {/* Message Bubble */}
                            <div
                              className={`max-w-lg rounded-2xl p-4 text-xs leading-relaxed shadow-2xs ${
                                isAdmin
                                  ? 'bg-slate-900 text-white rounded-tr-sm'
                                  : 'bg-white text-slate-900 border border-slate-200 rounded-tl-sm'
                              }`}
                            >
                              {msg.message && (
                                <div className="whitespace-pre-wrap break-words">{msg.message}</div>
                              )}

                              {/* Attachment */}
                              {hasAttachment && (
                                <div
                                  className={`mt-3 pt-3 border-t ${
                                    isAdmin ? 'border-slate-800' : 'border-slate-100'
                                  } space-y-2`}
                                >
                                  {isImage && msg.attachment_url && (
                                    <a
                                      href={msg.attachment_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block relative rounded-xl overflow-hidden border border-black/10 max-h-40 group"
                                    >
                                      <img
                                        src={msg.attachment_url}
                                        alt={msg.attachment_original_name || 'Attachment'}
                                        className="w-full h-auto object-cover group-hover:scale-105 transition duration-200"
                                      />
                                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1">
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>View</span>
                                      </div>
                                    </a>
                                  )}

                                  <a
                                    href={msg.attachment_url!}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center justify-between p-2.5 rounded-xl transition ${
                                      isAdmin
                                        ? 'bg-slate-800 hover:bg-slate-750 text-sky-200'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate pr-2">
                                      <Paperclip className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate font-medium text-xs">
                                        {msg.attachment_original_name || 'Attached File'}
                                      </span>
                                      {msg.attachment_size_bytes && (
                                        <span className="text-[10px] opacity-75 shrink-0">
                                          ({formatFileSize(msg.attachment_size_bytes)})
                                        </span>
                                      )}
                                    </div>
                                    <Download className="w-3.5 h-3.5 shrink-0" />
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={chatEndRef} />
                  </div>

                  {/* Admin Reply Composer Form */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    {/* Alert banner */}
                    {replyAlert && (
                      <div
                        className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                          replyAlert.type === 'success'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {replyAlert.type === 'success' ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        )}
                        <span className="font-semibold">{replyAlert.text}</span>
                      </div>
                    )}

                    {/* Selected File Chip */}
                    {adminReplyFile && (
                      <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800">
                        <div className="flex items-center gap-2 truncate pr-2">
                          <Paperclip className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                          <span className="truncate font-semibold">{adminReplyFile.name}</span>
                          <span className="text-[10px] text-slate-500 shrink-0">
                            ({formatFileSize(adminReplyFile.size)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveAdminFile}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleSendAdminReply} className="space-y-3">
                      <textarea
                        rows={3}
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                        placeholder="Type reply to customer... (Reply is saved to database and sent to customer's email with their secure link)"
                        disabled={sendingReply}
                        className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white transition resize-none disabled:opacity-50"
                      />

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <input
                            ref={adminFileInputRef}
                            type="file"
                            onChange={handleAdminFileChange}
                            accept=".pdf,.png,.jpg,.jpeg,.webp,.ai,.eps,.psd,.tif,.tiff"
                            className="hidden"
                            id="admin-reply-file-input"
                          />
                          <label
                            htmlFor="admin-reply-file-input"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold transition cursor-pointer shadow-2xs"
                          >
                            <Paperclip className="w-3.5 h-3.5 text-slate-600" />
                            <span>{adminReplyFile ? 'Change Proof / File' : 'Attach Proof / File'}</span>
                          </label>
                          <span className="text-[10px] text-slate-400 hidden sm:inline">
                            PDF, PNG, JPG, AI, PSD up to 25MB
                          </span>
                        </div>

                        <button
                          type="submit"
                          disabled={sendingReply || (!adminReplyText.trim() && !adminReplyFile)}
                          className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold text-xs shadow-md shadow-sky-600/20 hover:shadow-lg transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {sendingReply ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Sending Reply...</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Send Reply to Customer</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* TAB 2: DETAILS & SPECS */}
              {activeDetailTab === 'details' && (
                <div className="space-y-6">
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

                    {(selectedEnquiry.specifications?.finishing || selectedEnquiry.specifications?.folding) && (
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        {selectedEnquiry.specifications?.finishing && (
                          <div>
                            <span className="text-slate-400 block text-[11px]">Finishing</span>
                            <span className="font-semibold text-slate-800">{selectedEnquiry.specifications.finishing}</span>
                          </div>
                        )}
                        {selectedEnquiry.specifications?.folding && (
                          <div>
                            <span className="text-slate-400 block text-[11px]">Folding Option</span>
                            <span className="font-semibold text-slate-800">{selectedEnquiry.specifications.folding}</span>
                          </div>
                        )}
                      </div>
                    )}
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
                            ({formatFileSize(selectedEnquiry.attachment_size_bytes)})
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
                        <span>Download Initial File</span>
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: INTERNAL NOTES & STATUS */}
              {activeDetailTab === 'notes' && (
                <div className="space-y-6">
                  {/* Status Selection */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Workflow Status
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Update the lifecycle state of this customer quotation enquiry.
                      </p>
                    </div>

                    <select
                      value={selectedEnquiry.status}
                      onChange={(e) => handleStatusChange(selectedEnquiry.id, e.target.value)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${STATUS_CONFIG[selectedEnquiry.status]?.selectClass}`}
                    >
                      <option value="new">New Enquiry</option>
                      <option value="contacted">Contacted</option>
                      <option value="quoted">Quoted</option>
                      <option value="converted">Converted</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>

                  {/* Internal Prepress Notes */}
                  <div className="space-y-3">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
                      Internal Prepress & Sales Notes
                    </span>

                    <textarea
                      rows={5}
                      value={detailNotes}
                      onChange={(e) => setDetailNotes(e.target.value)}
                      placeholder="Record quote amounts, contact notes, turnaround commitments, supplier quotes, or internal production specifications..."
                      className="w-full p-3.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
                    />

                    <div className="flex items-center justify-between">
                      {notesFeedback ? (
                        <span className="text-xs text-emerald-600 font-semibold">{notesFeedback}</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">
                          Internal notes are visible only to logged-in administrators and will never be shared with the customer.
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={handleSaveNotes}
                        disabled={savingNotes}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        {savingNotes ? 'Saving…' : 'Save Internal Notes'}
                      </button>
                    </div>
                  </div>

                  {/* Audit & Metadata Card */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Enquiry Reference</span>
                      <span className="font-mono font-bold text-slate-800">{selectedEnquiry.reference}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Created At</span>
                      <span className="font-medium text-slate-800">
                        {new Date(selectedEnquiry.created_at).toLocaleString('en-AU')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Client IP</span>
                      <span className="font-mono text-slate-600">{selectedEnquiry.ip_address || 'Not recorded'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
