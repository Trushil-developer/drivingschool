(async () => {
    if (window.CommonReady) await window.CommonReady;

    window.Modal.init();
    
    const form = document.getElementById("mainForm");
    if (!form) throw new Error("Form not found");

    const formDate = document.getElementById("form_date");
    if (formDate) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, "0");
        const dd = String(today.getDate()).padStart(2, "0");
        formDate.value = `${yyyy}-${mm}-${dd}`;
    }

    const q = (s) => form.querySelector(s);
    const v = (s) => q(s)?.value.trim() || "";
    const c = (s) => q(s)?.checked || false;
    const getCheckedValues = (name) =>
        [...form.querySelectorAll(`input[name="${name}"]`)]
            .filter((i) => i.checked)
            .map((i) => i.value)
            .join(", ");

    function showModalAlert(message) {
        window.Modal.setContent(`
            <p style="margin-bottom:20px;">${message}</p>
            <button id="modalOk" style="padding:10px 22px;">OK</button>
        `);
        window.Modal.show();
        setTimeout(() => {
            const okBtn = document.getElementById("modalOk");
            if (okBtn) okBtn.onclick = () => window.Modal.hide();
        }, 20);
    }

    function printFullForm() {
        const originalForm = document.getElementById("mainForm");
        const clonedForm = originalForm.cloneNode(true);

        const originalInputs = originalForm.querySelectorAll("input, select");
        const cloneInputs = clonedForm.querySelectorAll("input, select");

        originalInputs.forEach((input, i) => {
            const cloneEl = cloneInputs[i];
            if (!cloneEl) return;

            if (input.type === "checkbox" || input.type === "radio") {
                if (input.checked) cloneEl.setAttribute("checked", "checked");
                else cloneEl.removeAttribute("checked");
            } else {
                cloneEl.value = input.value;
                cloneEl.setAttribute("value", input.value);
            }
        });

        const win = window.open("", "", "width=900,height=1100");

        win.document.write(`
            <html>
                <head>
                    <title>Driving School Registration</title>
                    <link rel="stylesheet" href="/css/form.css">
                    <style>button, #appModal { display:none!important; }</style>
                </head>
                <body>
                    <div class="form-container">
                        <div class="header">
                            <img src="images/logo.png" alt="Driving School Logo">
                            <h1>DWARKESH MOTOR DRIVING SCHOOL</h1>
                        </div>
                        <div class="row">
                            <div class="label">Date:</div>
                            <input type="date" value="${document.getElementById("form_date").value}">
                        </div>
                        ${clonedForm.outerHTML}
                    </div>
                </body>
            </html>
        `);

        win.document.close();
        win.focus();

        setTimeout(() => {
            win.print();
            win.close();
        }, 300);
    }

    const isAtLeastYearsOld = (dateStr, years) => {
        const birth = new Date(dateStr);
        const today = new Date();
        birth.setFullYear(birth.getFullYear() + years);
        return birth <= today;
    };

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const body = {};
        body.branch = getCheckedValues("branch");
        body.training_days = v('input[name="training_days"]:checked');
        body.car_names = getCheckedValues("car");
        body.customer_name = v("input[name='customer_name']");
        body.address = v("input[name='address']");
        body.pincode = v("input[name='pincode']");
        body.mobile_no = v("input[name='mobile_no']");
        body.whatsapp_no = v("input[name='whatsapp_no']");
        body.sex = v("select[name='sex']");
        body.birth_date = v("input[name='birth_date']");
        body.cov_lmv = c("input[name='cov_lmv']");
        body.cov_mc = c("input[name='cov_mc']");
        body.dl_no = v("input[name='dl_no']");
        body.dl_from = v("input[name='dl_from']");
        body.dl_to = v("input[name='dl_to']");
        body.email = v("input[name='email']");
        body.occupation = v("input[name='occupation']");
        body.ref = v("input[name='ref']");
        body.allotted_time = v("input[name='allotted_time']");
        let timeStr = body.allotted_time;
        if (timeStr) {
            const [time, modifier] = timeStr.split(' ');
            let [hours, minutes] = time.split(':').map(Number);
            if (modifier === "PM" && hours !== 12) hours += 12;
            if (modifier === "AM" && hours === 12) hours = 0;
            body.allotted_time = `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00`;
        } else {
            body.allotted_time = "";
        }
        body.starting_from = v("input[name='starting_from']");
        body.total_fees = v("input[name='total_fees']");
        body.advance = v("input[name='advance']");
        body.instructor_name = v("select[name='instructor_name']");
        body.instructor_id = null;

        // Validation
        if (!body.branch) return showModalAlert("Please select branch.");
        if (!body.training_days) return showModalAlert("Please select training days.");
        if (!body.car_names) return showModalAlert("Please select one car.");
        if (!body.customer_name) return showModalAlert("Please enter your full name.");
        if (!body.address) return showModalAlert("Please enter your address.");
        if (!body.pincode) return showModalAlert("Please enter pincode.");
        if (!body.mobile_no) return showModalAlert("Please enter your mobile number.");
        if (!body.whatsapp_no) return showModalAlert("Please enter your WhatsApp number.");
        if (!body.sex) return showModalAlert("Please select your sex.");
        if (!body.birth_date) return showModalAlert("Please enter your birth date.");
        if (!isAtLeastYearsOld(body.birth_date, 16)) 
            return showModalAlert("You must be at least 16 years old.");
        if (!body.email) return showModalAlert("Please enter your email.");
        if (!body.occupation) return showModalAlert("Please enter your occupation.");
        if (!body.allotted_time) return showModalAlert("Please select the allotted time.");
        if (!body.starting_from) return showModalAlert("Please select the start date.");
        if (!body.total_fees) return showModalAlert("Please enter the total fees.");
        if (!body.advance) return showModalAlert("Please enter the advance amount.");
        if (!body.instructor_name) return showModalAlert("Please enter the instructor name.");
        if (!document.getElementById("accept_notes").checked) 
            return showModalAlert("Please confirm that you have read and accepted the notes.");

        const submitBtn = form.querySelector("button[type='submit']");
        submitBtn.disabled = true;

        // Show success modal
        window.Modal.setContent(`
            <h2 style="margin-bottom:10px;">Booking Successful</h2>
            <p><br>Would you like to print the form?</p>
            <div style="margin-top:20px;">
                <button id="modalPrint" style="padding:10px 22px;">Print</button>
                <button id="modalCancel" style="padding:10px 22px;">Cancel</button>
            </div>
        `);
        window.Modal.show();

        setTimeout(() => {
            const printBtn = document.getElementById("modalPrint");
            const cancelBtn = document.getElementById("modalCancel");
            if (printBtn) printBtn.onclick = () => { printFullForm(); window.Modal.hide(); if(window._shouldResetForm) form.reset(); };
            if (cancelBtn) cancelBtn.onclick = () => { window.Modal.hide(); if(window._shouldResetForm) form.reset(); };
        }, 20);

        try {
            const res = await fetch("/api/bookings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();
            if (data.success) window._shouldResetForm = true;
            else showModalAlert("Error: " + data.error);

        } catch {
            showModalAlert("Server error. Try again later.");
        } finally {
            submitBtn.disabled = false;
        }
    });

})();
