import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
    api_key: process.env.CLOUDINARY_API_KEY || "",
    api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

/**
 * Upload image file to Cloudinary
 * @param {Buffer} fileBuffer - File buffer from multer
 * @param {string} fileName - Original file name
 * @param {string} folder - Cloudinary folder path (optional)
 * @returns {Promise<{secure_url: string, public_id: string, width: number, height: number, format: string}>}
 */
export const uploadImageToCloudinary = async (
    fileBuffer,
    fileName,
    folder = "okr-kpi-system"
) => {
    return new Promise((resolve, reject) => {
        const publicId = fileName.split(".")[0] || `image-${Date.now()}`;
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "auto",
                public_id: publicId,
            },
            (error, result) => {
                if (error) {
                    reject(new Error(`Cloudinary upload failed: ${error.message}`));
                } else if (result) {
                    resolve({
                        secure_url: result.secure_url,
                        public_id: result.public_id,
                        width: result.width,
                        height: result.height,
                        format: result.format,
                    });
                }
            }
        );

        uploadStream.end(fileBuffer);
    });
};

/**
 * Upload base64 image to Cloudinary
 * @param {string} base64Data - Base64 image string (raw or data URI)
 * @param {string} folder - Cloudinary folder path (optional)
 * @returns {Promise<{secure_url: string, public_id: string, width: number, height: number, format: string}>}
 */
export const uploadBase64ImageToCloudinary = async (
    base64Data,
    folder = "okr-kpi-system"
) => {
    if (!base64Data || typeof base64Data !== "string") {
        throw new Error("Invalid base64 image data");
    }

    // Accept both raw base64 and full data URI
    const dataUri = base64Data.startsWith("data:")
        ? base64Data
        : `data:image/png;base64,${base64Data}`;

    try {
        const result = await cloudinary.uploader.upload(dataUri, {
            folder,
            resource_type: "image",
        });

        return {
            secure_url: result.secure_url,
            public_id: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
        };
    } catch (error) {
        throw new Error(`Cloudinary upload failed: ${error.message}`);
    }
};

/**
 * Upload multiple images to Cloudinary
 * @param {Array<{buffer: Buffer, originalname: string}>} files - Array of file buffers from multer
 * @param {string} folder - Cloudinary folder path (optional)
 * @returns {Promise<Array<{secure_url: string, public_id: string, width: number, height: number, format: string}>>}
 */
export const uploadImagesToCloudinary = async (files, folder = "okr-kpi-system") => {
    const uploadPromises = files.map((file) =>
        uploadImageToCloudinary(file.buffer, file.originalname, folder)
    );

    return Promise.all(uploadPromises);
};

/**
 * Delete image from Cloudinary
 * @param {string} publicId - Public ID of the image to delete
 * @returns {Promise<void>}
 */
export const deleteImageFromCloudinary = async (publicId) => {
    try {
        await cloudinary.uploader.destroy(publicId);
    } catch (error) {
        console.error(`Cloudinary delete failed: ${error.message}`);
        throw new Error(`Failed to delete image: ${error.message}`);
    }
};

/**
 * Delete multiple images from Cloudinary
 * @param {string[]} publicIds - Array of public IDs to delete
 * @returns {Promise<void>}
 */
export const deleteImagesFromCloudinary = async (publicIds) => {
    const deletePromises = publicIds.map((publicId) =>
        deleteImageFromCloudinary(publicId)
    );

    await Promise.all(deletePromises);
};

/**
 * Generate Cloudinary URL with transformations
 * @param {string} publicId - Public ID of the image
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {string} crop - Crop mode (fill, fit, scale, thumb)
 * @returns {string}
 */
export const getCloudinaryImageUrl = (
    publicId,
    width,
    height,
    crop = "fill"
) => {
    return cloudinary.url(publicId, {
        secure: true,
        width,
        height,
        crop,
    });
};

/**
 * Get Cloudinary URL from public_id (no transformations)
 * @param {string} publicId - Public ID of the image
 * @returns {string|null}
 */
export const getCloudinaryUrlFromPublicId = (publicId) => {
    if (!publicId) return null;
    return cloudinary.url(publicId, { secure: true });
};

export default cloudinary;
