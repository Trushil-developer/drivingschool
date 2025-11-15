const form = document.getElementById("mainForm");

if (!form) {
    console.error("❌ FORM NOT FOUND — check script path or ID.");
}

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const q = (selector) => form.querySelector(selector);
    const v = (selector) => q(selector)?.value || "";
    const c = (selector) => q(selector)?.checked || false;

    const body = {};

    body.branch = [...form.querySelectorAll('input[name="branch"]')]
        .filter(i => i.checked)
        .map(i => i.value)
        .join(", ");

    body.training_days = v('input[name="training_days"]:checked');

    body.car_names = [...form.querySelectorAll('input[name="car"]')]
        .filter(i => i.checked)
        .map(i => i.value)
        .join(", ");

    body.customer_name = v('input[name="customer_name"]');
    body.address = v('input[name="address"]');
    body.mobile_no = v('input[name="mobile_no"]');
    body.whatsapp_no = v('input[name="whatsapp_no"]');

    body.sex = v('select[name="sex"]');
    body.birth_date = v('input[name="birth_date"]');

    body.cov_lmv = c('input[name="cov_lmv"]');
    body.cov_mc = c('input[name="cov_mc"]');

    body.dl_no = v('input[name="dl_no"]');
    body.dl_from = v('input[name="dl_from"]');
    body.dl_to = v('input[name="dl_to"]');

    body.email = v('input[name="email"]');
    body.occupation = v('input[name="occupation"]');
    body.ref = v('input[name="ref"]');

    body.allotted_time = v('input[name="allotted_time"]');
    body.starting_from = v('input[name="starting_from"]');

    body.total_fees = v('input[name="total_fees"]');
    body.advance = v('input[name="advance"]');

    body.instructor_name = v('input[name="instructor_name"]');
    body.instructor_id = null;

    body.notes = document.querySelector(".note")?.innerText || "";

    if (!body.customer_name.trim()) return alert("Please enter Name");
    if (!body.mobile_no.trim()) return alert("Please enter Mobile No.");
    if (!body.training_days) return alert("Please select Training Days");
    if (!body.branch) return alert("Please select Branch");

    const printConfirm = confirm("Booking saved successfully!\nDo you want to print this form?");
    if (printConfirm) window.print();

    try {
        const res = await fetch("/api/bookings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });

        const data = await res.json();

        if (data.success) {
            form.reset();
        } else {
            alert("Error: " + data.error);
        }

    } catch (err) {
        console.error("❌ Server error:", err);
        alert("Server error. Try again later.");
    }
});
