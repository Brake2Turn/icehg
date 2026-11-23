import type { ContestantSetup } from '../../../engine';

/** A contestant as the game screens show them: setup details plus their photo. */
export type Person = ContestantSetup & { photo?: string };
