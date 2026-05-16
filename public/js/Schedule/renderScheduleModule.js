window.renderScheduleModule = function(tableWrap) {
    return async function() {
        tableWrap.innerHTML = `<div class="loading-overlay">Loading schedule...</div>`;

        try {
            const resBranches = await window.api('/api/branches');
            if (!resBranches.success) throw new Error(resBranches.error || "Failed to fetch branches");

            const branches = resBranches.branches;

            tableWrap.innerHTML = `
                <div id="scheduleTabWrapper">
                    <div class="schedule-wrapper">
                        <div class="branch-tabs">
                            ${branches.map((b,i) => `
                                <div class="branch-tab ${i===0?'active':''}" data-branch="${b.branch_name}">
                                    ${b.branch_name}
                                </div>
                            `).join('')}
                        </div>
                        <div class="branch-content">
                            <div class="placeholder">Select a branch to view cars.</div>
                        </div>
                    </div>
                </div>
                <!-- Add Slot Modal -->
                <div id="addSlotOverlay" class="sched-modal-overlay" style="display:none">
                    <div class="sched-modal">
                        <h3 class="sched-modal-title">Add Student to Slot</h3>
                        <div class="sched-modal-info">
                            <span>Car: <strong id="addSlotCar"></strong></span>
                            <span>Time: <strong id="addSlotTime"></strong></span>
                        </div>
                        <div class="sched-modal-field">
                            <label>Student</label>
                            <select id="addSlotStudent">
                                <option value="">— Select student —</option>
                            </select>
                        </div>
                        <div class="sched-modal-field">
                            <label>Instructor</label>
                            <select id="addSlotInstructor">
                                <option value="">— Select instructor —</option>
                            </select>
                        </div>
                        <div class="sched-modal-actions">
                            <button id="addSlotConfirm" class="sched-modal-btn primary">Add Slot</button>
                            <button id="addSlotCancel" class="sched-modal-btn">Cancel</button>
                        </div>
                    </div>
                </div>
            `;

            const branchTabs = tableWrap.querySelectorAll(".branch-tab");

            branchTabs.forEach(tab => {
                tab.addEventListener("click", () => {
                    branchTabs.forEach(t => t.classList.remove("active"));
                    tab.classList.add("active");

                    const selectedBranch = tab.dataset.branch;
                    tableWrap.querySelector(".branch-content").innerHTML = `
                        <div class="content">
                            <div class="day-nav-wrapper">
                                <div class="day-nav">
                                    <button id="prevDay">Previous Day</button>
                                    <span id="currentDay"></span>
                                    <button id="nextDay">Next Day</button>
                                </div>
                                <button id="printScheduleBtn" class="print-btn">Print Schedule</button>
                                <div id="slotStats">
                                    <span class="active-slots">Active Slots: 0</span>
                                    <span class="available-slots">Available Slots: 0</span>
                                </div>
                            </div>
                            <div id="scheduleTableWrap">
                                <div class="loading-overlay">Loading schedule...</div>
                            </div>
                        </div>
                    `;

                    initDayNavigation(selectedBranch);
                });
            });

            if (branchTabs.length > 0) branchTabs[0].click();

            // ── Add Slot Modal helpers ──────────────────────────────────
            let _addSlotPending = null; // { date, time, car_name, branch, branchBookings, refreshFn }

            document.getElementById('addSlotCancel').addEventListener('click', closeAddSlotModal);
            document.getElementById('addSlotOverlay').addEventListener('click', e => {
                if (e.target === document.getElementById('addSlotOverlay')) closeAddSlotModal();
            });
            document.getElementById('addSlotConfirm').addEventListener('click', async () => {
                if (!_addSlotPending) return;
                const studentSel = document.getElementById('addSlotStudent');
                const booking_id = studentSel.value;
                if (!booking_id) return alert('Please select a student');

                const instructor = document.getElementById('addSlotInstructor').value.trim();
                const { date, time, car_name, refreshFn } = _addSlotPending;

                const confirmBtn = document.getElementById('addSlotConfirm');
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Adding…';

                const res = await window.api('/api/schedule-slots', {
                    method: 'POST',
                    body: { booking_id: Number(booking_id), date, time, car_name, instructor_name: instructor }
                });

                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Add Slot';

                if (res.success) {
                    closeAddSlotModal();
                    refreshFn();
                } else {
                    alert(res.error || 'Failed to add slot');
                }
            });

            async function openAddSlotModal({ date, time, car_name, branch, branchBookings, refreshFn }) {
                _addSlotPending = { date, time, car_name, branchBookings, refreshFn };
                document.getElementById('addSlotCar').textContent = car_name;
                document.getElementById('addSlotTime').textContent = to12HourFormat(time);

                const instrSel = document.getElementById('addSlotInstructor');
                instrSel.innerHTML = '<option value="">— Loading… —</option>';
                instrSel.disabled = true;

                const studentSel = document.getElementById('addSlotStudent');
                studentSel.innerHTML = '<option value="">— Select student —</option>';
                branchBookings.forEach(b => {
                    const opt = document.createElement('option');
                    opt.value = b.id;
                    opt.textContent = `${b.customer_name} (${b.present_days}/${b.training_days || 15})`;
                    opt.dataset.instructor = b.instructor_name || '';
                    studentSel.appendChild(opt);
                });

                document.getElementById('addSlotOverlay').style.display = 'flex';

                try {
                    const res = await window.api(`/api/instructors?branch=${encodeURIComponent(branch)}`);
                    const instructors = (res.success ? res.instructors : []).filter(i => i.is_active);
                    instrSel.innerHTML = '<option value="">— Select instructor —</option>';
                    instructors.forEach(i => {
                        const opt = document.createElement('option');
                        opt.value = i.instructor_name;
                        opt.textContent = i.instructor_name;
                        instrSel.appendChild(opt);
                    });
                } catch {
                    instrSel.innerHTML = '<option value="">— Failed to load —</option>';
                }
                instrSel.disabled = false;

                studentSel.onchange = () => {
                    const chosen = studentSel.selectedOptions[0];
                    if (chosen?.dataset.instructor) {
                        instrSel.value = chosen.dataset.instructor;
                    }
                };
            }

            function closeAddSlotModal() {
                document.getElementById('addSlotOverlay').style.display = 'none';
                _addSlotPending = null;
            }

            // ── Day navigation ──────────────────────────────────────────
            async function initDayNavigation(branch) {
                let currentDate = new Date();
                let _latestBranchBookings = [];

                async function renderDay() {
                    document.getElementById("currentDay").innerText = formatDate(currentDate);
                    const dateStr = localDateStr(currentDate);

                    const resCars = await window.api('/api/cars');
                    if (!resCars.success) {
                        document.getElementById("scheduleTableWrap").innerHTML =
                            `<div class="error">${resCars.error}</div>`;
                        return;
                    }

                    const cars = resCars.cars.filter(c => c.branch === branch);
                    if (cars.length === 0) {
                        document.getElementById("scheduleTableWrap").innerHTML =
                            `<div class="empty">No cars for this branch.</div>`;
                        return;
                    }

                    // Generate 30-min timeslots 06:00–22:00
                    const times = [];
                    for (let t = 6*60; t <= 22*60; t += 30) {
                        const hh = String(Math.floor(t/60)).padStart(2,'0');
                        const mm = String(t%60).padStart(2,'0');
                        times.push(`${hh}:${mm}`);
                    }

                    let bookings = [], attendanceRecords = [], adHocSlots = [];

                    try {
                        const [resBookings, resAttendance, resAdHoc] = await Promise.all([
                            window.api('/api/bookings'),
                            window.api('/api/attendance-all'),
                            window.api(`/api/schedule-slots?branch=${encodeURIComponent(branch)}&date=${dateStr}`)
                        ]);
                        bookings         = resBookings?.success  ? resBookings.bookings      : [];
                        attendanceRecords= resAttendance?.success? resAttendance.records      : [];
                        adHocSlots       = resAdHoc?.success     ? resAdHoc.slots             : [];
                    } catch (err) {
                        console.error("API fetch failed:", err);
                    }

                    const attendanceMap = {};
                    attendanceRecords.forEach(r => {
                        if (!attendanceMap[r.booking_id]) attendanceMap[r.booking_id] = {};
                        const dk = new Date(r.date).toISOString().split("T")[0];
                        attendanceMap[r.booking_id][dk] = Number(r.present);
                    });

                    const branchBookings = bookings.filter(b => {
                        if (!b.starting_from) return false;
                        const status = (b.attendance_status || '').trim().toLowerCase();
                        if (!['active', 'pending'].includes(status)) return false;

                        const start = new Date(b.starting_from);
                        const end   = new Date(start);
                        const totalSessions  = Number(b.training_days) || 15;
                        const doneSessions   = Number(b.present_days) || 0;
                        const remaining      = totalSessions - doneSessions;

                        if (remaining < totalSessions / 2) {
                            end.setTime(currentDate.getTime());
                            end.setDate(end.getDate() + remaining + 3);
                        } else {
                            end.setDate(start.getDate() + 29);
                        }

                        const sel = currentDate.getTime();
                        return (
                            b.branch.trim().toLowerCase() === branch.trim().toLowerCase() &&
                            sel >= start.getTime() &&
                            sel <= end.getTime()
                        );
                    });

                    // Build bookedSlots from regular bookings
                    const bookedSlots = {};
                    branchBookings.forEach(b => {
                        if (!b.car_name || !b.allotted_time) return;
                        const car  = b.car_name.trim();
                        const totalDays = Number(b.training_days) || 15;
                        const label = `${b.customer_name || ''} (${b.present_days}/${totalDays})`;

                        const slots = [b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4].filter(Boolean);
                        if (slots.length === 0) return;
                        slots.sort();

                        if (!bookedSlots[car]) bookedSlots[car] = {};

                        const slotMinutes = slots.map(s => {
                            const [h, m] = s.split(':').map(Number);
                            return h*60 + m;
                        });

                        let groups = [], currentGroup = [slotMinutes[0]];
                        for (let i = 1; i < slotMinutes.length; i++) {
                            if (slotMinutes[i] === slotMinutes[i-1] + 30) {
                                currentGroup.push(slotMinutes[i]);
                            } else {
                                groups.push(currentGroup);
                                currentGroup = [slotMinutes[i]];
                            }
                        }
                        groups.push(currentGroup);

                        groups.forEach(group => {
                            group.forEach((min, idx) => {
                                const hh = String(Math.floor(min/60)).padStart(2,'0');
                                const mm = String(min%60).padStart(2,'0');
                                const key = `${hh}:${mm}`;
                                bookedSlots[car][key] = idx === 0
                                    ? {
                                        customer: label,
                                        rowspan: group.length,
                                        instructor_name: b.instructor_name || "N/A",
                                        booking_id: b.id,
                                        mobile_no: b.mobile_no || '',
                                        ad_hoc: false
                                    }
                                    : { skip: true };
                            });
                        });
                    });

                    // Merge ad-hoc slots
                    adHocSlots.forEach(s => {
                        const car = (s.car_name || '').trim();
                        const key = s.time.substring(0,5); // HH:MM
                        if (!bookedSlots[car]) bookedSlots[car] = {};
                        if (!bookedSlots[car][key]) {
                            const totalDays = Number(s.training_days) || 15;
                            bookedSlots[car][key] = {
                                customer: `${s.customer_name} (${s.present_days}/${totalDays})`,
                                rowspan: 1,
                                instructor_name: s.instructor_name || 'N/A',
                                booking_id: s.booking_id,
                                mobile_no: s.mobile_no || '',
                                ad_hoc: true,
                                slot_id: s.id,
                                ad_hoc_present: Number(s.present)
                            };
                        }
                    });

                    // Slot stats
                    let totalSlots = cars.length * times.length;
                    let activeSlots = 0;
                    cars.forEach(car => {
                        const carName = car.car_name.trim();
                        times.forEach(t => {
                            if (bookedSlots[carName]?.[t] && !bookedSlots[carName][t].skip) activeSlots++;
                        });
                    });
                    document.getElementById("slotStats").innerHTML = `
                        <span class="active-slots">Active Slots: ${activeSlots}</span>
                        <span class="available-slots">Available Slots: ${totalSlots - activeSlots}</span>
                    `;

                    // Build table
                    let html = `<table class="schedule-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                ${cars.map(c => `<th>${c.car_name}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${times.map(t => `
                                <tr>
                                    <td class="time-col">${to12HourFormat(t)}</td>
                                    ${cars.map(car => {
                                        const carName = car.car_name.trim();
                                        const slot = bookedSlots[carName]?.[t];
                                        if (slot?.skip) return '';

                                        if (slot) {
                                            const now = new Date();
                                            const slotDateTime = new Date(`${dateStr}T${t}:00`);

                                            // Ad-hoc slots use their own present field; regular slots use attendanceMap
                                            const isPresent = slot.ad_hoc
                                                ? slot.ad_hoc_present > 0
                                                : (attendanceMap[slot.booking_id]?.[dateStr] ?? 0) > 0;

                                            let slotClass = "slot";
                                            if (isPresent) {
                                                slotClass += " slot-present";
                                            } else if (slotDateTime < now) {
                                                slotClass += " slot-absent";
                                            }
                                            if (slot.ad_hoc) slotClass += " slot-adhoc";

                                            const pv = slot.ad_hoc
                                                ? slot.ad_hoc_present
                                                : (attendanceMap[slot.booking_id]?.[dateStr] ?? 0);

                                            return `
                                                <td class="${slotClass}" rowspan="${slot.rowspan}"
                                                    data-booking-id="${slot.booking_id}"
                                                    data-date="${dateStr}"
                                                    data-present="${pv}"
                                                    ${slot.ad_hoc ? `data-slot-id="${slot.slot_id}" data-adhoc="1"` : ''}>
                                                    <div class="slot-content">
                                                        <span class="slot-name">${slot.customer}</span>
                                                        <div class="slot-actions">
                                                            <button class="att-btn att-present" title="Mark Present" data-action="present" ${isPresent ? 'disabled' : ''}>✓</button>
                                                            <button class="att-btn att-absent" title="Mark Absent" data-action="absent" ${!isPresent ? 'disabled' : ''}>✗</button>
                                                            <span class="info-tooltip">
                                                                ℹ
                                                                <span class="tooltip-text">${slot.instructor_name}</span>
                                                            </span>
                                                            ${slot.mobile_no ? `<a class="phone-icon" href="tel:${slot.mobile_no}" title="Call ${slot.mobile_no}" onclick="event.stopPropagation()">📞</a>` : ''}
                                                            ${slot.ad_hoc ? `<button class="att-btn att-remove" title="Remove ad-hoc slot" data-action="remove">✕</button>` : ''}
                                                        </div>
                                                    </div>
                                                </td>`;
                                        }

                                        return `<td class="slot empty-slot"
                                                    data-time="${t}"
                                                    data-car="${carName}"
                                                    data-date="${dateStr}">
                                                    <button class="add-slot-btn" title="Add student to this slot">+</button>
                                                </td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>`;

                    const wrap = document.getElementById("scheduleTableWrap");
                    wrap.innerHTML = html;
                    wrap.style.pointerEvents = ''; // re-enable only after DOM is updated
                    initTooltips();
                    // expose branchBookings to the outer-scope handler
                    _latestBranchBookings = branchBookings;
                }

                document.getElementById("printScheduleBtn").onclick =
                    () => printSchedule(branch, currentDate);

                document.getElementById("prevDay").onclick = () => {
                    currentDate.setDate(currentDate.getDate()-1);
                    renderDay();
                };
                document.getElementById("nextDay").onclick = () => {
                    currentDate.setDate(currentDate.getDate()+1);
                    renderDay();
                };

                await renderDay();

                // ── Event delegation attached ONCE — persists across renderDay() calls ──
                const wrap = document.getElementById("scheduleTableWrap");
                wrap.addEventListener('click', async e => {
                    // Attendance buttons
                    const attBtn = e.target.closest('.att-btn');
                    if (attBtn) {
                        const td = attBtn.closest('td[data-booking-id]');
                        if (!td) return;
                        const bookingId = td.dataset.bookingId;
                        const date      = td.dataset.date;
                        const action    = attBtn.dataset.action;

                        if (action === 'remove') {
                            const slotId = td.dataset.slotId;
                            if (!slotId) return;
                            if (!confirm('Remove this ad-hoc slot?')) return;
                            wrap.style.pointerEvents = 'none';
                            const r = await window.api(`/api/schedule-slots/${slotId}`, { method: 'DELETE' });
                            if (r.success) await renderDay();
                            else { wrap.style.pointerEvents = ''; alert(r.error || 'Failed to remove slot'); }
                            return;
                        }

                        wrap.style.pointerEvents = 'none';
                        let r;
                        if (td.dataset.adhoc === '1') {
                            // Ad-hoc slots have independent attendance in schedule_slots.present
                            const slotId = td.dataset.slotId;
                            r = await window.api(`/api/schedule-slots/${slotId}/present`, {
                                method: 'PATCH',
                                body: { present: action === 'present' ? 1 : 0 }
                            });
                        } else {
                            const newValue = action === 'present' ? 1 : 0;
                            r = await window.api(`/api/attendance/${bookingId}`, {
                                method: 'POST',
                                body: { date, value: newValue }
                            });
                        }
                        if (r.success) {
                            await renderDay();
                        } else {
                            wrap.style.pointerEvents = '';
                            alert(r.error || 'Failed to update attendance');
                        }
                        return;
                    }

                    // Add slot "+" button
                    const addBtn = e.target.closest('.add-slot-btn');
                    if (addBtn) {
                        const td = addBtn.closest('td.empty-slot');
                        if (!td) return;
                        openAddSlotModal({
                            date:     td.dataset.date,
                            time:     td.dataset.time,
                            car_name: td.dataset.car,
                            branch,
                            branchBookings: _latestBranchBookings,
                            refreshFn: renderDay
                        });
                    }
                });
            }

            function formatDate(d) {
                return `${String(d.getDate()).padStart(2,'0')}/` +
                       `${String(d.getMonth()+1).padStart(2,'0')}/` +
                       `${d.getFullYear()}`;
            }

            function localDateStr(d) {
                return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            }

        } catch(err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
        }
    };
};

if (typeof window.registerScheduleModule === "function") {
    window.registerScheduleModule(window.renderScheduleModule);
}

function initTooltips() {
    document.querySelectorAll('.info-tooltip').forEach(icon => {
        icon.addEventListener('click', e => {
            e.stopPropagation();
            icon.classList.toggle('active');
        });
    });
    document.addEventListener('click', () => {
        document.querySelectorAll('.info-tooltip.active')
            .forEach(icon => icon.classList.remove('active'));
    });
}

function to12HourFormat(time24) {
    let [hh, mm] = time24.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12;
    if (hh === 0) hh = 12;
    return `${hh}:${String(mm).padStart(2,'0')} ${ampm}`;
}

function printSchedule(branch, date) {
    const scheduleTable = document.getElementById("scheduleTableWrap").innerHTML;
    const dateStr = `${String(date.getDate()).padStart(2,'0')}/` +
                    `${String(date.getMonth()+1).padStart(2,'0')}/` +
                    `${date.getFullYear()}`;
    const printWindow = window.open('', '', 'width=900,height=700');
    printWindow.document.write(`
        <html>
        <head>
            <title>Schedule - ${branch} (${dateStr})</title>
            <style>
                body { font-family: Arial; padding: 10px; }
                table { width: 100%; border-collapse: collapse; }
                th, td { border: 1px solid #000; padding: 6px 8px; text-align: center; }
                th { background: #f3f3f3; font-weight: bold; }
                .slot-present { background: #dcfce7 !important; }
                .slot-absent  { background: #fee2e2 !important; }
                .slot-adhoc   { border: 2px dashed #38bdf8 !important; }
                /* Hide interactive elements */
                .att-btn, .add-slot-btn, .adhoc-badge,
                .slot-actions, .info-tooltip, .phone-icon { display: none !important; }
                .slot-content { display: block; }
                .slot-name { font-weight: 600; font-size: 12px; }
            </style>
        </head>
        <body>
            <h2>Schedule - ${branch}</h2>
            <div><strong>Date:</strong> ${dateStr}</div><br>
            ${scheduleTable}
        </body>
        </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
}
