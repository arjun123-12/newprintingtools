import { FramePreset, FrameShapeType } from '@/types/designer';

/**
 * The iconic Canva Frame Placeholder artwork.
 * High-definition SVG depicting the signature blue sky, soft cloud, and rolling green hills.
 */
export const CANVA_LANDSCAPE_SVG_RAW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500" width="100%" height="100%">
  <defs>
    <linearGradient id="canvaSky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#4ea8de" />
      <stop offset="45%" stop-color="#72bfe8" />
      <stop offset="85%" stop-color="#9dd5f2" />
      <stop offset="100%" stop-color="#cbeaf8" />
    </linearGradient>
    <linearGradient id="hillBack" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#64a322" />
      <stop offset="100%" stop-color="#467b12" />
    </linearGradient>
    <linearGradient id="hillMid" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#82c330" />
      <stop offset="100%" stop-color="#5a9718" />
    </linearGradient>
    <linearGradient id="hillFront" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#9bdc3e" />
      <stop offset="100%" stop-color="#76b825" />
    </linearGradient>
  </defs>
  
  <!-- Sky -->
  <rect width="500" height="500" fill="url(#canvaSky)" />
  
  <!-- Cloud Group -->
  <g fill="#ffffff" opacity="0.96">
    <ellipse cx="270" cy="180" rx="80" ry="40" />
    <ellipse cx="200" cy="195" rx="55" ry="32" />
    <ellipse cx="335" cy="195" rx="45" ry="28" />
    <circle cx="240" cy="160" r="42" />
    <circle cx="295" cy="165" r="35" />
  </g>
  
  <!-- Back Rolling Hill -->
  <path d="M -20,340 Q 120,240 280,285 Q 410,320 520,250 L 520,520 L -20,520 Z" fill="url(#hillBack)" />
  
  <!-- Middle Rolling Hill -->
  <path d="M -20,385 Q 160,280 340,340 Q 440,370 520,330 L 520,520 L -20,520 Z" fill="url(#hillMid)" />
  
  <!-- Front Bright Green Hill -->
  <path d="M -20,440 Q 190,325 520,410 L 520,520 L -20,520 Z" fill="url(#hillFront)" />
</svg>`;

export const CANVA_FRAME_PLACEHOLDER_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  CANVA_LANDSCAPE_SVG_RAW
)}`;

/**
 * Normalized SVG clip paths (viewBox 0 0 100 100) for previewing Canva frames in UI.
 */
