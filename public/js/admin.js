import { downloadCertificate, uploadCertificate } from "./globals/certificates.js";
import { loadFilterBranches, filterData, attachFilterListeners } from "./globals/filters.js";

window.renderScheduleSectionFactory = null;
window.registerScheduleModule = function (factory) {
    window.renderScheduleSectionFactory = factory;
};

(async () => {
    await window.CommonReady;

    loadFilterBranches();
   
    const tableWrap = document.getElementById('tableWrap');
    const searchInput = document.getElementById('searchInput');
    const addBtn = document.getElementById('addBtn');

    const urlParams = new URLSearchParams(window.location.search);
    let currentTab = urlParams.get('tab') || 'bookings';
    let lastSearch = '';

    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    function showLoading() {
        tableWrap.innerHTML = `<div class="loading-overlay">Loading...</div>`;
    }

    function hideLoading() {
        const overlay = tableWrap.querySelector('.loading-overlay');
        if (overlay) overlay.remove();
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    function filterUpcoming(bookings) {
        const today = new Date(); 
        today.setHours(0,0,0,0);

        return bookings.filter(b => {
            if (!b.starting_from) return false;
            if (b.attendance_fulfilled) return false;
            if (b.attendance_status !== "Active") return false;

            const start = new Date(b.starting_from); 
            start.setHours(0,0,0,0);
            const diffDays = (today - start) / MS_PER_DAY;
            return diffDays >= 0 && diffDays <= 30;
        });
    }


    
    const tabRenderers = {
        bookings: async () => {
            showLoading();
            try {
                const res = await window.api('/api/bookings');
                 console.log(res)
                if (!res.success) throw new Error(res.error || 'Failed to fetch bookings');

                const rows = filterData('bookings', res.bookings, lastSearch);

                if (!rows.length) {
                    tableWrap.innerHTML = '<div class="empty">No bookings found</div>';
                    return;
                }

                const scrollTop = window.scrollY || document.documentElement.scrollTop;
               

                const html = `
                    <table class="bookings-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Car</th>
                                <th>Instructor</th>
                                <th>Branch</th>
                                <th>Attendance</th>
                                <th>Status</th>
                                <th>Total Fees</th>
                                <th>Starting From</th>
                                <th>Certificate</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(b => `
                                <tr id="booking-${b.id}">
                                    <td>${b.id}</td>
                                    <td>
                                        <a href="details.html?id=${b.id}" class="customer-link">
                                            ${b.customer_name || '-'}
                                        </a>
                                    </td>
                                    <td>${b.car_name || '-'}</td>
                                    <td>${b.instructor_name || '-'}</td>
                                    <td>${b.branch || '-'}</td>
                                    <td>${b.present_days || 0}/${b.training_days || '-'}</td>
                                    <td class="status-${b.attendance_status.toLowerCase()}">${b.attendance_status || '-'}</td>
                                    <td>${b.advance || 0}/${b.total_fees || 0}</td>
                                    <td>${b.starting_from ? formatDate(b.starting_from) : '-'}</td>
                                    <td>
                                        ${
                                            b.certificate_url && b.certificate_url !== "null"
                                                ? `<a class="btn download-cert" data-id="${b.id}">Download</a>`
                                                : b.attendance_status === "Completed"
                                                    ? `<span class="missing">Missing...</span>`
                                                    : `<button class="btn upload" data-id="${b.id}">Upload</button>`
                                        }
                                    </td>
                                    <td>
                                        <button class="btn delete" data-id="${b.id}">Delete</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                tableWrap.innerHTML = html;
                window.scrollTo(0, scrollTop);
            } catch (err) {
                console.error(err);
                tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
            } finally {
                hideLoading();
            }
        },
        upcoming: async () => {
            showLoading();
            try {
                const res = await window.api('/api/bookings');
                if (!res.success) throw new Error(res.error || 'Failed to fetch bookings');

                const bookings = res.bookings;

                const allAtt = await window.api('/api/attendance-all');

                const attendanceMap = {};
                for (let row of allAtt.records) {
                    if (!attendanceMap[row.booking_id]) {
                        attendanceMap[row.booking_id] = [];
                    }
                    attendanceMap[row.booking_id].push(row);
                }

               for (let b of bookings) {
                    const existingAttendance = attendanceMap[b.id] || [];
                    const totalDays = parseInt(b.training_days, 10) || 0; 
                    const totalAttended = existingAttendance.reduce((sum, e) => {
                        const val = Number(e.present);
                        return sum + (isNaN(val) ? 0 : val);
                    }, 0);

                    b.present_days = totalAttended;

                    // If totalAttended >= training_days AND status is not Completed, update DB
                    if(totalAttended >= totalDays && b.attendance_status !== "Completed") {
                        b.attendance_status = "Completed"; // Update in-memory
                        b.attendance_fulfilled = true;

                        // Update DB
                        await window.api(`/api/bookings/${b.id}`, {
                            method: 'PUT',   // or PUT depending on your API
                            body: JSON.stringify({ attendance_status: "Completed" })
                        });
                    } else {
                        b.attendance_fulfilled = false;
                        if(b.attendance_status !== "Completed") b.attendance_status = "Active";
                    }
                }


                const rows = filterData('bookings', filterUpcoming(bookings), lastSearch);

                if (!rows.length) {
                    tableWrap.innerHTML = '<div class="empty">No upcoming bookings found</div>';
                    return;
                }

                const scrollTop = window.scrollY || document.documentElement.scrollTop;

                const html = `
                    <table class="bookings-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Car</th>
                                <th>Instructor</th>
                                <th>Branch</th>
                                <th>Attendance</th>
                                <th>Status</th>
                                <th>Starting From</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(b => `
                                <tr id="booking-${b.id}">
                                    <td>${b.id}</td>
                                    <td>
                                        <a href="#" class="customer-link" data-id="${b.id}">
                                            ${b.customer_name || '-'}
                                        </a>
                                    </td>
                                    <td>${b.car_name || '-'}</td>
                                    <td>${b.instructor_name || '-'}</td>
                                    <td>${b.branch || '-'}</td>
                                    <td>${b.present_days || 0}/${b.training_days || '-'}</td>
                                    <td class="status-${b.attendance_status.toLowerCase()}">${b.attendance_status || '-'}</td>
                                    <td>${b.starting_from ? formatDate(b.starting_from) : '-'}</td>
                                    <td>
                                        <button class="btn attendance" data-id="${b.id}">Attendance</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                tableWrap.innerHTML = html;
                window.scrollTo(0, scrollTop);
            } catch (err) {
                console.error(err);
                tableWrap.innerHTML = `<div class="error">${err.message}</div>`;
            } finally {
                hideLoading();
            }
        },
        instructors: async () => {
            showLoading();
            try {
                if (typeof window.renderInstructorsModule !== "function") {
                    tableWrap.innerHTML = '<div class="error">Instructors module not loaded</div>';
                    return;
                }
                const renderer = window.renderInstructorsModule(tableWrap, tabRenderers, currentTab);
                await renderer();
            } finally {
                hideLoading();
            }
        },
        cars: async () => {
            showLoading();
            try {
                if (typeof window.renderCarsModule !== "function") {
                    tableWrap.innerHTML = '<div class="error">Cars module not loaded</div>';
                    return;
                }
                await window.renderCarsModule(tableWrap, tabRenderers, currentTab)();
            } finally {
                hideLoading();
            }
        },
        branches: async () => {
            showLoading();
            try {
                if (typeof window.renderBranchesModule !== "function") {
                    tableWrap.innerHTML = '<div class="error">Branches module not loaded</div>';
                    return;
                }
                const renderer = window.renderBranchesModule(tableWrap);
                await renderer();
            } finally {
                hideLoading();
            }
        },
        schedule: async () => {
            showLoading();
            try {
                if (typeof window.renderScheduleModule !== "function") {
                    tableWrap.innerHTML = '<div class="error">Schedule module not loaded</div>';
                    return;
                }
                const renderer = window.renderScheduleModule(tableWrap);
                await renderer();
            } finally {
                hideLoading();
            }
        },
        trainingDays: async () => {
            showLoading();
            try {
                if(typeof window.renderTrainingDaysModule !== "function") {
                    tableWrap.innerHTML = '<div class="error">Training Days module not loaded</div>';
                    return;
                }
                const renderer = window.renderTrainingDaysModule(tableWrap);
                await renderer();
            } finally {
                hideLoading();
            }
        },
        enquiries: async () => {
            showLoading();
            try {
                if (typeof window.renderEnquiryModule !== "function") {
                    tableWrap.innerHTML = '<div class="error">Enquiries module not loaded</div>';
                    return;
                }
                await window.renderEnquiryModule(tableWrap);
            } finally {
                hideLoading();
            }
        },
        courses: async () => {
            showLoading();
            try {
                if (typeof window.renderCoursesModule !== "function") {
                    tableWrap.innerHTML = '<div class="error">Courses module not loaded</div>';
                    return;
                }
                const renderer = window.renderCoursesModule(tableWrap, tabRenderers, currentTab);
                await renderer();
            } finally {
                hideLoading();
            }
        }
    };

    attachFilterListeners(tabRenderers, () => currentTab);

    const sidebarItems = document.querySelectorAll('.sidebar li');

    async function switchTab(tab) {
        currentTab = tab;
        sidebarItems.forEach(i => i.classList.toggle('active', i.dataset.section === tab));

        const filterBar = document.getElementById('filterBar');

        if (filterBar) {
            if (tab === 'bookings' || tab === 'upcoming') {
                filterBar.classList.remove('hidden');
            } else {
                filterBar.classList.add('hidden');
            }
        }

        if (tab === 'schedule' || tab === 'enquiries') {
            searchInput?.classList.add('hidden');
            addBtn?.classList.add('hidden');
        } else if (tab === 'trainingDays' || tab === 'courses') {
            searchInput?.classList.add('hidden'); 
            addBtn?.classList.remove('hidden'); 
        } else if (tab === 'cars' || tab == 'branches' || tab == 'instructors'  ) {
            searchInput?.classList.add('hidden'); 
        } else {
            searchInput?.classList.remove('hidden');
            addBtn?.classList.remove('hidden');
        }

        if(tabRenderers[tab]) await tabRenderers[tab]();

        const newUrl = new URL(window.location);
        newUrl.searchParams.set('tab', tab);
        window.history.replaceState({}, '', newUrl);
    }


    sidebarItems.forEach(i => {
        i.addEventListener('click', e => {
            e.preventDefault();
            switchTab(i.dataset.section || 'bookings');
        });
    });

    searchInput?.addEventListener('input', e => {
        lastSearch = e.target.value;
        if(tabRenderers[currentTab]) tabRenderers[currentTab]();
    });

    addBtn?.addEventListener("click", e => {
        e.preventDefault();
        if (currentTab === "instructors") window.openInstructorAddModal(tabRenderers, currentTab)();
        else if (currentTab === "cars") window.openCarAddModal(tabRenderers, currentTab)();
        else if (currentTab === "branches") openBranchModal(tabRenderers, currentTab)();
        else if (currentTab === "trainingDays") openTrainingDaysModal(tabRenderers, currentTab);
        else if (currentTab === "courses") window.openCourseAddModal(tabRenderers, currentTab)();
        else window.location.href = "index.html";
    });

    // Click handlers (delete/edit) remain unchanged
    tableWrap.addEventListener('click', async e => {
        const id = e.target.dataset.id;
        if (!id) return;
        

        if (e.target.classList.contains('upload')) {
            const bookingId = e.target.dataset.id;
            uploadCertificate(bookingId, () => {
                if (tabRenderers[currentTab]) tabRenderers[currentTab]();
            });
        }

        if (e.target.classList.contains("download-cert")) {
            const bookingId = e.target.dataset.id;
            downloadCertificate(bookingId);
        }

        if (e.target.classList.contains('customer-link')) {
            e.preventDefault();
            const id = e.target.dataset.id;
            if(currentTab === 'bookings') {
                window.location.href = `details.html?id=${id}`;
            } else if(currentTab === 'upcoming') {
                const bookings = (await window.api('/api/bookings')).bookings;
                const booking = bookings.find(b => b.id == id);
                window.openAttendanceModal({ ...booking, refresh: () => tabRenderers[currentTab]() });
            }
        }
        
        if (e.target.classList.contains('delete')) {
            const pwd = prompt("Enter admin password to delete:");
            if (!pwd) return alert("Deletion cancelled");
            if (pwd !== "1234") return alert("Incorrect password!");
            const deleteApiMap = {
                bookings: '/api/bookings',
                instructors: '/api/instructors',
                cars: '/api/cars',
                branches: '/api/branches',
                trainingDays: '/api/training-days',
                courses: '/api/courses'
            };
            try {
                const res = await window.api(`${deleteApiMap[currentTab]}/${id}`, { method: "DELETE" });
                if (!res.success) return alert(res.error || "Delete failed");
                alert("Deleted successfully!");
                if (tabRenderers[currentTab]) tabRenderers[currentTab]();
            } catch (err) { console.error(err); alert("Error deleting record"); }
        }

        if(e.target.classList.contains('details') && currentTab === 'bookings') {
            window.location.href = `details.html?id=${id}`;
        }
        if(e.target.classList.contains('attendance') && currentTab === 'upcoming') {
            const bookings = (await window.api('/api/bookings')).bookings;
            const booking = bookings.find(b => b.id == id);
            window.openAttendanceModal({ ...booking, refresh: () => tabRenderers[currentTab]() });
        }
        if(e.target.classList.contains('edit-car') && currentTab === 'cars') {
            const data = {
                car_name: e.target.dataset.name || '',
                branch: e.target.dataset.branch || '', 
                car_registration_no: e.target.dataset.car_registration_no || '',
                insurance_policy_no: e.target.dataset.insurance_policy_no || '',
                insurance_company: e.target.dataset.insurance_company || '',
                insurance_issue_date: e.target.dataset.insurance_issue_date || '',
                insurance_expiry_date: e.target.dataset.insurance_expiry_date || '',
                puc_issue_date: e.target.dataset.puc_issue_date || '',
                puc_expiry_date: e.target.dataset.puc_expiry_date || ''
            };
            window.openCarEditModal(id, data, tabRenderers, currentTab)();
        }
        if(e.target.classList.contains('edit-instructor') && currentTab === 'instructors') {
            const data = {
                instructor_name: e.target.dataset.name,
                email: e.target.dataset.email,
                mobile_no: e.target.dataset.mobile,
                branch: e.target.dataset.branch,
                drivers_license: e.target.dataset.license,
                adhar_no: e.target.dataset.adhar,
                address: e.target.dataset.address,
            };
            openInstructorEditModal(id, data);
        }
        if (e.target.classList.contains('edit-branch') && currentTab === 'branches') {
            const data = {
                branch_name: e.target.dataset.name,
                city: e.target.dataset.city,
                state: e.target.dataset.state,
                mobile_no: e.target.dataset.mobile,
                email: e.target.dataset.email,
            };
            openBranchEditModal(id, data, tabRenderers, currentTab)();
        }
        if (e.target.classList.contains("edit-course") && currentTab === "courses") {
            const data = {
                name: e.target.dataset.name || "",
                duration: e.target.dataset.duration || "",
                fees: e.target.dataset.fees || "",
                description: e.target.dataset.description || "",
                status: e.target.dataset.status || "active"
            };
            window.openCourseEditModal(id, data, tabRenderers, currentTab)();
        }


    });
    await switchTab(currentTab);
})();

window.addEventListener("DOMContentLoaded", () => {
    const sidebar = document.getElementById("sidebar");
    const toggleBtn = document.getElementById("sidebarToggle");

    toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("active");
    });

    // Optional: close sidebar when clicking outside
    document.addEventListener("click", (e) => {
        if (!sidebar.contains(e.target) && !toggleBtn.contains(e.target)) {
            sidebar.classList.remove("active");
        }
    });
});
