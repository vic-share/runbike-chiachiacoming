import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

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
    return (
        <div className="relative w-full h-full bg-black" style={style?.containerStyle}>
            <Cropper
                image={image}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={onCropChange}
                onCropComplete={onCropComplete}
                onZoomChange={onZoomChange}
                showGrid={showGrid}
                objectFit="contain"
            />
        </div>
    );
};
