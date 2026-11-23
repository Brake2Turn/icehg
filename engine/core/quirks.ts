// Quirks: optional per-contestant traits the user picks (owner's request; replaces random stats).
// Every quirk has a pro and a con. The numbers live in tuning.ts (QUIRK_EFFECTS); this file is the words.
export type QuirkId = 'career' | 'young' | 'peoplePerson' | 'psycho' | 'survivalist' | 'sneaky' | 'loyal' | 'backstabber';

export const QUIRK_IDS: QuirkId[] = ['career', 'young', 'peoplePerson', 'psycho', 'survivalist', 'sneaky', 'loyal', 'backstabber'];

export const QUIRK_INFO: Record<QuirkId, { label: string; pro: string; con: string }> = {
  career: { label: 'Career', pro: 'Trained to fight, and sometimes survives a killing blow with just an injury.', con: 'Everyone else dislikes them from the start.' },
  young: { label: 'Young', pro: 'Everyone else feels protective of them.', con: 'Weaker in a fight.' },
  peoplePerson: { label: 'People person', pro: 'Twice as likely to join or form an alliance.', con: 'Weaker when fighting alone.' },
  psycho: { label: 'Psycho', pro: 'Far more dangerous fighting alone, even against several attackers.', con: 'Hardly ever teams up, and people are wary of them.' },
  survivalist: { label: 'Survivalist', pro: 'Gets hungry and thirsty more slowly, and is better at surviving the arena and the Gamemakers.', con: 'Weaker in a fight.' },
  sneaky: { label: 'Sneaky', pro: 'Hard to find, good at ambushes, and good at slipping away.', con: 'Nobody trusts them, so others like them less from the start.' },
  loyal: { label: 'Loyal', pro: 'Almost never betrays anyone, and is twice as likely to save someone they care about.', con: 'The first person a treacherous ally turns on.' },
  backstabber: { label: 'Backstabber', pro: 'Three times as likely to strike first and betray their alliance.', con: 'People sense it: others like them less, and alliances are harder to come by.' },
};
