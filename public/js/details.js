import {
    downloadCertificate,
    uploadCertificate,
} from "./globals/certificates.js";
import { openSlotPicker } from "./globals/slotPicker.js";

(async () => {
    await window.CommonReady;

    const detailsTable = document.getElementById('detailsTable');
    const editBtn = document.getElementById('editBtn');
    const saveBtn = document.getElementById('saveBtn');
    const backBtn = document.getElementById('backBtn');
    const attendanceBtn = document.getElementById('attendanceBtn');

    const REQUIRED_FIELDS = [
        "branch",
        "training_days",
        "car_name",
        "customer_name",
        "address",
        "pincode",
        "mobile_no",
        "whatsapp_no",
        "sex",
        "birth_date",
        "email",
        "occupation",
        "starting_from",
        "total_fees",
        "advance",
        "instructor_name"
    ];

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    if (!id) {
        detailsTable.innerHTML = `<tr><td colspan="2" class="error">No booking selected.</td></tr>`;
        return;
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const time = d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
        return `${date} ${time}`;
    }

    backBtn.addEventListener('click', () => window.location.href = 'admin.html');

    let booking = null;

    // =========================
    // LOAD BOOKING
    // =========================
    async function loadBooking() {
        try {
            const res = await window.api(`/api/bookings/${id}`);
            if (!res.success) throw new Error(res.error || 'Failed to fetch booking');
            booking = res.booking;
            if (!booking) {
                detailsTable.innerHTML = `<tr><td colspan="2" class="error">Booking not found.</td></tr>`;
                return;
            }

            const attRes = await window.api(`/api/attendance/${booking.id}`);
            const existingAttendance = attRes.records || [];

            detailsTable.innerHTML = '';

            // ------------------- Build Booking Rows -------------------
            detailsTable.insertAdjacentHTML("beforeend", `
                <tr>
                    <th>ID</th>
                    <td>${booking.id}</td>
                </tr>
                <tr>
                    <th>Attendance Status</th>
                    <td class="status-${booking.attendance_status.toLowerCase()}" data-key="attendance_status">
                        ${booking.attendance_status}
                    </td>
                </tr>
                <tr>
                    <th>Slots</th>
                    <td>${booking.present_days} / ${booking.training_days}</td>
                </tr>
                <tr>
                    <th>Hold Status</th>
                    <td data-key="hold_status" class="${booking.hold_status ? 'status-hold' : ''}">
                        ${booking.hold_status ? 'Yes' : 'No'}
                    </td>
                </tr>
                <tr>
                    <th>Hold From</th>
                    <td>${booking.hold_from ? formatDate(booking.hold_from) : '-'}</td>
                </tr>
                <tr>
                    <th>Resume From</th>
                    <td>${booking.resume_from ? formatDate(booking.resume_from) : '-'}</td>
                </tr>
                <tr>
                    <th>Extended Days</th>
                    <td>${booking.extended_days || 0}</td>
                </tr>
                <tr>
                    <th>Created At</th>
                    <td>${booking.created_at ? formatDateTime(booking.created_at) : '-'}</td>
                </tr>
            `);

            // ------------------- Other Booking Fields -------------------
            for (const key in booking) {
                if ([
                    'id',
                    'attendance_status',
                    'present_days',
                    'hold_status',
                    'hold_from',
                    'resume_from',
                    'extended_days',
                    'created_at',
                    'certificate_url',
                    'allotted_time',
                    'allotted_time2',
                    'allotted_time3',
                    'allotted_time4'
                ].includes(key)) continue;

                let value = booking[key];

                if (value === null || value === undefined) value = '';
                if (key.includes('date') || key === 'starting_from') value = formatDate(value);
                if (['cov_lmv','cov_mc','ac_facility','pickup_drop'].includes(key)) {
                    value = Number(value) === 1 ? 'Yes' : 'No';
                }

                let label = key.replace(/_/g, " ");

                if (key.startsWith('allotted_time')) {
                    const index = key.replace('allotted_time', '') || '1';
                    label = `Session Slot ${index}`;
                }

                detailsTable.insertAdjacentHTML("beforeend", `
                    <tr>
                        <th>${label}</th>
                        <td data-key="${key}">${value}</td>
                    </tr>
                `);
            }

            // ------------------- Session Slots -------------------
            const slotKeys = ['allotted_time', 'allotted_time2', 'allotted_time3', 'allotted_time4'];

            function to12Hour(t) {
                if (!t) return '';
                const [hh, mm] = t.split(':').map(Number);
                const ampm = hh >= 12 ? 'PM' : 'AM';
                const h = hh % 12 || 12;
                return `${h}:${String(mm).padStart(2,'0')} ${ampm}`;
            }

            slotKeys.forEach((slotKey, i) => {
                detailsTable.insertAdjacentHTML("beforeend", `
                    <tr id="slotRow${i}">
                        <th>Session Slot ${i + 1}</th>
                        <td id="slotCell${i}" data-key="${slotKey}"></td>
                    </tr>
                `);
            });
            detailsTable.insertAdjacentHTML("beforeend", `
                <tr id="slotActionRow">
                    <th></th>
                    <td id="slotActionCell"></td>
                </tr>
            `);

            function refreshSlotView() {
                slotKeys.forEach((k, i) => {
                    const val = booking[k];
                    const row = document.getElementById(`slotRow${i}`);
                    const cell = document.getElementById(`slotCell${i}`);
                    if (!row || !cell) return;
                    row.style.display = (i === 0 || val) ? '' : 'none';
                    cell.innerHTML = val
                        ? `<span class="slot-time-badge">${to12Hour(val)}</span>`
                        : '<span style="color:#9ca3af;">—</span>';
                });
                const actionCell = document.getElementById('slotActionCell');
                actionCell.innerHTML = `<button id="editSlotsBtn" class="btn-slot-edit">✏ Edit Slots</button>`;
                document.getElementById('editSlotsBtn').addEventListener('click', () => {
                    openSlotPicker({
                        branch:          booking.branch,
                        car:             booking.car_name,
                        startingFrom:    booking.starting_from,
                        durationMinutes: Number(booking.duration_minutes) || 60,
                        currentSlots:    slotKeys.map(k => booking[k]).filter(Boolean),
                        excludeId:       id,
                        onSave: async (selectedSlots) => {
                            const res = await window.api(`/api/bookings/${id}`, {
                                method: 'PUT',
                                body: JSON.stringify({ selected_slots: selectedSlots })
                            });
                            if (!res.success) throw new Error(res.error || 'Failed to save');
                            slotKeys.forEach((k, i) => { booking[k] = selectedSlots[i] || null; });
                            refreshSlotView();
                        }
                    });
                });
            }

            refreshSlotView();


            attendanceBtn.onclick = () => openAttendanceHistory(booking);

            // ------------------- Certificate Row -------------------
            detailsTable.insertAdjacentHTML("beforeend", `
                <tr data-cert-row="1">
                    <th>Certificate</th>
                    <td data-key="certificate_url" id="certCell">
                        ${booking.certificate_url
                            ? `<button id="downloadCertBtn" class="btn btn-primary">Download Certificate</button>
                               <button id="replaceCertBtn" class="btn btn-warning">Replace</button>`
                            : `<button id="uploadCertBtn" class="btn btn-success">Upload Certificate</button>`
                        }
                    </td>
                </tr>
            `);

            setTimeout(() => {
                const uploadBtn = document.getElementById("uploadCertBtn");
                const replaceBtn = document.getElementById("replaceCertBtn");
                const downloadBtn = document.getElementById("downloadCertBtn");

                if (uploadBtn) uploadBtn.onclick = () => uploadCertificate(booking.id, loadBooking);
                if (replaceBtn) replaceBtn.onclick = () => uploadCertificate(booking.id, loadBooking);
                if (downloadBtn) downloadBtn.onclick = () => downloadCertificate(booking.id);

            }, 50);

        } catch (err) {
            console.error(err);
            detailsTable.innerHTML = `<tr><td colspan="2" class="error">Failed to load booking details.</td></tr>`;
        }
    }

    await loadBooking();

    // =============================================
    // ATTENDANCE HISTORY
    // =============================================
    async function openAttendanceHistory(bk) {
        document.getElementById('ahOverlay')?.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ahOverlay';
        overlay.className = 'ah-overlay';
        overlay.innerHTML = `
            <div class="ah-modal">
                <div class="ah-header">
                    <div>
                        <h3>Attendance History</h3>
                        <p>${bk.customer_name} &middot; ${bk.branch}</p>
                    </div>
                    <button class="ah-close">&times;</button>
                </div>
                <div class="ah-summary" id="ahSummary">
                    <span class="ah-stat ah-stat--total"><strong id="ahTotal">…</strong> Recorded</span>
                    <span class="ah-stat ah-stat--present"><strong id="ahPresent">…</strong> Present</span>
                    <span class="ah-stat ah-stat--absent"><strong id="ahAbsent">…</strong> Absent</span>
                </div>
                <div class="ah-body">
                    <table class="ah-table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Slot</th>
                                <th>Status</th>
                                <th>Marked At</th>
                            </tr>
                        </thead>
                        <tbody id="ahBody"><tr><td colspan="4" class="ah-empty">Loading…</td></tr></tbody>
                    </table>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('active'));

        const close = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 280);
        };
        overlay.querySelector('.ah-close').addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

        try {
            const res = await window.api(`/api/attendance/${bk.id}`);
            const records = res.records || [];
            const tbody = overlay.querySelector('#ahBody');

            if (records.length === 0) {
                tbody.innerHTML = `<tr><td colspan="4" class="ah-empty">No attendance recorded yet.</td></tr>`;
                overlay.querySelector('#ahTotal').textContent = 0;
                overlay.querySelector('#ahPresent').textContent = 0;
                overlay.querySelector('#ahAbsent').textContent = 0;
                return;
            }

            const presentCount = records.filter(r => r.present == 1).length;
            const absentCount  = records.filter(r => r.present == 0).length;
            overlay.querySelector('#ahTotal').textContent   = records.length;
            overlay.querySelector('#ahPresent').textContent = presentCount;
            overlay.querySelector('#ahAbsent').textContent  = absentCount;

            tbody.innerHTML = records.map(r => {
                const slotLabel = r.time ? to12HourFromDB(r.time) : '—';
                const isPresent = r.present == 1;
                const badge = isPresent
                    ? `<span class="ah-badge ah-badge--present">Present</span>`
                    : `<span class="ah-badge ah-badge--absent">Absent</span>`;
                return `
                    <tr>
                        <td>${r.date}</td>
                        <td>${slotLabel}</td>
                        <td>${badge}</td>
                        <td style="color:#64748b; font-size:12px;">${r.marked_at || '—'}</td>
                    </tr>`;
            }).join('');

        } catch (err) {
            overlay.querySelector('#ahBody').innerHTML =
                `<tr><td colspan="4" class="ah-empty" style="color:#dc2626;">Failed to load history.</td></tr>`;
        }
    }

    function to12HourFromDB(t) {
        if (!t) return '—';
        const [hh, mm] = t.split(':').map(Number);
        const ampm = hh >= 12 ? 'PM' : 'AM';
        const h = hh % 12 || 12;
        return `${h}:${String(mm).padStart(2,'0')} ${ampm}`;
    }

    // =============================================
    // EDIT MODE
    // =============================================
    editBtn.addEventListener('click', async () => {
        saveBtn.style.display = 'inline-block';
        editBtn.style.display = 'none';

        try {
            const [branchRes, carRes, instructorRes] = await Promise.all([
                window.api("/api/branches"),
                window.api("/api/cars"),
                window.api("/api/instructors?role=Instructor")
            ]);

            const allBranches = branchRes.branches || [];
            const allCars = carRes.cars || [];
            const allInstructors = (instructorRes.instructors || []).filter(i => i.is_active == 1); 

            const tds = detailsTable.querySelectorAll('td[data-key]');

            for (const td of tds) {
                const key = td.dataset.key;
                if (!key || key === 'attendance_status') continue;

                let val = td.textContent.trim() || '';
                td.innerHTML = "";

                if (key === "branch") {
                    const select = document.createElement("select");
                    select.innerHTML = `<option value="">Select Branch</option>`;
                    allBranches.forEach(b => {
                        const opt = document.createElement("option");
                        opt.value = b.branch_name;
                        opt.textContent = b.branch_name;
                        if (val === b.branch_name) opt.selected = true;
                        select.appendChild(opt);
                    });
                    select.addEventListener("change", () => {
                        const carCell = detailsTable.querySelector('td[data-key="car_name"]');
                        loadCarsDropdown(carCell, select.value, allCars, booking.car_name);
                    });
                    td.appendChild(select);
                    continue;
                }

                if (key === "car_name") {
                    const branchCell = detailsTable.querySelector('td[data-key="branch"] select');
                    const currentBranch = branchCell ? branchCell.value : booking.branch;
                    loadCarsDropdown(td, currentBranch, allCars, val);
                    continue;
                }

                // ------------------ Instructor Dropdown ------------------
                if (key === "instructor_name") {
                    const select = document.createElement("select");
                    select.innerHTML = `<option value="">Select Instructor</option>`;

                    allInstructors.forEach(instr => {
                        const opt = document.createElement("option");
                        opt.value = instr.instructor_name;
                        opt.textContent = instr.instructor_name;

                        if (val === instr.instructor_name) opt.selected = true;
                        select.appendChild(opt);
                    });

                    td.appendChild(select);
                    continue;
                }


                if (key === "training_days") {
                    const container = document.createElement("div");
                    td.appendChild(container);
                    try {
                        const res = await fetch("/api/training-days");
                        const data = await res.json();
                        const activeDays = (data.training_days || []).filter(d => d.is_active == 1);
                        container.innerHTML = activeDays.map(d => {
                            const checked = String(d.days) === val ? 'checked' : '';
                            return `<label style="margin-right:10px;">
                                        <input type="radio" name="training_days" value="${d.days}" ${checked}>
                                        ${d.days} Days
                                    </label>`;
                        }).join("");
                    } catch (err) {
                        container.innerHTML = "<p style='color:red;'>Error loading training days</p>";
                        console.error(err);
                    }
                    continue;
                }

                if (['cov_lmv','cov_mc','ac_facility','pickup_drop','hold_status'].includes(key)) {
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.checked = (val === 'Yes');
                    td.appendChild(checkbox);
                    continue;
                }

                if (key.includes('date') || key === 'starting_from') {
                    const dateInput = document.createElement('input');
                    dateInput.type = 'date';
                    dateInput.value = val;
                    td.appendChild(dateInput);
                    continue;
                }

                if (key.startsWith('allotted_time')) {
                    // Slots are managed by the inline slot editor — skip in main edit form
                    td.innerHTML = val;
                    continue;
                }


                if (key === 'duration_minutes') {
                    const select = document.createElement('select');
                    const options = [
                        { value: 30, label: '30 mins' },
                        { value: 60, label: '1 hr' },
                        { value: 90, label: '1.5 hr' },
                        { value: 120, label: '2 hr' }
                    ];
                    select.innerHTML = options.map(opt => {
                        const selected = String(opt.value) === val ? 'selected' : '';
                        return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
                    }).join('');
                    td.appendChild(select);
                    continue;
                }

                const textInput = document.createElement('input');
                textInput.type = 'text';
                textInput.value = val;
                td.appendChild(textInput);
            }
        } catch (err) {
            console.error("Failed to enter edit mode:", err);
            alert("Error enabling edit mode.");
        }
    });

    // =============================================
    // SAVE BOOKING
    // =============================================
    saveBtn.addEventListener('click', async () => {
        const updatedData = {};
        let missingFields = [];

        detailsTable.querySelectorAll('td').forEach(td => {
            const key = td.dataset.key;
            if (!key || key === 'attendance_status') return;

            const input = td.querySelector('input, select');
            if (!input) return;

            let value;
            if (key === "training_days") {
                const selectedRadio = td.querySelector('input[name="training_days"]:checked');
                value = selectedRadio ? selectedRadio.value : null;
            } else if (input.type === "checkbox") {
                value = input.checked ? 1 : 0;
            } else {
                value = input.value.trim();
            }

            updatedData[key] = value;

            if (REQUIRED_FIELDS.includes(key) && (value === '' || value === null)) {
                missingFields.push(key);
            }
        });

        // Slots are managed by the inline slot editor — preserve current values
        ['allotted_time', 'allotted_time2', 'allotted_time3', 'allotted_time4'].forEach(k => {
            delete updatedData[k];
        });
        updatedData.allotted_time  = booking.allotted_time  || null;
        updatedData.allotted_time2 = booking.allotted_time2 || null;
        updatedData.allotted_time3 = booking.allotted_time3 || null;
        updatedData.allotted_time4 = booking.allotted_time4 || null;

        if (missingFields.length > 0) {
            alert(`Please fill all required fields: ${missingFields.join(', ')}`);
            return;
        }

        try {
            const res = await window.api(`/api/bookings/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (res.success) {
                alert('Booking updated successfully!');
                saveBtn.style.display = 'none';
                editBtn.style.display = 'inline-block';
                await loadBooking();
            } else {
                alert('Failed to update booking: ' + res.error);
            }
        } catch (err) {
            console.error(err);
            alert('Error updating booking.');
        }
    });

    // ------------------- Helper: Cars Dropdown -------------------
    function loadCarsDropdown(td, selectedBranch, allCars, selectedCar) {
        td.innerHTML = "";
        const carSelect = document.createElement("select");
        carSelect.name = "car_name";

        if (!selectedBranch) {
            carSelect.innerHTML = `<option value="">Select Branch First</option>`;
            td.appendChild(carSelect);
            return;
        }

        const carsForBranch = allCars.filter(c => (c.branch || "").toLowerCase() === selectedBranch.toLowerCase());
        carSelect.innerHTML = `<option value="">Select Car</option>`;

        carsForBranch.forEach(car => {
            const opt = document.createElement("option");
            opt.value = car.car_name;
            opt.textContent = car.car_name;
            if (selectedCar === car.car_name) opt.selected = true;
            carSelect.appendChild(opt);
        });

        td.appendChild(carSelect);
    }

})();