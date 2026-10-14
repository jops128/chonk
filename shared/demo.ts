import { abilities, skillAbilities, type Character } from './character';

// Fictional demo only. The real character is provisioned privately in the database.
export function demoCharacter(): Character {
  return {
    schemaVersion: 1,
    profile: { name: 'Wayfarer', level: 3, species: 'Goliath · Stone Giant', subclass: 'Zealot Barbarian', background: 'Soldier', languages: 'Common, Giant' },
    scores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }, proficiency: 2,
    skills: Object.keys(skillAbilities).map(name => ({ name: name as keyof typeof skillAbilities, proficient: ['Athletics', 'Intimidation', 'Perception'].includes(name), override: null })),
    saves: abilities.map(ability => ({ ability, proficient: ['str', 'con'].includes(ability), override: null })),
    combat: { hp: 28, maxHp: 28, tempHp: 0, ac: 14, initiative: 2, speed: 35, passive: 13, rage: false, inspiration: false, successes: 0, failures: 0, stable: false },
    resources: {
      rage: { name: 'Rage', remaining: 3, max: 3, formula: '+2 damage · physical resistance', rest: 'short' },
      stone: { name: 'Stone’s Endurance', remaining: 2, max: 2, formula: '1d12 + CON damage reduction', rest: 'long' },
      hitDice: { name: 'Hit Dice', remaining: 3, max: 3, formula: '1d12 + CON per die', rest: 'long' },
      gods: { name: 'Warrior of the Gods', remaining: 4, max: 4, formula: '1d12 healing per die', rest: 'long' },
    },
    attacks: [{ id: 'greataxe', name: 'Greataxe', bonus: 5, damage: '1d12 + 3', mastery: 'Cleave', details: 'Slashing · Heavy · Two-handed' }],
    features: [{ id: 'rage', name: 'Rage', summary: 'A bonus action starts Rage. Strength attacks gain +2 damage; bludgeoning, piercing, and slashing damage is resisted. Strength checks and saves have advantage. Extend each round; maximum 10 minutes.', page: '51' }],
    inventory: [{ id: 'pack', name: 'Explorer’s pack', quantity: 1, description: 'Ready for the road.', review: false }], notes: '',
  };
}
