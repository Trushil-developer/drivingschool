// Nags whoever is logged into the admin panel to explain every expired
// course. Checks once on load, then every 30 minutes — if any expired
// booking still has no reason, a popup lists it (branch / customer /
// instructor) until a reason is submitted for each one.
const RECHECK_INTERVAL_MS = 30 * 60 * 1000;

let overlayEl = null;
let listEl = null;

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
}

function ensureUI() {
    if (overlayEl) return;

    overlayEl = document.createElement('div');
    overlayEl.id = 'expiryReasonNagOverlay';
    Object.assign(overlayEl.style, {
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
        background: 'rgba(0,0,0,0.55)', display: 'none', zIndex: '5000',
        alignItems: 'center', justifyContent: 'center',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
        background: '#fff', borderRadius: '10px', padding: '20px',
        maxWidth: '520px', width: '92%', maxHeight: '80vh', overflowY: 'auto',
        boxShadow: '0 8px 30px rgba(0,0,0,0.3)', position: 'relative',
    });

    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    Object.assign(closeBtn.style, {
        position: 'absolute', top: '10px', right: '15px', fontSize: '22px',
        cursor: 'pointer', color: '#888', lineHeight: '1',
    });
    closeBtn.addEventListener('click', hide);

    const title = document.createElement('h3');
    title.textContent = 'Expired Courses — Reason Required';
    Object.assign(title.style, { marginTop: 0, marginBottom: '4px' });

    const subtitle = document.createElement('p');
    subtitle.textContent = 'Please enter a reason for each expired course below.';
    Object.assign(subtitle.style, { marginTop: 0, marginBottom: '14px', color: '#666', fontSize: '13px' });

    listEl = document.createElement('div');
    listEl.id = 'expiryReasonNagList';

    box.appendChild(closeBtn);
    box.appendChild(title);
    box.appendChild(subtitle);
    box.appendChild(listEl);
    overlayEl.appendChild(box);
    document.body.appendChild(overlayEl);
}

function show() { ensureUI(); overlayEl.style.display = 'flex'; }
function hide() { if (overlayEl) overlayEl.style.display = 'none'; }

function renderRow(booking) {
    const row = document.createElement('div');
    Object.assign(row.style, { border: '1px solid #eee', borderRadius: '8px', padding: '12px', marginBottom: '12px' });

    const info = document.createElement('div');
    info.innerHTML = `<strong>${escapeHtml(booking.customer_name || '—')}</strong>
        <div style="font-size:12px;color:#666;margin-top:2px;">
            Branch: ${escapeHtml(booking.branch || '—')} &nbsp;|&nbsp; Instructor: ${escapeHtml(booking.instructor_name || '—')}
        </div>`;

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Reason for expiry...';
    Object.assign(textarea.style, {
        width: '100%', minHeight: '60px', marginTop: '8px', padding: '8px',
        borderRadius: '6px', border: '1px solid #ddd', fontFamily: 'inherit',
        fontSize: '13px', boxSizing: 'border-box',
    });

    const errorEl = document.createElement('div');
    Object.assign(errorEl.style, { color: '#c0392b', fontSize: '12px', marginTop: '4px', display: 'none' });

    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.textContent = 'Submit';
    Object.assign(submitBtn.style, {
        marginTop: '8px', padding: '6px 16px', background: '#1C3A5E', color: '#fff',
        border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
    });

    submitBtn.addEventListener('click', async () => {
        const reason = textarea.value.trim();
        if (!reason) {
            errorEl.textContent = 'Please enter a reason.';
            errorEl.style.display = 'block';
            return;
        }
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';
        try {
            const res = await fetch(`/api/bookings/${booking.id}/expiry-reason`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ reason }),
            });
            const data = await res.json();
            if (data.success) {
                row.remove();
                if (!listEl.children.length) hide();
            } else {
                errorEl.textContent = data.error || 'Failed to submit. Try again.';
                errorEl.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Submit';
            }
        } catch (err) {
            errorEl.textContent = 'Network error. Try again.';
            errorEl.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
        }
    });

    row.appendChild(info);
    row.appendChild(textarea);
    row.appendChild(errorEl);
    row.appendChild(submitBtn);
    return row;
}

async function checkAndPrompt() {
    try {
        const res = await fetch('/api/bookings/expired-pending-reason', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success || !Array.isArray(data.bookings) || !data.bookings.length) return;

        ensureUI();
        listEl.innerHTML = '';
        data.bookings.forEach(b => listEl.appendChild(renderRow(b)));
        show();
    } catch (err) {
        // Silent — the next interval will retry.
    }
}

export function initExpiryReasonNag() {
    checkAndPrompt();
    setInterval(checkAndPrompt, RECHECK_INTERVAL_MS);
}
