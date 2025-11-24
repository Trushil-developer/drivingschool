(async () => {
    // Wait for common.js to finish loading topbar/sidebar/modal
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
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '-';
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

            // Fetch attendance
            const attRes = await window.api(`/api/attendance/${booking.id}`);
            const existingAttendance = attRes.records || [];

            // Determine total required training days
            const totalDays = booking.training_days == "21" ? 21 : 15;
            const presentDays = existingAttendance.filter(e => e.present == 1).length;

            // Completion logic
            const fulfilled = presentDays >= totalDays;

            // Expiration: 30 days from starting_from
            const startDate = new Date(booking.starting_from);
            const expireDate = new Date(startDate);
            expireDate.setDate(expireDate.getDate() + 30);

            const today = new Date();

            if (fulfilled) booking.attendance_status = "Completed";
            else if (today > expireDate) booking.attendance_status = "Expired";
            else booking.attendance_status = "Active";

            // ------- Render booking details -------
            detailsTable.innerHTML = '';

            // Insert ID row first
            const idRow = document.createElement('tr');
            idRow.innerHTML = `
                <th>ID</th>
                <td data-key="id">${booking.id}</td>
            `;
            detailsTable.appendChild(idRow);

            // Insert Attendance Status row second
            const statusRow = document.createElement('tr');
            const statusTh = document.createElement('th');
            statusTh.textContent = "Attendance Status";
            const statusTd = document.createElement('td');
            statusTd.dataset.key = "attendance_status";
            statusTd.textContent = booking.attendance_status;

            // Apply color classes
            statusTd.classList.remove("status-completed", "status-pending", "status-expired");
            if (booking.attendance_status === "Completed") statusTd.classList.add("status-completed");
            else if (booking.attendance_status === "Expired") statusTd.classList.add("status-expired");
            else statusTd.classList.add("status-pending");

            statusRow.append(statusTh, statusTd);
            detailsTable.appendChild(statusRow);

            // Insert Present Days row third
            const presentRow = document.createElement('tr');
            presentRow.innerHTML = `
                <th>Present Days</th>
                <td>${presentDays} / ${totalDays}</td>
            `;
            detailsTable.appendChild(presentRow);

            // Insert remaining fields
            for (const key in booking) {
                if (key === "id" || key === "attendance_status" || key === "present_days") continue;

                const row = document.createElement('tr');
                const th = document.createElement('th');
                th.textContent = key.replace(/_/g, ' ');
                const td = document.createElement('td');
                td.dataset.key = key;

                if ((key.includes('date') || key === 'starting_from') && booking[key]) {
                    td.textContent = formatDate(booking[key]);
                } else if (key === 'created_at' && booking[key]) {
                    td.textContent = formatDateTime(booking[key]);
                } else if (key === 'cov_lmv' || key === 'cov_mc') {
                    td.textContent = booking[key] ? 'Yes' : 'No';
                } else {
                    td.textContent = booking[key] || '-';
                }

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
    editBtn.addEventListener('click', () => {
        saveBtn.style.display = 'inline-block';
        editBtn.style.display = 'none';

        detailsTable.querySelectorAll('td').forEach(td => {
            const key = td.dataset.key;
            if (key === 'id' || key === 'created_at' || key === 'attendance_status') return;

            const val = td.textContent === '-' ? '' : td.textContent;
            const input = document.createElement('input');

            if (key.includes('date') || key === 'starting_from') {
                input.type = 'date';
            } else if (key === 'cov_lmv' || key === 'cov_mc') {
                input.type = 'checkbox';
                input.checked = val === 'Yes';
            } else if (key === 'allotted_time') {
                input.type = 'time';
            } else {
                input.type = 'text';
            }

            if (input.type !== 'checkbox') input.value = val;
            td.innerHTML = '';
            td.appendChild(input);
        });
    });

    // ------------------ Save Logic ------------------
    saveBtn.addEventListener('click', async () => {
        const updatedData = {};

        detailsTable.querySelectorAll('td').forEach(td => {
            const key = td.dataset.key;
            if (key === 'id' || key === 'created_at' || key === 'attendance_status') return;

            const input = td.querySelector('input');
            let value = input.type === 'checkbox' ? (input.checked ? 1 : 0) : input.value;

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

    // ------------------ Attendance Modal Button ------------------
    attendanceBtn.addEventListener('click', () => {
        window.openAttendanceModal({
            ...booking,
            refresh: loadBooking
        });
    });

})();
