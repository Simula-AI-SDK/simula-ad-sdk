import React from 'react';

interface AditudePlaceholderProps {
    width: number;
    height: number;
    label: string;
    style?: React.CSSProperties;
}

export const AditudePlaceholder: React.FC<AditudePlaceholderProps> = ({
    width,
    height,
    label,
    style,
}) => {
    return (
        <div
            style={{
                width: `${width}px`,
                height: `${height}px`,
                border: '2px dashed rgba(150, 150, 150, 0.6)',
                backgroundColor: 'rgba(200, 200, 200, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                ...style,
            }}
        >
            <span
                style={{
                    color: 'rgba(150, 150, 150, 0.8)',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    userSelect: 'none',
                }}
            >
                {label} {width}x{height}
            </span>
        </div>
    );
};
