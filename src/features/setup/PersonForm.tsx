import { QUIRK_IDS, QUIRK_INFO, type PronounKey, type QuirkId } from '../../../engine';
import { PhotoPicker } from './PhotoPicker';

export type PersonDraft = { name: string; pronouns: PronounKey; quirk?: QuirkId; photo?: string };

/** Name, photo and pronouns: used by the Add sheet and the Pool screen. */
/** `onChange` receives only the changed fields, so a slow photo crop can't overwrite a name typed meanwhile. */
export function PersonForm({ value, onChange }: { value: PersonDraft; onChange: (patch: Partial<PersonDraft>) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <PhotoPicker name={value.name} photo={value.photo} onChange={(photo) => onChange({ photo })} />
      <label className="flex flex-col gap-1 text-sm text-mute" htmlFor="person-name">
        Name
        <input
          id="person-name"
          className="input"
          placeholder="Name"
          value={value.name}
          maxLength={24}
          autoCapitalize="words"
          autoComplete="off"
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </label>
      <div className="flex flex-col gap-1 text-sm text-mute">
        Pronouns (used in event text)
        <div className="grid grid-cols-3 gap-2">
          {(['he', 'she', 'they'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ pronouns: p })}
              className={`rounded-xl py-2 border text-base ${value.pronouns === p ? 'border-gold text-gold bg-gold/10' : 'border-line text-text'}`}
            >
              {p}
            </button>
          ))}
                </div>
      </div>
      <div className="flex flex-col gap-1.5 text-sm text-mute">
        Quirk (optional; without one, everyone is equal)
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => onChange({ quirk: undefined })}
            className={`rounded-full px-3 py-1.5 border text-sm ${!value.quirk ? 'border-gold text-gold bg-gold/10' : 'border-line text-text'}`}
          >
            None
          </button>
          {QUIRK_IDS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onChange({ quirk: q })}
              className={`rounded-full px-3 py-1.5 border text-sm ${value.quirk === q ? 'border-gold text-gold bg-gold/10' : 'border-line text-text'}`}
            >
              {QUIRK_INFO[q].label}
            </button>
          ))}
        </div>
        <div className="text-xs min-h-[3.5em] flex flex-col gap-0.5">
          {value.quirk ? (
            <>
              <span>
                <span className="text-chip-green font-semibold">Pro: </span>
                <span className="text-text">{QUIRK_INFO[value.quirk].pro}</span>
              </span>
              <span>
                <span className="text-chip-red font-semibold">Con: </span>
                <span className="text-text">{QUIRK_INFO[value.quirk].con}</span>
              </span>
            </>
          ) : (
            <span className="text-mute">A regular tribute. Nothing special, for better or worse.</span>
          )}
        </div>
      </div>
    </div>
  );
}
