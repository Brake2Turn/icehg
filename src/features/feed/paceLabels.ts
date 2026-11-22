import type { Pace } from '../../../engine';

export const PACE_LABEL: Record<Pace, { name: string; detail: string }> = {
  quick: { name: 'Quick', detail: '1 game day ≈ 3 min' },
  standard: { name: 'Standard', detail: '1 game day ≈ 12 min' },
  slow: { name: 'Slow', detail: '1 game day ≈ 1 hour' },
  realtime: { name: 'Real time', detail: '1 game day = 24 hours' },
};
