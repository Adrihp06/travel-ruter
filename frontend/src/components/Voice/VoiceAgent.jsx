/**
 * VoiceAgent - Parent component mounting VoiceButton + Voice side panel.
 * Renders in-flow within the Layout flex container (same pattern as AIChat).
 * Syncs trip context from Layout to the voice store.
 */

import React, { useEffect, lazy, Suspense } from 'react';
import useVoiceStore from '../../stores/useVoiceStore';
import VoiceButton from './VoiceButton';

const VoicePanel = lazy(() => import('./VoiceOverlay'));

const VoiceAgent = ({ tripContext }) => {
  const isOverlayOpen = useVoiceStore((s) => s.isOverlayOpen);
  const setTripContext = useVoiceStore((s) => s.setTripContext);
  const toggleOverlay = useVoiceStore((s) => s.toggleOverlay);

  // Sync trip context from Layout to the voice store
  useEffect(() => {
    setTripContext(tripContext || null);
  }, [tripContext, setTripContext]);

  return (
    <>
      {/* Floating button - hidden when panel is open */}
      {!isOverlayOpen && <VoiceButton />}

      {/* Side panel - renders in-flow within the Layout flex container */}
      <div
        className={`flex-shrink-0 h-screen transition-[width] duration-300 ease-out overflow-hidden ${
          isOverlayOpen ? 'w-full sm:w-[380px]' : 'w-0'
        }`}
      >
        <div className="w-full sm:w-[380px] h-full">
          {isOverlayOpen && (
            <Suspense fallback={null}>
              <VoicePanel />
            </Suspense>
          )}
        </div>
      </div>
    </>
  );
};

export default VoiceAgent;
