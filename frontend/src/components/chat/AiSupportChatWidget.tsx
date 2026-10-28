'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Sparkles,
  User,
  ShieldCheck,
  Bot,
  Minimize2,
  Maximize2,
  AlertCircle,
  HelpCircle,
  FileUp,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import { apiClient } from '@/services/api/client';
import { useAuth } from '@/context/AuthContext';
import { useEnquiry } from '@/context/EnquiryContext';

interface ChatMessage {
  id: number | string;
  sender_type: 'customer' | 'admin' | 'ai';
  sender_name?: string | null;
  message: string;
  created_at?: string;
  time_ago?: string;
}

const QUICK_PROMPTS = [
  'What are your business card options & prices?',
  'What turnaround times do you offer?',
  'How does Australia-wide delivery work?',
  'Can I speak with a human support agent?',
];

export const AiSupportChatWidget: React.FC = () => {
  const { user } = useAuth();
  const { openEnquiryModal } = useEnquiry();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [needsFollowup, setNeedsFollowup] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>('');

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize or restore visitor session ID from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let sess = localStorage.getItem('erry_visitor_session_id');
    if (!sess) {
      sess = 'sess_' + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem('erry_visitor_session_id', sess);
    }
    setSessionId(sess);

    const savedToken = localStorage.getItem('erry_chat_token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  // Fetch conversation history
  const loadHistory = useCallback(async (conversationToken?: string, sess?: string) => {
    const activeToken = conversationToken || token;
    const activeSess = sess || sessionId;

    if (!activeToken && !activeSess) return;

    setIsLoadingHistory(true);
    setErrorMessage(null);

    try {
      const url = activeToken
        ? `/chat/history?token=${encodeURIComponent(activeToken)}`
        : `/chat/history?session_id=${encodeURIComponent(activeSess)}`;

      const res = await apiClient.get(url);
      if (res.data?.success && res.data.data) {
        const data = res.data.data;
        if (data.token) {
          setToken(data.token);
          if (typeof window !== 'undefined') {
            localStorage.setItem('erry_chat_token', data.token);
          }
        }
        setNeedsFollowup(Boolean(data.needs_human_followup));
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages);
        }
      }
    } catch (err: any) {
      // If 404 or invalid token, clear stored token
      if (err.response?.status === 404 && typeof window !== 'undefined') {
        localStorage.removeItem('erry_chat_token');
        setToken(null);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token, sessionId]);

  // Load history when opening or on initial mount
  useEffect(() => {
    if (isOpen && (token || sessionId)) {
      loadHistory(token || undefined, sessionId);
    }
  }, [isOpen, loadHistory, token, sessionId]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (isOpen && !isMinimized) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isSending, isOpen, isMinimized]);

  // Focus input on open
  useEffect(() => {
    if (isOpen && !isMinimized) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, isMinimized]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || inputText).trim();
    if (!textToSend || isSending) return;

    setInputText('');
    setErrorMessage(null);

    // Optimistically append customer message
    const tempCustomerMsg: ChatMessage = {
      id: 'temp_' + Date.now(),
      sender_type: 'customer',
      sender_name: user?.name || 'You',
      message: textToSend,
      time_ago: 'Just now',
    };
    setMessages((prev) => [...prev, tempCustomerMsg]);
    setIsSending(true);

    try {
      const payload: Record<string, any> = {
        message: textToSend,
        session_id: sessionId,
      };

      if (token) {
        payload.token = token;
      }
      if (user?.name) {
        payload.name = user.name;
      }
      if (user?.email) {
        payload.email = user.email;
      }

      // Add idempotency key based on session and timestamp
      payload.idempotency_key = `${sessionId}_${Date.now()}`;

      const res = await apiClient.post('/chat/message', payload);

      if (res.data?.success && res.data.data) {
        const data = res.data.data;
        if (data.token) {
          setToken(data.token);
          if (typeof window !== 'undefined') {
            localStorage.setItem('erry_chat_token', data.token);
          }
        }

        setNeedsFollowup(Boolean(data.needs_human_followup));

        // Replace temp customer message with authoritative server message & append AI reply
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempCustomerMsg.id);
          const updated = [...filtered, data.customer_message];
          if (data.ai_message) {
            updated.push(data.ai_message);
          }
          return updated;
        });
      } else {
        throw new Error(res.data?.message || 'Could not send message.');
      }
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'Unable to connect to AI Support. Please check your connection and try again.'
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      {/* Floating Trigger Button */}
      {!isOpen && (
        <div className="flex flex-col items-end gap-2 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            aria-label="Open AI Customer Support Chat"
            className="group flex items-center gap-3 px-4 py-3 rounded-full bg-slate-950 hover:bg-slate-900 text-white font-bold text-xs shadow-2xl shadow-slate-950/40 hover:shadow-sky-500/20 hover:scale-105 active:scale-95 transition-all duration-200 border border-slate-800"
          >
            <div className="relative flex items-center justify-center w-7 h-7 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-inner">
              <Bot className="w-4 h-4 text-white" />
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-white tracking-tight">Erry AI Support</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                  Online
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-normal">Instant product specs, pricing & FAQs</p>
            </div>
          </button>
        </div>
      )}

      {/* Chat Drawer Window */}
      {isOpen && (
        <div
          className={`flex flex-col bg-white rounded-3xl border border-slate-200/90 shadow-2xl overflow-hidden transition-all duration-200 ${
            isMinimized
              ? 'w-80 h-16'
              : 'w-[92vw] sm:w-[410px] h-[580px] max-h-[85vh]'
          }`}
        >
          {/* Header Bar */}
          <div className="px-4 py-3.5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex items-center justify-center w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-md shrink-0">
                <Bot className="w-5 h-5 text-white" />
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm tracking-tight text-white truncate">
                    Erry Imprints Support
                  </h3>
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    AI Active
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {needsFollowup ? 'Support team flagged for follow-up' : 'Instant print advice & answers'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 text-slate-400">
              <button
                type="button"
                onClick={() => setIsMinimized((prev) => !prev)}
                className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition"
                title={isMinimized ? 'Expand' : 'Minimize'}
                aria-label="Toggle chat minimize"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:text-white hover:bg-slate-800 transition"
                title="Close chat"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Secondary Navigation Strip: Formal Quote CTA */}
              <div className="px-4 py-2 bg-sky-50/80 border-b border-sky-100 flex items-center justify-between text-xs shrink-0">
                <span className="text-[11px] text-sky-950 font-medium">Need a detailed custom quote?</span>
                <button
                  type="button"
                  onClick={() => openEnquiryModal()}
                  className="inline-flex items-center gap-1 font-bold text-sky-700 hover:text-sky-900 transition hover:underline text-[11px]"
                >
                  <FileUp className="w-3.5 h-3.5" />
                  <span>Upload Artwork / Specs</span>
                </button>
              </div>

              {/* Human Escalation Alert Banner */}
              {needsFollowup && (
                <div className="px-3.5 py-2.5 bg-amber-50 border-b border-amber-200 text-amber-900 text-xs flex items-center gap-2 shrink-0 animate-in fade-in duration-200">
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="leading-snug text-[11px] font-medium">
                    Our prepress team has received your conversation. An agent will follow up shortly during business hours.
                  </span>
                </div>
              )}

              {/* Conversation Messages Container */}
              <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50/50 text-xs">
                {/* Initial Welcome Bubble */}
                <div className="flex flex-col items-start gap-1">
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium px-1">
                    <Sparkles className="w-3 h-3 text-sky-600" />
                    <span className="font-bold text-slate-700">Erry AI Support</span>
                    <span>·</span>
                    <span>Automated</span>
                  </div>
                  <div className="max-w-[88%] rounded-2xl p-3.5 bg-white border border-slate-200 text-slate-800 shadow-2xs leading-relaxed space-y-2">
                    <p>
                      G&apos;day! I&apos;m your Erry Imprints support assistant. Ask me about our commercial print products,
                      standard turnaround times, pricing, artwork requirements, or Australia-wide shipping.
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Need custom die-cutting, spot UV, or high volume? Type your specs here or click &quot;Upload Artwork / Specs&quot; above!
                    </p>
                  </div>
                </div>

                {/* Quick Prompts (visible when messages are low) */}
                {messages.length === 0 && (
                  <div className="space-y-1.5 pt-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">
                      Quick Questions:
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {QUICK_PROMPTS.map((prompt, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleSendMessage(prompt)}
                          className="text-left p-2.5 rounded-xl bg-white hover:bg-sky-50 hover:border-sky-200 border border-slate-200 text-slate-700 font-medium text-[11px] transition shadow-2xs cursor-pointer flex items-center justify-between group"
                        >
                          <span>{prompt}</span>
                          <span className="text-slate-300 group-hover:text-sky-600 transition">→</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chat History Messages */}
                {messages.map((msg, index) => {
                  const isUser = msg.sender_type === 'customer';
                  const isAi = msg.sender_type === 'ai';
                  const isAdmin = msg.sender_type === 'admin';

                  return (
                    <div
                      key={msg.id || index}
                      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-1`}
                    >
                      <div
                        className={`flex items-center gap-1.5 text-[10px] text-slate-400 px-1 ${
                          isUser ? 'flex-row-reverse' : 'flex-row'
                        }`}
                      >
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          {isUser ? (
                            <>
                              <User className="w-3 h-3 text-slate-500" />
                              <span>{msg.sender_name || 'You'}</span>
                            </>
                          ) : isAi ? (
                            <>
                              <Sparkles className="w-3 h-3 text-sky-600" />
                              <span>Erry AI Support</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck className="w-3 h-3 text-emerald-600" />
                              <span>{msg.sender_name || 'Prepress Team'}</span>
                              <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-800 font-bold">
                                Staff
                              </span>
                            </>
                          )}
                        </span>
                        <span>·</span>
                        <span>{msg.time_ago || 'Recent'}</span>
                      </div>

                      <div
                        className={`max-w-[88%] rounded-2xl p-3.5 leading-relaxed shadow-2xs whitespace-pre-wrap ${
                          isUser
                            ? 'bg-slate-900 text-white rounded-br-sm'
                            : isAdmin
                            ? 'bg-emerald-950 text-emerald-50 border border-emerald-900 rounded-bl-sm'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                        }`}
                      >
                        {msg.message}
                      </div>
                    </div>
                  );
                })}

                {/* Typing / Processing Indicator */}
                {isSending && (
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 px-1">
                      <Sparkles className="w-3 h-3 text-sky-600" />
                      <span className="font-bold text-slate-700">Erry AI Support</span>
                      <span>·</span>
                      <span>Typing...</span>
                    </div>
                    <div className="rounded-2xl p-3 bg-white border border-slate-200 text-slate-600 shadow-2xs flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-sky-500 animate-ping" />
                      <span className="text-[11px] font-medium text-slate-500">Checking print catalog & specs...</span>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span className="flex-1">{errorMessage}</span>
                    <button
                      type="button"
                      onClick={() => handleSendMessage()}
                      className="px-2 py-1 rounded bg-rose-200/60 hover:bg-rose-200 text-rose-900 font-bold text-[10px] transition"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              {/* Composer Input Bar */}
              <div className="p-3 bg-white border-t border-slate-200 shrink-0">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about products, pricing, turnaround..."
                    disabled={isSending}
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition shadow-inner disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !inputText.trim()}
                    aria-label="Send message to AI support"
                    className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white font-bold transition shadow-md shadow-sky-600/30 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  >
                    {isSending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </form>

                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400 px-1">
                  <span>Powered by OpenAI &amp; Prepress Knowledge</span>
                  {token && (
                    <a
                      href={`/enquiries/conversation/${token}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-sky-600 transition flex items-center gap-1"
                    >
                      <span>Full view</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
