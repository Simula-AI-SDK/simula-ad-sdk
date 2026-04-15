import React, { useEffect, useRef } from 'react';
import { AditudeSlotProps } from '../../types';
import { useSimula } from '../../SimulaProvider';
import { generateSlotId, getSlotPrefix, refreshAdSlot } from '../../utils/aditude';
import { AditudePlaceholder } from './AditudePlaceholder';

const EMPTY_TARGETING: Record<string, any> = {};

export const AditudeSlot: React.FC<AditudeSlotProps> = React.memo(({
    baseDivId,
    width,
    height,
    label,
    targeting = EMPTY_TARGETING,
    style
}) => {
    const { devMode, aditudeReady, aditudeConfig } = useSimula();

    // Generate a stable unique ID per component instance
    const divIdRef = useRef<string>(generateSlotId(getSlotPrefix(baseDivId)));
    const divId = divIdRef.current;

    // when aditude becomes ready, call refreshAdSlot
    useEffect(() => {
        if (aditudeReady && !devMode) {
            refreshAdSlot(divId, baseDivId, targeting);
        }
    }, [aditudeReady, baseDivId, devMode, divId, targeting])

    if (devMode) {
        return <AditudePlaceholder width={width} height={height} label={label} style={style} />;
    }

    if (!aditudeConfig || !aditudeReady) {
        return null;
    }

    return <div id={divId} style={style} />;
}, (prevProps, nextProps) => {
    return prevProps.baseDivId === nextProps.baseDivId
        && prevProps.width === nextProps.width
        && prevProps.height === nextProps.height
        && prevProps.label === nextProps.label
        && prevProps.style === nextProps.style
        && prevProps.targeting === nextProps.targeting;
});
