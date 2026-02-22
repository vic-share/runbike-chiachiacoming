import React from 'react';
import { format, parseISO } from 'date-fns';

interface SimpleComposedChartProps {
    data: any[];
    xKey?: string;
    areaKey?: string;
    lineKeys?: { key: string; color: string; strokeDasharray?: string }[];
    height?: number;
    showXAxis?: boolean;
    xAxisFormatter?: (val: any) => string;
}

export const SimpleComposedChart: React.FC<SimpleComposedChartProps> = ({ 
    data, 
    xKey = 'date',
    areaKey = 'avg', 
    lineKeys = [], 
    height = 200,
    showXAxis = true,
    xAxisFormatter
}) => {
    if (!data || data.length === 0) return null;

    const speedValues: number[] = [];
    const stabilityValues: number[] = [];

    data.forEach(d => {
        if (areaKey && d[areaKey] != null) speedValues.push(Number(d[areaKey]));
        lineKeys.forEach(lk => {
            if (lk.key === 'stability') {
                if (d[lk.key] != null) stabilityValues.push(Number(d[lk.key]));
            } else {
                if (d[lk.key] != null) speedValues.push(Number(d[lk.key]));
            }
        });
    });

    if (speedValues.length === 0) return null;

    const maxSpeed = Math.max(...speedValues);
    const minSpeed = Math.min(...speedValues);
    const speedRange = maxSpeed - minSpeed;
    const speedPadding = Math.max(speedRange * 0.4, 0.8);
    const effectiveMinSpeed = Math.max(0, minSpeed - speedPadding);
    const effectiveMaxSpeed = maxSpeed + speedPadding;
    const effectiveSpeedRange = effectiveMaxSpeed - effectiveMinSpeed || 1;

    const getX = (index: number) => {
        if (data.length <= 1) return 50;
        return (index / (data.length - 1)) * 100;
    };
    const getSpeedY = (val: number) => 100 - ((val - effectiveMinSpeed) / effectiveSpeedRange) * 100;
    const getStabilityY = (val: number) => 100 - (val / 100) * 100; // Stability is 0-100

    // Generate Area Path
    let areaPoints = '';
    let polylinePoints = '';
    if (areaKey && data.length > 1) {
        const points = data.map((d, i) => `${getX(i)},${getSpeedY(Number(d[areaKey] || 0))}`).join(' ');
        polylinePoints = points;
        areaPoints = `0,100 ${points} 100,100`;
    }

    const defaultFormatter = (val: any) => {
        if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) {
            return format(parseISO(val), 'MM/dd');
        }
        return String(val);
    };

    const formatX = xAxisFormatter || defaultFormatter;

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex-1 relative min-h-0">
                <svg viewBox="0 -10 100 120" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                        <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#39e75f" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#39e75f" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    
                    {/* Grid Lines */}
                    <line x1="0" y1="0" x2="100" y2="0" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" strokeDasharray="2" vectorEffect="non-scaling-stroke" />
                    <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" strokeDasharray="2" vectorEffect="non-scaling-stroke" />
                    <line x1="0" y1="100" x2="100" y2="100" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" strokeDasharray="2" vectorEffect="non-scaling-stroke" />

                    {/* Area */}
                    {areaKey && (
                        <>
                            {data.length === 1 ? (
                                <circle cx="50" cy={getSpeedY(Number(data[0][areaKey] || 0))} r="3" fill="#39e75f" vectorEffect="non-scaling-stroke" />
                            ) : (
                                <>
                                    <polygon points={areaPoints} fill="url(#chartGradient)" />
                                    <polyline 
                                        points={polylinePoints} 
                                        fill="none" 
                                        stroke="#39e75f" 
                                        strokeWidth="2" 
                                        vectorEffect="non-scaling-stroke" 
                                        strokeLinecap="round" 
                                    />
                                    {data.map((d, i) => (
                                        <circle key={`area-dot-${i}`} cx={getX(i)} cy={getSpeedY(Number(d[areaKey] || 0))} r="1.5" fill="#39e75f" vectorEffect="non-scaling-stroke" />
                                    ))}
                                </>
                            )}
                        </>
                    )}

                    {/* Lines */}
                    {lineKeys.map((lk, idx) => {
                        const isStability = lk.key === 'stability';
                        const getYValue = isStability ? getStabilityY : getSpeedY;

                        if (data.length === 1) {
                             const y = getYValue(Number(data[0][lk.key] || 0));
                             return <circle key={idx} cx="50" cy={y} r="3" fill={lk.color} vectorEffect="non-scaling-stroke" />;
                        }
                        const points = data.map((d, i) => `${getX(i)},${getYValue(Number(d[lk.key] || 0))}`).join(' ');
                        return (
                            <g key={idx}>
                                <polyline 
                                    points={points} 
                                    fill="none" 
                                    stroke={lk.color} 
                                    strokeWidth="2" 
                                    strokeDasharray={lk.strokeDasharray || ""}
                                    vectorEffect="non-scaling-stroke" 
                                    strokeLinecap="round" 
                                />
                                {data.map((d, i) => (
                                    <circle key={`line-dot-${lk.key}-${i}`} cx={getX(i)} cy={getYValue(Number(d[lk.key] || 0))} r="1.5" fill={lk.color} vectorEffect="non-scaling-stroke" />
                                ))}
                            </g>
                        );
                    })}
                </svg>
            </div>
            {showXAxis && (
                <div className="flex justify-between text-[9px] text-zinc-500 mt-2 font-mono">
                    {(() => {
                        const maxLabels = 5;
                        let indices = Array.from({ length: Math.min(maxLabels, data.length) }, (_, i) => 
                            Math.floor(i * (data.length - 1) / (Math.min(maxLabels, data.length) - 1))
                        );
                        if (data.length === 1) indices = [0];
                        return indices.map(i => <span key={i}>{formatX(data[i][xKey])}</span>);
                    })()}
                </div>
            )}
            <div className="flex justify-center items-center gap-4 mt-3 text-[10px] font-bold uppercase tracking-wider">
                {(() => {
                    const legendLabels: { [key: string]: string } = {
                        avg: '平均',
                        best: '最快',
                        stability: '穩定度'
                    };
                    return (
                        <>
                            {areaKey && (
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-2 rounded-sm" style={{ backgroundColor: '#39e75f', opacity: 0.6 }}></div>
                                    <span className="text-zinc-400">{legendLabels[areaKey] || areaKey}</span>
                                </div>
                            )}
                            {lineKeys.map(lk => (
                                <div key={lk.key} className="flex items-center gap-1.5">
                                    <div className="w-3 h-0.5" style={{ backgroundColor: lk.color }}></div>
                                    <span className="text-zinc-400">{legendLabels[lk.key] || lk.key}</span>
                                </div>
                            ))}
                        </>
                    );
                })()}
            </div>
        </div>
    );
};
