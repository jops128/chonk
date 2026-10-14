import type { Character } from '../shared/character';
import { greatWeaponDamage } from '../shared/weapons';

export default function GreatWeaponDamage({ character, attack }: { character: Character; attack: Character['attacks'][number] }) {
  const totals = greatWeaponDamage(character, attack);
  if (!totals) return null;
  return <div className="weapon-damage-breakdown">
    <div><span>Attack action · Great Weapon Master</span><strong>{totals.attack}</strong></div>
    <div><span>Attack action · with Rage</span><strong>{totals.raging}</strong></div>
    <p>Includes +{character.proficiency} from Great Weapon Master on your turn. Hew uses base damage, plus Rage if active. Add Divine Fury separately when eligible.</p>
  </div>;
}
