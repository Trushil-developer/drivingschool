import { 
    downloadCertificate, 
    uploadCertificate,
} from "./globals/certificates.js";

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
        "allotted_time",
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
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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
                    <th>Present Days</th>
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
                if (['id','attendance_status','present_days','hold_status','hold_from','resume_from','extended_days','created_at','certificate_url'].includes(key)) continue;

                let value = booking[key] || '';
                if (key.includes('date') || key === 'starting_from') value = formatDate(value);
                if (['cov_lmv','cov_mc'].includes(key)) value = value ? 'Yes' : 'No';

                const label = key.replace(/_/g, " ");
                detailsTable.insertAdjacentHTML("beforeend", `
                    <tr>
                        <th>${label}</th>
                        <td data-key="${key}">${value}</td>
                    </tr>
                `);
            }

            booking._attendanceRecords = existingAttendance;

            attendanceBtn.onclick = () => {
                if (!booking || !booking.starting_from) return alert("Booking starting date missing");
                window.openAttendanceModal({
                    ...booking,
                    totalDays: Number(booking.training_days) || 30,
                    refresh: loadBooking
                });
            };

            // ------------------- Certificate Row -------------------
            detailsTable.insertAdjacentHTML("beforeend", `
                <tr>
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
    // EDIT MODE
    // =============================================
    editBtn.addEventListener('click', async () => {
        saveBtn.style.display = 'inline-block';
        editBtn.style.display = 'none';

        try {
            const [branchRes, carRes] = await Promise.all([
                window.api("/api/branches"),
                window.api("/api/cars")
            ]);

            const allBranches = branchRes.branches || [];
            const allCars = carRes.cars || [];

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

                if (['cov_lmv','cov_mc','hold_status'].includes(key)) {
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

                if (key === 'allotted_time') {
                    const timeInput = document.createElement('input');
                    timeInput.type = 'time';
                    timeInput.value = val;
                    td.appendChild(timeInput);
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

            if (REQUIRED_FIELDS.includes(key) && (value === '' || value === null || value === undefined)) {
                missingFields.push(key);
            }
        });

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