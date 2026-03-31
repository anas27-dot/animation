const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../config/logging');

// Initialize S3 Client
const s3Client = new S3Client({
    region: process.env.AWS_S3_REGION || 'ap-south-1',
    credentials: {
        accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'omniagent-bucket';

/**
 * Generate a pre-signed URL for uploading a file to S3
 * @param {string} key - The S3 key (filename/path)
 * @param {string} contentType - MIME type of the file
 * @returns {Promise<{uploadUrl: string, key: string}>}
 */
const getPresignedUploadUrl = async (key, contentType) => {
    try {
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            ContentType: contentType,
        });

        // URL expires in 15 minutes (900 seconds)
        const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

        return {
            uploadUrl,
            key,
        };
    } catch (error) {
        logger.error('Error generating pre-signed URL:', error);
        throw error;
    }
};

/**
 * Delete a file from S3
 * @param {string} key - The S3 key to delete
 * @returns {Promise<void>}
 */
const deleteFile = async (key) => {
    try {
        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
        });

        await s3Client.send(command);
        logger.info(`Successfully deleted file from S3: ${key}`);
    } catch (error) {
        logger.error(`Error deleting file from S3 (${key}):`, error);
        // Don't throw error for delete, just log it
    }
};

module.exports = {
    getPresignedUploadUrl,
    deleteFile,
};
