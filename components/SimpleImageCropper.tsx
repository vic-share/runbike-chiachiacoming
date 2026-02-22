import React, { useState, useRef, useEffect } from 'react';

interface SimpleImageCropperProps {
    image: string;
    crop: { x: number; y: number };
    zoom: number;
    aspect: number;
    onCropChange: (crop: { x: number; y: number }) => void;
    onCropComplete: (croppedArea: any, croppedAreaPixels: any) => void;
    onZoomChange: (zoom: number) => void;
    showGrid?: boolean;
    style?: any;
}

export const SimpleImageCropper: React.FC<SimpleImageCropperProps> = ({
    image,
    crop,
    zoom,
    aspect,
    onCropChange,
    onCropComplete,
    onZoomChange,
    showGrid,
    style
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
        if (containerRef.current) {
            const { width, height } = containerRef.current.getBoundingClientRect();
            setContainerSize({ width, height });
        }
    }, []);

    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { naturalWidth, naturalHeight } = e.currentTarget;
        setImageSize({ width: naturalWidth, height: naturalHeight });
        // Initial center
        onCropChange({ x: 0, y: 0 });
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (dragStart) {
            e.preventDefault();
            const newX = e.clientX - dragStart.x;
            const newY = e.clientY - dragStart.y;
            onCropChange({ x: newX, y: newY });
        }
    };

    const handleMouseUp = () => {
        setDragStart(null);
        emitCropComplete();
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        const touch = e.touches[0];
        setDragStart({ x: touch.clientX - crop.x, y: touch.clientY - crop.y });
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (dragStart) {
            const touch = e.touches[0];
            const newX = touch.clientX - dragStart.x;
            const newY = touch.clientY - dragStart.y;
            onCropChange({ x: newX, y: newY });
        }
    };

    const handleTouchEnd = () => {
        setDragStart(null);
        emitCropComplete();
    };

    const emitCropComplete = () => {
        if (!imageSize.width || !containerSize.width) return;

        // Calculate cropped area pixels
        // This is a simplified calculation and might need adjustment based on exact requirements
        // Assuming the crop area is centered in the container
        const cropSize = {
            width: containerSize.width, // Simplified: assume full width crop area for now or use aspect
            height: containerSize.width / aspect
        };
        
        // Adjust for zoom
        const scale = zoom;
        const x = -crop.x / scale;
        const y = -crop.y / scale;
        const width = cropSize.width / scale;
        const height = cropSize.height / scale;

        onCropComplete(
            { x, y, width, height }, // Percentages (simplified)
            { x, y, width, height }  // Pixels
        );
    };

    // Trigger complete on mount/change
    useEffect(() => {
        const timeout = setTimeout(emitCropComplete, 500);
        return () => clearTimeout(timeout);
    }, [crop, zoom, imageSize, containerSize]);

    return (
        <div 
            ref={containerRef}
            className="relative w-full h-full overflow-hidden bg-black flex items-center justify-center cursor-move touch-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={style?.containerStyle}
        >
            {image && (
                <img
                    ref={imageRef}
                    src={image}
                    alt="Crop Preview"
                    onLoad={handleImageLoad}
                    style={{
                        transform: `translate(${crop.x}px, ${crop.y}px) scale(${zoom})`,
                        transformOrigin: 'center',
                        maxWidth: 'none',
                        maxHeight: 'none',
                        pointerEvents: 'none',
                        userSelect: 'none'
                    }}
                    draggable={false}
                />
            )}
            
            {/* Overlay Grid */}
            {showGrid && (
                <div 
                    className="absolute inset-0 pointer-events-none border border-white/30"
                    style={{
                        width: '80%',
                        height: '80%', // Simplified fixed overlay
                        top: '10%',
                        left: '10%',
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)'
                    }}
                >
                    <div className="w-full h-full grid grid-cols-3 grid-rows-3">
                        {[...Array(9)].map((_, i) => (
                            <div key={i} className="border border-white/10"></div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
