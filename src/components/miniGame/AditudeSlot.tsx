import { useEffect } from 'react';
import { useSimula } from '../../SimulaProvider';

// TODO: move to types.ts
export interface AditudeSlotProps {
    baseDivId: string
    width: number
    height: number
    label: string
    targeting?: Record<string, any>
    style?: Record<string, any>
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
    const { aditudeReady, aditudeConfig } = useSimula();

    const divId = baseDivId === '.htlad-anchor' ? 'anchor'
        : baseDivId === '.htlad-medrec' ? 'medrec'
        : baseDivId === '.htlad-rightrail' ? 'rightrail'
        : '';

    // when aditude becomes ready, call refreshAdSlot
    useEffect(() => {
        if (aditudeReady) {
            refreshAdSlot(divId, baseDivId, targeting);
        }
    }, [aditudeReady])

    if (aditudeReady) {
        return <div id={divId}/>
    } else {
        return <div></div>
    }
}
