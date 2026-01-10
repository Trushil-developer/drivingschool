export function initEmailOtp({
    emailInput,
    sendBtn,
    otpInputs,
    statusEl,
    onVerified,
    DEV_MODE = false
}) {
    let verified = false;

    const otpBox = document.getElementById("gate-otp-box");
    const otpTimerEl = document.getElementById("otpTimer");
    const resendBtn = document.getElementById("resendOtpBtn");


    function resetOtp() {
        verified = false;
        statusEl.textContent = "";
        otpInputs.forEach(i => (i.value = ""));
        document.getElementById("gate-otp-box").style.display = "none";
    }

    /* ================= SHOW OTP UI ================= */
    function showOtpBox() {
        otpBox.style.display = "block";
        otpInputs.forEach(i => (i.value = ""));
        otpInputs[0].focus();
        resendBtn.style.display = "none";
        otpTimerEl.style.display = "none";
    }

    /* ================= SEND OTP ================= */
    async function sendOtp() {
        const email = emailInput.value.trim();

        if (!/^\S+@\S+\.\S+$/.test(email)) {
            alert("Enter valid email");
            return;
        }

        showOtpBox();

        if (DEV_MODE) {
            statusEl.textContent = "DEV MODE: Enter any 4 digits";
            return;
        }

        sendBtn.disabled = true;
        sendBtn.textContent = "Sending...";

        try {
            const res = await fetch("/api/enquiries/send-email-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            if (!data.success) throw new Error(data.message);

        } catch (err) {
            alert("Failed to send OTP");
            console.error(err);
        }

        sendBtn.disabled = false;
        sendBtn.textContent = "Send Verification Code";
    }

    /* ================= VERIFY OTP ================= */
    async function verifyOtp() {
        const otp = Array.from(otpInputs).map(i => i.value).join("");
        if (otp.length !== 4 || verified) return;

        const email = emailInput.value.trim() || "dev@example.com";

        if (DEV_MODE) {
            verified = true;
            statusEl.textContent = "DEV MODE: Email verified ✅";
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
            alert("OTP verification failed");
            console.error(err);
        }
    }

    /* ================= EVENTS ================= */
    sendBtn.addEventListener("click", sendOtp);

    otpInputs.forEach((input, index) => {
        input.addEventListener("input", () => {
            input.value = input.value.replace(/\D/g, "");
            if (input.value && otpInputs[index + 1]) {
                otpInputs[index + 1].focus();
            }
            verifyOtp();
        });
    });

    return { resetOtp };
}
