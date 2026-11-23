// Quirks: optional per-contestant traits the user picks (owner's request; replaces random stats).
// The numbers live in tuning.ts (QUIRK_EFFECTS); this file is names and descriptions.
export type QuirkId = 'career' | 'young' | 'peoplePerson' | 'psycho' | 'survivalist' | 'sneaky' | 'loyal' | 'backstabber';

export const QUIRK_IDS: QuirkId[] = ['career', 'young', 'peoplePerson', 'psycho', 'survivalist', 'sneaky', 'loyal', 'backstabber'];

export const QUIRK_INFO: Record<QuirkId, { label: string; description: string }> = {
  career: { label: 'Career', description: 'Trained for this. Strong and ruthless, and sometimes survives a killing blow with just an injury. Everyone else likes them a bit less.' },
  young: { label: 'Young', description: 'Weaker in a fight, but everyone else feels more protective of them.' },
  peoplePerson: { label: 'People person', description: 'Much more likely to join or form an alliance, but weaker when fighting alone.' },
  psycho: { label: 'Psycho', description: 'Hardly ever teams up, and is far more dangerous fighting alone, even against several attackers.' },
  survivalist: { label: 'Survivalist', description: 'Gets hungry and thirsty more slowly, and is better at surviving the arena and the Gamemakers.' },
  sneaky: { label: 'Sneaky', description: 'Hard to find, good at ambushes, and good at slipping away from a losing fight.' },
  loyal: { label: 'Loyal', description: 'Almost never betrays anyone, and is twice as likely to save someone they care about.' },
  backstabber: { label: 'Backstabber', description: 'Joins alliances like anyone else, but is three times as likely to betray them.' },
};
