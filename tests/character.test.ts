import { describe, expect, it } from 'vitest';
import { demoCharacter } from '../shared/demo';
import { abilityMod, characterSchema, damage, heal, rest, skillMod, spendHealing } from '../shared/character';

describe('table tracking', () => {
  it('spends temporary HP before HP and never goes below zero', () => {
    const c = demoCharacter(); c.combat.tempHp = 5;
    const result = damage(c, 7);
    expect(result.combat.hp).toBe(26); expect(result.combat.tempHp).toBe(0);
    expect(c.combat.hp).toBe(28);
    expect(damage(result, 100).combat.hp).toBe(0);
  });
  it('caps healing and clears death saves when HP is restored', () => {
    const c = demoCharacter(); Object.assign(c.combat, { hp: 0, successes: 1, failures: 2, stable: true });
    expect(heal(c, 0).combat.failures).toBe(2);
    expect(heal(c, 1).combat).toMatchObject({ hp: 1, successes: 0, failures: 0, stable: false });
    expect(heal(c, 100).combat.hp).toBe(28);
  });
  it('restores only one Rage on a short rest; long rest restores all pools', () => {
    const c = demoCharacter(); c.combat.hp = 10; c.combat.tempHp = 4; c.combat.rage = true;
    for (const r of Object.values(c.resources)) r.remaining = 0;
    const short = rest(c, 'short');
    expect(short.resources.rage.remaining).toBe(1); expect(short.resources.gods.remaining).toBe(0);
    expect(short.combat).toMatchObject({ hp: 10, tempHp: 4, rage: false });
    const long = rest(c, 'long'); expect(long.combat).toMatchObject({ hp: 28, tempHp: 0, rage: false });
    expect(long.resources.hitDice.remaining).toBe(3); expect(long.resources.gods.remaining).toBe(4);
    expect(rest(rest(demoCharacter(), 'short'), 'short').resources.rage.remaining).toBe(3);
  });
  it('does not allow rests or Hit Dice healing at zero HP', () => {
    const c = demoCharacter(); c.combat.hp = 0;
    expect(() => rest(c, 'long')).toThrow(); expect(() => rest(c, 'short')).toThrow();
    expect(() => spendHealing(c, 'hitDice', 1, 5)).toThrow();
  });
  it('spends only available healing dice and uses the entered total', () => {
    const c = demoCharacter(); c.combat.hp = 1;
    const result = spendHealing(c, 'gods', 2, 9);
    expect(result.combat.hp).toBe(10); expect(result.resources.gods.remaining).toBe(2);
    expect(() => spendHealing(result, 'gods', 3, 12)).toThrow();
  });
  it('applies Primal Knowledge only to eligible skills while raging', () => {
    const c = demoCharacter(); c.scores.str = 20;
    expect(skillMod(c, 'Perception', true)).toBe(3);
    c.combat.rage = true;
    expect(skillMod(c, 'Perception', true)).toBe(7);
    expect(skillMod(c, 'Arcana', true)).toBe(0);
    expect(abilityMod(8)).toBe(-1);
  });
  it('rejects corrupt backups and inconsistent counters', () => {
    const c = demoCharacter(); expect(characterSchema.safeParse(c).success).toBe(true);
    c.resources.rage.remaining = 4; expect(characterSchema.safeParse(c).success).toBe(false);
    c.resources.rage.remaining = 3; c.combat.hp = 100; expect(characterSchema.safeParse(c).success).toBe(false);
  });
});
