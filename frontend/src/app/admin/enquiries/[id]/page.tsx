'use client';

import React, { useState, useEffect, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  MessageSquare,
  MessageSquareText,
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
  Paperclip,
  ExternalLink,
  Send,
  Copy,
  Check,
  Sparkles,
  User,
  Clock,
  ShieldCheck,
  Trash2,
  X,
  ChevronRight,
  Info,
  Bot,
} from 'lucide-react';
import { apiClient } from '@/services/api/client';

interface EnquiryMessage {
  id: number;
  customer_enquiry_id: number;
  sender_type: 'customer' | 'admin' | 'ai';
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
  needs_human_followup?: boolean;
  is_ai_enabled?: boolean;
  channel?: string;
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

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function AdminEnquiryDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const enquiryId = resolvedParams.id;
  const router = useRouter();

  const [enquiry, setEnquiry] = useState<CustomerEnquiryItem | null>(null);
  const [messages, setMessages] = useState<EnquiryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active view tab for smaller viewports or tabs
  const [activeTab, setActiveTab] = useState<'conversation' | 'details' | 'notes'>('conversation');

  // Reply form state
  const [adminReplyText, setAdminReplyText] = useState('');
  const [adminReplyFile, setAdminReplyFile] = useState<File | null>(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [replyAlert, setReplyAlert] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notes state
  const [detailNotes, setDetailNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesFeedback, setNotesFeedback] = useState<string | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const adminFileInputRef = useRef<HTMLInputElement>(null);

  const fetchEnquiry = useCallback(async (isPolling = false) => {
    if (!isPolling) setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/admin/enquiries/${enquiryId}`);
      if (response.data?.success && response.data?.data) {
        const data: CustomerEnquiryItem = response.data.data;
        setEnquiry(data);
        setDetailNotes(data.admin_notes || '');
        if (data.messages) {
          setMessages(data.messages);
        }
      } else {
        throw new Error(response.data?.message || 'Enquiry not found.');
      }
    } catch (err: any) {
      if (!isPolling) {
        setError(err.response?.data?.message || err.message || 'Failed to load customer enquiry.');
      }
    } finally {
      if (!isPolling) setLoading(false);
    }
  }, [enquiryId]);

  useEffect(() => {
    fetchEnquiry();
  }, [fetchEnquiry]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeTab]);

  const handleStatusChange = async (newStatus: string) => {
    if (!enquiry) return;
    setUpdatingStatus(true);
    try {
      setEnquiry((prev) => prev ? { ...prev, status: newStatus as any } : null);
      await apiClient.patch(`/admin/enquiries/${enquiry.id}`, {
        status: newStatus,
      });
    } catch (err) {
      alert('Failed to update enquiry status.');
      fetchEnquiry(true);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAdminFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 25MB limit
    const maxSizeBytes = 25 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setReplyAlert({ type: 'error', text: 'Attachment exceeds the 25MB limit.' });
      if (adminFileInputRef.current) adminFileInputRef.current.value = '';
      return;
    }

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
    if (!enquiry) return;

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

      const res = await apiClient.post(`/admin/enquiries/${enquiry.id}/messages`, formData);

      if (res.data?.success) {
        const newMsg: EnquiryMessage = res.data.data;
        setMessages((prev) => [...prev, newMsg]);
        setAdminReplyText('');
        handleRemoveAdminFile();
        setReplyAlert({ type: 'success', text: 'Reply saved to database and email notification sent to customer.' });
        setTimeout(() => setReplyAlert(null), 5000);

        const newStatus = res.data.enquiry_status || enquiry.status;
        setEnquiry((prev) => prev ? { ...prev, status: newStatus, needs_human_followup: false } : null);
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

  const handleToggleAi = async () => {
    if (!enquiry) return;
    const currentAi = enquiry.is_ai_enabled !== false;
    const nextAi = !currentAi;

    try {
      const res = await apiClient.post(`/admin/enquiries/${enquiry.id}/toggle-ai`, {
        is_ai_enabled: nextAi,
      });
      if (res.data?.success) {
        setEnquiry((prev) => prev ? { ...prev, is_ai_enabled: nextAi } : null);
      }
    } catch (err) {
      alert('Failed to update AI auto-reply setting.');
    }
  };

  const handleResolveFollowup = async () => {
    if (!enquiry) return;

    try {
      const res = await apiClient.post(`/admin/enquiries/${enquiry.id}/resolve-followup`);
      if (res.data?.success) {
        setEnquiry((prev) => prev ? { ...prev, needs_human_followup: false } : null);
      }
    } catch (err) {
      alert('Failed to resolve follow-up status.');
    }
  };

  const handleCopyCustomerLink = () => {
    if (!enquiry?.conversation_url) return;
    navigator.clipboard.writeText(enquiry.conversation_url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleSaveNotes = async () => {
    if (!enquiry) return;
    setSavingNotes(true);
    setNotesFeedback(null);
    try {
      const res = await apiClient.patch(`/admin/enquiries/${enquiry.id}`, {
        admin_notes: detailNotes,
      });
      if (res.data?.success) {
        setNotesFeedback('Internal notes saved successfully.');
        setEnquiry((prev) => prev ? { ...prev, admin_notes: detailNotes } : null);
        setTimeout(() => setNotesFeedback(null), 4000);
      }
    } catch (err) {
      setNotesFeedback('Failed to save internal notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDeleteEnquiry = async () => {
    if (!enquiry) return;
    if (!confirm(`Are you sure you want to permanently delete enquiry ${enquiry.reference}?`)) return;
    try {
      await apiClient.delete(`/admin/enquiries/${enquiry.id}`);
      router.push('/admin/enquiries');
    } catch (err) {
      alert('Failed to delete enquiry.');
    }
  };

  if (loading) {
    return (
      <div className="p-8 sm:p-12 flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-sky-600" />
        <p className="text-sm font-semibold text-slate-600">Loading customer enquiry...</p>
      </div>
    );
  }

  if (error || !enquiry) {
    return (
      <div className="p-6 sm:p-10 max-w-3xl mx-auto space-y-6">
        <div className="p-6 rounded-2xl bg-white border border-rose-200 shadow-sm text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Enquiry Not Found</h2>
            <p className="text-sm text-slate-500 mt-1">
              {error || `Customer enquiry #${enquiryId} does not exist or may have been deleted.`}
            </p>
          </div>
          <div>
            <Link
              href="/admin/enquiries"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Enquiries</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[enquiry.status] || STATUS_CONFIG.new;

  return (
    <div className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header / Breadcrumb Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link
              href="/admin/enquiries"
              className="inline-flex items-center gap-1 text-slate-600 hover:text-sky-600 font-medium transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Customer Enquiries</span>
            </Link>
            <span className="text-slate-300">/</span>
            <span className="font-semibold text-slate-800">{enquiry.reference}</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              {enquiry.name}
            </h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}>
              {statusInfo.label}
            </span>
            <span className="text-xs text-slate-400 font-mono">
              ID #{enquiry.id}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date(enquiry.created_at).toLocaleDateString('en-AU', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1 font-semibold text-slate-700">
              <Package className="w-3.5 h-3.5 text-sky-600" />
              {enquiry.product_name || 'Custom Print Job'}
            </span>
            {enquiry.quantity && (
              <>
                <span className="text-slate-300">·</span>
                <span>{Number(enquiry.quantity).toLocaleString()} units</span>
              </>
            )}
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Status changer */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status:</span>
            <select
              value={enquiry.status}
              disabled={updatingStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="text-xs font-bold bg-transparent border-0 focus:ring-0 cursor-pointer text-slate-800 py-0 pl-1 pr-6"
            >
              <option value="new">New Enquiry</option>
              <option value="contacted">Contacted</option>
              <option value="quoted">Quoted</option>
              <option value="converted">Converted</option>
              <option value="closed">Closed</option>
            </select>
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => fetchEnquiry(true)}
            className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 transition shadow-2xs cursor-pointer"
            title="Refresh conversation & details"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Delete button */}
          <button
            type="button"
            onClick={handleDeleteEnquiry}
            className="p-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 transition shadow-2xs cursor-pointer"
            title="Delete this enquiry"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content: Two-column Layout on Desktop, Tabbed on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left / Primary Column: Conversation with Customer (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[620px]">
            
            {/* Conversation Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 to-sky-950 text-white flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/30 flex items-center justify-center text-sky-300 font-bold">
                  <MessageSquareText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold flex items-center gap-2">
                    <span>Conversation with Customer</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/30 text-sky-200 border border-sky-400/30">
                      Live Chat
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Replies save to database and immediately send email notification to customer.
                  </p>
                </div>
              </div>

              {/* Action Buttons: AI Toggle & Secure Link */}
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleToggleAi}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition cursor-pointer shadow-2xs ${
                    enquiry.is_ai_enabled !== false
                      ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Toggle automatic AI replies for this conversation"
                >
                  <Bot className="w-3.5 h-3.5" />
                  <span>AI: {enquiry.is_ai_enabled !== false ? 'Active' : 'Paused (Takeover)'}</span>
                </button>

                {enquiry.conversation_url && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleCopyCustomerLink}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold transition cursor-pointer"
                      title="Copy customer's unguessable link"
                    >
                      {copiedLink ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-300">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                    <a
                      href={enquiry.conversation_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                      title="Open customer view in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Human Follow-up Alert Banner */}
            {enquiry.needs_human_followup && (
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="font-semibold">
                    Customer requested a human agent or inquiry requires prepress quotation review.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResolveFollowup}
                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition shrink-0 shadow-2xs cursor-pointer"
                >
                  Mark Follow-up Resolved
                </button>
              </div>
            )}

            {/* Customer Contact Strip */}
            <div className="px-4 py-2.5 bg-sky-50 border-b border-sky-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2 text-slate-700">
                <span className="font-bold text-slate-900">{enquiry.name}</span>
                <span className="text-slate-300">·</span>
                <a href={`mailto:${enquiry.email}`} className="text-sky-700 hover:underline flex items-center gap-1">
                  <Mail className="w-3 h-3 text-sky-600" />
                  <span>{enquiry.email}</span>
                </a>
                {enquiry.phone && (
                  <>
                    <span className="text-slate-300">·</span>
                    <a href={`tel:${enquiry.phone}`} className="text-slate-600 hover:text-slate-900 flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      <span>{enquiry.phone}</span>
                    </a>
                  </>
                )}
              </div>

              {enquiry.delivery_location && (
                <span className="text-[11px] text-slate-500 font-medium">
                  📍 {enquiry.delivery_location}
                </span>
              )}
            </div>

            {/* Chat Messages Timeline */}
            <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4 max-h-[500px] bg-slate-50/60">
              
              {/* Initial Customer Request Card */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-700 shadow-2xs space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium">
                  <span className="flex items-center gap-1.5 font-bold text-slate-800">
                    <User className="w-3.5 h-3.5 text-sky-600" />
                    <span>{enquiry.name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                      Original Enquiry
                    </span>
                  </span>
                  <span>
                    {new Date(enquiry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="text-slate-900 font-medium leading-relaxed whitespace-pre-wrap">
                  {enquiry.additional_requirements || 'Customer requested a custom quote for this print job.'}
                </div>

                {/* Original attachment if present */}
                {enquiry.attachment_url && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Attached File:
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate text-xs">
                          {enquiry.attachment_original_name || 'Artwork File'}
                        </span>
                        {enquiry.attachment_size_bytes && (
                          <span className="text-[11px] text-slate-400 shrink-0">
                            ({formatFileSize(enquiry.attachment_size_bytes)})
                          </span>
                        )}
                      </div>
                      <a
                        href={enquiry.attachment_url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold transition shrink-0 ml-2"
                      >
                        <Download className="w-3 h-3" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Conversation Messages */}
              {messages.length === 0 ? (
                <div className="py-8 text-center text-slate-400 space-y-1">
                  <p className="text-xs">No customer replies yet.</p>
                  <p className="text-[11px]">Type a message below to send the first reply to {enquiry.name}.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isAdmin = msg.sender_type === 'admin';
                  const isAi = msg.sender_type === 'ai';
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1 px-1">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          {isAdmin ? (
                            <>
                              <Sparkles className="w-3 h-3 text-sky-600" />
                              <span>Erry Imprints (Staff)</span>
                            </>
                          ) : isAi ? (
                            <>
                              <Bot className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Erry AI Support</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-indigo-100 text-indigo-800 font-bold border border-indigo-200">
                                AI Assistant
                              </span>
                            </>
                          ) : (
                            <>
                              <User className="w-3 h-3 text-slate-500" />
                              <span>{enquiry.name}</span>
                            </>
                          )}
                        </span>
                        <span>·</span>
                        <span>{msg.time_ago || msg.formatted_date}</span>
                      </div>

                      <div
                        className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-2xs space-y-2 ${
                          isAdmin
                            ? 'bg-slate-900 text-white rounded-br-xs'
                            : isAi
                            ? 'bg-gradient-to-br from-indigo-50/90 to-sky-50/70 border border-indigo-200/80 text-slate-900 rounded-bl-xs'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-xs'
                        }`}
                      >
                        {msg.message && (
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                        )}

                        {/* Message Attachment */}
                        {msg.attachment_url && (
                          <div className={`pt-2 border-t ${isAdmin ? 'border-slate-800' : 'border-slate-100'}`}>
                            {isImageMime(msg.attachment_mime_type, msg.attachment_original_name) ? (
                              <div className="space-y-1.5">
                                <a href={msg.attachment_url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-slate-300/30 max-w-xs">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={msg.attachment_url}
                                    alt={msg.attachment_original_name || 'Attachment'}
                                    className="max-h-48 w-full object-cover hover:scale-102 transition"
                                  />
                                </a>
                                <div className="flex items-center justify-between text-[11px]">
                                  <span className={`truncate max-w-[180px] font-medium ${isAdmin ? 'text-slate-300' : 'text-slate-600'}`}>
                                    {msg.attachment_original_name}
                                  </span>
                                  <a
                                    href={msg.attachment_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    download
                                    className={`inline-flex items-center gap-1 underline font-semibold ${
                                      isAdmin ? 'text-sky-300 hover:text-white' : 'text-sky-700 hover:text-sky-900'
                                    }`}
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>Download</span>
                                  </a>
                                </div>
                              </div>
                            ) : (
                              <div className={`flex items-center justify-between gap-2 p-2 rounded-xl ${isAdmin ? 'bg-slate-800/80 border border-slate-700' : 'bg-slate-50 border border-slate-200'}`}>
                                <div className="flex items-center gap-2 min-w-0">
                                  <Paperclip className={`w-3.5 h-3.5 shrink-0 ${isAdmin ? 'text-slate-400' : 'text-slate-500'}`} />
                                  <span className={`font-semibold text-[11px] truncate ${isAdmin ? 'text-white' : 'text-slate-800'}`}>
                                    {msg.attachment_original_name || 'Attached File'}
                                  </span>
                                  {msg.attachment_size_bytes && (
                                    <span className="text-[10px] text-slate-400 shrink-0">
                                      ({formatFileSize(msg.attachment_size_bytes)})
                                    </span>
                                  )}
                                </div>
                                <a
                                  href={msg.attachment_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  download
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold transition shrink-0 ${
                                    isAdmin ? 'bg-sky-600 hover:bg-sky-500 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'
                                  }`}
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download</span>
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Admin Reply Form */}
            <div className="p-4 border-t border-slate-200 bg-white">
              {replyAlert && (
                <div
                  className={`mb-3 p-3 rounded-xl text-xs flex items-center justify-between ${
                    replyAlert.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border border-rose-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {replyAlert.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    )}
                    <span>{replyAlert.text}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyAlert(null)}
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <form onSubmit={handleSendAdminReply} className="space-y-3">
                <div className="relative">
                  <textarea
                    rows={3}
                    value={adminReplyText}
                    onChange={(e) => setAdminReplyText(e.target.value)}
                    placeholder={`Write your reply or quote details for ${enquiry.name}...`}
                    className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500 text-slate-800 placeholder-slate-400 transition"
                    disabled={sendingReply}
                  />
                </div>

                {/* Attachment Badge if selected */}
                {adminReplyFile && (
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-800">
                    <Paperclip className="w-3.5 h-3.5 text-sky-600" />
                    <span className="font-semibold truncate max-w-xs">{adminReplyFile.name}</span>
                    <span className="text-[10px] text-sky-600 font-normal">
                      ({formatFileSize(adminReplyFile.size)})
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveAdminFile}
                      className="p-0.5 rounded hover:bg-sky-200 text-sky-700 ml-1 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div>
                    <input
                      ref={adminFileInputRef}
                      type="file"
                      onChange={handleAdminFileChange}
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.ai,.eps,.psd,.tif,.tiff"
                      className="hidden"
                      id="admin-reply-file-input"
                      disabled={sendingReply}
                    />
                    <label
                      htmlFor="admin-reply-file-input"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer transition shadow-2xs"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-slate-500" />
                      <span>{adminReplyFile ? 'Change Attachment' : 'Attach File / Quote'}</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={sendingReply || (!adminReplyText.trim() && !adminReplyFile)}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    {sendingReply ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending...</span>
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
        </div>

        {/* Right Column: Customer Details, Print Specs & Internal Notes (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Card 1: Job Specifications & Customer Information */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-sky-600" />
                <span>Job & Print Specifications</span>
              </h3>
              <span className="text-xs font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-0.5 rounded-full">
                {enquiry.product_name || 'Custom Print'}
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Customer:</span>
                <span className="font-bold text-slate-900 text-right">{enquiry.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500 font-medium">Email:</span>
                <a href={`mailto:${enquiry.email}`} className="font-semibold text-sky-700 hover:underline text-right">
                  {enquiry.email}
                </a>
              </div>
              {enquiry.phone && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Phone:</span>
                  <a href={`tel:${enquiry.phone}`} className="font-semibold text-slate-800 text-right">
                    {enquiry.phone}
                  </a>
                </div>
              )}
              {enquiry.delivery_location && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Delivery Suburb:</span>
                  <span className="font-semibold text-slate-800 text-right">{enquiry.delivery_location}</span>
                </div>
              )}
              {enquiry.quantity && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Requested Quantity:</span>
                  <span className="font-black text-slate-900 text-right">
                    {Number(enquiry.quantity).toLocaleString()} units
                  </span>
                </div>
              )}
            </div>

            {/* Structured Specs Grid */}
            {enquiry.specifications && Object.keys(enquiry.specifications).length > 0 && (
              <div className="pt-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Technical Specifications:
                </div>
                <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50 text-xs overflow-hidden">
                  {Object.entries(enquiry.specifications).map(([key, val]) => {
                    if (!val) return null;
                    const formattedKey = key
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (c) => c.toUpperCase());
                    return (
                      <div key={key} className="flex items-center justify-between px-3 py-2">
                        <span className="text-slate-500 font-medium">{formattedKey}</span>
                        <span className="font-bold text-slate-800 text-right">{String(val)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Original Attachment */}
            {enquiry.attachment_url && (
              <div className="pt-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  📎 Uploaded Artwork / Reference:
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                  <div className="min-w-0 text-xs">
                    <p className="font-bold text-slate-900 truncate">
                      {enquiry.attachment_original_name || 'Artwork File'}
                    </p>
                    {enquiry.attachment_size_bytes && (
                      <p className="text-[11px] text-slate-400">
                        {formatFileSize(enquiry.attachment_size_bytes)}
                      </p>
                    )}
                  </div>
                  <a
                    href={enquiry.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            )}

            {/* Direct Link to Store Product if source_url is available */}
            {enquiry.source_url && (
              <div className="pt-1">
                <a
                  href={enquiry.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-sky-700 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>View Product on Storefront</span>
                </a>
              </div>
            )}
          </div>

          {/* Card 2: Internal Admin Notes */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-600" />
                <span>Internal Staff Notes</span>
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">Private</span>
            </div>

            <p className="text-xs text-slate-500">
              Notes entered here are visible only to logged-in administrators and will never be seen by the customer.
            </p>

            {notesFeedback && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>{notesFeedback}</span>
              </div>
            )}

            <div className="space-y-3">
              <textarea
                rows={4}
                value={detailNotes}
                onChange={(e) => setDetailNotes(e.target.value)}
                placeholder="Add internal notes about quote pricing, paper supplier codes, delivery notes, or customer conversations..."
                className="w-full text-xs p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-slate-800 placeholder-slate-400"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  {savingNotes ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Notes...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Notes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
