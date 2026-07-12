window.renderInboxModule = async function (tableWrap) {

    function escHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function fmtDate(str) {
        if (!str) return '';
        const d = new Date(str);
        const now = new Date();
        const mins = Math.floor((now - d) / 60000);
        if (mins < 1)        return 'Just now';
        if (mins < 60)       return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24)        return `${hrs}h ago`;
        const days = Math.floor(hrs / 24);
        if (days < 7)        return `${days}d ago`;
        // Same year → show day + month, else full date
        if (d.getFullYear() === now.getFullYear()) {
            return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(d);
        }
        return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    }

    function fmtDateFull(str) {
        if (!str) return '';
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
        }).format(new Date(str));
    }

    function avatarColor(str) {
        const palette = ['#1a73e8','#8430ce','#e94235','#f9ab00','#0f9d58','#00829b','#e37400','#6d4c41'];
        let hash = 0;
        for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
        return palette[Math.abs(hash) % palette.length];
    }

    function senderName(from) {
        // "John Doe <john@example.com>" → "John Doe"
        const match = from.match(/^(.+?)\s*<[^>]+>/);
        return (match ? match[1] : from).trim() || from;
    }

    function senderInitials(from) {
        const name = senderName(from);
        return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
    }

    function senderEmail(from) {
        const match = from.match(/<([^>]+)>/);
        return match ? match[1] : from;
    }

    function snippet(body) {
        return (body || '').replace(/\s+/g, ' ').trim().slice(0, 100);
    }

    // ── Layout shell ───────────────────────────────────────────────────────────
    tableWrap.innerHTML = `
        <div class="gm-wrap">
            <!-- Left: list -->
            <div class="gm-list-panel">
                <div class="gm-toolbar">
                    <span class="gm-toolbar-title">Inbox</span>
                    <span class="gm-toolbar-count" id="gmCount"></span>
                    <button class="gm-refresh-btn" id="gmRefresh" title="Refresh">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="23 4 23 10 17 10"/>
                            <polyline points="1 20 1 14 7 14"/>
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                        </svg>
                    </button>
                </div>
                <div class="gm-list" id="gmList"></div>
                <div class="gm-pagination" id="gmPagination" style="display:none"></div>
            </div>

            <!-- Right: detail -->
            <div class="gm-detail-panel" id="gmDetail">
                <div class="gm-detail-empty">
                    <div class="gm-detail-empty-icon">✉️</div>
                    <div class="gm-detail-empty-text">Select an email to read</div>
                </div>
            </div>
        </div>
    `;

    const gmList       = document.getElementById('gmList');
    const gmDetail     = document.getElementById('gmDetail');
    const gmCount      = document.getElementById('gmCount');
    const gmPagination = document.getElementById('gmPagination');

    let selectedUid = null;

    // ── Open email ─────────────────────────────────────────────────────────────
    function openEmail(email, rowEl) {
        // Deselect previous
        gmList.querySelectorAll('.gm-row').forEach(r => r.classList.remove('gm-selected'));
        rowEl.classList.add('gm-selected');
        selectedUid = email.uid;

        const color = avatarColor(email.from);
        const name  = senderName(email.from);
        const addr  = senderEmail(email.from);

        gmDetail.innerHTML = `
            <div class="gm-detail-header">
                <div class="gm-detail-subject">${escHtml(email.subject)}</div>
                <div class="gm-detail-meta">
                    <div class="gm-detail-avatar" style="background:${color}">${escHtml(senderInitials(email.from))}</div>
                    <div>
                        <div class="gm-detail-sender-name">${escHtml(name)}</div>
                        <div class="gm-detail-sender-email">${escHtml(addr)}</div>
                    </div>
                    <div class="gm-detail-date">${fmtDateFull(email.date)}</div>
                </div>
            </div>
            <div class="gm-detail-body">${escHtml(email.body || '(empty message)')}</div>
        `;

        // Mark as read visually
        if (email.unread) {
            email.unread = false;
            rowEl.classList.remove('gm-unread');
            rowEl.classList.add('gm-read');
            window.api(`/api/email/${email.uid}/seen`, { method: 'POST' }).catch(() => {});
        }
    }

    // ── Render list ────────────────────────────────────────────────────────────
    function renderList(emails) {
        if (!emails.length) {
            gmList.innerHTML = `
                <div class="gm-empty">
                    <div class="gm-empty-icon">📭</div>
                    <div class="gm-empty-title">Inbox is empty</div>
                    <div class="gm-empty-sub">No emails found.</div>
                </div>`;
            return;
        }

        gmList.innerHTML = emails.map(e => {
            const color = avatarColor(e.from);
            return `
            <div class="gm-row ${e.unread ? 'gm-unread' : 'gm-read'}" data-uid="${e.uid}">
                <div class="gm-avatar" style="background:${color}">${escHtml(senderInitials(e.from))}</div>
                <div class="gm-row-body">
                    <div class="gm-row-top">
                        <span class="gm-sender">${escHtml(senderName(e.from))}</span>
                        <span class="gm-date">${escHtml(fmtDate(e.date))}</span>
                    </div>
                    <div class="gm-subject">${escHtml(e.subject)}</div>
                    <div class="gm-snippet">${escHtml(snippet(e.body))}</div>
                </div>
            </div>`;
        }).join('');

        gmList.querySelectorAll('.gm-row').forEach(row => {
            row.addEventListener('click', () => {
                const uid   = Number(row.dataset.uid);
                const email = emails.find(e => e.uid === uid);
                if (email) openEmail(email, row);
            });
        });

        // Re-select previously open email if still visible
        if (selectedUid) {
            const row = gmList.querySelector(`.gm-row[data-uid="${selectedUid}"]`);
            if (row) row.classList.add('gm-selected');
        }
    }

    // ── Load ───────────────────────────────────────────────────────────────────
    let currentPage = 1;

    async function load(page) {
        gmList.innerHTML = `<div class="gm-loading"><div class="gm-spinner"></div>Connecting…</div>`;
        gmPagination.style.display = 'none';
        gmCount.textContent = '';

        let res;
        try {
            res = await window.api(`/api/email/inbox?page=${page}&limit=20`);
        } catch (err) {
            gmList.innerHTML = `<div class="gm-error">Network error: ${escHtml(err.message)}</div>`;
            return;
        }

        if (!res?.success) {
            if (/IMAP credentials not configured|IMAP_PASS|Login failed/i.test(res?.error || '')) {
                gmList.innerHTML = `
                    <div class="gm-config-note">
                        <strong>📋 Setup required</strong><br><br>
                        Add these to your <code>.env</code> on the server, then restart:<br><br>
                        <code>IMAP_USER=info@dwarkeshdrivingschool.com</code><br>
                        <code>IMAP_PASS=your_hostinger_email_password</code>
                    </div>`;
            } else {
                gmList.innerHTML = `<div class="gm-error">⚠️ ${escHtml(res?.error || 'Unknown error')}</div>`;
            }
            return;
        }

        const { emails, total, pages } = res;
        const unreadCount = emails.filter(e => e.unread).length;
        gmCount.textContent = total ? `${total} emails${unreadCount ? ` · ${unreadCount} unread` : ''}` : '';

        renderList(emails);

        if (pages > 1) {
            const start = (page - 1) * 20 + 1;
            const end   = Math.min(page * 20, total);
            gmPagination.style.display = 'flex';
            gmPagination.innerHTML = `
                <span class="gm-page-info">${start}–${end} of ${total}</span>
                <button class="gm-page-btn" id="gmPrev" title="Older" ${page <= 1 ? 'disabled' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <button class="gm-page-btn" id="gmNext" title="Newer" ${page >= pages ? 'disabled' : ''}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
            `;
            document.getElementById('gmPrev')?.addEventListener('click', () => { currentPage--; load(currentPage); });
            document.getElementById('gmNext')?.addEventListener('click', () => { currentPage++; load(currentPage); });
        }
    }

    document.getElementById('gmRefresh').addEventListener('click', () => {
        selectedUid = null;
        gmDetail.innerHTML = `<div class="gm-detail-empty"><div class="gm-detail-empty-icon">✉️</div><div class="gm-detail-empty-text">Select an email to read</div></div>`;
        load(currentPage);
    });

    await load(currentPage);
};
