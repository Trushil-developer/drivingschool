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
    // LOAD BOOKING (Now uses DB-calculated attendance)
    // =========================
    async function loadBooking() {
        try {
            const res = await window.api('/api/bookings');
            if (!res.success) throw new Error(res.error || 'Failed to fetch bookings');

            booking = res.bookings.find(b => b.id == id);
            if (!booking) {
                detailsTable.innerHTML = `<tr><td colspan="2" class="error">Booking not found.</td></tr>`;
                return;
            }

            // Get attendance records only for modal use (not for calculation)
            const attRes = await window.api(`/api/attendance/${booking.id}`);
            const existingAttendance = attRes.records || [];

            // ------------------- UI BUILD -------------------
            detailsTable.innerHTML = '';

            detailsTable.insertAdjacentHTML("beforeend", `
                <tr><th>ID</th><td>${booking.id}</td></tr>
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
            `);

            // Print all other fields
            for (const key in booking) {
                if (['id','attendance_status','present_days','hold_status','created_at'].includes(key)) continue;

                let value = booking[key] || '';

                if (key.includes('date') || key === 'starting_from') value = formatDate(value);
                if (key === 'created_at') value = formatDateTime(value);
                if (['cov_lmv','cov_mc'].includes(key)) value = value ? 'Yes' : 'No';

                const label = key.replace(/_/g, " ");

                detailsTable.insertAdjacentHTML("beforeend", `
                    <tr>
                        <th>${label}</th>
                        <td data-key="${key}">${value}</td>
                    </tr>
                `);
            }

            booking._attendanceRecords = existingAttendance; // Keep for modal

        } catch (err) {
            console.error(err);
            detailsTable.innerHTML = `<tr><td colspan="2" class="error">Failed to load booking details.</td></tr>`;
        }
    }

    await loadBooking();

    // =============================================
    // EDIT MODE (Same as before — except no attendance fields)
    // =============================================
    editBtn.addEventListener('click', async () => {
        saveBtn.style.display = 'inline-block';
        editBtn.style.display = 'none';

        const branchRes = await window.api("/api/branches");
        const carRes = await window.api("/api/cars");
        const allBranches = branchRes.branches || [];
        const allCars = carRes.cars || [];

        detailsTable.querySelectorAll('td').forEach(td => {
            const key = td.dataset.key;
            if (!key || key === 'attendance_status') return;

            let val = td.textContent.trim() || '';
            td.innerHTML = "";

            let input;

            if (key === "branch") {
                input = document.createElement("select");
                input.innerHTML = `<option value="">Select Branch</option>`;
                allBranches.forEach(b => {
                    const opt = document.createElement("option");
                    opt.value = b.branch_name;
                    opt.textContent = b.branch_name;
                    if (val === b.branch_name) opt.selected = true;
                    input.appendChild(opt);
                });

                input.addEventListener("change", () => {
                    const carCell = detailsTable.querySelector('td[data-key="car_name"]');
                    loadCarsDropdown(carCell, input.value, allCars, booking.car_name);
                });

                td.appendChild(input);
                return;
            }

            if (key === "car_name") {
                const branchCell = detailsTable.querySelector('td[data-key="branch"] select');
                const currentBranch = branchCell ? branchCell.value : booking.branch;
                loadCarsDropdown(td, currentBranch, allCars, val);
                return;
            }

            if (['cov_lmv','cov_mc','hold_status'].includes(key)) {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = (val === 'Yes');
                td.appendChild(input);
                return;
            }

            if (key.includes('date') || key === 'starting_from') {
                input = document.createElement('input');
                input.type = 'date';
                input.value = val;
                td.appendChild(input);
                return;
            }

            if (key === 'allotted_time') {
                input = document.createElement('input');
                input.type = 'time';
                input.value = val;
                td.appendChild(input);
                return;
            }

            input = document.createElement('input');
            input.type = 'text';
            input.value = val;
            td.appendChild(input);
        });
    });

    // =============================================
    // SAVE BOOKING (NO FRONTEND CALCULATIONS ANYMORE)
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
                if (input.type === 'checkbox') value = input.checked ? 1 : 0;
                else value = input.value.trim();

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
                    await loadBooking(); // reload updated + backend-calculated data
                } else {
                    alert('Failed to update booking: ' + res.error);
                }
            } catch (err) {
                console.error(err);
                alert('Error updating booking.');
            }
        });

    // =============================================
    // ATTENDANCE MODAL
    // =============================================
    attendanceBtn.addEventListener('click', () => {
        window.openAttendanceModal({
            ...booking,
            refresh: loadBooking
        });
    });

    // Cars dropdown helper ------------------------
    function loadCarsDropdown(td, selectedBranch, allCars, selectedCar) {
        td.innerHTML = "";
        const carSelect = document.createElement("select");
        carSelect.name = "car_name";

        if (!selectedBranch) {
            carSelect.innerHTML = `<option value="">Select Branch First</option>`;
            td.appendChild(carSelect);
            return;
        }

        const carsForBranch = allCars.filter(c => 
            (c.branch || "").toLowerCase() === selectedBranch.toLowerCase()
        );

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