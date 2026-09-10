// "Find Your Driver" — customers request a hired driver for their own car for
// a day or two. This module lists those requests and lets an admin assign an
// instructor, quote a price, add a note and move the status along.
//
// Follows the same shape as renderScheduleRequestsModule.js:
//   window.renderDriverHireModule(container)(filterStatus)

window.renderDriverHireModule = function (container) {
  const STATUSES = ['Requested', 'Assigned', 'In Progress', 'Completed', 'Cancelled'];

  const esc = s => String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const fmtDate = s => {
    const d = new Date(s);
    if (isNaN(d)) return s || '—';
    return d.getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()] + ' ' + d.getFullYear();
  };
  const fmtDateTime = s => {
    const d = new Date(s);
    if (isNaN(d)) return '—';
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }).format(d);
  };

  const statusCls = s =>
    s === 'Completed' ? 'status-completed'
    : s === 'Cancelled' ? 'status-reverted'
    : s === 'Assigned' ? 'status-active'
    : s === 'In Progress' ? 'status-hold'
    : 'status-pending';

  return async function render(filterStatus = '') {
    container.innerHTML = `<div class="loading-spinner">Loading driver hire requests...</div>`;

    try {
      const url = '/api/admin/driver-hire-requests' + (filterStatus ? `?status=${encodeURIComponent(filterStatus)}` : '');
      const [res, instRes] = await Promise.all([
        window.api(url),
        window.api('/api/instructors').catch(() => ({ success: false })),
      ]);
      if (!res.success) throw new Error(res.error || 'Failed to load');

      const reqs = res.requests || [];
      const instructors = (instRes && instRes.success ? instRes.instructors : [])
        .filter(i => i.is_active == null || i.is_active)
        .sort((a, b) => (a.instructor_name || '').localeCompare(b.instructor_name || ''));

      const filterBar = `
        <div class="leave-filter-bar" style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
          ${['', ...STATUSES].map(s => `
            <button class="btn driver-hire-filter-btn ${filterStatus === s ? 'btn-primary' : ''}" data-status="${s}">
              ${s || 'All'}
            </button>`).join('')}
        </div>`;

      if (!reqs.length) {
        container.innerHTML = filterBar + `<div class="empty">No driver hire requests found</div>`;
        wireFilters();
        return;
      }

      const instOptions = start => `
        <option value="">— Select driver —</option>
        ${instructors.map(i => `<option value="${i.id}" ${String(start) === String(i.id) ? 'selected' : ''}>${esc(i.instructor_name)}${i.role && i.role !== 'Instructor' ? ` (${esc(i.role)})` : ''}</option>`).join('')}`;

      const rows = reqs.map(r => {
        const daysLabel = `${r.num_days} day${r.num_days > 1 ? 's' : ''}`;
        const priceLabel = r.quoted_price != null ? `₹${Number(r.quoted_price).toLocaleString('en-IN')}` : '—';
        const car = [r.car_model, r.transmission].filter(Boolean).join(' · ') || '—';
        const noteRow = r.admin_note ? `<div style="color:#9ba3b2;font-size:12px;margin-top:2px">Note: ${esc(r.admin_note)}</div>` : '';

        return `
          <tr>
            <td>
              <div style="font-weight:600">${esc(r.student_name || '—')}</div>
              <div style="color:#9ba3b2;font-size:12px">
                <a href="tel:${esc(r.contact_phone)}">${esc(r.contact_phone)}</a>
              </div>
              <div style="color:#9ba3b2;font-size:11px">${esc(r.student_email)}</div>
            </td>
            <td>${fmtDate(r.service_date)}<br><span style="color:#9ba3b2">${daysLabel}</span></td>
            <td>${esc(car)}</td>
            <td>
              ${r.area ? `<div>${esc(r.area)}</div>` : ''}
              <div style="color:#9ba3b2;font-size:12px;white-space:pre-wrap">${esc(r.pickup_address)}</div>
              ${r.notes ? `<div style="color:#9ba3b2;font-size:12px;margin-top:2px">“${esc(r.notes)}”</div>` : ''}
            </td>
            <td>${esc(r.assigned_instructor_name || '—')}</td>
            <td>${priceLabel}</td>
            <td>
              <span class="status-badge ${statusCls(r.status)}">${r.status}</span>${noteRow}
              <div style="color:#9ba3b2;font-size:11px;margin-top:2px">${fmtDateTime(r.created_at)}</div>
            </td>
            <td>
              <button class="btn driver-hire-manage" data-id="${r.id}" style="background:#185fa5;color:#fff">Manage</button>
            </td>
          </tr>
          <tr class="driver-hire-editor" data-editor-for="${r.id}" style="display:none">
            <td colspan="8" style="background:#f7f9fc">
              <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-end;padding:8px 4px">
                <label style="display:flex;flex-direction:column;font-size:12px;gap:4px">
                  Driver
                  <select class="dh-instructor" style="min-width:200px;padding:6px">${instOptions(r.assigned_instructor_id)}</select>
                </label>
                <label style="display:flex;flex-direction:column;font-size:12px;gap:4px">
                  Quoted price (₹)
                  <input class="dh-price" type="number" min="0" step="1" value="${r.quoted_price != null ? Number(r.quoted_price) : ''}" style="width:130px;padding:6px" />
                </label>
                <label style="display:flex;flex-direction:column;font-size:12px;gap:4px">
                  Status
                  <select class="dh-status" style="min-width:150px;padding:6px">
                    ${STATUSES.map(s => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>
                </label>
                <label style="display:flex;flex-direction:column;font-size:12px;gap:4px;flex:1;min-width:220px">
                  Note for customer (optional)
                  <input class="dh-note" type="text" maxlength="2000" value="${esc(r.admin_note || '')}" style="padding:6px" />
                </label>
                <button class="btn btn-primary driver-hire-save" data-id="${r.id}">Save</button>
                <button class="btn driver-hire-cancel-edit" data-id="${r.id}">Close</button>
              </div>
            </td>
          </tr>`;
      }).join('');

      container.innerHTML = filterBar + `
        <table class="bookings-table">
          <thead>
            <tr>
              <th>Customer</th><th>From · Duration</th><th>Their Car</th>
              <th>Area / Pickup</th><th>Assigned Driver</th><th>Quote</th>
              <th>Status</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;

      wireFilters();

      // Toggle the editor row
      container.querySelectorAll('.driver-hire-manage').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = container.querySelector(`.driver-hire-editor[data-editor-for="${btn.dataset.id}"]`);
          if (row) row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
        });
      });
      container.querySelectorAll('.driver-hire-cancel-edit').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = container.querySelector(`.driver-hire-editor[data-editor-for="${btn.dataset.id}"]`);
          if (row) row.style.display = 'none';
        });
      });

      // Save
      container.querySelectorAll('.driver-hire-save').forEach(btn => {
        btn.addEventListener('click', async () => {
          const wrap = container.querySelector(`.driver-hire-editor[data-editor-for="${btn.dataset.id}"]`);
          if (!wrap) return;
          const body = {
            assigned_instructor_id: wrap.querySelector('.dh-instructor').value || null,
            quoted_price: wrap.querySelector('.dh-price').value,
            status: wrap.querySelector('.dh-status').value,
            admin_note: wrap.querySelector('.dh-note').value.trim() || null,
          };
          btn.disabled = true;
          const orig = btn.textContent;
          btn.textContent = 'Saving…';
          try {
            const r = await window.api(`/api/admin/driver-hire-requests/${btn.dataset.id}`, {
              method: 'PATCH',
              body: JSON.stringify(body),
            });
            if (!r.success) throw new Error(r.error || 'Failed');
            await render(filterStatus);
            window.refreshDriverHireBadge?.();
          } catch (e) {
            alert('Error: ' + e.message);
            btn.disabled = false;
            btn.textContent = orig;
          }
        });
      });

    } catch (err) {
      console.error(err);
      container.innerHTML = `<div class="error">${esc(err.message)}</div>`;
    }

    function wireFilters() {
      container.querySelectorAll('.driver-hire-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => render(btn.dataset.status));
      });
    }
  };
};
