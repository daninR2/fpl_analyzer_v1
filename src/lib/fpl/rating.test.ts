import { it, expect } from 'vitest';
import { rateTeams } from './rating';
import type { InsightPlayer } from './types';

const p = (id: number, pos: number, v: number, injured = false): InsightPlayer => ({ playerId: id, name: `P${id}`, team: 'ARS', position: 'X', positionId: pos, availability: injured ? 0 : 1, news: '', form: 0, xg90: 0, xa90: 0, minutesShare: 1, byEvent: { 1: injured ? 0 : v }, fixtures: [], total: injured ? 0 : v, healthyTotal: v, established: true, isNew: false, priorInjured: false, injury: injured ? { returnDate: null } : null, healthyHoldValue: v });
const squad = (base: number, offset: number, injuredStar = false) => [p(offset + 1, 1, base), p(offset + 2, 1, base), ...[3, 4, 5, 6, 7].map((i) => p(offset + i, 2, base)), ...[8, 9, 10, 11, 12].map((i) => p(offset + i, 3, base, injuredStar && i === 8)), ...[13, 14, 15].map((i) => p(offset + i, 4, base))];

it('best squad rates 100 and ranks first', () => {
  const r = rateTeams([{ entryId: 1, teamName: 'Weak', squad: squad(2, 0) }, { entryId: 2, teamName: 'Strong', squad: squad(4, 100) }], 1);
  expect(r[0]).toMatchObject({ teamName: 'Strong', rank: 1, rating: 100 });
  expect(r[1]!.rating).toBe(50);
});

it('a currently injured player still counts at full quality', () => {
  const r = rateTeams([{ entryId: 1, teamName: 'A', squad: squad(3, 0, true) }, { entryId: 2, teamName: 'B', squad: squad(3, 100) }], 1);
  expect(r[0]!.rating).toBe(100);
  expect(r[1]!.rating).toBe(100);
});
