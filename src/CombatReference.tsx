import { Axe, Flame, Shield, Sparkles, Swords, Target } from 'lucide-react';
import { abilityMod, signed, type Character } from '../shared/character';

type Feature = Character['features'][number];

export default function CombatReference({ character: c }: { character: Character }) {
  const reminders = [
    {
      id: 'gwm', icon: Axe, timing: 'ATTACK ACTION · YOUR TURN',
      formula: `+${c.proficiency} damage with Heavy weapons`,
      text: 'Add your proficiency bonus on Heavy-weapon hits made as part of the Attack action on your turn. Hew: immediately after a melee critical hit or reducing a creature to 0 HP, you may attack with the same weapon as a bonus action. Hew does not gain this damage bonus.',
    },
    {
      id: 'divine', icon: Sparkles, timing: 'FIRST HIT · YOUR TURN',
      formula: `+1d6 + ${Math.floor(c.profile.level / 2)}`,
      text: 'While raging, add this to the first creature you hit on your turn with a weapon or unarmed strike. Choose radiant or necrotic.',
      requiresRage: true,
    },
    {
      id: 'reckless', icon: Swords, timing: 'FIRST ATTACK · YOUR TURN',
      formula: 'Advantage on STR attacks',
      text: 'Choose when making your first attack. Lasts until your next turn starts. Attacks against you also have advantage during that time.',
    },
    {
      id: 'danger', icon: Shield, timing: 'DEXTERITY SAVES',
      formula: 'Advantage on DEX saves',
      text: 'Applies unless you are incapacitated.',
    },
    {
      id: 'stone', icon: Shield, timing: 'REACTION · WHEN TAKING DAMAGE',
      formula: c.resources.stone.formula,
      text: 'Spend a use to reduce incoming damage by your roll. Apply damage reductions before resistance. Track the use in your resource counter.',
    },
    {
      id: 'savage', icon: Axe, timing: 'ONCE PER TURN · WEAPON HIT',
      formula: 'Roll weapon damage twice',
      text: 'Choose either roll of the weapon’s damage dice. This does not reroll Divine Fury dice.',
    },
    {
      id: 'primal', icon: Flame, timing: 'SKILL CHECKS · WHILE RAGING',
      formula: `Use Strength (${signed(abilityMod(c.scores.str))})`,
      text: 'You may use Strength for Acrobatics, Intimidation, Perception, Stealth, or Survival. Add proficiency when applicable.',
      requiresRage: true,
    },
    {
      id: 'cleave', icon: Axe, timing: 'ONCE PER TURN · MELEE HIT',
      formula: 'Attack a second creature',
      text: 'The second target must be within 5 feet of the first and within your reach. Do not add a positive ability modifier to the second hit’s damage.',
    },
    {
      id: 'vex', icon: Target, timing: 'AFTER A HIT THAT DEALS DAMAGE',
      formula: 'Advantage on your next attack',
      text: 'Against that same creature, before the end of your next turn.',
    },
  ];
  const available = reminders.flatMap(reminder => {
    const feature = c.features.find(f => f.id === reminder.id || (reminder.id === 'gwm' && f.name.toLowerCase() === 'great weapon master'));
    return feature ? [{ ...reminder, feature }] : [];
  });
  if (!available.length) return null;

  return (
    <section className="combat-reference" aria-labelledby="combat-abilities-heading">
      <div className="section-title">
        <h2 id="combat-abilities-heading">Combat abilities</h2>
        <span>QUICK REFERENCE</span>
      </div>
      <div className="combat-ability-grid">
        {available.map(({ feature, icon: Icon, timing, formula, text, requiresRage }) => (
          <article className={`card combat-ability ${requiresRage && c.combat.rage ? 'rage-ready' : ''}`} key={feature.id}>
            <div className="combat-ability-title">
              <Icon size={17} aria-hidden="true"/>
              <h3>{feature.name}</h3>
              {requiresRage && <span className={`rage-label ${c.combat.rage ? 'active' : ''}`}>{c.combat.rage ? 'Rage active' : 'Requires Rage'}</span>}
            </div>
            <p className="combat-ability-formula">{formula}</p>
            <p className="combat-ability-copy">{text}</p>
            <span className="combat-ability-timing">{timing}</span>
            <FullNote feature={feature}/>
          </article>
        ))}
      </div>
    </section>
  );
}

function FullNote({ feature }: { feature: Feature }) {
  return (
    <details className="combat-full-note">
      <summary>Full note · PHB {feature.page}</summary>
      <p>{feature.summary}</p>
    </details>
  );
}
