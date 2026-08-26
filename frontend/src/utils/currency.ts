export const GST_RATE = 0.10;

export function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function calculateFromIncGst(priceIncGst: number) {
  const priceExGst = priceIncGst / (1 + GST_RATE);
  const gstAmount = priceIncGst - priceExGst;
  return {
    priceExGst: Number(priceExGst.toFixed(2)),
    gstAmount: Number(gstAmount.toFixed(2)),
    priceIncGst: Number(priceIncGst.toFixed(2)),
  };
}

export function calculateFromExGst(priceExGst: number) {
  const gstAmount = priceExGst * GST_RATE;
  const priceIncGst = priceExGst + gstAmount;
  return {
    priceExGst: Number(priceExGst.toFixed(2)),
    gstAmount: Number(gstAmount.toFixed(2)),
    priceIncGst: Number(priceIncGst.toFixed(2)),
  };
}
