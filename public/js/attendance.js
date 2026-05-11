(function () {
    const LOCK_PASSWORD = "1234";

    function localDateStr(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    // Helper to attach increment/decrement events
    function attachCounterEvents(counterDiv, incrementMap) {
        const incBtn = counterDiv.querySelector(".increment-btn");
        const decBtn = counterDiv.querySelector(".decrement-btn");
        const countSpan = counterDiv.querySelector(".attendance-count");

        if (!incBtn || !decBtn) return;

        // Set initial disabled state based on current displayed value
        const initCount = parseInt(countSpan.textContent || "0");
        incBtn.disabled = initCount >= 4;
        decBtn.disabled = initCount <= 0;

        incBtn.addEventListener("click", () => {
            let count = parseInt(countSpan.textContent || "0");
            if (count < 4) count += 1;
            countSpan.textContent = count;

            incBtn.disabled = count >= 4;
            decBtn.disabled = count <= 0;

            incrementMap[incBtn.dataset.date] = count;
        });

        decBtn.addEventListener("click", () => {
            let count = parseInt(countSpan.textContent || "0");
            if (count > 0) count -= 1;
            countSpan.textContent = count;

            decBtn.disabled = count <= 0;
            incBtn.disabled = count >= 4;

            incrementMap[decBtn.dataset.date] = count;
        });
    }

    // Generate attendance rows
    function generateAttendanceRows(startDate, existing, totalDays, isEditable, incrementMap) {
        const tbody = document.createElement('tbody');
        const todayStr = localDateStr(new Date());

        for (let i = 0; i < totalDays; i++) {
            const d = new Date(startDate);
            d.setDate(startDate.getDate() + i);
            const dateStr = localDateStr(d);

            const existingRecord = existing.find(e => e.date === dateStr);
            let count = existingRecord ? Math.max(0, existingRecord.present) : 0;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td>Day ${i + 1}</td>
                <td>${dateStr}</td>
                <td><div class="attendance-counter"></div></td>
            `;

            const counterDiv = row.querySelector(".attendance-counter");

            if (dateStr === todayStr && isEditable) {
                // Today's date editable
                counterDiv.innerHTML = `
                    <button class="decrement-btn" data-date="${dateStr}">-</button>
                    <span class="attendance-count">${count}</span>
                    <button class="increment-btn" data-date="${dateStr}">+</button>
                `;
                attachCounterEvents(counterDiv, incrementMap);

            } else if (dateStr < todayStr && isEditable) {
                // Past date → show count + lock
                const countSpan = document.createElement("span");
                countSpan.className = "attendance-count";
                countSpan.textContent = count;

                const lockBtn = document.createElement("button");
                lockBtn.textContent = "🔒";
                lockBtn.className = "btn btn-ghost btn-sm";
                lockBtn.style.marginLeft = "6px";

                lockBtn.addEventListener("click", () => {
                    const pw = prompt("Enter password");
                    if (pw === LOCK_PASSWORD) {
                        const currentCount = parseInt(countSpan.textContent || "0");
                        counterDiv.innerHTML = `
                            <button class="decrement-btn" data-date="${dateStr}">-</button>
                            <span class="attendance-count">${currentCount}</span>
                            <button class="increment-btn" data-date="${dateStr}">+</button>
                        `;
                        attachCounterEvents(counterDiv, incrementMap);
                    } else {
                        alert("Incorrect password");
                    }
                });

                counterDiv.appendChild(countSpan);
                counterDiv.appendChild(lockBtn);

            } else {
                // Future date → just show count
                counterDiv.textContent = count;
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
        const totalDays = 30 + Number(booking.extended_days || 0);

        if (booking.hold_from && booking.resume_from) {
            const holdStart = new Date(booking.hold_from);
            const resumeStart = new Date(booking.resume_from);
            const holdDays = Math.ceil((resumeStart - holdStart) / (1000 * 60 * 60 * 24));
            startDate.setDate(startDate.getDate() + holdDays);
        }

        // Fetch existing attendance
        const res = await window.api(`/api/attendance/${booking.id}`);
        const existing = res.records || [];

        const isEditable = booking.attendance_status.toLowerCase() === "active";
        const incrementMap = {}; // Track increments

        const newTbody = generateAttendanceRows(startDate, existing, totalDays, isEditable, incrementMap);
        tableBody.innerHTML = "";
        while (newTbody.firstChild) {
            tableBody.appendChild(newTbody.firstChild);
        }

    saveBtn.onclick = async () => {
        const updates = Object.entries(incrementMap);
        if (updates.length === 0) {
            overlay.classList.remove("active");
            modal.classList.remove("active");
            return booking.refresh?.();
        }

        try {
            for (const [date, newCount] of updates) {
                const result = await window.api(`/api/attendance/${booking.id}`, {
                    method: "POST",
                    body: { date, value: newCount }
                });
                if (!result.success) throw new Error(result.error || 'Save failed');
            }

            alert("Attendance saved successfully!");
            overlay.classList.remove("active");
            modal.classList.remove("active");
            booking.refresh?.();
        } catch (err) {
            console.error(err);
            alert("Failed to save attendance. Try again.");
        }
    };


        closeBtn.onclick = () => {
            overlay.classList.remove("active");
            modal.classList.remove("active");
        };
    }

    window.openAttendanceModal = openAttendanceModal;
})();