export const FRAME_SVG_PATHS: Record<FrameShapeType, string> = {
  circle: 'M 50, 50 m -46, 0 a 46,46 0 1,0 92,0 a 46,46 0 1,0 -92,0',
  square: 'M 6,6 L 94,6 L 94,94 L 6,94 Z',
  'rounded-rect': 'M 18,6 L 82,6 A 12,12 0 0 1 94,18 L 94,82 A 12,12 0 0 1 82,94 L 18,94 A 12,12 0 0 1 6,82 L 6,18 A 12,12 0 0 1 18,6 Z',
  squircle: 'M 50,4 C 80,4 96,20 96,50 C 96,80 80,96 50,96 C 20,96 4,80 4,50 C 4,20 20,4 50,4 Z',
  arch: 'M 8,92 L 8,46 A 42,42 0 0 1 92,46 L 92,92 Z',
  oval: 'M 50,8 A 38,44 0 1 0 50,92 A 38,44 0 1 0 50,8 Z',
  pill: 'M 26,12 L 74,12 A 38,38 0 0 1 74,88 L 26,88 A 38,38 0 0 1 26,12 Z',
  heart: 'M 50,86 C 20,62 6,42 6,26 C 6,14 16,6 28,6 C 36,6 44,11 50,18 C 56,11 64,6 72,6 C 84,6 94,14 94,26 C 94,42 80,62 50,86 Z',
  star: 'M 50,4 L 64,34 L 96,36 L 72,58 L 79,90 L 50,74 L 21,90 L 28,58 L 4,36 L 36,34 Z',
  hexagon: 'M 50,4 L 92,27 L 92,73 L 50,96 L 8,73 L 8,27 Z',
  octagon: 'M 32,6 L 68,6 L 94,32 L 94,68 L 68,94 L 32,94 L 6,68 L 6,32 Z',
  diamond: 'M 50,6 L 94,50 L 50,94 L 6,50 Z',
  triangle: 'M 50,6 L 94,92 L 6,92 Z',
  shield: 'M 50,6 L 90,18 L 90,52 C 90,74 72,90 50,96 C 28,90 10,74 10,52 L 10,18 Z',
  flower: 'M 50,6 C 58,6 64,16 69,12 C 75,8 84,15 87,22 C 90,29 100,34 99,42 C 98,50 92,57 93,65 C 94,73 85,80 79,84 C 73,88 67,97 59,96 C 51,95 47,85 39,87 C 31,89 24,80 20,73 C 16,66 6,62 7,54 C 8,46 17,41 18,33 C 19,25 27,17 35,18 C 43,19 46,6 50,6 Z',
  blob: 'M 52,8 C 76,4 94,22 92,48 C 90,74 78,94 48,92 C 18,90 6,70 8,44 C 10,18 28,12 52,8 Z',
  phone: 'M 28,6 L 72,6 A 14,14 0 0 1 86,20 L 86,80 A 14,14 0 0 1 72,94 L 28,94 A 14,14 0 0 1 14,80 L 14,20 A 14,14 0 0 1 28,6 Z',
  tablet: 'M 18,8 L 82,8 A 10,10 0 0 1 92,18 L 92,82 A 10,10 0 0 1 82,92 L 18,92 A 10,10 0 0 1 8,82 L 8,18 A 10,10 0 0 1 18,8 Z',
  laptop: 'M 16,14 L 84,14 A 6,6 0 0 1 90,20 L 90,72 L 10,72 L 10,20 A 6,6 0 0 1 16,14 Z M 4,74 L 96,74 L 90,86 L 10,86 Z',
  desktop: 'M 12,10 L 88,10 A 6,6 0 0 1 94,16 L 94,68 A 6,6 0 0 1 88,74 L 12,74 A 6,6 0 0 1 6,68 L 6,16 A 6,6 0 0 1 12,10 Z M 44,76 L 56,76 L 60,90 L 40,90 Z M 32,90 L 68,90 L 68,94 L 32,94 Z',
  polaroid: 'M 10,6 L 90,6 A 4,4 0 0 1 94,10 L 94,94 A 4,4 0 0 1 90,98 L 10,98 A 4,4 0 0 1 6,94 L 6,10 A 4,4 0 0 1 10,6 Z',
  stamp: 'M 10,10 Q 15,6 20,10 Q 25,6 30,10 Q 35,6 40,10 Q 45,6 50,10 Q 55,6 60,10 Q 65,6 70,10 Q 75,6 80,10 Q 85,6 90,10 Q 94,15 90,20 Q 94,25 90,30 Q 94,35 90,40 Q 94,45 90,50 Q 94,55 90,60 Q 94,65 90,70 Q 94,75 90,80 Q 94,85 90,90 Q 85,94 80,90 Q 75,94 70,90 Q 65,94 60,90 Q 55,94 50,90 Q 45,94 40,90 Q 35,94 30,90 Q 25,94 20,90 Q 15,94 10,90 Q 6,85 10,80 Q 6,75 10,70 Q 6,65 10,60 Q 6,55 10,50 Q 6,45 10,40 Q 6,35 10,30 Q 6,25 10,20 Q 6,15 10,10 Z',
  'torn-paper': 'M 10,8 Q 30,12 50,7 Q 70,11 90,8 L 92,90 Q 70,86 50,92 Q 30,87 8,90 Z',
  filmstrip: 'M 8,14 L 92,14 L 92,86 L 8,86 Z',
};

/**
 * Complete set of Canva-style Frame Presets.
 */
