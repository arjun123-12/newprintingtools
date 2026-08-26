export interface SolidColorPreset {
  name: string;
  color: string;
  category: string;
}

export interface GradientPreset {
  id: string;
  name: string;
  css: string;
  type: 'linear' | 'radial';
  angle: number;
  stops: Array<{ offset: number; color: string }>;
}

export interface BackgroundImageItem {
  id: string;
  title: string;
  category: string;
  url: string;
  thumbnail: string;
  tags: string[];
}

export const BACKGROUND_CATEGORIES = [
  'All',
  'Abstract',
  'Textures',
  'Patterns',
  'Nature',
  'Business',
  'Marble',
  'Wood',
  'Fabric',
  'Metal',
  'Paper',
  'Dark',
  'Light',
] as const;

export const SOLID_COLOR_PALETTES: { name: string; colors: string[] }[] = [
  {
    name: 'Print Essentials',
    colors: ['#ffffff', '#f8fafc', '#f1f5f9', '#e2e8f0', '#94a3b8', '#475569', '#1e293b', '#0f172a', '#000000'],
  },
  {
    name: 'Corporate & Tech',
    colors: ['#2563eb', '#1d4ed8', '#1e40af', '#0284c7', '#0369a1', '#0891b2', '#0f766e', '#047857', '#15803d'],
  },
  {
    name: 'Luxury & Warmth',
    colors: ['#d97706', '#b45309', '#92400e', '#ea580c', '#c2410c', '#9a3412', '#dc2626', '#b91c1c', '#7f1d1d'],
  },
  {
    name: 'Modern Pastels',
    colors: ['#fed7aa', '#fef08a', '#bbf7d0', '#a7f3d0', '#bae6fd', '#c7d2fe', '#e9d5ff', '#fbcfe8', '#ffe4e6'],
  },
  {
    name: 'Earth & Minimal',
    colors: ['#fafaf9', '#f5f5f4', '#e7e5e4', '#d6d3d1', '#a8a29e', '#78716c', '#57534e', '#44403c', '#292524'],
  },
];

export const GRADIENT_PRESETS: GradientPreset[] = [
  {
    id: 'grad-sunset',
    name: 'Sunset Glow',
    css: 'linear-gradient(135deg, #f97316 0%, #ec4899 100%)',
    type: 'linear',
    angle: 135,
    stops: [{ offset: 0, color: '#f97316' }, { offset: 1, color: '#ec4899' }],
  },
  {
    id: 'grad-ocean',
    name: 'Deep Oceanic',
    css: 'linear-gradient(135deg, #0284c7 0%, #0f172a 100%)',
    type: 'linear',
    angle: 135,
    stops: [{ offset: 0, color: '#0284c7' }, { offset: 1, color: '#0f172a' }],
  },
  {
    id: 'grad-emerald',
    name: 'Emerald Prestige',
    css: 'linear-gradient(135deg, #059669 0%, #064e3b 100%)',
    type: 'linear',
    angle: 135,
    stops: [{ offset: 0, color: '#059669' }, { offset: 1, color: '#064e3b' }],
  },
  {
    id: 'grad-royal-gold',
    name: 'Royal Gold',
    css: 'linear-gradient(135deg, #fbbf24 0%, #b45309 100%)',
    type: 'linear',
    angle: 135,
    stops: [{ offset: 0, color: '#fbbf24' }, { offset: 1, color: '#b45309' }],
  },
  {
    id: 'grad-silk-violet',
    name: 'Silk Violet',
    css: 'linear-gradient(135deg, #8b5cf6 0%, #312e81 100%)',
    type: 'linear',
    angle: 135,
    stops: [{ offset: 0, color: '#8b5cf6' }, { offset: 1, color: '#312e81' }],
  },
  {
    id: 'grad-slate-steel',
    name: 'Slate Metallic',
    css: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)',
    type: 'linear',
    angle: 135,
    stops: [{ offset: 0, color: '#334155' }, { offset: 1, color: '#0f172a' }],
  },
  {
    id: 'grad-clean-mesh',
    name: 'Clean Aurora',
    css: 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)',
    type: 'linear',
    angle: 135,
    stops: [{ offset: 0, color: '#e0f2fe' }, { offset: 1, color: '#f0fdf4' }],
  },
  {
    id: 'grad-neon-cyber',
    name: 'Neon Cyber',
    css: 'linear-gradient(135deg, #06b6d4 0%, #7c3aed 100%)',
    type: 'linear',
    angle: 135,
    stops: [{ offset: 0, color: '#06b6d4' }, { offset: 1, color: '#7c3aed' }],
  },
];

