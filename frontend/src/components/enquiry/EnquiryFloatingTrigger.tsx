'use client';

import React from 'react';
import { MessageSquareText } from 'lucide-react';
import { useEnquiry } from '@/context/EnquiryContext';

export const EnquiryFloatingTrigger: React.FC = () => {
  const { openEnquiryModal, isOpen, isAdmin } = useEnquiry();

  // If modal is already open, do not render trigger
  if (isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button
        type="button"
        onClick={() => openEnquiryModal()}
        aria-label="Request a custom printing quote"
        className="group flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-500 hover:to-blue-600 text-white font-bold text-xs shadow-xl shadow-sky-600/30 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all duration-200 border border-white/20"
      >
        <div className="relative">
          <MessageSquareText className="w-4 h-4 text-white" />
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
        <span className="tracking-tight">Request a Quote / Enquiry</span>
      </button>
    </div>
  );
};
