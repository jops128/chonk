import { describe, expect, it } from 'vitest';
import { demoCharacter } from '../shared/demo';
import { addDamageBonus, greatWeaponDamage } from '../shared/weapons';

describe('Great Weapon Master damage', () => {
  it('adds proficiency only for a character with the feat using a Heavy weapon', () => {
    const c = demoCharacter();
    const axe = c.attacks[0];
    expect(greatWeaponDamage(c, axe)).toBeNull();
    c.features.push({ id: 'gwm', name: 'Great Weapon Master', summary: '', page: '204' });
    axe.damage = '1d12 + 5';
    expect(greatWeaponDamage(c, axe)).toEqual({ attack: '1d12 + 7', raging: '1d12 + 9' });
    expect(axe.damage).toBe('1d12 + 5');
    expect(greatWeaponDamage(c, { ...axe, details: 'Light · Thrown 20/60 ft' })).toBeNull();
    c.proficiency = 3;
    expect(greatWeaponDamage(c, axe)?.attack).toBe('1d12 + 8');
  });
  it('preserves custom formulas and correctly combines signed modifiers', () => {
    expect(addDamageBonus('1d12', 2)).toBe('1d12 + 2');
    expect(addDamageBonus('1d12 - 2', 2)).toBe('1d12');
    expect(addDamageBonus('2d6 + 1d4 + 5', 2)).toBe('(2d6 + 1d4 + 5) + 2');
  });
});