export const FRAME_PRESETS: FramePreset[] = [
  // --- Basic Shapes ---
  {
    id: 'frame_circle',
    name: 'Circle',
    shape: 'circle',
    category: 'basic',
    description: 'Perfect round photo frame',
    aspectRatio: 1.0,
  },
  {
    id: 'frame_rounded_rect',
    name: 'Rounded Card',
    shape: 'rounded-rect',
    category: 'basic',
    description: 'Smooth rounded corner card frame',
    aspectRatio: 1.0,
  },
  {
    id: 'frame_square',
    name: 'Square',
    shape: 'square',
    category: 'basic',
    description: 'Classic crisp square photo mask',
    aspectRatio: 1.0,
  },
  {
    id: 'frame_squircle',
    name: 'Squircle',
    shape: 'squircle',
    category: 'basic',
    description: 'Modern iOS smooth squircle frame',
    aspectRatio: 1.0,
  },
  {
    id: 'frame_arch',
    name: 'Arch Window',
    shape: 'arch',
    category: 'basic',
    description: 'Elegant arch top photo frame',
    aspectRatio: 0.75,
  },
  {
    id: 'frame_oval',
    name: 'Oval',
    shape: 'oval',
    category: 'basic',
    description: 'Classic vertical ellipse frame',
    aspectRatio: 0.8,
  },
  {
    id: 'frame_pill',
    name: 'Capsule Pill',
    shape: 'pill',
    category: 'basic',
    description: 'Rounded pill shape frame',
    aspectRatio: 1.6,
  },
  {
    id: 'frame_heart',
    name: 'Heart',
    shape: 'heart',
    category: 'basic',
    description: 'Romantic heart cutout photo frame',
    aspectRatio: 1.0,
  },
  {
    id: 'frame_star',
    name: 'Star',
    shape: 'star',
    category: 'basic',
    description: '5-point star photo cutout',
    aspectRatio: 1.0,
  },
  {
    id: 'frame_hexagon',
    name: 'Hexagon',
    shape: 'hexagon',
    category: 'basic',
    description: 'Geometric 6-sided frame',
    aspectRatio: 1.0,
  },
  {
    id: 'frame_octagon',
    name: 'Octagon',
    shape: 'octagon',
    category: 'basic',
    description: '8-sided geometric photo frame',
    aspectRatio: 1.0,
  },
  {
    id: 'frame_diamond',
    name: 'Diamond',
    shape: 'diamond',
    category: 'basic',
    description: 'Rhombus diamond photo frame',
    aspectRatio: 1.0,
  },
  {
    id: 'frame_triangle',
    name: 'Triangle',
    shape: 'triangle',
    category: 'basic',
    description: 'Clean equilateral triangle frame',
    aspectRatio: 1.1,
  },
  {
    id: 'frame_shield',
    name: 'Shield Crest',
    shape: 'shield',
    category: 'basic',
    description: 'Heraldic badge shield frame',
    aspectRatio: 0.85,
  },
  {
    id: 'frame_flower',
    name: 'Flower Petal',
    shape: 'flower',
    category: 'creative',
    description: 'Scalloped floral bloom frame',
    aspectRatio: 1.0,
  },
  {
    id: 'frame_blob',
    name: 'Organic Blob',
    shape: 'blob',
    category: 'creative',
    description: 'Smooth organic fluid blob frame',
    aspectRatio: 1.0,
  },

  // --- Devices & Mockups ---
  {
    id: 'frame_phone',
    name: 'Smartphone',
    shape: 'phone',
    category: 'devices',
    description: 'iPhone device mockup frame',
    aspectRatio: 0.52,
  },
  {
    id: 'frame_tablet',
    name: 'Tablet iPad',
    shape: 'tablet',
    category: 'devices',
    description: 'iPad tablet screen frame',
    aspectRatio: 0.72,
  },
  {
    id: 'frame_laptop',
    name: 'Laptop MacBook',
    shape: 'laptop',
    category: 'devices',
    description: 'MacBook laptop screen frame',
    aspectRatio: 1.5,
  },
  {
    id: 'frame_desktop',
    name: 'Desktop iMac',
    shape: 'desktop',
    category: 'devices',
    description: 'iMac desktop computer frame',
    aspectRatio: 1.3,
  },

  // --- Creative & Photography ---
  {
    id: 'frame_polaroid',
    name: 'Polaroid Instant',
    shape: 'polaroid',
    category: 'creative',
    description: 'Vintage instant photo print frame',
    aspectRatio: 0.85,
  },
  {
    id: 'frame_stamp',
    name: 'Postage Stamp',
    shape: 'stamp',
    category: 'creative',
    description: 'Perforated edge postage stamp',
    aspectRatio: 1.0,
  },
  {
    id: 'frame_torn_paper',
    name: 'Torn Paper',
    shape: 'torn-paper',
    category: 'creative',
    description: 'Ripped paper photo cutout',
    aspectRatio: 1.0,
  },
  {
    id: 'frame_filmstrip',
    name: 'Film Strip',
    shape: 'filmstrip',
    category: 'creative',
    description: 'Cinema 35mm film reel frame',
    aspectRatio: 1.4,
  },
];
