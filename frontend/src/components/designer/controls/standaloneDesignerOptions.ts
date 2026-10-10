export interface PaperStockOption {
  id: string;
  name: string;
  stock_name: string;
  gsm: number;
}

export const DEFAULT_PAPER_STOCKS: PaperStockOption[] = [
  { id: 'gsm_128', name: '128 GSM', stock_name: 'Standard Art Paper', gsm: 128 },
  { id: 'gsm_150', name: '150 GSM', stock_name: 'Gloss Art Paper', gsm: 150 },
  { id: 'gsm_350', name: '350 GSM', stock_name: 'Premium Matte Artboard', gsm: 350 },
];

export interface StandaloneDesignerInitialState {
  gsmOptions: PaperStockOption[];
  defaultGsmId: string;
  printingOptions: any[];
  defaultPrintingSide: string;
  foldingOptions: any[];
  defaultFolding: string;
}

export function getStandaloneDesignerOptions(): StandaloneDesignerInitialState {
  return {
    gsmOptions: DEFAULT_PAPER_STOCKS,
    defaultGsmId: DEFAULT_PAPER_STOCKS[0].id,
    printingOptions: [],
    defaultPrintingSide: '',
    foldingOptions: [],
    defaultFolding: 'no_fold',
  };
}

export function shouldFetchProductConfiguration(productId: string | null | undefined): boolean {
  if (!productId) return false;
  if (productId.trim() === '' || productId === 'default') return false;
  return true;
}
