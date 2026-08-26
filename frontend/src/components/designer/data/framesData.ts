import { FramePreset } from '@/types/designer';

export const FRAME_PRESETS: FramePreset[] = [
  {
    id: 'frame_circle',
    name: 'Circle Frame',
    shape: 'circle',
    iconName: 'Circle',
    description: 'Perfect round photo frame',
  },
  {
    id: 'frame_rounded_rect',
    name: 'Rounded Card Frame',
    shape: 'rounded-rect',
    iconName: 'Square',
    description: 'Modern rounded photo card',
  },
  {
    id: 'frame_hexagon',
    name: 'Hexagon Frame',
    shape: 'hexagon',
    iconName: 'Hexagon',
    description: 'Geometric 6-sided photo mask',
  },
  {
    id: 'frame_heart',
    name: 'Heart Frame',
    shape: 'heart',
    iconName: 'Heart',
    description: 'Romantic heart photo cutout',
  },
  {
    id: 'frame_star',
    name: 'Star Frame',
    shape: 'star',
    iconName: 'Star',
    description: '5-point star photo frame',
  },
  {
    id: 'frame_diamond',
    name: 'Diamond Frame',
    shape: 'diamond',
    iconName: 'Diamond',
    description: 'Rotated square portrait frame',
  },
];
