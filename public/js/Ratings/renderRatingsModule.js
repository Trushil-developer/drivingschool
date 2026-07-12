window.renderRatingsModule = async function (tableWrap) {

    function fmtDT(str) {
        if (!str) return '—';
        const d = new Date(str);
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: true,
        }).format(d);
    }

    function escHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function stars(rating) {
        return [1,2,3,4,5].map(i =>
            `<span style="color:${i <= rating ? '#f59e0b' : '#d1d5db'};font-size:16px">★</span>`
        ).join('');
    }

    function ratingColor(r) {
        if (r >= 4) return { color: '#065f46', bg: '#d1fae5' };
        if (r === 3) return { color: '#92400e', bg: '#fef3c7' };
        return { color: '#991b1b', bg: '#fee2e2' };
    }

    tableWrap.innerHTML = `
        <div class="cp-page">
            <div class="cp-page-header">
                <div>
                    <h2 class="cp-page-title">Session Ratings</h2>
                    <p class="cp-page-sub">Star ratings submitted by students after each class session</p>
                </div>
                <button class="cp-refresh-btn" id="rtRefresh" title="Refresh">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    Refresh
                </button>
            </div>
            <div id="rtStats" class="cp-stats"></div>
            <div id="rtList"></div>
        </div>
    `;

    async function load() {
        const list  = document.getElementById('rtList');
        const stats = document.getElementById('rtStats');
        list.innerHTML  = '<div class="cp-loading"><div class="cp-spinner"></div><span>Loading ratings…</span></div>';
        stats.innerHTML = '';

        const res     = await window.api('/api/admin/session-ratings');
        const ratings = res?.success ? res.ratings : [];

        if (ratings.length === 0) {
            list.innerHTML = `
                <div class="cp-empty">
                    <div class="cp-empty-icon">⭐</div>
                    <div class="cp-empty-title">No ratings yet</div>
                    <div class="cp-empty-sub">Ratings will appear here once students review their sessions.</div>
                </div>`;
            return;
        }

        const avg   = (ratings.reduce((s, r) => s + r.rating, 0) / ratings.length).toFixed(1);
        const dist  = [5,4,3,2,1].map(n => ({ n, count: ratings.filter(r => r.rating === n).length }));

        stats.innerHTML = `
            <div class="cp-stat-row">
                <div class="cp-stat-card cp-stat--total">
                    <span class="cp-stat-num">${ratings.length}</span>
                    <span class="cp-stat-lbl">Total Ratings</span>
                </div>
                <div class="cp-stat-card cp-stat--open" style="--accent:#f59e0b">
                    <span class="cp-stat-num">${avg} ★</span>
                    <span class="cp-stat-lbl">Average Rating</span>
                </div>
                ${dist.map(d => `
                <div class="cp-stat-card" style="background:#f9fafb">
                    <span class="cp-stat-num" style="font-size:1rem">${'★'.repeat(d.n)}</span>
                    <span class="cp-stat-lbl">${d.count} review${d.count !== 1 ? 's' : ''}</span>
                </div>`).join('')}
            </div>
        `;

        list.innerHTML = ratings.map(r => {
            const rc = ratingColor(r.rating);
            return `
                <div class="cp-card">
                    <div class="cp-card-accent" style="background:${rc.color}"></div>
                    <div class="cp-card-body">
                        <div class="cp-card-top">
                            <div class="cp-card-student">
                                <div>
                                    <div class="cp-student-name">${escHtml(r.student_name || 'Unknown')}</div>
                                    <div class="cp-student-email">${escHtml(r.student_email || '')}</div>
                                </div>
                            </div>
                            <div class="cp-card-meta">
                                <span class="cp-cat-chip" style="background:${rc.bg};color:${rc.color};font-size:18px;padding:4px 10px">
                                    ${stars(r.rating)}
                                </span>
                            </div>
                        </div>
                        <div style="font-size:13px;color:#6b7280;margin:6px 0 2px">
                            👤 ${escHtml(r.instructor_name || '—')} &nbsp;·&nbsp; Booking #${r.booking_id || '—'}
                        </div>
                        ${r.comment ? `<div class="cp-card-message" style="margin-top:8px">"${escHtml(r.comment)}"</div>` : ''}
                        <div class="cp-card-footer" style="margin-top:8px">
                            <span class="cp-card-date">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                ${fmtDT(r.rated_at)}
                            </span>
                        </div>
                    </div>
                </div>`;
        }).join('');
    }

    document.getElementById('rtRefresh').addEventListener('click', load);
    await load();
};
