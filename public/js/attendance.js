(function () {

    const LOCK_PASSWORD = "1234"; 

    function generateAttendanceRows(startDate, existing, totalDays) {
        const tbody = document.createElement('tbody');
        const todayStr = new Date().toISOString().split("T")[0];

        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dateStr = d.toISOString().split("T")[0];

            const isPresent = existing.some(e => e.date.split('T')[0] === dateStr && e.present == 1);

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>Day ${i + 1}</td>
                <td>${dateStr}</td>
                <td><input type="checkbox" data-date="${dateStr}" ${isPresent ? "checked" : ""}></td>
            `;

            const cb = row.querySelector('input');
            if (dateStr > todayStr) {
                cb.disabled = true;
            }
            else if (dateStr < todayStr) {
                cb.disabled = true;

                const lockBtn = document.createElement('button');
                lockBtn.textContent = "🔒";
                lockBtn.className = "btn btn-ghost btn-sm";
                lockBtn.style.marginLeft = "8px";

                lockBtn.addEventListener("click", () => {
                    const pw = prompt("Enter password");
                    if (pw === LOCK_PASSWORD) {
                        cb.disabled = false;
                        lockBtn.remove();
                    } else {
                        alert("Incorrect password");
                    }
                });

                row.children[2].appendChild(lockBtn);
            }

            tbody.appendChild(row);
        }

        return tbody;
    }

    async function openAttendanceModal(booking) {
        if (!booking.starting_from) return alert("Starting date missing");

        const overlay = document.getElementById("attendanceOverlay");
        const modal = document.getElementById("attendanceModal");
        const tableBody = document.querySelector("#attendanceTable tbody");
        const saveBtn = document.getElementById("saveAttendanceBtn");
        const closeBtn = document.getElementById("closeAttendanceBtn");

        overlay.classList.add("active");
        modal.classList.add("active");
        tableBody.innerHTML = "";

        const startDate = new Date(booking.starting_from);
        const totalDays = 30;

        const res = await window.api(`/api/attendance/${booking.id}`);
        const existing = res.records || [];

        const newTbody = generateAttendanceRows(startDate, existing, totalDays);
        tableBody.replaceWith(newTbody);
        newTbody.id = "attendance-body";

        saveBtn.onclick = async () => {
            const checkboxes = newTbody.querySelectorAll("input[type='checkbox']");
            const attendance = [];

            checkboxes.forEach(cb => {
                if (cb.checked) attendance.push({ date: cb.dataset.date });
            });

            const result = await window.api(`/api/attendance/${booking.id}`, {
                method: "POST",
                body: { attendance }
            });

            if (result.success) {
                alert("Saved!");
                overlay.classList.remove("active");
                modal.classList.remove("active");
                booking.refresh?.();
            } else {
                alert("Failed to save");
            }
        };

        closeBtn.onclick = () => {
            overlay.classList.remove("active");
            modal.classList.remove("active");
        };
    }

    window.openAttendanceModal = openAttendanceModal;

})();
