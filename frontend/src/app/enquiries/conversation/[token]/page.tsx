'use client';

import React, { useEffect, useState, useRef, use } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Send,
  Loader2,
  Paperclip,
  Download,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Package,
  Layers,
  FileText,
  User,
  Sparkles,
  ArrowLeft,
  X,
  ExternalLink,
  RefreshCw,
  Eye,
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

interface ConversationData {
  reference: string;
  name: string;
  email: string;
  phone?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  specifications?: Record<string, any> | null;
  delivery_location?: string | null;
  additional_requirements?: string | null;
  attachment_url?: string | null;
  attachment_original_name?: string | null;
  attachment_size_bytes?: number | null;
  status: string;
  created_at: string;
  formatted_date?: string;
  messages: EnquiryMessage[];
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  new: { label: 'Enquiry Received', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  contacted: { label: 'In Conversation', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  quoted: { label: 'Quote Prepared', className: 'bg-purple-50 text-purple-700 border-purple-200' },
  converted: { label: 'Order Confirmed', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  closed: { label: 'Resolved / Closed', className: 'bg-slate-100 text-slate-600 border-slate-200' },
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

export default function CustomerConversationPage({ params }: { params: any }) {
  const unwrappedParams = typeof params?.then === 'function' ? use(params) : params;
  const token = unwrappedParams?.token as string;

  const [conversation, setConversation] = useState<ConversationData | null>(null);
  const [messages, setMessages] = useState<EnquiryMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reply form state
  const [replyText, setReplyText] = useState('');
  const [replyFile, setReplyFile] = useState<File | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [replySuccess, setReplySuccess] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchConversation = async (isSilent = false) => {
    if (!token) return;
    if (!isSilent) setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get(`/enquiries/conversation/${token}`);
      if (response.data?.success && response.data.data) {
        setConversation(response.data.data);
        setMessages(response.data.data.messages || []);
      } else {
        throw new Error(response.data?.message || 'Unable to load conversation.');
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setError('This conversation could not be found or the link is invalid.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to load conversation.');
      }
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversation();
  }, [token]);

  useEffect(() => {
    // Auto-scroll to latest message
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 25MB size limit
    const maxSizeBytes = 25 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setReplyError('Selected file exceeds the 25MB limit. Please choose a smaller file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Supported extensions
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'ai', 'eps', 'psd', 'tif', 'tiff'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      setReplyError('Unsupported file type. Please upload a PDF, PNG, JPG, WebP, AI, EPS, PSD, or TIFF file.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setReplyError(null);
    setReplyFile(file);
  };

  const handleRemoveFile = () => {
    setReplyFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const trimmed = replyText.trim();
    if (!trimmed && !replyFile) {
      setReplyError('Please enter a message or attach a file.');
      return;
    }

    setIsSending(true);
    setReplyError(null);
    setReplySuccess(null);

    try {
      const formData = new FormData();
      if (trimmed) {
        formData.append('message', trimmed);
      }
      if (replyFile) {
        formData.append('attachment', replyFile);
      }

      const response = await apiClient.post(`/enquiries/conversation/${token}/reply`, formData);

      if (response.data?.success) {
        const newMsg: EnquiryMessage = response.data.data;
        setMessages((prev) => [...prev, newMsg]);
        setReplyText('');
        handleRemoveFile();
        setReplySuccess('Your reply has been sent to our prepress specialists.');
        setTimeout(() => setReplySuccess(null), 4000);
      } else {
        throw new Error(response.data?.message || 'Could not send reply.');
      }
    } catch (err: any) {
      if (err.response?.status === 429) {
        setReplyError('Too many messages sent. Please wait a minute before replying again.');
      } else {
        const valErrors = err.response?.data?.errors;
        if (valErrors) {
          const firstErr = Object.values(valErrors).flat()[0];
          setReplyError(String(firstErr));
        } else {
          setReplyError(err.response?.data?.message || err.message || 'Unable to send reply. Please try again.');
        }
      }
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-slate-800/80 border border-slate-700/60 shadow-2xl flex flex-col items-center text-center max-w-sm">
          <Loader2 className="w-10 h-10 animate-spin text-sky-400 mb-4" />
          <h2 className="text-base font-bold text-white mb-1">Opening Conversation</h2>
          <p className="text-xs text-slate-400">Loading your enquiry thread and prepress updates...</p>
        </div>
      </div>
    );
  }

  if (error || !conversation) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="p-8 rounded-3xl bg-slate-800 border border-slate-700 shadow-2xl flex flex-col items-center text-center max-w-md">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">Conversation Unavailable</h2>
          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            {error || 'This conversation link is either invalid, expired, or has been removed.'}
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Homepage</span>
          </Link>
        </div>
      </div>
    );
  }

  const statusBadge = STATUS_BADGES[conversation.status] || STATUS_BADGES.new;
  const specs = conversation.specifications || {};

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow-md group-hover:scale-105 transition">
                EI
              </div>
              <div>
                <span className="font-black text-sm tracking-tight text-white block">
                  Erry Imprints
                </span>
                <span className="text-[10px] text-slate-400 block -mt-0.5">
                  Direct Customer Prepress Portal
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Private Encrypted Link</span>
            </div>

            <button
              type="button"
              onClick={() => fetchConversation(true)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Refresh conversation"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-xl hover:bg-slate-800 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Storefront</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Enquiry Specifications Overview */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-5">
            {/* Header info */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-sky-950/80 text-sky-300 font-bold border border-sky-800/60">
                  {conversation.reference}
                </span>
                <span className={`px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wider border ${statusBadge.className}`}>
                  {statusBadge.label}
                </span>
              </div>
              <h1 className="text-lg font-bold text-white tracking-tight">
                {conversation.product_name || 'Custom Print Job'}
              </h1>
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Submitted {conversation.formatted_date || conversation.created_at}</span>
              </p>
            </div>

            {/* Product Specifications Grid */}
            <div className="space-y-2.5 pt-4 border-t border-slate-800 text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                Job Specifications
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">Quantity</span>
                  <span className="font-bold text-white">{conversation.quantity ?? 'Custom'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">Paper / Stock</span>
                  <span className="font-bold text-white">{specs.gsm || 'Standard'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">Print Sides</span>
                  <span className="font-bold text-white">{specs.printing_sides || 'Double-Sided'}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-[10px] text-slate-500 block">Dimensions</span>
                  <span className="font-bold text-white">{specs.size || 'Standard Size'}</span>
                </div>
              </div>

              {(specs.finishing || specs.folding) && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 space-y-1">
                  {specs.finishing && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Finishing:</span>
                      <span className="font-medium text-slate-200">{specs.finishing}</span>
                    </div>
                  )}
                  {specs.folding && (
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-500">Folding:</span>
                      <span className="font-medium text-slate-200">{specs.folding}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Delivery suburb if provided */}
            {conversation.delivery_location && (
              <div className="pt-3 border-t border-slate-800 text-xs">
                <span className="text-[10px] text-slate-500 block">Delivery Destination</span>
                <span className="font-semibold text-slate-300">{conversation.delivery_location}</span>
              </div>
            )}

            {/* Initial customer instructions */}
            {conversation.additional_requirements && (
              <div className="pt-3 border-t border-slate-800 space-y-1 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Original Requirements
                </span>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-slate-300 whitespace-pre-wrap leading-relaxed text-xs">
                  {conversation.additional_requirements}
                </div>
              </div>
            )}

            {/* Initial Enquiry Attachment if present */}
            {conversation.attachment_url && (
              <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Initial Uploaded File
                </span>
                <a
                  href={conversation.attachment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-3 rounded-xl bg-sky-950/40 border border-sky-800/50 hover:bg-sky-900/40 transition text-sky-200 group"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Paperclip className="w-4 h-4 text-sky-400 shrink-0" />
                    <span className="truncate font-medium text-xs">
                      {conversation.attachment_original_name || 'Artwork File'}
                    </span>
                    {conversation.attachment_size_bytes && (
                      <span className="text-[10px] text-sky-400/80 shrink-0">
                        ({formatFileSize(conversation.attachment_size_bytes)})
                      </span>
                    )}
                  </div>
                  <Download className="w-4 h-4 text-sky-400 shrink-0 group-hover:scale-110 transition" />
                </a>
              </div>
            )}
          </div>

          {/* Email notice reminder */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-sky-400" />
              <span>Email Notifications Active</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-snug">
              Whenever our prepress team replies with quotes or proofs, an email notification is automatically sent to{' '}
              <span className="text-slate-300 font-medium">{conversation.email}</span> with your link.
            </p>
          </div>
        </div>

        {/* Right Column: Live Two-Way Chat Thread */}
        <div className="lg:col-span-8 flex flex-col rounded-3xl bg-slate-900 border border-slate-800 shadow-xl overflow-hidden min-h-[580px]">
          {/* Chat Header */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-600/20 text-sky-400 border border-sky-500/30 flex items-center justify-center shadow-inner">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  <span>Conversation with Prepress Team</span>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Direct communication regarding quote {conversation.reference}
                </p>
              </div>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-[11px] text-slate-400 block">Logged in as</span>
              <span className="text-xs font-bold text-white">{conversation.name}</span>
            </div>
          </div>

          {/* Messages Thread Container */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 max-h-[500px] bg-slate-950/40">
            {messages.length === 0 ? (
              <div className="py-16 text-center space-y-3 text-slate-500">
                <MessageSquare className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-sm font-semibold text-slate-300">No messages in this conversation yet</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Our prepress team is reviewing your specifications and will respond shortly with quote details or proof files.
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
                    className={`flex flex-col ${isAdmin ? 'items-start' : 'items-end'}`}
                  >
                    {/* Sender Label and Timestamp */}
                    <div
                      className={`flex items-center gap-2 mb-1 px-1 text-[11px] text-slate-400 ${
                        isAdmin ? 'flex-row' : 'flex-row-reverse'
                      }`}
                    >
                      <span className="font-semibold text-xs flex items-center gap-1 text-slate-300">
                        {isAdmin ? (
                          <>
                            <Sparkles className="w-3 h-3 text-sky-400" />
                            <span>{msg.sender_name || 'Erry Imprints Team'}</span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-sky-950 text-sky-300 border border-sky-800">
                              Official
                            </span>
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3 text-emerald-400" />
                            <span>{msg.sender_name || 'You'}</span>
                          </>
                        )}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-[11px] text-slate-500">
                        {msg.formatted_date || msg.created_at}
                      </span>
                    </div>

                    {/* Message Card Bubble */}
                    <div
                      className={`max-w-xl rounded-2xl p-4 text-xs leading-relaxed shadow-sm ${
                        isAdmin
                          ? 'bg-slate-800 border border-slate-700/80 text-slate-100 rounded-tl-sm'
                          : 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white rounded-tr-sm shadow-sky-600/10'
                      }`}
                    >
                      {/* Text */}
                      {msg.message && (
                        <div className="whitespace-pre-wrap break-words">{msg.message}</div>
                      )}

                      {/* Attachment Box */}
                      {hasAttachment && (
                        <div
                          className={`mt-3 pt-3 border-t ${
                            isAdmin ? 'border-slate-700' : 'border-white/20'
                          } space-y-2`}
                        >
                          {/* Image preview if image */}
                          {isImage && msg.attachment_url && (
                            <a
                              href={msg.attachment_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block relative rounded-xl overflow-hidden border border-black/10 max-h-48 group"
                            >
                              <img
                                src={msg.attachment_url}
                                alt={msg.attachment_original_name || 'Attachment'}
                                className="w-full h-auto object-cover group-hover:scale-105 transition duration-200"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white text-xs font-bold gap-1.5">
                                <Eye className="w-4 h-4" />
                                <span>View Full Size</span>
                              </div>
                            </a>
                          )}

                          {/* Download Link Card */}
                          <a
                            href={msg.attachment_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center justify-between p-2.5 rounded-xl transition ${
                              isAdmin
                                ? 'bg-slate-900/80 hover:bg-slate-900 border border-slate-700 text-sky-300'
                                : 'bg-black/20 hover:bg-black/30 border border-white/20 text-white'
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
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Form Footer */}
          <div className="p-4 sm:p-5 bg-slate-900 border-t border-slate-800 space-y-3">
            {/* Feedback Alerts */}
            {replyError && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{replyError}</span>
              </div>
            )}
            {replySuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{replySuccess}</span>
              </div>
            )}

            {/* Selected File Chip */}
            {replyFile && (
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-slate-200">
                <div className="flex items-center gap-2 truncate pr-2">
                  <Paperclip className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate font-medium">{replyFile.name}</span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    ({formatFileSize(replyFile.size)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition"
                  title="Remove file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Compose Form */}
            <form onSubmit={handleSendReply} className="space-y-3">
              <div className="relative">
                <textarea
                  rows={3}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply or question for our prepress team..."
                  disabled={isSending}
                  className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition resize-none disabled:opacity-50"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileChange}
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.ai,.eps,.psd,.tif,.tiff"
                    className="hidden"
                    id="customer-chat-attachment"
                  />
                  <label
                    htmlFor="customer-chat-attachment"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-semibold cursor-pointer transition"
                  >
                    <Paperclip className="w-3.5 h-3.5 text-sky-400" />
                    <span>{replyFile ? 'Change File' : 'Attach File / Proof'}</span>
                  </label>
                  <span className="text-[10px] text-slate-500 hidden sm:inline">
                    PDF, PNG, JPG, AI, PSD up to 25MB
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSending || (!replyText.trim() && !replyFile)}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-sky-600/20 hover:shadow-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Message</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
