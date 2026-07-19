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
                <!-- Replace Slot Modal -->
                <div id="replaceSlotOverlay" class="sched-modal-overlay" style="display:none">
                    <div class="sched-modal">
                        <h3 class="sched-modal-title">Replace Slot for Today</h3>
                        <div class="sched-modal-info">
                            <span>Replacing: <strong id="replaceSlotOriginal"></strong></span>
                            <span>Time: <strong id="replaceSlotTime"></strong></span>
                        </div>
                        <div class="sched-modal-field">
                            <label>Replacement Student</label>
                            <select id="replaceSlotStudent">
                                <option value="">— Select student —</option>
                            </select>
                        </div>
                        <div class="sched-modal-field">
                            <label>Instructor</label>
                            <select id="replaceSlotInstructor">
                                <option value="">— Select instructor —</option>
                            </select>
                        </div>
                        <div class="sched-modal-actions">
                            <button id="replaceSlotConfirm" class="sched-modal-btn primary">Replace</button>
                            <button id="replaceSlotCancel" class="sched-modal-btn">Cancel</button>
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
                            <div id="instructorChips" class="instructor-chips"></div>
                            <div id="scheduleTableWrap">
                                <div class="loading-overlay">Loading schedule...</div>
                            </div>
                        </div>
                        <!-- Instructor Schedule Modal -->
                        <div id="instrSchedOverlay" class="instr-sched-overlay" style="display:none">
                            <div class="instr-sched-modal">
                                <div class="instr-sched-header">
                                    <div class="instr-sched-header-left">
                                        <div class="instr-sched-avatar" id="instrSchedAvatar"></div>
                                        <div>
                                            <h3 id="instrSchedName"></h3>
                                            <p id="instrSchedDate"></p>
                                        </div>
                                    </div>
                                    <button id="instrSchedClose" class="instr-sched-close">&times;</button>
                                </div>
                                <div id="instrSchedBody"></div>
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
                    const instructors = (res.success ? res.instructors : []).filter(i => i.is_active && (i.role || '').toLowerCase() === 'instructor');
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

            // ── Replace Slot Modal ──────────────────────────────────────
            let _replaceSlotPending = null;

            document.getElementById('replaceSlotCancel').addEventListener('click', closeReplaceSlotModal);
            document.getElementById('replaceSlotOverlay').addEventListener('click', e => {
                if (e.target === document.getElementById('replaceSlotOverlay')) closeReplaceSlotModal();
            });
            document.getElementById('replaceSlotConfirm').addEventListener('click', async () => {
                if (!_replaceSlotPending) return;
                const studentSel = document.getElementById('replaceSlotStudent');
                const replacement_booking_id = studentSel.value;
                if (!replacement_booking_id) return alert('Please select a replacement student');

                const instructor = document.getElementById('replaceSlotInstructor').value.trim();
                const { date, time, car_name, original_booking_id, original_time, refreshFn } = _replaceSlotPending;

                const confirmBtn = document.getElementById('replaceSlotConfirm');
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Replacing…';

                try {
                    // Mark original as absent for this date+time
                    await window.api(`/api/attendance/${original_booking_id}`, {
                        method: 'POST',
                        body: { date, time: original_time, value: 0 }
                    });
                    // Add ad-hoc slot for replacement student
                    const res = await window.api('/api/schedule-slots', {
                        method: 'POST',
                        body: { booking_id: Number(replacement_booking_id), date, time, car_name, instructor_name: instructor }
                    });
                    if (!res.success) throw new Error(res.error || 'Failed to add replacement slot');
                    closeReplaceSlotModal();
                    refreshFn();
                } catch (err) {
                    alert(err.message || 'Failed to replace slot');
                } finally {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Replace';
                }
            });

            async function openReplaceSlotModal({ date, time, car_name, branch, original_booking_id, original_customer, original_time, branchBookings, refreshFn }) {
                _replaceSlotPending = { date, time, car_name, original_booking_id, original_time, refreshFn };
                document.getElementById('replaceSlotOriginal').textContent = original_customer;
                document.getElementById('replaceSlotTime').textContent = to12HourFormat(time);

                const instrSel = document.getElementById('replaceSlotInstructor');
                instrSel.innerHTML = '<option value="">— Loading… —</option>';
                instrSel.disabled = true;

                const studentSel = document.getElementById('replaceSlotStudent');
                studentSel.innerHTML = '<option value="">— Select student —</option>';
                branchBookings
                    .filter(b => b.id !== original_booking_id)
                    .forEach(b => {
                        const opt = document.createElement('option');
                        opt.value = b.id;
                        opt.textContent = `${b.customer_name} (${b.present_days}/${b.training_days || 15})`;
                        opt.dataset.instructor = b.instructor_name || '';
                        studentSel.appendChild(opt);
                    });

                document.getElementById('replaceSlotOverlay').style.display = 'flex';

                try {
                    const res = await window.api(`/api/instructors?branch=${encodeURIComponent(branch)}`);
                    const instructors = (res.success ? res.instructors : []).filter(i => i.is_active && (i.role || '').toLowerCase() === 'instructor');
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
                    if (chosen?.dataset.instructor) instrSel.value = chosen.dataset.instructor;
                };
            }

            function closeReplaceSlotModal() {
                document.getElementById('replaceSlotOverlay').style.display = 'none';
                _replaceSlotPending = null;
            }

            // ── Day navigation ──────────────────────────────────────────
            async function initDayNavigation(branch) {
                let currentDate = new Date();
                let _latestBranchBookings = [];
                let _currentView = 'car'; // 'car' | 'instructor'

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
                        if (!attendanceMap[r.booking_id][dk]) attendanceMap[r.booking_id][dk] = {};
                        const tk = (r.time || '').substring(0, 5);
                        attendanceMap[r.booking_id][dk][tk] = Number(r.present);
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

                        if (remaining <= 0) return false;

                        if (remaining < totalSessions / 2) {
                            // Use today's real date, not the viewed date, so the window
                            // doesn't slide forward as you navigate the calendar
                            const today = new Date();
                            today.setHours(23, 59, 59, 999);
                            end.setTime(today.getTime());
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

                    // Also include completed bookings that were present on this specific date
                    const completedOnDate = bookings.filter(b => {
                        const status = (b.attendance_status || '').trim().toLowerCase();
                        if (status !== 'completed') return false;
                        if (!b.car_name) return false;
                        if ((b.branch || '').trim().toLowerCase() !== branch.trim().toLowerCase()) return false;
                        const dayMap = attendanceMap[b.id]?.[dateStr];
                        return dayMap && Object.values(dayMap).some(v => Number(v) === 1);
                    }).map(b => ({ ...b, completed: true }));

                    const allBranchBookings = [...branchBookings, ...completedOnDate];

                    // Build bookedSlots from regular bookings
                    const bookedSlots = {};
                    allBranchBookings.forEach(b => {
                        if (!b.car_name || !b.allotted_time) return;
                        const car  = b.car_name.trim();
                        const totalDays = Number(b.training_days) || 15;
                        const label = `${b.customer_name || ''} (${b.present_days}/${totalDays})`;

                        const slots = [b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4].filter(Boolean);
                        if (slots.length === 0) return;

                        if (!bookedSlots[car]) bookedSlots[car] = {};

                        slots.forEach(s => {
                            const key = s.substring(0, 5); // HH:MM
                            bookedSlots[car][key] = {
                                customer: label,
                                rowspan: 1,
                                instructor_name: b.instructor_name || "N/A",
                                booking_id: b.id,
                                mobile_no: b.mobile_no || '',
                                ad_hoc: false,
                                completed: !!b.completed
                            };
                        });
                    });

                    // Merge ad-hoc slots
                    adHocSlots.forEach(s => {
                        const car = (s.car_name || '').trim();
                        const key = s.time.substring(0,5); // HH:MM
                        if (!bookedSlots[car]) bookedSlots[car] = {};
                        const totalDays = Number(s.training_days) || 15;
                        const adHocEntry = {
                            customer: `${s.customer_name} (${s.present_days}/${totalDays})`,
                            rowspan: 1,
                            instructor_name: s.instructor_name || 'N/A',
                            booking_id: s.booking_id,
                            mobile_no: s.mobile_no || '',
                            ad_hoc: true,
                            slot_id: s.id,
                            ad_hoc_present: Number(s.present)
                        };
                        const existing = bookedSlots[car][key];
                        if (existing && !existing.ad_hoc) {
                            // Regular slot already here — override only if original is absent (replacement)
                            const existingDayMap = attendanceMap[existing.booking_id]?.[dateStr];
                            const existingPv = existingDayMap?.[key] ?? existingDayMap?.[''] ?? null;
                            if (existingPv === 0) {
                                adHocEntry.replacedCustomer = existing.customer.split(' (')[0];
                                bookedSlots[car][key] = adHocEntry;
                            }
                        } else if (!existing) {
                            bookedSlots[car][key] = adHocEntry;
                        }
                    });

                    // Inject historical attendance entries for bookings whose slot time changed
                    allBranchBookings.forEach(b => {
                        const car = (b.car_name || '').trim();
                        if (!car) return;
                        const currentSlots = [b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4]
                            .filter(Boolean).map(s => s.substring(0, 5));
                        const dayMap = attendanceMap[b.id]?.[dateStr] || {};
                        Object.keys(dayMap).forEach(time => {
                            if (!time || currentSlots.includes(time)) return;
                            if (!bookedSlots[car]) bookedSlots[car] = {};
                            if (bookedSlots[car][time]) return;
                            const totalDays = Number(b.training_days) || 15;
                            bookedSlots[car][time] = {
                                customer: `${b.customer_name || ''} (${b.present_days}/${totalDays})`,
                                rowspan: 1,
                                instructor_name: b.instructor_name || 'N/A',
                                booking_id: b.id,
                                mobile_no: b.mobile_no || '',
                                ad_hoc: false,
                                historical: true
                            };
                        });
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

                                            // Ad-hoc: own present field. Regular: look up by time, fall back to null (no record)
                                            const dayMap = attendanceMap[slot.booking_id]?.[dateStr];
                                            const slotPv = slot.ad_hoc
                                                ? slot.ad_hoc_present
                                                : (dayMap?.[t] ?? dayMap?.[''] ?? null);
                                            const isPresent = slotPv != null && slotPv > 0;
                                            const isAbsent  = slotPv != null && slotPv === 0;

                                            let slotClass = "slot";
                                            if (isPresent) {
                                                slotClass += " slot-present";
                                            } else if (isAbsent) {
                                                slotClass += " slot-absent";
                                            }
                                            if (slot.ad_hoc) slotClass += " slot-adhoc";
                                            if (slot.historical) slotClass += " slot-historical";
                                            if (slot.completed) slotClass += " slot-completed";

                                            return `
                                                <td class="${slotClass}" rowspan="${slot.rowspan}"
                                                    data-booking-id="${slot.booking_id}"
                                                    data-date="${dateStr}"
                                                    data-time="${t}"
                                                    data-car="${carName}"
                                                    data-present="${slotPv ?? ''}"
                                                    ${slot.ad_hoc ? `data-slot-id="${slot.slot_id}" data-adhoc="1"` : ''}>
                                                    <div class="slot-content">
                                                        <span class="slot-name">${slot.customer}</span>
                                                        <span class="slot-instructor">${slot.instructor_name && slot.instructor_name !== 'N/A' ? slot.instructor_name : ''}</span>
                                                        <div class="slot-actions">
                                                            ${!slot.completed ? `
                                                            <button class="att-btn att-present" title="Mark Present" data-action="present" ${isPresent ? 'disabled' : ''}>✓</button>
                                                            <button class="att-btn att-absent" title="Mark Absent" data-action="absent" ${isAbsent ? 'disabled' : ''}>✗</button>
                                                            ` : ''}
                                                            ${!slot.ad_hoc && !slot.historical && !slot.completed ? `<button class="att-btn att-replace" title="Replace for today" data-action="replace">⇄</button>` : ''}
                                                            <span class="info-tooltip">
                                                                ℹ
                                                                <span class="tooltip-text">${slot.instructor_name}</span>
                                                            </span>
                                                            ${slot.mobile_no ? `<a class="phone-icon" href="tel:${slot.mobile_no}" title="Call ${slot.mobile_no}" onclick="event.stopPropagation()">📞</a>` : ''}
                                                            ${slot.ad_hoc ? `<button class="att-btn att-remove" title="Remove ad-hoc slot" data-action="remove">✕</button>` : ''}
                                                        </div>
                                                        ${slot.replacedCustomer ? `<span class="slot-replaced-label">↩ ${slot.replacedCustomer}</span>` : ''}
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

                    // ── Upcoming bookings table (starts in the future) ──
                    const upcomingBookings = bookings.filter(b => {
                        if (!b.starting_from) return false;
                        if ((b.branch || '').trim().toLowerCase() !== branch.trim().toLowerCase()) return false;
                        const status = (b.attendance_status || '').trim().toLowerCase();
                        if (status !== 'pending') return false;
                        const startDate = new Date(b.starting_from);
                        startDate.setHours(0, 0, 0, 0);
                        const today = new Date();
                        today.setHours(0, 0, 0, 0);
                        return startDate > today;
                    }).sort((a, b) => new Date(a.starting_from) - new Date(b.starting_from));

                    if (upcomingBookings.length > 0) {
                        const upcomingHtml = `
                            <div class="upcoming-bookings-wrap">
                                <h3 class="upcoming-bookings-title">Upcoming Bookings</h3>
                                <table class="upcoming-bookings-table">
                                    <thead>
                                        <tr>
                                            <th>Student</th>
                                            <th>Car</th>
                                            <th>Slots</th>
                                            <th>Instructor</th>
                                            <th>Starts On</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${upcomingBookings.map(b => {
                                            const slots = [b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4]
                                                .filter(Boolean)
                                                .map(t => to12HourFormat(t.substring(0, 5)))
                                                .join(', ');
                                            const startStr = new Date(b.starting_from).toLocaleDateString('en-IN', {
                                                day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata'
                                            });
                                            return `<tr>
                                                <td><a href="details.html?id=${b.id}" style="color:inherit;text-decoration:none;font-weight:600;">${b.customer_name || '-'}</a></td>
                                                <td>${b.car_name || '-'}</td>
                                                <td>${slots || '-'}</td>
                                                <td>${b.instructor_name || '-'}</td>
                                                <td>${startStr}</td>
                                            </tr>`;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>`;
                        html += upcomingHtml;
                    }

                    // ── Build per-instructor slot map for modal ──────────
                    const instrSlotMap = {};
                    [...allBranchBookings].forEach(b => {
                        const instr = (b.instructor_name || '').trim();
                        if (!instr) return;
                        if (!instrSlotMap[instr]) instrSlotMap[instr] = [];
                        const slots = [b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4].filter(Boolean);
                        const totalDays = Number(b.training_days) || 15;
                        const dayMap = attendanceMap[b.id]?.[dateStr];
                        slots.forEach(s => {
                            const key = s.substring(0, 5);
                            const pv = dayMap?.[key] ?? null;
                            instrSlotMap[instr].push({
                                time: key,
                                customer: b.customer_name || '',
                                progress: `${b.present_days}/${totalDays}`,
                                booking_id: b.id,
                                present: pv
                            });
                        });
                    });
                    adHocSlots.forEach(s => {
                        const instr = (s.instructor_name || '').trim();
                        if (!instr) return;
                        if (!instrSlotMap[instr]) instrSlotMap[instr] = [];
                        instrSlotMap[instr].push({
                            time: s.time.substring(0, 5),
                            customer: s.customer_name || '',
                            progress: 'Ad-hoc',
                            booking_id: s.booking_id,
                            present: Number(s.present)
                        });
                    });

                    // ── Populate instructor cards ────────────────────────
                    const instrRes = await window.api(`/api/instructors?branch=${encodeURIComponent(branch)}`);
                    const instructors = (instrRes.success ? instrRes.instructors : [])
                        .filter(i => i.is_active && (i.role || '').toLowerCase() === 'instructor');

                    const chipsEl = document.getElementById('instructorChips');
                    if (chipsEl) {
                        if (instructors.length) {
                            const initials = name => name.trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();
                            chipsEl.innerHTML = `
                                <div class="instr-section-label">Instructors</div>
                                <div class="instr-cards-row">
                                ${instructors.map(i => {
                                    const busy = (instrSlotMap[i.instructor_name] || []).length;
                                    const statusClass = busy ? 'instr-card--busy' : 'instr-card--free';
                                    const statusText  = busy ? `${busy} session${busy !== 1 ? 's' : ''}` : 'Free today';
                                    return `<button class="instr-card ${statusClass}" data-name="${i.instructor_name}">
                                        <span class="instr-card-avatar">${initials(i.instructor_name)}</span>
                                        <span class="instr-card-info">
                                            <span class="instr-card-name">${i.instructor_name}</span>
                                            <span class="instr-card-status">${statusText}</span>
                                        </span>
                                    </button>`;
                                }).join('')}
                                </div>`;
                        } else {
                            chipsEl.innerHTML = '<span class="instr-section-empty">No active instructors for this branch</span>';
                        }
                        chipsEl._slotMap = instrSlotMap;
                        chipsEl._dateStr = formatDate(currentDate);
                    }

                    const wrap = document.getElementById("scheduleTableWrap");
                    wrap.innerHTML = html;
                    wrap.style.pointerEvents = '';
                    initTooltips();
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

                // ── Instructor card click → show schedule modal ──────
                document.getElementById('instructorChips').addEventListener('click', e => {
                    const chip = e.target.closest('.instr-card');
                    if (!chip) return;
                    const name = chip.dataset.name;
                    const chipsEl = document.getElementById('instructorChips');
                    const slotMap = chipsEl._slotMap || {};
                    const dateStr = chipsEl._dateStr || '';
                    const slots = (slotMap[name] || []).sort((a, b) => a.time.localeCompare(b.time));

                    document.getElementById('instrSchedName').textContent = name;
                    document.getElementById('instrSchedDate').textContent = dateStr;
                    const av = document.getElementById('instrSchedAvatar');
                    if (av) av.textContent = name.trim().split(/\s+/).map(w => w[0]).join('').substring(0, 2).toUpperCase();

                    const body = document.getElementById('instrSchedBody');
                    if (slots.length === 0) {
                        body.innerHTML = `<div class="instr-sched-empty">
                            <div class="instr-sched-empty-icon">🎉</div>
                            <div>Free all day — no sessions scheduled</div>
                        </div>`;
                    } else {
                        body.innerHTML = `<div class="instr-sched-sessions">
                            ${slots.map((s, idx) => {
                                const presentClass = s.present === 1 ? 'iss-present' : s.present === 0 ? 'iss-absent' : 'iss-unmarked';
                                const presentLabel = s.present === 1 ? 'Present' : s.present === 0 ? 'Absent' : 'Not marked';
                                const presentIcon  = s.present === 1 ? '✓' : s.present === 0 ? '✗' : '–';
                                return `<div class="instr-sched-session ${presentClass}">
                                    <div class="iss-num">${idx + 1}</div>
                                    <div class="iss-time">${to12HourFormat(s.time)}</div>
                                    <div class="iss-info">
                                        <a href="details.html?id=${s.booking_id}" class="iss-name">${s.customer}</a>
                                        <span class="iss-progress">${s.progress}</span>
                                    </div>
                                    <div class="iss-badge ${presentClass}">${presentIcon} ${presentLabel}</div>
                                </div>`;
                            }).join('')}
                        </div>`;
                    }

                    document.getElementById('instrSchedOverlay').style.display = 'flex';
                });

                document.getElementById('instrSchedClose').addEventListener('click', () => {
                    document.getElementById('instrSchedOverlay').style.display = 'none';
                });
                document.getElementById('instrSchedOverlay').addEventListener('click', e => {
                    if (e.target === document.getElementById('instrSchedOverlay'))
                        document.getElementById('instrSchedOverlay').style.display = 'none';
                });

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

                        if (action === 'replace') {
                            const customerName = td.querySelector('.slot-name')?.textContent?.split(' (')[0] || 'Student';
                            openReplaceSlotModal({
                                date:                td.dataset.date,
                                time:                td.dataset.time,
                                car_name:            td.dataset.car,
                                branch,
                                original_booking_id: Number(td.dataset.bookingId),
                                original_customer:   customerName,
                                original_time:       td.dataset.time,
                                branchBookings:      _latestBranchBookings,
                                refreshFn:           renderDay
                            });
                            return;
                        }

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

                        // Password required only when undoing a present mark (present → absent)
                        if (action === 'absent' && td.dataset.present !== '' && Number(td.dataset.present) > 0) {
                            const pwd = prompt('Enter password to change attendance:');
                            if (pwd !== '1234') {
                                alert('Incorrect password.');
                                return;
                            }
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
                                body: { date, time: td.dataset.time || '', value: newValue }
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
                        return;
                    }

                });
            }

            function formatDate(d) {
                const parts = new Intl.DateTimeFormat('en-IN', {
                    timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
                }).formatToParts(d);
                const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
                return `${v.day}/${v.month}/${v.year}`;
            }

            function localDateStr(d) {
                return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
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
    const dateStr = date.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' });
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
                .slot-adhoc      { border: 2px dashed #38bdf8 !important; }
                .slot-historical { border: 2px dashed #f59e0b !important; }
                /* Hide interactive elements */
                .att-btn, .add-slot-btn, .adhoc-badge,
                .slot-actions, .info-tooltip, .phone-icon { display: none !important; }
                .slot-content { display: block; }
                .slot-name { font-weight: 600; font-size: 12px; }
                .slot-instructor { display: block; font-size: 11px; color: #555; margin-top: 2px; }
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
