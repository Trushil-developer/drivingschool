// admin.js
(async () => {
    // Wait for common.js to finish loading topbar/sidebar/modal
    await window.CommonReady;

    const tableWrap = document.getElementById('tableWrap');
    const searchInput = document.getElementById('searchInput');
    const addBtn = document.getElementById('addBtn');

    let currentData = [];
    let lastSearch = '';
    const urlParams = new URLSearchParams(window.location.search);
    let currentTab = urlParams.get('tab') || 'bookings';

    const MS_PER_DAY = 1000*60*60*24;

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function filterBookings(bookings, query) {
        if (!query) return bookings;
        query = query.trim().toLowerCase();
        return bookings.filter(b =>
            [b.customer_name, b.mobile_no, b.whatsapp_no, b.branch].some(f => (f||'').toLowerCase().includes(query))
        );
    }

    function filterUpcoming(bookings) {
        const today = new Date(); today.setHours(0,0,0,0);
        return bookings.filter(b => {
            if (!b.starting_from) return false;
            const start = new Date(b.starting_from); start.setHours(0,0,0,0);
            const diffDays = (today - start)/MS_PER_DAY;
            return diffDays >=0 && diffDays <=30;
        });
    }

    async function loadData() {
        try {
            const res = await window.api('/api/bookings');
            if (!res.success) throw new Error(res.error || 'Failed to fetch bookings');
            currentData = res.bookings;
            renderTable();
        } catch (err) {
            console.error(err);
            tableWrap.innerHTML = `<div class="error">Failed to load bookings</div>`;
        }
    }

    function renderTable() {
        let rows = currentData;
        if (currentTab === 'upcoming') rows = filterUpcoming(rows);
        rows = filterBookings(rows, lastSearch);

        if (!rows.length) {
            tableWrap.innerHTML = `<div class="empty">No ${currentTab==='upcoming'?'upcoming':''} bookings found</div>`;
            return;
        }

        let html = `<table class="bookings-table"><thead><tr>`;
        if (currentTab==='upcoming') {
            html += `<th>Name</th><th>Car</th><th>Training Days</th><th>Starting From</th><th>Branch</th><th>Actions</th>`;
        } else {
            html += `<th>ID</th><th>Name</th><th>Mobile</th><th>WhatsApp</th>
                     <th>Branch</th><th>Training Days</th><th>Total Fees</th><th>Advance</th>
                     <th>Starting From</th><th>Actions</th>`;
        }
        html += `</tr></thead><tbody>`;

        rows.forEach(b => {
            html += `<tr id="booking-${b.id}">`;
            if(currentTab==='upcoming'){
                html += `<td>${b.customer_name||'-'}</td>
                         <td>${b.cov_lmv?'LMV':b.cov_mc?'MC':'-'}</td>
                         <td>${b.training_days||'-'}</td>
                         <td>${b.starting_from?formatDate(b.starting_from):'-'}</td>
                         <td>${b.branch||'-'}</td>
                         <td>
                            <button class="btn details" data-id="${b.id}">Details</button>
                            <button class="btn attendance" data-id="${b.id}">Attendance</button>
                         </td>`;
            } else {
                html += `<td>${b.id}</td><td>${b.customer_name||'-'}</td><td>${b.mobile_no||'-'}</td>
                         <td>${b.whatsapp_no||'-'}</td><td>${b.branch||'-'}</td>
                         <td>${b.training_days||'-'}</td><td>${b.total_fees||'-'}</td>
                         <td>${b.advance||'-'}</td><td>${b.starting_from?formatDate(b.starting_from):'-'}</td>
                         <td>
                            <button class="btn details" data-id="${b.id}">Details</button>
                            <button class="btn delete" data-id="${b.id}">Delete</button>
                         </td>`;
            }
            html += `</tr>`;
        });

        html += `</tbody></table>`;
        tableWrap.innerHTML = html;
    }

    tableWrap.addEventListener('click', e => {
        const id = e.target.dataset.id;
        if(!id) return;
        const booking = currentData.find(b => b.id == id);
        if(!booking) return;

        if(e.target.classList.contains('delete')){
            if(confirm("Are you sure?")) {
                window.api(`/api/bookings/${id}`, {method:'DELETE'}).then(loadData);
            }
        }
        if(e.target.classList.contains('details')){
            window.location.href = `details.html?id=${id}`;
        }
        if(e.target.classList.contains('attendance')){
            window.openAttendanceModal({
                ...booking,
                refresh: loadData
            });
        }
    });

    searchInput?.addEventListener('input', e=>{
        lastSearch = e.target.value;
        renderTable();
    });

    addBtn?.addEventListener('click', () => window.location.href = 'index.html');

    // Sidebar highlighting
    const sidebarItems = document.querySelectorAll('.sidebar li');
    function updateActiveTab(){
        sidebarItems.forEach(i=>i.classList.remove('active'));
        const active = Array.from(sidebarItems).find(i=>i.dataset.section===currentTab);
        if(active) active.classList.add('active');
    }
    updateActiveTab();
    sidebarItems.forEach(i => {
        i.addEventListener('click', () => {
            currentTab = i.dataset.section || 'bookings';
            updateActiveTab();
            renderTable();
        });
    });

    await loadData();

})();
