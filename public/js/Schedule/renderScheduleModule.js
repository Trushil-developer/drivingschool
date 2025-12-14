window.renderScheduleModule = function(tableWrap) {
    return async function() {
        // Show loading initially
        tableWrap.innerHTML = `<div class="loading-overlay">Loading schedule...</div>`;

        try {
            const resBranches = await window.api('/api/branches');
            if (!resBranches.success) throw new Error(resBranches.error || "Failed to fetch branches");

            const branches = resBranches.branches;

            // Render branch tabs
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

            if(branchTabs.length > 0) branchTabs[0].click();

            async function initDayNavigation(branch) {
                let currentDate = new Date();

                async function renderDay() {
                    document.getElementById("currentDay").innerText = formatDate(currentDate);

                    const resCars = await window.api('/api/cars');
                    if(!resCars.success) {
                        document.getElementById("scheduleTableWrap").innerHTML = `<div class="error">${resCars.error}</div>`;
                        return;
                    }

                    const cars = resCars.cars.filter(c => c.branch === branch);
                    if(cars.length === 0) {
                        document.getElementById("scheduleTableWrap").innerHTML = `<div class="empty">No cars for this branch.</div>`;
                        return;
                    }

                    // Generate timeslots
                    const times = [];
                    let start = 6*60, end = 22*60;
                    for(let t=start; t<=end; t+=30){
                        const hh = String(Math.floor(t/60)).padStart(2,'0');
                        const mm = String(t%60).padStart(2,'0');
                        times.push(`${hh}:${mm}`);
                    }

                    // Fetch bookings and attendance together
                    const [resBookings, resAttendance] = await Promise.all([
                        window.api('/api/bookings'),
                        window.api('/api/attendance-all')
                    ]);

                    const bookings = resBookings.success ? resBookings.bookings : [];
                    const attendanceRecords = resAttendance.success ? resAttendance.records : [];

                    // Build attendance map
                    const attendanceMap = {};
                    attendanceRecords.forEach(r => {
                        if(!attendanceMap[r.booking_id]) attendanceMap[r.booking_id] = [];
                        attendanceMap[r.booking_id].push(r);
                    });

                    const branchBookings = bookings.filter(b => {
                        if (!b.starting_from) return false;
                        const status = (b.attendance_status || '').trim().toLowerCase();
                        if (!['active', 'pending'].includes(status)) return false;

                        const start = new Date(b.starting_from);
                        const end = new Date(start);
                        end.setDate(start.getDate() + 29);
                        const selectedTime = currentDate.getTime();

                        return (
                            b.branch.trim().toLowerCase() === branch.trim().toLowerCase() &&
                            selectedTime >= start.getTime() &&
                            selectedTime <= end.getTime()
                        );
                    });

                    const bookedSlots = {};
                    branchBookings.forEach(b => {
                        if(!b.car_name || !b.allotted_time) return;
                        const car = b.car_name.trim();

                        const totalDays = Number(b.training_days) || 15;
                        const customerWithDays = `${b.customer_name || ''} (${b.present_days}/${totalDays})`;

                        const duration = Number(b.duration_minutes) || 30;
                        const slotCount = Math.ceil(duration / 30);

                        if(!bookedSlots[car]) bookedSlots[car] = {};
                        let [hhStr, mmStr] = b.allotted_time.split(':');
                        let startMinutes = Number(hhStr)*60 + Number(mmStr);

                        for(let i=0;i<slotCount;i++){
                            const slotH = String(Math.floor(startMinutes/60)).padStart(2,'0');
                            const slotM = String(startMinutes%60).padStart(2,'0');

                            bookedSlots[car][`${slotH}:${slotM}`] = i === 0 
                                ? { customer: customerWithDays, rowspan: slotCount, instructor_name: b.instructor_name || "N/A" } 
                                : { skip: true };

                            startMinutes += 30;
                        }
                    });

                    // Count active/available slots
                    let totalSlots = cars.length * times.length;
                    let activeSlots = 0;
                    cars.forEach(car => {
                        const carName = car.car_name.trim();
                        times.forEach(t => {
                            if(bookedSlots[carName]?.[t] && !bookedSlots[carName][t].skip) activeSlots++;
                        });
                    });
                    let availableSlots = totalSlots - activeSlots;
                    document.getElementById("slotStats").innerHTML = `
                        <span class="active-slots">Active Slots: ${activeSlots}</span>
                        <span class="available-slots">Available Slots: ${availableSlots}</span>
                    `;

                    // Render schedule table
                    let html = `<table class="schedule-table">
                        <thead>
                            <tr>
                                <th>Time</th>
                                ${cars.map(c => `<th>${c.car_name}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${times.map(t => {
                                return `<tr>
                                    <td class="time-col">${to12HourFormat(t)}</td>
                                    ${cars.map(car => {
                                        const carName = car.car_name.trim();
                                        const slot = bookedSlots[carName]?.[t];
                                        if(slot?.skip) return '';
                                        if(slot) {
                                            const instructor = slot.instructor_name || "N/A";
                                            return `<td class="slot" rowspan="${slot.rowspan}">
                                                        ${slot.customer} 
                                                        <span class="info-tooltip">
                                                            ℹ
                                                            <span class="tooltip-text">${instructor}</span>
                                                        </span>
                                                    </td>`;
                                        }

                                        return `<td class="slot"></td>`;
                                    }).join('')}
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>`;

                    document.getElementById("scheduleTableWrap").innerHTML = html;

                    initTooltips();
                }

                document.getElementById("printScheduleBtn").onclick = () => {
                    printSchedule(branch, currentDate);
                };
                document.getElementById("prevDay").onclick = () => {
                    currentDate.setDate(currentDate.getDate()-1);
                    renderDay();
                };
                document.getElementById("nextDay").onclick = () => {
                    currentDate.setDate(currentDate.getDate()+1);
                    renderDay();
                };

                await renderDay();
            }

            function formatDate(d) {
                return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
            }

        } catch(err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
        }
    }
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
        document.querySelectorAll('.info-tooltip.active').forEach(icon => {
            icon.classList.remove('active');
        });
    });
}

function to12HourFormat(time24) {
    let [hh, mm] = time24.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    hh = hh % 12;
    if(hh===0) hh=12;
    return `${hh}:${String(mm).padStart(2,'0')} ${ampm}`;
}

function printSchedule(branch, date) {
    const scheduleTable = document.getElementById("scheduleTableWrap").innerHTML;
    const dateStr = `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;

    const printWindow = window.open('', '', 'width=900,height=700');

    printWindow.document.write(`
        <html>
        <head>
            <title>Schedule - ${branch} (${dateStr})</title>
            <style>
                body { font-family: Arial; padding: 10px; }
                h2 { margin-bottom: 10px; }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 10px;
                }
                th, td {
                    border: 1px solid #000;
                    padding: 3px;
                    text-align: center;
                }
                th {
                    background: #f3f3f3;
                }
            </style>
        </head>
        <body>
            <h2>Schedule - ${branch}</h2>
            <div><strong>Date:</strong> ${dateStr}</div>
            <br>
            ${scheduleTable}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
}
