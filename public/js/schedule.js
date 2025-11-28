(function () {
    function renderScheduleSection(tableWrap) {
        return async function () {

            const resBranches = await window.api('/api/branches');
            if (!resBranches.success) {
                tableWrap.innerHTML = `<div class="error">${resBranches.error}</div>`;
                return;
            }
            const branches = resBranches.branches;

            // Render branch tabs
            tableWrap.innerHTML = `
                <div id="scheduleTabWrapper">
                    <div class="schedule-wrapper">
                        <div class="branch-tabs">
                            ${branches.map((b,i)=>`
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

            branchTabs.forEach(tab=>{
                tab.addEventListener("click",()=>{
                    branchTabs.forEach(t=>t.classList.remove("active"));
                    tab.classList.add("active");

                    const selectedBranch = tab.dataset.branch;
                    tableWrap.querySelector(".branch-content").innerHTML = `
                        <div class="content">
                            <div class="day-nav">
                                <button id="prevDay">Previous Day</button>
                                <span id="currentDay"></span>
                                <button id="nextDay">Next Day</button>
                            </div>
                            <div id="scheduleTableWrap"></div>
                        </div>
                    `;

                    initDayNavigation(selectedBranch);
                });
            });

            if(branchTabs.length>0) branchTabs[0].click();

            function initDayNavigation(branch){
                let currentDate = new Date();

                async function renderDay(){
                    document.getElementById("currentDay").innerText = formatDate(currentDate);

                    const resCars = await window.api('/api/cars');
                    if(!resCars.success){
                        document.getElementById("scheduleTableWrap").innerHTML = `<div class="error">${resCars.error}</div>`;
                        return;
                    }

                    const cars = resCars.cars.filter(c=>c.branch===branch);
                    if(cars.length===0){
                        document.getElementById("scheduleTableWrap").innerHTML = `<div class="empty">No cars for this branch.</div>`;
                        return;
                    }

                    const times = [];
                    let start = 6*60, end = 22*60;
                    for(let t=start;t<=end;t+=30){
                        const hh = String(Math.floor(t/60)).padStart(2,'0');
                        const mm = String(t%60).padStart(2,'0');
                        times.push(`${hh}:${mm}`);
                    }

                    const resBookings = await window.api('/api/bookings');
                    const bookings = resBookings.success ? resBookings.bookings : [];
                    const selectedDateStr = currentDate.toISOString().split("T")[0];

                    const branchBookings = bookings.filter(b => {
                        if (!b.starting_from) return false;

                        const start = new Date(b.starting_from);
                        const end = new Date(start);
                        end.setDate(start.getDate() + 29); // 30 days

                        const selectedTime = currentDate.getTime();

                        return (
                            b.branch.trim().toLowerCase() === branch.trim().toLowerCase() &&
                            selectedTime >= start.getTime() &&
                            selectedTime <= end.getTime()
                        );
                    });



                    const bookedSlots = {};
                    branchBookings.forEach(b => {
                        if (!b.car_name || !b.allotted_time) return;
                        const car = b.car_name.trim();
                        const time = b.allotted_time.slice(0,5);
                        const customer = b.customer_name || '';
                        if (!bookedSlots[car]) bookedSlots[car] = {};
                        bookedSlots[car][time] = customer;
                    });

                    // 🔥 Build schedule table
                    let html = `
                        <table class="schedule-table">
                            <thead>
                                <tr>
                                    <th>Time</th>
                                    ${cars.map(c=>`<th>${c.car_name}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${times.map(t=>`
                                    <tr>
                                        <td class="time-col">${t}</td>
                                        ${cars.map(car=>{
                                            const carName = car.car_name.trim();
                                            const customerName = bookedSlots[carName]?.[t] || '';
                                            return `<td class="slot">${customerName}</td>`;
                                        }).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;

                    document.getElementById("scheduleTableWrap").innerHTML = html;
                }

                document.getElementById("prevDay").onclick = ()=>{
                    currentDate.setDate(currentDate.getDate()-1);
                    renderDay();
                };
                document.getElementById("nextDay").onclick = ()=>{
                    currentDate.setDate(currentDate.getDate()+1);
                    renderDay();
                };

                renderDay();
            }

            function formatDate(d){
                return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
            }
        };
    }

    if(window.registerScheduleModule){
        window.registerScheduleModule(renderScheduleSection);
    }
})();
