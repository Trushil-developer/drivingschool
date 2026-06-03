/**
 * openSlotPicker — reusable slot-selection modal
 *
 * opts:
 *   branch, car, startingFrom  — used to detect conflicts
 *   durationMinutes            — drives max selectable slots (duration / 30)
 *   currentSlots               — array of "HH:MM" or "HH:MM:SS" already selected
 *   excludeId                  — booking id to exclude from conflict check (the one being edited)
 *   onSave(selectedSlots)      — async callback; receives sorted ["HH:MM", …] array; throw to show error
 */
export async function openSlotPicker({ branch, car, startingFrom, durationMinutes, currentSlots = [], excludeId = null, onSave }) {

    // ── 1. Build full 6:00–22:00 grid in 30-min steps ──────────────────────
    const ALL_SLOTS = [];
    for (let h = 6; h < 22; h++) {
        for (const m of [0, 30]) {
            ALL_SLOTS.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
        }
    }

    // Normalise HH:MM:SS → HH:MM
    const norm = t => (t || '').substring(0, 5);

    const maxSlots = 4; // DB supports 4 slot columns; admin can assign any number 1–4
    const preSelected = new Set(currentSlots.map(norm).filter(Boolean));

    // ── 2. Fetch availability (exclude current booking) ─────────────────────
    const takenSlots = new Set();
    try {
        const qs = excludeId ? `?exclude_id=${excludeId}` : '';
        const res = await fetch(`/api/bookings/availability${qs}`, { credentials: 'same-origin' });
        const data = await res.json();

        if (data.success && startingFrom) {
            const myStart = new Date(startingFrom);
            const myEnd   = new Date(myStart);
            myEnd.setDate(myStart.getDate() + 30);

            data.bookings.forEach(b => {
                if (!b.starting_from) return;
                if (!['Active', 'Pending'].includes(b.attendance_status)) return;
                if (b.branch !== branch || b.car_name !== car) return;

                const bStart = new Date(b.starting_from);
                const bEnd   = new Date(bStart);
                bEnd.setDate(bStart.getDate() + 30);

                // Overlapping periods → mark as taken
                if (bStart <= myEnd && bEnd >= myStart) {
                    ['allotted_time','allotted_time2','allotted_time3','allotted_time4'].forEach(k => {
                        if (b[k]) takenSlots.add(norm(b[k]));
                    });
                }
            });
        }
    } catch (e) {
        console.error('slotPicker: availability fetch failed', e);
    }

    // ── 3. Build modal DOM ───────────────────────────────────────────────────
    document.getElementById('slotPickerOverlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'slotPickerOverlay';
    overlay.className = 'sp-overlay';

    overlay.innerHTML = `
        <div class="sp-modal" role="dialog" aria-modal="true">
            <div class="sp-header">
                <div>
                    <h3 class="sp-title">Edit Session Slots</h3>
                    <p class="sp-sub">${car} &middot; ${branch}</p>
                </div>
                <button class="sp-close" aria-label="Close">&times;</button>
            </div>

            <div class="sp-legend">
                <span class="sp-legend-item"><span class="sp-dot sp-dot--selected"></span>Selected</span>
                <span class="sp-legend-item"><span class="sp-dot sp-dot--taken"></span>Taken by another student</span>
                <span class="sp-legend-item"><span class="sp-dot sp-dot--free"></span>Available</span>
            </div>

            <div class="sp-grid" id="spGrid"></div>

            <div class="sp-footer">
                <span class="sp-count" id="spCount"></span>
                <div class="sp-actions">
                    <button class="sp-btn sp-btn--cancel" id="spCancelBtn">Cancel</button>
                    <button class="sp-btn sp-btn--save"   id="spSaveBtn">Save Slots</button>
                </div>
            </div>
            <p class="sp-msg" id="spMsg"></p>
        </div>
    `;

    document.body.appendChild(overlay);

    // ── 4. Render slot grid ──────────────────────────────────────────────────
    const grid  = overlay.querySelector('#spGrid');
    const msg   = overlay.querySelector('#spMsg');
    const count = overlay.querySelector('#spCount');

    const selected = new Set(preSelected);

    function updateCount() {
        count.textContent = `${selected.size} / ${maxSlots} slot${maxSlots > 1 ? 's' : ''} selected`;
    }

    function buildGrid() {
        grid.innerHTML = '';
        ALL_SLOTS.forEach(t => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sp-slot';
            btn.textContent = to12Hr(t);
            btn.dataset.time = t;

            if (takenSlots.has(t)) {
                btn.classList.add('sp-slot--taken');
                btn.disabled = true;
                btn.title = 'Already booked by another student';
            } else if (selected.has(t)) {
                btn.classList.add('sp-slot--selected');
            }

            if (!btn.disabled) {
                btn.addEventListener('click', () => toggleSlot(t, btn));
            }

            grid.appendChild(btn);
        });
    }

    function toggleSlot(t, btn) {
        msg.textContent = '';
        if (selected.has(t)) {
            selected.delete(t);
            btn.classList.remove('sp-slot--selected');
        } else {
            if (selected.size >= maxSlots) {
                msg.textContent = `Max ${maxSlots} slot${maxSlots > 1 ? 's' : ''} allowed. Remove one first.`;
                return;
            }
            selected.add(t);
            btn.classList.add('sp-slot--selected');
        }
        updateCount();
    }

    buildGrid();
    updateCount();

    // ── 5. Animate in ────────────────────────────────────────────────────────
    requestAnimationFrame(() => overlay.classList.add('sp-overlay--active'));

    function close() {
        overlay.classList.remove('sp-overlay--active');
        setTimeout(() => overlay.remove(), 280);
    }

    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('.sp-close').addEventListener('click', close);
    overlay.querySelector('#spCancelBtn').addEventListener('click', close);

    // ── 6. Save ──────────────────────────────────────────────────────────────
    overlay.querySelector('#spSaveBtn').addEventListener('click', async () => {
        if (selected.size === 0) {
            msg.textContent = 'Select at least one slot.';
            return;
        }

        const sorted = [...selected].sort();
        const saveBtn = overlay.querySelector('#spSaveBtn');
        saveBtn.textContent = 'Saving…';
        saveBtn.disabled = true;
        msg.textContent = '';

        try {
            await onSave(sorted);
            close();
        } catch (err) {
            msg.textContent = err.message || 'Failed to save. Try again.';
            saveBtn.textContent = 'Save Slots';
            saveBtn.disabled = false;
        }
    });
}

function to12Hr(t) {
    const [hh, mm] = t.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h = hh % 12 || 12;
    return `${h}:${String(mm).padStart(2,'0')} ${ampm}`;
}
