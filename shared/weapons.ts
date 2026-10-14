import type { Character } from './character';

export function hasGreatWeaponMaster(c: Character) {
  return c.features.some(f => f.id === 'gwm' || f.name.toLowerCase() === 'great weapon master');
}

export function addDamageBonus(formula: string, bonus: number) {
  const simple = formula.trim().match(/^(\d+d\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!simple) return `(${formula}) + ${bonus}`;
  const modifier = (Number(simple[3] ?? 0) * (simple[2] === '-' ? -1 : 1)) + bonus;
  return modifier === 0 ? simple[1] : `${simple[1]} ${modifier < 0 ? '-' : '+'} ${Math.abs(modifier)}`;
}

export function greatWeaponDamage(c: Character, attack: Character['attacks'][number]) {
  if (!hasGreatWeaponMaster(c) || !/\bHeavy\b/i.test(attack.details)) return null;
  return {
    attack: addDamageBonus(attack.damage, c.proficiency),
    raging: addDamageBonus(attack.damage, c.proficiency + 2),
  };
}
