const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
    {
        action: {
            type: String,
            required: true,
            enum: ['MASTER_PASSWORD_LOGIN', 'ADMIN_ACCESS', 'PASSWORD_RESET', 'ACCOUNT_MODIFICATION'],
            index: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        userEmail: {
            type: String,
            required: true,
        },
        adminIp: {
            type: String,
            required: true,
        },
        userAgent: {
            type: String,
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        timestamp: {
            type: Date,
            default: Date.now,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index for querying logs by user and date
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });

// Static method to create a master password login log
auditLogSchema.statics.logMasterPasswordAccess = async function (userId, userEmail, ipAddress, userAgent, metadata = {}) {
    return this.create({
        action: 'MASTER_PASSWORD_LOGIN',
        userId,
        userEmail,
        adminIp: ipAddress,
        userAgent,
        metadata,
        timestamp: new Date(),
    });
};

module.exports = mongoose.model('AuditLog', auditLogSchema);
