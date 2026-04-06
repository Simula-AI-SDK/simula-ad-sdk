import { useEffect } from 'react';
import { useSimula } from '../../SimulaProvider';
import { AditudePlaceholder } from '../aditude/AditudePlaceholder';

// TODO: move to types.ts
export interface AditudeSlotProps {
    baseDivId: string
    width: number
    height: number
    label: string
    targeting?: Record<string, any>
    style?: React.CSSProperties
}

const refreshAdSlot = (
    divId: string,
    baseDivId: string,
    targeting: Record<string, any>
) => {
    if (!document.querySelector(`script[data-aditude-slot="${divId}"]`)) {
        const script = document.createElement('script');
        script.textContent = `tude.cmd.push(() => tude.refreshAdsViaDivMappings([{ divId: "${divId}", baseDivId: "${baseDivId}", targeting: ${JSON.stringify(targeting)} }]))`;
        script.setAttribute('data-aditude-slot', divId);
        document.body.append(script);
    }
}

export const AditudeSlot: React.FC<AditudeSlotProps> = ({
    baseDivId,
    width,
    height,
    label,
    targeting = {},
    style
}) => {
    const { devMode, aditudeReady, aditudeConfig } = useSimula();

    const divId = baseDivId === '.htlad-anchor' ? 'anchor'
        : baseDivId === '.htlad-medrec' ? 'medrec'
        : baseDivId === '.htlad-rightrail' ? 'rightrail'
        : '';

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