export const STOCK_BACKGROUND_IMAGES: BackgroundImageItem[] = [
  // Marble
  {
    id: 'bg-marble-white',
    title: 'White Carrara Marble',
    category: 'Marble',
    url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=400&q=70',
    tags: ['marble', 'white', 'luxury', 'stone', 'clean', 'light'],
  },
  {
    id: 'bg-marble-black-gold',
    title: 'Black & Gold Marble Veins',
    category: 'Marble',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=70',
    tags: ['marble', 'black', 'gold', 'luxury', 'dark', 'texture'],
  },
  // Abstract
  {
    id: 'bg-abstract-gradient-fluid',
    title: 'Fluid Gradient Waves',
    category: 'Abstract',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=400&q=70',
    tags: ['abstract', 'gradient', 'fluid', 'modern', 'art', 'colorful'],
  },
  {
    id: 'bg-abstract-minimal-geom',
    title: 'Geometric Minimal Shapes',
    category: 'Abstract',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=400&q=70',
    tags: ['abstract', 'geometric', 'minimal', 'modern', 'design'],
  },
  // Textures
  {
    id: 'bg-texture-concrete',
    title: 'Smooth Gray Concrete',
    category: 'Textures',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=400&q=70',
    tags: ['texture', 'concrete', 'gray', 'industrial', 'minimal'],
  },
  {
    id: 'bg-texture-stucco',
    title: 'White Plaster Wall',
    category: 'Textures',
    url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=400&q=70',
    tags: ['texture', 'stucco', 'white', 'wall', 'plaster', 'light'],
  },
  // Wood
  {
    id: 'bg-wood-light-oak',
    title: 'Natural Light Oak Grain',
    category: 'Wood',
    url: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1546484396-fb3fc6f95f98?auto=format&fit=crop&w=400&q=70',
    tags: ['wood', 'oak', 'natural', 'grain', 'warm', 'light'],
  },
  {
    id: 'bg-wood-dark-walnut',
    title: 'Dark Walnut Planks',
    category: 'Wood',
    url: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=400&q=70',
    tags: ['wood', 'walnut', 'dark', 'planks', 'vintage'],
  },
  // Paper
  {
    id: 'bg-paper-kraft',
    title: 'Vintage Kraft Cardstock',
    category: 'Paper',
    url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=400&q=70',
    tags: ['paper', 'kraft', 'cardstock', 'vintage', 'rustic', 'texture'],
  },
  {
    id: 'bg-paper-watercolor',
    title: 'Handmade Watercolor Paper',
    category: 'Paper',
    url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=400&q=70',
    tags: ['paper', 'watercolor', 'handmade', 'art', 'white', 'light'],
  },
  // Metal
  {
    id: 'bg-metal-brushed',
    title: 'Brushed Aluminum Steel',
    category: 'Metal',
    url: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?auto=format&fit=crop&w=400&q=70',
    tags: ['metal', 'aluminum', 'brushed', 'steel', 'tech', 'silver'],
  },
  {
    id: 'bg-metal-carbon',
    title: 'Dark Carbon Fiber Grid',
    category: 'Metal',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=400&q=70',
    tags: ['metal', 'carbon', 'fiber', 'dark', 'tech', 'pattern'],
  },
  // Fabric
  {
    id: 'bg-fabric-linen',
    title: 'Natural Raw Linen Fabric',
    category: 'Fabric',
    url: 'https://images.unsplash.com/photo-1584589167171-541ce45f1eea?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1584589167171-541ce45f1eea?auto=format&fit=crop&w=400&q=70',
    tags: ['fabric', 'linen', 'cloth', 'natural', 'textile', 'light'],
  },
  {
    id: 'bg-fabric-leather',
    title: 'Luxury Black Leather Texture',
    category: 'Fabric',
    url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=400&q=70',
    tags: ['fabric', 'leather', 'black', 'luxury', 'dark', 'texture'],
  },
  // Nature
  {
    id: 'bg-nature-botanical',
    title: 'Tropical Botanical Palm Shadows',
    category: 'Nature',
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=70',
    tags: ['nature', 'palm', 'leaves', 'shadow', 'green', 'summer'],
  },
  {
    id: 'bg-nature-clouds',
    title: 'Soft Pastel Sunrise Clouds',
    category: 'Nature',
    url: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1534088568595-a066f410bcda?auto=format&fit=crop&w=400&q=70',
    tags: ['nature', 'sky', 'clouds', 'sunset', 'soft', 'light'],
  },
  // Business
  {
    id: 'bg-biz-architecture',
    title: 'Modern Glass Skyscraper',
    category: 'Business',
    url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=400&q=70',
    tags: ['business', 'architecture', 'glass', 'corporate', 'city', 'modern'],
  },
  {
    id: 'bg-biz-blue-network',
    title: 'Digital Tech Grid Waves',
    category: 'Business',
    url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=400&q=70',
    tags: ['business', 'tech', 'digital', 'network', 'blue', 'dark'],
  },
  // Patterns
  {
    id: 'bg-pattern-hex',
    title: 'Geometric Hexagon Grid',
    category: 'Patterns',
    url: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=400&q=70',
    tags: ['patterns', 'geometric', 'hexagon', 'grid', 'minimal', 'modern'],
  },
  // Dark & Light
  {
    id: 'bg-dark-minimal-mesh',
    title: 'Deep Obsidian Dark Smoke',
    category: 'Dark',
    url: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=400&q=70',
    tags: ['dark', 'black', 'minimal', 'smoke', 'obsidian'],
  },
  {
    id: 'bg-light-ceramic-podium',
    title: 'Clean Minimalist Ceramic Studio',
    category: 'Light',
    url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1600&q=85',
    thumbnail: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=400&q=70',
    tags: ['light', 'white', 'studio', 'clean', 'ceramic', 'bright'],
  },
];
