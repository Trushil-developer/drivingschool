export function initEmailOtp({
    emailInput,
    sendBtn,
    otpInputs,
    statusEl,
    onVerified,
    DEV_MODE = false
}) {
    let verified = false;
    let lockedEmail = null;

    const otpBox = document.getElementById("gate-otp-box");
    const otpTimerEl = document.getElementById("otpTimer");
    const resendBtn = document.getElementById("resendOtpBtn");

    /* =====================================
       RESET
    ===================================== */
    function resetOtp() {
        verified = false;
        lockedEmail = null;
        statusEl.textContent = "";
        emailInput.readOnly = false;

        otpInputs.forEach(i => (i.value = ""));
        otpBox.style.display = "none";
    }

    /* =====================================
       SHOW OTP UI
    ===================================== */
    function showOtpBox() {
        otpBox.style.display = "block";
        otpInputs.forEach(i => (i.value = ""));
        otpInputs[0].focus();

        if (resendBtn) resendBtn.style.display = "none";
        if (otpTimerEl) otpTimerEl.style.display = "none";
    }

    /* =====================================
       SEND OTP
    ===================================== */
    async function sendOtp(e) {
        e?.preventDefault();

        const email = emailInput.value.trim();

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            alert("Enter valid email");
            return;
        }

        lockedEmail = email;
        emailInput.readOnly = true;

        showOtpBox();

        if (DEV_MODE) {
            statusEl.textContent = "DEV MODE: Enter any 4 digits";
            return;
        }

        sendBtn.disabled = true;
        sendBtn.textContent = "OTP Sent";

        try {
            const res = await fetch("/api/enquiries/send-email-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            if (!data.success) {
                throw new Error(data.message || "OTP send failed");
            }

        } catch (err) {
            console.error(err);
            alert("Failed to send OTP");
            sendBtn.disabled = false;
            sendBtn.textContent = "Send Verification Code";
        }
    }

    /* =====================================
       VERIFY OTP
    ===================================== */
    async function verifyOtp() {
        if (verified) return;

        const otp = Array.from(otpInputs).map(i => i.value).join("");
        if (otp.length !== 4) return;

        const email = lockedEmail;
        if (!email) return;

        console.log("Verifying OTP:", otp, "for email:", email);

        if (DEV_MODE) {
            verified = true;
            statusEl.textContent = "Email verified ✅";
            onVerified(email);
            return;
        }

        try {
            const res = await fetch("/api/enquiries/verify-email-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, otp })
            });

            const data = await res.json();
            console.log("Server response:", data);

            if (data.success) {
                verified = true;
                statusEl.textContent = "Email verified ✅";
                onVerified(email);
            } else {
                statusEl.textContent = "Invalid OTP ❌";
                otpInputs.forEach(i => (i.value = ""));
                otpInputs[0].focus();
            }

        } catch (err) {
            console.error(err);
            alert("OTP verification failed");
        }
    }


    /* =====================================
       EVENTS (IMPORTANT FIXES)
    ===================================== */

    // Prevent form submit on Send
    sendBtn.addEventListener("click", sendOtp);

    otpInputs.forEach((input, index) => {

        // 🔒 CRITICAL: stop form submit + reload
        input.addEventListener("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
            }
        });

        input.addEventListener("input", e => {
            e.preventDefault();

            input.value = input.value.replace(/\D/g, "");

            if (input.value && otpInputs[index + 1]) {
                otpInputs[index + 1].focus();
            }

            verifyOtp();
        });
    });

    return { resetOtp };
}

document.addEventListener("submit", e => {
    e.preventDefault();
});