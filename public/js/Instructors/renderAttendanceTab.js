window.renderAttendanceTab = function (container) {
    return async function () {

        function fmtDT(str) {
            if (!str) return '—';
            return new Intl.DateTimeFormat('en-IN', {
                timeZone: 'Asia/Kolkata',
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', hour12: true,
            }).format(new Date(str));
        }

        function fmtDate(str) {
            if (!str) return '—';
            const [y, m, d] = str.split('-');
            const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            return `${parseInt(d, 10)} ${months[parseInt(m, 10) - 1]} ${y}`;
        }

        function fmtDur(mins) {
            if (mins == null || mins === '') return '—';
            const m = Math.round(Number(mins));
            if (m < 60) return `${m} min`;
            return `${Math.floor(m / 60)}h ${m % 60}m`;
        }

        const pad = n => String(n).padStart(2, '0');
        const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        const toDate   = new Date();
        const fromDate = new Date(toDate);

        // Load instructors for filter
        const resInst = await window.api('/api/instructors').catch(() => ({ instructors: [] }));
        const instructors = (resInst?.instructors || [])
            .filter(i => i.is_active && (i.role || '').toLowerCase() === 'instructor');

        container.innerHTML = `
            <div id="mgrRosterWrap" style="margin-bottom:22px;"></div>
            <div id="instRosterWrap" style="margin-bottom:22px;"></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-bottom:18px;">
                <div>
                    <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:4px">From</label>
                    <input type="date" id="attDateFrom" value="${isoDate(fromDate)}"
                        style="border:1px solid #d1d5db;border-radius:6px;padding:7px 10px;font-size:13px">
                </div>
                <div>
                    <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:4px">To</label>
                    <input type="date" id="attDateTo" value="${isoDate(toDate)}"
                        style="border:1px solid #d1d5db;border-radius:6px;padding:7px 10px;font-size:13px">
                </div>
                <div>
                    <label style="display:block;font-size:12px;color:#6b7280;margin-bottom:4px">Instructor</label>
                    <select id="attInstructor"
                        style="border:1px solid #d1d5db;border-radius:6px;padding:7px 10px;font-size:13px;background:#fff">
                        <option value="">All Instructors</option>
                        ${instructors.map(i => `<option value="${i.id}">${i.instructor_name}</option>`).join('')}
                    </select>
                </div>
                <button id="attApply"
                    style="padding:7px 18px;background:#185fa5;color:#fff;border:none;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer">
                    Apply
                </button>
                <button id="attClear"
                    style="padding:7px 14px;background:#f3f4f6;color:#374151;border:1px solid #d1d5db;border-radius:6px;font-size:13px;cursor:pointer">
                    Clear
                </button>
            </div>
            <div id="attSummary"></div>
            <div id="attTable"></div>
        `;

        async function loadData() {
            const from   = document.getElementById('attDateFrom')?.value || isoDate(fromDate);
            const to     = document.getElementById('attDateTo')?.value   || isoDate(toDate);
            const instId = document.getElementById('attInstructor')?.value || '';
            const summaryEl = document.getElementById('attSummary');
            const tableEl   = document.getElementById('attTable');
            if (!summaryEl || !tableEl) return;

            tableEl.innerHTML = `<div style="padding:20px;color:#6b7280">Loading…</div>`;

            const params = new URLSearchParams({ date_from: from, date_to: to });
            if (instId) params.set('instructor_id', instId);

            const res = await window.api(`/api/admin/instructor-attendance?${params}`).catch(() => ({ success: false, records: [] }));
            const records = res?.success ? (res.records || []) : [];

            const total     = records.length;
            const active    = records.filter(r => !r.clock_out).length;
            const completed = total - active;
            const totalMins = records.filter(r => r.clock_out).reduce((s, r) => s + Number(r.duration_mins || 0), 0);
            const avgMins   = completed > 0 ? Math.round(totalMins / completed) : null;

            summaryEl.innerHTML = `
                <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:18px;">
                    ${[
                        { label: 'Total Records',   value: total,           color: '#1e3a5f' },
                        { label: 'Currently In',    value: active,          color: '#16a34a' },
                        { label: 'Completed',       value: completed,       color: '#374151' },
                        { label: 'Avg Duration',    value: avgMins != null ? fmtDur(avgMins) : '—', color: '#185fa5' },
                    ].map(c => `
                        <div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px 20px;min-width:120px;text-align:center">
                            <div style="font-size:22px;font-weight:700;color:${c.color}">${c.value}</div>
                            <div style="font-size:12px;color:#6b7280;margin-top:2px">${c.label}</div>
                        </div>
                    `).join('')}
                </div>
            `;

            if (!total) {
                tableEl.innerHTML = `
                    <div style="padding:32px;text-align:center;color:#6b7280;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb">
                        No attendance records found for the selected range.
                    </div>`;
                return;
            }

            tableEl.innerHTML = `
                <div style="overflow-x:auto">
                    <table class="bookings-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Instructor</th>
                                <th>Clock In</th>
                                <th>Clock Out</th>
                                <th>Duration</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${records.map(r => `
                                <tr>
                                    <td>${fmtDate(r.date)}</td>
                                    <td><strong>${r.instructor_name || '—'}</strong></td>
                                    <td>${fmtDT(r.clock_in)}</td>
                                    <td>${r.clock_out ? fmtDT(r.clock_out) : '<span style="color:#92400e;font-weight:600">Still in</span>'}</td>
                                    <td>${fmtDur(r.duration_mins)}</td>
                                    <td>
                                        ${r.clock_out
                                            ? '<span class="status-badge status-active">Completed</span>'
                                            : '<span class="status-badge status-hold">Clocked In</span>'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
        }

        async function loadRoster(role, title, wrapId, onlyActive) {
            const wrap = document.getElementById(wrapId);
            if (!wrap) return;
            wrap.innerHTML = `<div style="padding:16px;color:#6b7280">Loading today's ${role} attendance…</div>`;

            const res = await window.api(`/api/admin/attendance-roster?role=${role}`).catch(() => ({ success: false, roster: [] }));
            let roster = res?.success ? (res.roster || []) : [];
            if (onlyActive) roster = roster.filter(r => r.status === 'Clocked In');

            if (!roster.length) {
                wrap.innerHTML = '';
                return;
            }

            const statusStyle = {
                'Clocked In':     { bg: '#dcfce7', color: '#16a34a', label: 'Clocked In' },
                'Clocked Out':    { bg: '#e5e7eb', color: '#374151', label: 'Clocked Out' },
                'Not Clocked In': { bg: '#fee2e2', color: '#dc2626', label: 'Not Clocked In' },
            };

            wrap.innerHTML = `
                <h3 style="font-size:14px;font-weight:700;color:#1e3a5f;margin:0 0 10px">${title}</h3>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                    ${roster.map(r => {
                        const st = statusStyle[r.status] || statusStyle['Not Clocked In'];
                        return `
                            <div style="background:#fff;border:1px solid #e5e7eb;border-radius:8px;padding:10px 16px;min-width:180px">
                                <div style="font-weight:600;font-size:13px;color:#111827">${r.name || '—'}</div>
                                <div style="font-size:11px;color:#6b7280;margin:2px 0 6px">${r.branch || ''}</div>
                                <span style="display:inline-block;font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;background:${st.bg};color:${st.color}">
                                    ${st.label}${r.clock_in ? ' · ' + fmtDT(r.clock_in).split(', ').pop() : ''}
                                </span>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        container.querySelector('#attApply')?.addEventListener('click', loadData);
        container.querySelector('#attClear')?.addEventListener('click', () => {
            document.getElementById('attDateFrom').value   = isoDate(fromDate);
            document.getElementById('attDateTo').value     = isoDate(toDate);
            document.getElementById('attInstructor').value = '';
            loadData();
        });

        await Promise.all([
            loadRoster('manager', "Today's Manager Attendance", 'mgrRosterWrap'),
            loadRoster('instructor', "Today's Instructor Attendance", 'instRosterWrap', true),
        ]);
        await loadData();
    };
};
