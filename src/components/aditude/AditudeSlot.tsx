import { useEffect, useRef } from 'react';
import { AditudeSlotProps } from '../../types';
import { useSimula } from '../../SimulaProvider';
import { generateSlotId, getSlotPrefix, refreshAdSlot } from '../../utils/aditude';
import { AditudePlaceholder } from './AditudePlaceholder';

export const AditudeSlot: React.FC<AditudeSlotProps> = ({
    baseDivId,
    width,
    height,
    label,
    targeting = {},
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
    }, [aditudeReady])

    if (devMode) {
        return <AditudePlaceholder width={width} height={height} label={label} style={style} />;
    }

    if (!aditudeConfig || !aditudeReady) {
        return null;
    }

    return <div id={divId} style={style} />;
}
