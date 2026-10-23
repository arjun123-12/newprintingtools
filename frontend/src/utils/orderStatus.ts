export const STATUS_STYLES: Record<string, string> = {
  // 1. Completed / Delivered / Collected -> GREEN
  delivered: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  collected: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  completed: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',

  // 2. Ready for pickup / Ready for shipping -> Cyan / Teal
  ready_for_pickup: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
  ready_for_shipping: 'bg-teal-500/15 text-teal-300 border border-teal-500/30',

  // 3. Dispatched / Out with Courier -> Blue
  dispatched: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  handed_over_to_courier: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',

  // 4. Approved -> Teal
  approved: 'bg-teal-500/15 text-teal-400 border border-teal-500/30',

  // 5. In Production / Printing -> Sky Blue
  in_production: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  printing: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  production_started: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',

  // 6. Cutting & Finishing -> Indigo
  cutting_and_finishing: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',
  cutting_in_progress: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30',

  // 7. Quality Check & Packing -> Purple
  quality_check_and_packaging: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  production_completed: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',

  // 8. Artwork Review / Required -> Violet / Fuchsia
  artwork_review: 'bg-violet-500/15 text-violet-400 border border-violet-500/30',
  artwork_required: 'bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/30',

  // 9. Changes Requested -> Rose
  changes_requested: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',

  // 10. Pending Payment / Processing -> Amber / Yellow
  pending_payment: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  processing: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',

  // 11. Draft -> Slate
  draft: 'bg-slate-500/15 text-slate-300 border border-slate-500/30',

  // 12. Cancelled / Refunded -> Red / Orange
  cancelled: 'bg-red-500/15 text-red-400 border border-red-500/30',
  refunded: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_payment: 'Pending Payment',
  processing: 'Processing',
  artwork_required: 'Artwork Required',
  artwork_review: 'Artwork Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  in_production: 'Printing',
  printing: 'Printing',
  production_started: 'Printing',
  cutting_and_finishing: 'Cutting & Finishing',
  cutting_in_progress: 'Cutting & Finishing',
  quality_check_and_packaging: 'Quality Check & Packing',
  production_completed: 'Production Completed',
  ready_for_pickup: 'Ready for Pickup',
  ready_for_shipping: 'Ready for Shipping',
  dispatched: 'Dispatched',
  handed_over_to_courier: 'With Courier',
  delivered: 'Delivered',
  collected: 'Collected',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

export function getStatusStyle(status: string): string {
  if (STATUS_STYLES[status]) return STATUS_STYLES[status];
  const s = status.toLowerCase();
  if (s.includes('complete') || s.includes('deliver') || s.includes('collect')) {
    return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
  }
  if (s.includes('pickup')) {
    return 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30';
  }
  if (s.includes('dispatch') || s.includes('courier') || s.includes('ship')) {
    return 'bg-blue-500/15 text-blue-400 border border-blue-500/30';
  }
  if (s.includes('print')) {
    return 'bg-sky-500/15 text-sky-400 border border-sky-500/30';
  }
  if (s.includes('cut')) {
    return 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30';
  }
  if (s.includes('pack') || s.includes('quality')) {
    return 'bg-purple-500/15 text-purple-400 border border-purple-500/30';
  }
  if (s.includes('review') || s.includes('proof')) {
    return 'bg-violet-500/15 text-violet-400 border border-violet-500/30';
  }
  if (s.includes('change')) {
    return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
  }
  if (s.includes('pay') || s.includes('pend')) {
    return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
  }
  return 'bg-slate-700/50 text-slate-300 border border-slate-600';
}

export function formatStatusLabel(status: string): string {
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
