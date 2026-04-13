"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface GalleryImage {
    id: string;
    imageUrl: string;
    caption?: string | null;
    sortOrder: number;
}

interface ImageGalleryProps {
    images: GalleryImage[];
    onDelete?: (imageId: string) => Promise<void>;
    canDelete?: boolean;
    emptyMessage?: string;
    maxImages?: number;
}

export function ImageGallery({
    images,
    onDelete,
    canDelete = false,
    emptyMessage = "No images yet.",
    maxImages,
}: ImageGalleryProps) {
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (imageId: string) => {
        if (!onDelete) return;
        setDeletingId(imageId);
        try {
            await onDelete(imageId);
        } finally {
            setDeletingId(null);
        }
    };

    if (images.length === 0) {
        return (
            <p className="text-sm text-muted-foreground py-4 text-center">
                {emptyMessage}
            </p>
        );
    }

    return (
        <div className="space-y-2">
            {maxImages !== undefined && (
                <p className="text-xs text-muted-foreground text-right">
                    {images.length}/{maxImages}
                </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((image) => (
                    <div key={image.id} className="flex flex-col gap-1">
                        <div className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                            <Image
                                src={image.imageUrl}
                                alt={image.caption ?? "Gallery image"}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 50vw, 33vw"
                            />
                            {canDelete && (
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDelete(image.id)}
                                    disabled={deletingId === image.id}
                                    aria-label="Delete image"
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                        {image.caption && (
                            <p className="text-xs text-muted-foreground truncate px-0.5">
                                {image.caption}
                            </p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
