import { v2 as cloudinary } from "cloudinary";

const requiredEnvVars = [
    "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
] as const;

for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
        console.warn(`[cloudinary] Missing required environment variable: ${envVar}`);
    }
}

cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const CLOUDINARY_URL_PREFIX = "https://res.cloudinary.com/";

export function isValidCloudinaryUrl(url: string): boolean {
    return url.startsWith(CLOUDINARY_URL_PREFIX);
}

export function extractPublicId(url: string): string {
    // Strip scheme + host: https://res.cloudinary.com/<cloud>/image/upload/v1234/folder/file.jpg
    //                    -> /<cloud>/image/upload/v1234/folder/file.jpg
    const withoutOrigin = url.replace(/^https?:\/\/[^/]+/, "");

    // Remove /<cloud>/(image|video)/upload/vXXXX/ prefix
    const withoutPrefix = withoutOrigin.replace(
        /^\/[^/]+\/(image|video)\/upload\/v\d+\//,
        ""
    );

    // Remove file extension
    return withoutPrefix.replace(/\.[^/.]+$/, "");
}

export async function destroyAsset(publicId: string): Promise<void> {
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.warn(`[cloudinary] Failed to destroy asset "${publicId}":`, err);
    }
}
