const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY_HOURS = parseInt(process.env.JWT_EXPIRY_HOURS) || 24;

/**
 * Generate JWT token with user data
 * @param {Object} payload - User data to encode
 * @returns {Object} Token data with expiry information
 */
const generateToken = (payload) => {
    const issuedAt = Date.now();
    const expiresIn = JWT_EXPIRY_HOURS * 3600; // Convert hours to seconds
    const expiresAt = issuedAt + (expiresIn * 1000); // Convert to milliseconds

    const token = jwt.sign(
        {
            ...payload,
            iat: Math.floor(issuedAt / 1000), // JWT expects seconds
            exp: Math.floor(expiresAt / 1000)
        },
        JWT_SECRET
    );

    return {
        token,
        expiresIn,
        issuedAt,
        expiresAt
    };
};

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded payload or null if invalid
 */
const verifyToken = (token) => {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        console.error('JWT verification failed:', error.message);
        return null;
    }
};

module.exports = {
    generateToken,
    verifyToken
};
