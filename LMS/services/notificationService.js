const { getFeatureFlag } = require('../config/environment');

const CHANNELS = {
    email: {
        enabled: () => getFeatureFlag('notifications.email', false),
        async send({ to, subject, body }) {
            if (!this.enabled()) return { sent: false, reason: 'email channel disabled' };
            // Plug in nodemailer, SendGrid, etc.
            console.log('[NotificationService] EMAIL to=%s subject=%s', to, subject);
            return { sent: true, channel: 'email', to, subject };
        },
    },
    sms: {
        enabled: () => getFeatureFlag('notifications.sms', false),
        async send({ to, message }) {
            if (!this.enabled()) return { sent: false, reason: 'sms channel disabled' };
            // Plug in Twilio, Africa's Talking, etc.
            console.log('[NotificationService] SMS to=%s message=%s', to, message);
            return { sent: true, channel: 'sms', to };
        },
    },
    inApp: {
        enabled: () => getFeatureFlag('notifications.inApp', true),
        async send({ recipientId, recipientType, title, message }) {
            if (!this.enabled()) return { sent: false, reason: 'inApp channel disabled' };
            const { sql, pool, poolConnect } = require('../config/database');
            await poolConnect;
            await pool.request()
                .input('recipientId', sql.Int, recipientId)
                .input('recipientType', sql.NVarChar(20), recipientType)
                .input('title', sql.NVarChar(200), title)
                .input('body', sql.NVarChar(sql.MAX), message ?? null)
                .query(`INSERT INTO notifications (recipient_id, recipient_type, title, body, is_read, created_at)
                        VALUES (@recipientId, @recipientType, @title, @body, 0, SYSUTCDATETIME())`);
            return { sent: true, channel: 'inApp', recipientId };
        },
    },
};

async function notify(channels, payload) {
    const results = [];
    for (const ch of [].concat(channels)) {
        const handler = CHANNELS[ch];
        if (!handler) {
            results.push({ sent: false, channel: ch, reason: 'unknown channel' });
            continue;
        }
        try {
            results.push(await handler.send(payload));
        } catch (err) {
            results.push({ sent: false, channel: ch, reason: err.message });
        }
    }
    return results;
}

async function getNotifications(recipientId, recipientType, { unreadOnly = false } = {}) {
    const { sql, pool, poolConnect } = require('../config/database');
    await poolConnect;
    const req = pool.request()
        .input('recipientId', sql.Int, recipientId)
        .input('recipientType', sql.NVarChar(20), recipientType);
    const where = 'WHERE recipient_id = @recipientId AND recipient_type = @recipientType'
        + (unreadOnly ? ' AND is_read = 0' : '');
    const result = await req.query(`SELECT * FROM notifications ${where} ORDER BY created_at DESC`);
    return result.recordset;
}

async function markRead(notificationId) {
    const { sql, pool, poolConnect } = require('../config/database');
    await poolConnect;
    await pool.request()
        .input('id', sql.Int, notificationId)
        .query('UPDATE notifications SET is_read = 1 WHERE id = @id');
}

module.exports = { notify, getNotifications, markRead, CHANNELS };
