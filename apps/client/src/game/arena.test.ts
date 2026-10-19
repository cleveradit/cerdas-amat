import { describe, expect, test } from 'vitest';
import { arenaLayout, poseFor } from './arena';

describe('arenaLayout', () => {
  test('seri: kedua tangan 5 langkah dari zona netral', () => {
    expect(arenaLayout(0)).toEqual({ hostHand: -5, p2Hand: 5, marker: 0 });
  });

  test('host unggul 3: Player 2 terseret, penanda ke sisi host', () => {
    expect(arenaLayout(3)).toEqual({ hostHand: -5, p2Hand: 2, marker: -3 });
  });

  test('batas KO: tangan yang tertinggal tepat di zona netral', () => {
    expect(arenaLayout(5)).toEqual({ hostHand: -5, p2Hand: 0, marker: -5 });
    expect(arenaLayout(-5)).toEqual({ hostHand: 0, p2Hand: 5, marker: 5 });
  });
});

describe('poseFor', () => {
  test('selama bermain: menarik saat unggul atau seri, terseret saat tertinggal', () => {
    expect(poseFor(0, 2, null)).toBe('pull');
    expect(poseFor(1, 0, null)).toBe('pull');
    expect(poseFor(1, 2, null)).toBe('drag');
    expect(poseFor(0, -1, null)).toBe('drag');
  });

  test('hasil: menang, kalah, seri, dibatalkan', () => {
    expect(poseFor(0, 5, { winner: 0, reason: 'ko' })).toBe('win');
    expect(poseFor(1, 5, { winner: 0, reason: 'ko' })).toBe('lose');
    expect(poseFor(0, 0, { winner: null, reason: 'time' })).toBe('idle');
    expect(poseFor(1, 0, { winner: null, reason: 'void' })).toBe('idle');
  });
});
