document.addEventListener("DOMContentLoaded", async () => {

    /* =====================================================
       STATE
    ===================================================== */
    let verifyMethod = "email"; // email | mobile
    let otpVerified = false;
    let otpTimer = 60;
    let otpInterval = null;
    let resendAttempts = 0;

    const MAX_RESENDS = 3;
    const OTP_LENGTH = 4;

    /* =====================================================
       ELEMENTS
    ===================================================== */
    const enquiryForm = document.getElementById("enquiryForm");

    const branchSelect = document.getElementById("branch");
    const courseSelect = document.getElementById("course");

    const emailInput = document.getElementById("email");
    const sendOtpBtn = document.getElementById("sendOtpBtn");
    const otpSection = document.getElementById("otpSection");
    const otpInputs = document.querySelectorAll(".otp-input");

    const resendBtn = document.getElementById("resendOtpBtn");
    const otpTimerText = document.getElementById("otpTimer");
    const otpTargetPreview = document.getElementById("otpTargetPreview");

    const BYPASS_OTP = false;

    /* =====================================================
       STEP NAVIGATION
    ===================================================== */
    const steps = document.querySelectorAll(".form-step");
    const stepIndicators = document.querySelectorAll(".step");
    let currentStep = 0;

    function showStep(index) {
        steps.forEach((step, i) => {
            step.classList.toggle("active", i === index);
            if (stepIndicators[i]) {
                stepIndicators[i].classList.toggle("active", i === index);
            }
        });
    }

    showStep(0);

    document.querySelectorAll(".next-btn").forEach(btn => {
        btn.addEventListener("click", () => {

            const currentForm = steps[currentStep];
            const requiredFields = currentForm.querySelectorAll("[required]");

            for (let field of requiredFields) {
                if (!field.value.trim()) {
                    field.focus();
                    alert("Please fill all required fields.");
                    return;
                }
            }


            if (currentStep === 0) {
                if (verifyMethod === "mobile") {
                    alert("📱 Mobile verification is coming soon.\nPlease use Email verification to continue.");
                    return;
                }
                if (!otpVerified && !BYPASS_OTP) {
                    alert("Please verify your email before continuing.");
                    return;
                }
            }

            if (currentStep < steps.length - 1) {
                currentStep++;
                showStep(currentStep);
            }
        });
    });

    document.querySelectorAll(".back-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            if (currentStep > 0) {
                currentStep--;
                showStep(currentStep);
            }
        });
    });

    /* =====================================================
    VERIFY METHOD SELECTION (EMAIL / MOBILE)
    ===================================================== */
    const verifyCards = document.querySelectorAll(".verify-card");

    if (verifyCards.length) {
        verifyCards.forEach(card => {
            card.addEventListener("click", () => {

                verifyCards.forEach(c => c.classList.remove("active"));
                card.classList.add("active");

                verifyMethod = card.dataset.method; // email | mobile

                // Reset verification state
                otpVerified = false;
                resendAttempts = 0;
                clearInterval(otpInterval);

                otpSection.style.display = "none";
                resendBtn.style.display = "inline-block";
                otpTimerText.textContent = "";

                sendOtpBtn.disabled = false;
                sendOtpBtn.textContent = "Send Verification Code";
                emailInput.disabled = false;
            });
        });
    }
    ;

    /* =====================================================
       OTP TIMER
    ===================================================== */
    function startOtpTimer() {
        otpTimer = 60;
        resendBtn.disabled = true;
        otpTimerText.textContent = `Resend OTP in ${otpTimer}s`;

        clearInterval(otpInterval);

        otpInterval = setInterval(() => {
            otpTimer--;
            otpTimerText.textContent = `Resend OTP in ${otpTimer}s`;

            if (otpTimer <= 0) {
                clearInterval(otpInterval);
                otpTimerText.textContent = "Didn't receive OTP?";
                resendBtn.disabled = false;
            }
        }, 1000);
    }

    /* =====================================================
       SEND OTP
    ===================================================== */
    sendOtpBtn.addEventListener("click", async () => {

        const name = document.getElementById("name").value.trim();
        if (name.length < 2) {
            alert("Please enter your full name.");
            document.getElementById("name").focus();
            return;
        }

        const phone = document.getElementById("phone").value.trim();
        if (!/^[6-9]\d{9}$/.test(phone)) {
            alert("Please enter a valid 10-digit mobile number.");
            document.getElementById("phone").focus();
            return;
        }


        const email = emailInput.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            alert("Please enter a valid email address.");
            return;
        }

        // ===============================
        // 🔥 BYPASS OTP MODE
        // ===============================
        if (BYPASS_OTP) {
            otpVerified = true;
            emailInput.disabled = true;

            otpSection.style.display = "block";
            otpTargetPreview.textContent = email;
            otpTimerText.textContent = "Email verified (Test mode) ✅";
            resendBtn.style.display = "none";

            sendOtpBtn.disabled = true;
            sendOtpBtn.textContent = "Verified ✅";

            return; // ⛔ STOP HERE (no API call)
        }

        // ===============================
        // NORMAL OTP FLOW
        // ===============================
        if (verifyMethod === "mobile") {
            alert("📱 Mobile OTP coming soon. Use email verification.");
            return;
        }

        try {
            sendOtpBtn.disabled = true;
            sendOtpBtn.textContent = "Sending...";
            emailInput.disabled = true;
            document.getElementById("phone").disabled = true;

            const res = await fetch("/api/enquiries/send-email-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.message);

            otpSection.style.display = "block";
            otpTargetPreview.textContent = email;

            otpInputs.forEach(i => i.value = "");
            otpInputs[0].focus();

            startOtpTimer();

        } catch (err) {
            alert(err.message || "Failed to send OTP.");
            sendOtpBtn.disabled = false;
            sendOtpBtn.textContent = "Send Verification Code";
            emailInput.disabled = false;
        }
    });

    /* =====================================================
       VERIFY OTP
    ===================================================== */
    async function verifyOtp() {
        if (BYPASS_OTP) return;
        const otp = Array.from(otpInputs).map(i => i.value).join("");
        const email = emailInput.value.trim();

        if (otp.length !== OTP_LENGTH) return;

        try {
            const res = await fetch("/api/enquiries/verify-email-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp })
            });

            const data = await res.json();
            if (!data.success) throw new Error();

            otpVerified = true;
            clearInterval(otpInterval);

            otpTimerText.textContent = "Email verified successfully ✅";
            resendBtn.style.display = "none";
            sendOtpBtn.textContent = "Verified ✅";

        } catch {
            alert("Invalid OTP. Please try again.");
            otpInputs.forEach(i => i.value = "");
            otpInputs[0].focus();
        }
    }

    /* =====================================================
       RESEND OTP
    ===================================================== */
    resendBtn.addEventListener("click", async () => {
        if (resendAttempts >= MAX_RESENDS) {
            alert("Maximum resend attempts reached. Try again later.");
            return;
        }

        resendAttempts++;
        resendBtn.disabled = true;

        try {
            const res = await fetch("/api/enquiries/send-email-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: emailInput.value.trim() })
            });

            const data = await res.json();
            if (!data.success) throw new Error();

            otpInputs.forEach(i => i.value = "");
            otpInputs[0].focus();
            startOtpTimer();

        } catch {
            alert("Failed to resend OTP. Please try again.");
            resendBtn.disabled = false;
        }
    });

    /* =====================================================
       OTP INPUT UX
    ===================================================== */
    otpInputs.forEach((input, index) => {
        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "");
            if (input.value && otpInputs[index + 1]) {
                otpInputs[index + 1].focus();
            }
            if (Array.from(otpInputs).every(i => i.value.length === 1)) {
                verifyOtp();
            }
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !input.value && otpInputs[index - 1]) {
                otpInputs[index - 1].focus();
            }
        });
    });

    /* =====================================================
       LOAD BRANCHES
    ===================================================== */
    if (branchSelect) {
        try {
            const res = await fetch("/api/branches");
            const data = await res.json();
            if (!data.success) throw new Error();

            branchSelect.innerHTML = `<option value="">Select Branch</option>`;
            data.branches.forEach(b => {
                const opt = document.createElement("option");
                opt.value = b.id;
                opt.textContent = b.branch_name;
                branchSelect.appendChild(opt);
            });

        } catch {
            alert("Unable to load branches.");
        }
    }

    /* =====================================================
       LOAD COURSES
    ===================================================== */
    if (courseSelect) {
        try {
            const res = await fetch("/api/courses");
            const data = await res.json();
            if (!data.success) throw new Error();

            courseSelect.innerHTML = `<option value="">Select Service</option>`;
            data.courses
                .filter(c => c.status === "active")
                .forEach(c => {
                    const opt = document.createElement("option");
                    opt.value = c.id;
                    opt.textContent = c.course_name;
                    courseSelect.appendChild(opt);
                });

        } catch {
            alert("Unable to load services.");
        }
    }

    /* =====================================================
       LICENCE TOGGLE
    ===================================================== */
    let hasLicence = "Yes";

    document.querySelectorAll(".licence-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".licence-btn")
                .forEach(b => b.classList.remove("active"));

            btn.classList.add("active");
            hasLicence = btn.dataset.value || "No";
        });
    });

    /* =====================================================
       FORM SUBMISSION
    ===================================================== */
    enquiryForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!BYPASS_OTP && (verifyMethod !== "email" || !otpVerified)) {
            alert("Please complete email verification before submitting.");
            return;
        }

        const payload = {
            full_name: document.getElementById("name").value.trim(),
            phone: document.getElementById("phone").value.trim(),
            email: emailInput.value.trim(),

            branch_id: branchSelect.value,
            course_id: courseSelect.value,

            has_licence: hasLicence,
            hear_about: document.getElementById("reference").value,
            message: document.getElementById("message")?.value.trim() || null
        };

        try {
            const res = await fetch("/api/enquiries", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (!data.success) throw new Error();

            alert("✅ Enquiry submitted successfully");

            enquiryForm.reset();
            currentStep = 0;
            otpVerified = false;
            resendAttempts = 0;

            emailInput.disabled = false;
            sendOtpBtn.disabled = false;
            sendOtpBtn.textContent = "Send Verification Code";
            resendBtn.style.display = "inline-block";
            otpSection.style.display = "none";

            showStep(0);

        } catch {
            alert("❌ Submission failed. Please try again.");
        }
    });
});
