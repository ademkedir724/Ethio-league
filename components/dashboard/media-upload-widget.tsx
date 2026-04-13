"use client";

import type { ReactNode } from "react";
import { CldUploadWidget } from "next-cloudinary";

interface MediaUploadWidgetProps {
    uploadPreset: string;
    onSuccess: (url: string) => void;
    onError?: (error: unknown) => void;
    accept?: "image" | "image+video";
    maxFileSizeMb?: number;
    disabled?: boolean;
    children: ReactNode;
}

const FORMATS: Record<"image" | "image+video", string[]> = {
    image: ["jpg", "jpeg", "png", "webp"],
    "image+video": ["jpg", "jpeg", "png", "webp", "mp4"],
};

export function MediaUploadWidget({
    uploadPreset,
    onSuccess,
    onError,
    accept = "image",
    maxFileSizeMb = 5,
    disabled = false,
    children,
}: MediaUploadWidgetProps) {
    return (
        <CldUploadWidget
            uploadPreset={uploadPreset}
            options={{
                clientAllowedFormats: FORMATS[accept],
                maxFileSize: maxFileSizeMb * 1024 * 1024,
            }}
            onSuccess={(result) => {
                if (
                    result.info &&
                    typeof result.info === "object" &&
                    "secure_url" in result.info
                ) {
                    onSuccess(result.info.secure_url as string);
                }
            }}
            onError={(error) => {
                onError?.(error);
            }}
        >
            {({ open }) => (
                <span
                    onClick={() => {
                        if (!disabled) open();
                    }}
                    style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, display: "inline-block" }}
                >
                    {children}
                </span>
            )}
        </CldUploadWidget>
    );
}
