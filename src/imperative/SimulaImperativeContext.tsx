import { createContext } from 'react';
import type { SimulaEventType } from './types';

/**
 * Internal React context linking the declarative components (rendered inside
 * a manager-owned private `SimulaProvider` tree) back to the imperative
 * manager. Default value is `null` so `useContext` returns `null` in normal
 * declarative trees — ALL consumers MUST guard via optional chaining
 * (`ctx?.onEvent(...)`). Do not throw when missing: that would break
 * declarative usage, which is the whole point of "additive only".
 */
export interface SimulaImperativeContextValue {
  /** Emit a PRD event for this show cycle. Payload shape is event-specific. */
  onEvent: (type: SimulaEventType, payload: unknown) => void;
  /** Request the imperative owner to tear down the visible child tree. */
  onImperativeClose: () => void;
  /**
   * Advance the imperative manager's internal phase machine. Today only
   * SimulaMiniGameInterstitial consumes this — `'interstitial:cta'`
   * transitions interstitial → game. Unknown tokens are ignored by
   * managers that don't recognize them.
   */
  onImperativeAdvance?: (token: string) => void;
}

export const SimulaImperativeContext = createContext<SimulaImperativeContextValue | null>(null);
