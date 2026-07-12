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

function credentialsConfigured() {
    const p = process.env.IMAP_PASS || '';
    return process.env.IMAP_USER && p && !p.includes('your_hostinger') && !p.includes('password_here');
}

function stripHtml(str) {
    return str
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function isHtml(str) {
    return /<html|<body|<div|<p[ >]|<br/i.test(str);
}

// GET /api/email/inbox?page=1&limit=20
// Fetches envelope + body in one IMAP session so clicking an email is instant.
router.get('/inbox', requireAdmin, async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(30, parseInt(req.query.limit) || 20);

    if (!credentialsConfigured()) {
        return res.json({ success: false, error: 'IMAP credentials not configured. Add IMAP_USER and IMAP_PASS to .env' });
    }

    const client = makeClient();
    try {
        await client.connect();
        const mailbox = await client.mailboxOpen('INBOX');
        const total   = mailbox.exists;

        if (total === 0) {
            await client.logout();
            return res.json({ success: true, emails: [], total: 0, page, limit, pages: 0 });
        }

        const from = Math.max(1, total - (page * limit) + 1);
        const to   = Math.max(1, total - ((page - 1) * limit));

        const emails = [];
        for await (const msg of client.fetch(`${from}:${to}`, {
            uid: true, envelope: true, flags: true, bodyParts: ['1', 'TEXT'],
        })) {
            const raw  = msg.bodyParts?.get('1') || msg.bodyParts?.get('TEXT') || Buffer.alloc(0);
            let body   = raw.toString('utf8');
            if (isHtml(body)) body = stripHtml(body);

            emails.push({
                uid:     msg.uid,
                from:    msg.envelope.from?.[0]
                    ? `${msg.envelope.from[0].name || ''} <${msg.envelope.from[0].address}>`.trim()
                    : '—',
                subject: msg.envelope.subject || '(no subject)',
                date:    msg.envelope.date,
                unread:  !msg.flags.has('\\Seen'),
                body,
            });
        }

        emails.reverse();

        await client.logout();
        res.json({ success: true, emails, total, page, limit, pages: Math.ceil(total / limit) });
    } catch (err) {
        try { await client.logout(); } catch (_) {}
        console.error('[email/inbox]', err.message);
        const msg = /command failed|auth|login/i.test(err.message)
            ? 'Login failed — check IMAP_PASS in .env is your correct Hostinger email password'
            : err.message;
        res.json({ success: false, error: msg });
    }
});

// POST /api/email/:uid/seen — mark a message as read (fire-and-forget from client)
router.post('/:uid/seen', requireAdmin, async (req, res) => {
    const uid = parseInt(req.params.uid);
    if (!uid) return res.json({ success: false });
    const client = makeClient();
    try {
        await client.connect();
        await client.mailboxOpen('INBOX');
        await client.messageFlagsAdd({ uid }, ['\\Seen']);
        await client.logout();
        res.json({ success: true });
    } catch (err) {
        try { await client.logout(); } catch (_) {}
        res.json({ success: false });
    }
});

export default router;
