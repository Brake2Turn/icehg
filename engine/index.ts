// Public surface of the engine.
export * from './core/types';
export * from './core/clock';
export { Rng } from './core/rng';
export { simulate, compiled } from './core/simulate';
export { stateAt, blankView, ViewFolder, revealedCount } from './core/stateAt';
export { renderText, segments, plainText, hasLeftoverTokens, type TextBinding, type TextContext } from './core/text';
export { ZONES, RING, ALL_ZONES, neighbours, zoneLabel } from './core/arena';
export { ITEM_LABEL, WEAPON_LABEL } from './systems/resolve';
export * as tuning from './tuning';
