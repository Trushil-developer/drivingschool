import express from 'express';
import { ImapFlow } from 'imapflow';

const router = express.Router();

function requireAdmin(req, res, next) {
    if (req.session?.adminLoggedIn) return next();
    res.status(401).json({ success: false, error: 'Unauthorized' });
}

function makeClient() {
    return new ImapFlow({
        host: 'imap.hostinger.com',
        port: 993,
        secure: true,
        auth: {
            user: process.env.IMAP_USER,
            pass: process.env.IMAP_PASS,
        },
        logger: false,
    });
}

// GET /api/email/inbox?page=1&limit=20
router.get('/inbox', requireAdmin, async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);

    const imapPass = process.env.IMAP_PASS || '';
    if (!process.env.IMAP_USER || !imapPass || imapPass.includes('your_hostinger') || imapPass.includes('password_here')) {
        return res.json({ success: false, error: 'IMAP credentials not configured. Add IMAP_USER and IMAP_PASS to .env' });
    }

    const client = makeClient();
    try {
        await client.connect();
        const mailbox = await client.mailboxOpen('INBOX');
        const total   = mailbox.exists;

        // Fetch most recent emails first (highest UIDs last)
        const from   = Math.max(1, total - (page * limit) + 1);
        const to     = Math.max(1, total - ((page - 1) * limit));

        if (total === 0) {
            await client.logout();
            return res.json({ success: true, emails: [], total: 0, page, limit });
        }

        const emails = [];
        for await (const msg of client.fetch(`${from}:${to}`, {
            uid: true, envelope: true, flags: true, bodyStructure: false,
        })) {
            emails.push({
                uid:      msg.uid,
                seq:      msg.seq,
                from:     msg.envelope.from?.[0]
                    ? `${msg.envelope.from[0].name || ''} <${msg.envelope.from[0].address}>`.trim()
                    : '—',
                subject:  msg.envelope.subject || '(no subject)',
                date:     msg.envelope.date,
                unread:   !msg.flags.has('\\Seen'),
            });
        }

        // Reverse so newest is first
        emails.reverse();

        await client.logout();
        res.json({ success: true, emails, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (err) {
        try { await client.logout(); } catch (_) {}
        console.error('[email/inbox]', err.message);
        const msg = err.message?.toLowerCase().includes('command failed') || err.message?.toLowerCase().includes('auth')
            ? 'Login failed — check IMAP_PASS in .env is your correct Hostinger email password'
            : err.message;
        res.json({ success: false, error: msg });
    }
});

// GET /api/email/:uid  — fetch full message body
router.get('/:uid', requireAdmin, async (req, res) => {
    const uid = parseInt(req.params.uid);
    if (!uid) return res.json({ success: false, error: 'Invalid UID' });

    if (!process.env.IMAP_USER || !process.env.IMAP_PASS) {
        return res.json({ success: false, error: 'IMAP credentials not configured' });
    }

    const client = makeClient();
    try {
        await client.connect();
        await client.mailboxOpen('INBOX');

        let body = '';
        let htmlBody = '';

        for await (const msg of client.fetch({ uid }, {
            uid: true, envelope: true, flags: true, bodyParts: ['TEXT'],
        })) {
            // Mark as read
            await client.messageFlagsAdd({ uid }, ['\\Seen']);

            const raw = msg.bodyParts?.get('TEXT') || Buffer.alloc(0);
            body = raw.toString('utf8');

            // Very basic HTML detection — take text/plain only
            if (body.includes('<html') || body.includes('<HTML')) {
                htmlBody = body;
                body = body.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            }
        }

        await client.logout();
        res.json({ success: true, body, htmlBody: htmlBody || null });
    } catch (err) {
        try { await client.logout(); } catch (_) {}
        console.error('[email/:uid]', err.message);
        res.json({ success: false, error: err.message });
    }
});

export default router;
