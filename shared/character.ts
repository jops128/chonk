import { z } from 'zod';

export const abilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;
export type Ability = typeof abilities[number];
export const skillAbilities = {
  Acrobatics: 'dex', 'Animal Handling': 'wis', Arcana: 'int', Athletics: 'str',
  Deception: 'cha', History: 'int', Insight: 'wis', Intimidation: 'cha',
  Investigation: 'int', Medicine: 'wis', Nature: 'int', Perception: 'wis',
  Performance: 'cha', Persuasion: 'cha', Religion: 'int', 'Sleight of Hand': 'dex',
  Stealth: 'dex', Survival: 'wis',
} as const satisfies Record<string, Ability>;
export type Skill = keyof typeof skillAbilities;
const text = z.string().max(10000);
const count = z.number().int().min(0).max(1000000);
const modifier = z.number().int().min(-100).max(100);
const resource = z.object({ name: text, remaining: count, max: count, formula: text, rest: z.enum(['long', 'short']) });
export const characterSchema = z.object({
  schemaVersion: z.literal(1),
  profile: z.object({ name: text.min(1), level: z.number().int().min(1).max(20), species: text, subclass: text, background: text, languages: text }),
  scores: z.object({ str: z.number().int().min(1).max(30), dex: z.number().int().min(1).max(30), con: z.number().int().min(1).max(30), int: z.number().int().min(1).max(30), wis: z.number().int().min(1).max(30), cha: z.number().int().min(1).max(30) }),
  proficiency: z.number().int().min(0).max(20),
  skills: z.array(z.object({ name: z.enum(Object.keys(skillAbilities) as [Skill, ...Skill[]]), proficient: z.boolean(), override: modifier.nullable() })).length(18),
  saves: z.array(z.object({ ability: z.enum(abilities), proficient: z.boolean(), override: modifier.nullable() })).length(6),
  combat: z.object({ hp: count, maxHp: count.min(1), tempHp: count, ac: count, initiative: modifier, speed: count, passive: count, rage: z.boolean(), inspiration: z.boolean(), successes: z.number().int().min(0).max(3), failures: z.number().int().min(0).max(3), stable: z.boolean() }),
  resources: z.object({ rage: resource, stone: resource, hitDice: resource, gods: resource }),
  attacks: z.array(z.object({ id: text, name: text, bonus: modifier, damage: text, mastery: text, details: text })).max(100),
  features: z.array(z.object({ id: text, name: text, summary: text, page: text })).max(100),
  inventory: z.array(z.object({ id: text, name: text, quantity: count, description: text, review: z.boolean() })).max(500),
  notes: text,
}).superRefine((c, ctx) => {
  if (c.combat.hp > c.combat.maxHp) ctx.addIssue({ code: 'custom', path: ['combat', 'hp'], message: 'HP cannot exceed maximum HP.' });
  for (const [key, r] of Object.entries(c.resources)) {
    if (r.remaining > r.max) ctx.addIssue({ code: 'custom', path: ['resources', key, 'remaining'], message: 'Remaining uses cannot exceed the maximum.' });
  }
  if (new Set(c.skills.map(s => s.name)).size !== 18 || new Set(c.saves.map(s => s.ability)).size !== 6) ctx.addIssue({ code: 'custom', message: 'Skills and saves must be unique.' });
});
export type Character = z.infer<typeof characterSchema>;
export type ResourceKey = keyof Character['resources'];
export type Snapshot = { data: Character; revision: number; updated_at: string; last_write_id: string | null };
export const saveSchema = z.object({ data: characterSchema, expectedRevision: count, writeId: z.uuid() });
export function abilityMod(score: number) { return Math.floor((score - 10) / 2); }
export function signed(value: number) { return value >= 0 ? `+${value}` : String(value); }
export function skillMod(c: Character, name: Skill, primal = false) {
  const skill = c.skills.find(s => s.name === name)!;
  const useStrength = primal && c.combat.rage && ['Acrobatics', 'Intimidation', 'Perception', 'Stealth', 'Survival'].includes(name);
  return !useStrength && skill.override !== null ? skill.override : abilityMod(c.scores[useStrength ? 'str' : skillAbilities[name]]) + (skill.proficient ? c.proficiency : 0);
}
export function saveMod(c: Character, ability: Ability) {
  const save = c.saves.find(s => s.ability === ability)!;
  return save.override ?? abilityMod(c.scores[ability]) + (save.proficient ? c.proficiency : 0);
}
export function damage(c: Character, amount: number): Character {
  const next = structuredClone(c);
  const effective = Math.max(0, Math.floor(amount));
  next.combat.tempHp = Math.max(0, c.combat.tempHp - effective);
  next.combat.hp = Math.max(0, c.combat.hp - Math.max(0, effective - c.combat.tempHp));
  if (next.combat.hp === 0) next.combat.rage = false;
  if (effective > c.combat.tempHp && c.combat.hp === 0) next.combat.stable = false;
  return next;
}
export function heal(c: Character, amount: number): Character {
  const next = structuredClone(c);
  next.combat.hp = Math.min(c.combat.maxHp, c.combat.hp + Math.max(0, Math.floor(amount)));
  if (next.combat.hp > 0) Object.assign(next.combat, { successes: 0, failures: 0, stable: false });
  return next;
}
export function spendHealing(c: Character, key: 'hitDice' | 'gods', dice: number, total: number): Character {
  if (key === 'hitDice' && c.combat.hp === 0) throw new Error('You need at least 1 HP to begin a short rest.');
  if (!Number.isInteger(dice) || dice < 1 || dice > c.resources[key].remaining) throw new Error('Not enough healing dice.');
  const next = heal(c, total);
  next.resources[key].remaining -= dice;
  return next;
}
export function rest(c: Character, kind: 'short' | 'long'): Character {
  if (c.combat.hp === 0) throw new Error('You need at least 1 HP to begin a rest.');
  const next = structuredClone(c);
  next.combat.rage = false;
  if (kind === 'long') {
    Object.assign(next.combat, { hp: next.combat.maxHp, tempHp: 0, successes: 0, failures: 0, stable: false });
    for (const r of Object.values(next.resources)) r.remaining = r.max;
  } else next.resources.rage.remaining = Math.min(next.resources.rage.max, next.resources.rage.remaining + 1);
  return next;
}
