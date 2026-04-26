import { useEffect, useRef } from 'react';
import { useSimula } from '../SimulaProvider';

interface ReadinessProbeProps {
  onReady: (sessionId: string) => void;
}

/**
 * Tiny internal child mounted inside the manager-owned SimulaProvider tree.
 * When `useSimula().sessionId` first becomes truthy, fires `onReady(sessionId)`
 * exactly once so the imperative manager can resolve its `_loadInFlight`.
 *
 * Renders nothing — it's a side-effect probe, not UI.
 */
export const ReadinessProbe: React.FC<ReadinessProbeProps> = ({ onReady }) => {
  const { sessionId } = useSimula();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (sessionId) {
      firedRef.current = true;
      onReady(sessionId);
    }
  }, [sessionId, onReady]);

  return null;
};
