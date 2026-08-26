export interface FontFamilyItem {
  id: string;
  name: string;
  family: string;
  category: 'sans-serif' | 'serif' | 'display' | 'handwriting' | 'monospace';
  googleFont?: string; // Query string for Google Fonts API
  popular?: boolean;
}

export const POPULAR_FONTS: FontFamilyItem[] = [
  { id: 'inter', name: 'Inter', family: 'Inter, sans-serif', googleFont: 'Inter:wght@400;500;600;700;800', category: 'sans-serif', popular: true },
  { id: 'roboto', name: 'Roboto', family: 'Roboto, sans-serif', googleFont: 'Roboto:wght@400;500;700;900', category: 'sans-serif', popular: true },
  { id: 'montserrat', name: 'Montserrat', family: 'Montserrat, sans-serif', googleFont: 'Montserrat:wght@400;600;700;800', category: 'sans-serif', popular: true },
  { id: 'poppins', name: 'Poppins', family: 'Poppins, sans-serif', googleFont: 'Poppins:wght@400;500;600;700;800', category: 'sans-serif', popular: true },
  { id: 'playfair', name: 'Playfair Display', family: '"Playfair Display", serif', googleFont: 'Playfair+Display:ital,wght@0,400;0,600;0,700;1,400', category: 'serif', popular: true },
  { id: 'merriweather', name: 'Merriweather', family: 'Merriweather, serif', googleFont: 'Merriweather:ital,wght@0,300;0,400;0,700;1,400', category: 'serif' },
  { id: 'oswald', name: 'Oswald', family: 'Oswald, sans-serif', googleFont: 'Oswald:wght@400;600;700', category: 'display', popular: true },
  { id: 'bebas-neue', name: 'Bebas Neue', family: '"Bebas Neue", sans-serif', googleFont: 'Bebas+Neue', category: 'display', popular: true },
  { id: 'great-vibes', name: 'Great Vibes', family: '"Great Vibes", cursive', googleFont: 'Great+Vibes', category: 'handwriting', popular: true },
  { id: 'pacifico', name: 'Pacifico', family: 'Pacifico, cursive', googleFont: 'Pacifico', category: 'handwriting' },
  { id: 'open-sans', name: 'Open Sans', family: '"Open Sans", sans-serif', googleFont: 'Open+Sans:wght@400;600;700', category: 'sans-serif' },
  { id: 'lato', name: 'Lato', family: 'Lato, sans-serif', googleFont: 'Lato:wght@400;700', category: 'sans-serif' },
  { id: 'raleway', name: 'Raleway', family: 'Raleway, sans-serif', googleFont: 'Raleway:wght@400;600;700;800', category: 'sans-serif' },
  { id: 'cinzel', name: 'Cinzel', family: 'Cinzel, serif', googleFont: 'Cinzel:wght@400;700', category: 'serif' },
  { id: 'dancing-script', name: 'Dancing Script', family: '"Dancing Script", cursive', googleFont: 'Dancing+Script:wght@400;700', category: 'handwriting' },
  { id: 'plus-jakarta', name: 'Plus Jakarta Sans', family: '"Plus Jakarta Sans", sans-serif', googleFont: 'Plus+Jakarta+Sans:wght@400;600;700;800', category: 'sans-serif', popular: true },
  { id: 'fira-code', name: 'Fira Code', family: '"Fira Code", monospace', googleFont: 'Fira+Code:wght@400;600', category: 'monospace' },
  // System Standard Fonts
  { id: 'arial', name: 'Arial', family: 'Arial, Helvetica, sans-serif', category: 'sans-serif' },
  { id: 'georgia', name: 'Georgia', family: 'Georgia, serif', category: 'serif' },
  { id: 'times', name: 'Times New Roman', family: '"Times New Roman", Times, serif', category: 'serif' },
  { id: 'courier', name: 'Courier New', family: '"Courier New", Courier, monospace', category: 'monospace' },
];

const loadedFonts = new Set<string>();

/**
 * Dynamically loads a Google Font by creating a <link> tag in document head
 */
export function loadFont(font: FontFamilyItem): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (!font.googleFont || loadedFonts.has(font.id)) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const linkId = `google-font-${font.id}`;
    if (document.getElementById(linkId)) {
      loadedFonts.add(font.id);
      resolve(true);
      return;
    }

    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${font.googleFont}&display=swap`;

    link.onload = () => {
      loadedFonts.add(font.id);
      // Wait for document.fonts if available
      if (document.fonts) {
        document.fonts.ready.then(() => resolve(true));
      } else {
        resolve(true);
      }
    };

    link.onerror = () => {
      console.warn(`Failed to load Google Font: ${font.name}`);
      resolve(false);
    };

    document.head.appendChild(link);
  });
}

/**
 * Preloads all popular fonts in background
 */
export function preloadPopularFonts(): void {
  if (typeof window === 'undefined') return;
  POPULAR_FONTS.filter((f) => f.popular && f.googleFont).forEach((font) => {
    loadFont(font);
  });
}
