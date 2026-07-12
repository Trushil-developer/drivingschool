window.renderInboxModule = async function (tableWrap) {

    function escHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmtDate(str) {
        if (!str) return '—';
        const d = new Date(str);
        const now = new Date();
        const diff = now - d;
        const mins = Math.floor(diff / 60000);
        if (mins < 1)   return 'just now';
        if (mins < 60)  return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs  < 24)  return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7)   return `${days}d ago`;
        return new Intl.DateTimeFormat('en-IN', {
            day: '2-digit', month: 'short', year: 'numeric',
        }).format(d);
    }

    function fmtDateFull(str) {
        if (!str) return '—';
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
        }).format(new Date(str));
    }

    function avatarColor(str) {
        const palette = ['#6366f1','#8b5cf6','#ec4899','#f97316','#14b8a6','#0ea5e9','#84cc16','#f59e0b'];
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        return palette[Math.abs(hash) % palette.length];
    }

    function initials(from) {
        // Extract name part before <email>
        const name = from.replace(/<[^>]+>/, '').trim() || from;
        return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
    }

    // ── Shell ──────────────────────────────────────────────────────────────────
    tableWrap.innerHTML = `
        <div class="inbox-page">
            <div class="inbox-header">
                <div>
                    <h2 class="inbox-title">📧 Inbox</h2>
                    <p class="inbox-subtitle">info@dwarkeshdrivingschool.com</p>
                </div>
                <button class="inbox-refresh-btn" id="inboxRefresh">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    Refresh
                </button>
            </div>
            <div id="inboxContent"></div>
            <div id="inboxPagination" class="inbox-pagination" style="display:none"></div>
        </div>
    `;

    // ── Detail overlay (appended to body) ──────────────────────────────────────
    let detailEl = document.getElementById('inboxDetail');
    if (detailEl) detailEl.remove();
    detailEl = document.createElement('div');
    detailEl.id = 'inboxDetail';
    detailEl.className = 'inbox-detail-overlay';
    detailEl.style.display = 'none';
    detailEl.innerHTML = `
        <div class="inbox-detail">
            <div class="inbox-detail-header">
                <div style="min-width:0">
                    <div class="inbox-detail-subject" id="inboxDetailSubject"></div>
                    <div class="inbox-detail-meta" id="inboxDetailMeta"></div>
                </div>
                <button class="inbox-detail-close" id="inboxDetailClose" title="Close">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </div>
            <div class="inbox-detail-body" id="inboxDetailBody">
                <div class="inbox-detail-loading">
                    <div class="inbox-spinner"></div> Loading…
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(detailEl);

    function closeDetail() { detailEl.style.display = 'none'; }
    document.getElementById('inboxDetailClose').addEventListener('click', closeDetail);
    detailEl.addEventListener('click', e => { if (e.target === detailEl) closeDetail(); });

    // ── State ──────────────────────────────────────────────────────────────────
    let currentPage = 1;
    const PAGE_SIZE = 20;

    async function openEmail(email) {
        document.getElementById('inboxDetailSubject').textContent = email.subject;
        document.getElementById('inboxDetailMeta').textContent =
            `From: ${email.from}  ·  ${fmtDateFull(email.date)}`;
        document.getElementById('inboxDetailBody').innerHTML =
            '<div class="inbox-detail-loading"><div class="inbox-spinner"></div> Loading…</div>';
        detailEl.style.display = 'flex';

        // Mark item as read visually
        const item = tableWrap.querySelector(`.inbox-item[data-uid="${email.uid}"]`);
        if (item) {
            item.classList.remove('unread');
            const dot = item.querySelector('.inbox-unread-dot');
            if (dot) { dot.classList.remove('inbox-unread-dot'); dot.classList.add('inbox-read-spacer'); }
        }

        try {
            const res = await window.api(`/api/email/${email.uid}`);
            if (!res?.success) throw new Error(res?.error || 'Failed to load');
            document.getElementById('inboxDetailBody').textContent = res.body || '(empty message)';
        } catch (err) {
            document.getElementById('inboxDetailBody').innerHTML =
                `<div class="inbox-error">Failed to load email: ${escHtml(err.message)}</div>`;
        }
    }

    async function load(page) {
        const content    = document.getElementById('inboxContent');
        const pagination = document.getElementById('inboxPagination');
        content.innerHTML = '<div class="inbox-loading"><div class="inbox-spinner"></div> Connecting to mailbox…</div>';
        pagination.style.display = 'none';

        let res;
        try {
            res = await window.api(`/api/email/inbox?page=${page}&limit=${PAGE_SIZE}`);
        } catch (err) {
            content.innerHTML = `<div class="inbox-error">Network error: ${escHtml(err.message)}</div>`;
            return;
        }

        if (!res?.success) {
            // Detect "not configured" state and show a helpful guide
            if (res?.error?.includes('IMAP credentials not configured') || res?.error?.includes('IMAP_USER')) {
                content.innerHTML = `
                    <div class="inbox-config-note">
                        <strong>📋 Setup required — one-time configuration</strong><br><br>
                        To connect your Hostinger email inbox, add these two lines to your <code>.env</code> file on the server:
                        <br><br>
                        <code>IMAP_USER=info@dwarkeshdrivingschool.com</code><br>
                        <code>IMAP_PASS=your_hostinger_email_password</code>
                        <br><br>
                        Use the same password you use to log into Hostinger Webmail. Then restart the server and click Refresh.
                    </div>`;
            } else {
                content.innerHTML = `<div class="inbox-error">Error: ${escHtml(res?.error || 'Unknown error')}</div>`;
            }
            return;
        }

        const { emails, total, pages } = res;

        if (emails.length === 0) {
            content.innerHTML = `
                <div class="inbox-empty">
                    <div class="inbox-empty-icon">📭</div>
                    <div class="inbox-empty-title">Inbox is empty</div>
                    <div class="inbox-empty-sub">No emails found.</div>
                </div>`;
            return;
        }

        content.innerHTML = `<div class="inbox-list">${emails.map(e => `
            <div class="inbox-item ${e.unread ? 'unread' : ''}" data-uid="${e.uid}">
                <div class="${e.unread ? 'inbox-unread-dot' : 'inbox-read-spacer'}"></div>
                <div class="inbox-item-avatar" style="background:${avatarColor(e.from)}">${escHtml(initials(e.from))}</div>
                <div class="inbox-item-body">
                    <div class="inbox-item-from">${escHtml(e.from)}</div>
                    <div class="inbox-item-subject">${escHtml(e.subject)}</div>
                </div>
                <div class="inbox-item-date">${fmtDate(e.date)}</div>
            </div>`).join('')}
        </div>`;

        // Click to open email
        content.querySelectorAll('.inbox-item').forEach(item => {
            item.addEventListener('click', () => {
                const uid  = Number(item.dataset.uid);
                const email = emails.find(e => e.uid === uid);
                if (email) openEmail(email);
            });
        });

        // Pagination
        if (pages > 1) {
            pagination.style.display = 'flex';
            pagination.innerHTML = `
                <button class="inbox-page-btn" id="inboxPrev" ${page <= 1 ? 'disabled' : ''}>← Prev</button>
                <span class="inbox-page-info">Page ${page} of ${pages} · ${total} emails</span>
                <button class="inbox-page-btn" id="inboxNext" ${page >= pages ? 'disabled' : ''}>Next →</button>
            `;
            document.getElementById('inboxPrev')?.addEventListener('click', () => { currentPage--; load(currentPage); });
            document.getElementById('inboxNext')?.addEventListener('click', () => { currentPage++; load(currentPage); });
        }
    }

    document.getElementById('inboxRefresh').addEventListener('click', () => load(currentPage));

    await load(currentPage);
};
