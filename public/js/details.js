(async () => {
            await window.CommonReady;

            const detailsTable = document.getElementById('detailsTable');
            const editBtn = document.getElementById('editBtn');
            const saveBtn = document.getElementById('saveBtn');
            const backBtn = document.getElementById('backBtn');
            const attendanceBtn = document.getElementById('attendanceBtn');

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

            async function loadBooking() {
                try {
                    const res = await window.api('/api/bookings');
                    if (!res.success) throw new Error(res.error || 'Failed to fetch bookings');

                    booking = res.bookings.find(b => b.id == id);
                    if (!booking) {
                        detailsTable.innerHTML = `<tr><td colspan="2" class="error">Booking not found.</td></tr>`;
                        return;
                    }

                    const attRes = await window.api(`/api/attendance/${booking.id}`);
                    const existingAttendance = attRes.records || [];

                    const totalDays = booking.training_days == "21" ? 21 : 15;
                    const presentDays = existingAttendance.filter(e => e.present == 1).length;

                    const fulfilled = presentDays >= totalDays;

                    const startDate = new Date(booking.starting_from);
                    const expireDate = new Date(startDate);
                    expireDate.setDate(expireDate.getDate() + 30);
                    const today = new Date();

                    if (fulfilled) booking.attendance_status = "Completed";
                    else if (today > expireDate) booking.attendance_status = "Expired";
                    else booking.attendance_status = "Active";

                    detailsTable.innerHTML = '';

                    const idRow = document.createElement('tr');
                    idRow.innerHTML = `<th>ID</th><td data-key="id">${booking.id}</td>`;
                    detailsTable.appendChild(idRow);

                    const statusRow = document.createElement('tr');
                    const statusTd = document.createElement('td');
                    statusTd.dataset.key = 'attendance_status';
                    statusTd.textContent = booking.attendance_status;
                    statusTd.className = booking.attendance_status === "Completed" ? "status-completed" : booking.attendance_status === "Expired" ? "status-expired" : "status-pending";
                    statusRow.innerHTML = `<th>Attendance Status</th>`;
                    statusRow.appendChild(statusTd);
                    detailsTable.appendChild(statusRow);

                    // Present Days
                    const presentRow = document.createElement('tr');
                    presentRow.innerHTML = `<th>Present Days</th><td>${presentDays} / ${totalDays}</td>`;
                    detailsTable.appendChild(presentRow);

                    for (const key in booking) {
                        if (['id', 'attendance_status', 'present_days'].includes(key)) continue;
                        const row = document.createElement('tr');
                        const th = document.createElement('th');
                        th.textContent = key.replace(/_/g, ' ');
                        const td = document.createElement('td');
                        td.dataset.key = key;

                        if ((key.includes('date') || key === 'starting_from') && booking[key]) td.textContent = formatDate(booking[key]);
                        else if (key === 'created_at' && booking[key]) td.textContent = formatDateTime(booking[key]);
                        else if (key === 'cov_lmv' || key === 'cov_mc') td.textContent = booking[key] ? 'Yes' : 'No';
                        else td.textContent = booking[key] || '';

                        row.append(th, td);
                        detailsTable.appendChild(row);
                    }
                } catch (err) {
                    console.error(err);
                    detailsTable.innerHTML = `<tr><td colspan="2" class="error">Failed to load booking details.</td></tr>`;
                }
            }

            await loadBooking();

            // ------------------ Edit Mode ------------------
            editBtn.addEventListener('click', async () => {
                saveBtn.style.display = 'inline-block';
                editBtn.style.display = 'none';

                // Fetch branches & cars first
                const branchRes = await window.api("/api/branches");
                const carRes = await window.api("/api/cars");
                const allBranches = branchRes.branches || [];
                const allCars = carRes.cars || [];

                detailsTable.querySelectorAll('td').forEach(td => {
                    const key = td.dataset.key;
                    if (!key || ['id', 'created_at', 'attendance_status'].includes(key)) return;

                    const val = td.textContent || '';
                    td.innerHTML = "";

                    let input;

                    // ------------------ BRANCH DROPDOWN ------------------
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
                            loadCarsDropdown(carCell, input.value, allCars, booking.car_names);
                        });

                        td.appendChild(input);
                        return;
                    }

                    // ------------------ CAR DROPDOWN (depends on branch) ------------------
                    if (key === "car_name") {
                        const branchCell = detailsTable.querySelector('td[data-key="branch"] select');
                        const currentBranch = branchCell ? branchCell.value : booking.branch;

                        loadCarsDropdown(td, currentBranch, allCars, val);
                        return;
                    }

                    // ------------------ CHECKBOXES ------------------
                    if (['cov_lmv', 'cov_mc'].includes(key)) {
                        input = document.createElement('input');
                        input.type = 'checkbox';
                        input.checked = val === 'Yes';
                        td.appendChild(input);
                        return;
                    }

                    // ------------------ DATE ------------------
                    if (key.includes('date') || key === 'starting_from') {
                        input = document.createElement('input');
                        input.type = 'date';
                        input.value = val;
                        td.appendChild(input);
                        return;
                    }

                    // ------------------ TIME ------------------
                    if (key === 'allotted_time') {
                        input = document.createElement('input');
                        input.type = 'time';
                        input.value = val;
                        td.appendChild(input);
                        return;
                    }

                    // ------------------ NORMAL TEXT INPUT ------------------
                    input = document.createElement('input');
                    input.type = 'text';
                    input.value = val;
                    td.appendChild(input);
                });
            });

            // ------------------ Save ------------------
            saveBtn.addEventListener('click', async () => {
                const updatedData = {};

                detailsTable.querySelectorAll('td').forEach(td => {
                    const key = td.dataset.key;
                    if (!key || ['id', 'created_at', 'attendance_status'].includes(key)) return;

                    const input = td.querySelector('input, select');
                    if (!input) return;

                    let value;
                    if (input.type === 'checkbox') value = input.checked ? 1 : 0;
                    else value = input.value || '';

                    if (key === 'allotted_time' && value === '') value = null;

                    updatedData[key] = value;
                });

                try {
                    const res = await window.api(`/api/bookings/${id}`, {
                        method: 'PUT',
                        body: updatedData
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

            // ------------------ Attendance Modal ------------------
            attendanceBtn.addEventListener('click', () => {
                window.openAttendanceModal({
                    ...booking,
                    refresh: loadBooking
                });
            });

function loadCarsDropdown(td, selectedBranch, allCars, selectedCar) {
    td.innerHTML = "";

    const carSelect = document.createElement("select");
    carSelect.name = "car_names";

    if (!selectedBranch) {
        carSelect.innerHTML = `<option value="">Select Branch First</option>`;
        td.appendChild(carSelect);
        return;
    }

    const carsForBranch = allCars.filter(c => {
        const branchFromCars =
            c.branch ??
            c.branch_name ??
            c.branch_id ??
            "";

        return String(branchFromCars).toLowerCase() === selectedBranch.toLowerCase();
    });

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