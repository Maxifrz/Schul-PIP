import { CardSnapshot, snapshot } from '../../src/lib/learn/cards';

export const start = 1_800_000_000_000;
export const MATERIAL = '00000000-0000-0000-0000-0000000000C1';

export function card(front: string, back: string, index: number, material: string | null = MATERIAL, dueDate = start): CardSnapshot {
  return snapshot(front, back, material, start + index * 1000, dueDate);
}
