import { initEmailOtp } from "../otp/emailOtp.js";
import { loadQuestions } from "./loader.js";
import { dom } from "./dom.js";
import { confirmAnswer } from "./actions.js";
import { state, resetState } from "./state.js";
import { stopTimer } from "./timer.js";

/**
 * Set true ONLY for local testing
 */
const DEV_MODE = true;

document.addEventListener("DOMContentLoaded", async () => {

    /* ================= DOM ================= */
    const startBtn = document.getElementById("startTestBtn");
    const mockTestBtn = document.getElementById("mockTestBtn");
    const practiceMenuBtn = document.getElementById("practiceMenuBtn");

    const emailInput = document.getElementById("gate-email");
    const otpInputs = document.querySelectorAll(".otp-input");
    const statusEl = document.getElementById("gate-otp-status");

    const authSection = document.getElementById("authSection");
    const testSection = document.getElementById("testSection");
    const practiceSection = document.getElementById("practiceSection");
    const practiceGrid = document.getElementById("practiceCategoryGrid");

    const reviewBtn = document.getElementById("reviewAnswersBtn");
    const restartBtn = document.getElementById("restartMockBtn");
    const reviewSection = document.getElementById("review-section");
    const reviewList = document.getElementById("review-list");
    const backBtn = document.getElementById("backToResultBtn");
    const resultSection = document.getElementById("result-section");

    /* ================= GLOBAL STATE ================= */
    state.isVerified = false;
    state.authPurpose = null; // "mock" | null

    /* ================= INIT OTP ================= */
    const otpController = initEmailOtp({
        emailInput,
        sendBtn: document.getElementById("gate-send-otp"),
        otpInputs,
        statusEl,
        onVerified: () => {
            state.isVerified = true;
            startBtn.disabled = false;
        },
        DEV_MODE
    });

    /* ================= LOAD PRACTICE CATEGORIES ================= */
    try {
        const res = await fetch("/api/questions");
        const questions = await res.json();

        const categoryMap = {};

        questions.forEach(q => {
            const cat = q.CATEGORY || q.category;
            if (!cat) return;

            categoryMap[cat] = (categoryMap[cat] || 0) + 1;
        });

        renderPracticeCategories(categoryMap);

    } catch (err) {
        console.error("Failed to load categories", err);
    }

    /* ================= SIDEBAR EVENTS ================= */

    // 📝 MOCK TEST
    mockTestBtn.addEventListener("click", () => {
        setActiveSidebar(mockTestBtn);
        resetEntireExamUI();

        state.authPurpose = "mock";
        authSection.style.display = "block";
    });

    // 📘 PRACTICE
    practiceMenuBtn.addEventListener("click", () => {
        setActiveSidebar(practiceMenuBtn);
        resetEntireExamUI();

        state.authPurpose = null;
        authSection.style.display = "none";
        practiceSection.style.display = "block";
    });

    /* ================= START MOCK ================= */
    startBtn.addEventListener("click", async () => {
        if (!state.isVerified) {
            alert("Please verify your email to start the mock test.");
            return;
        }

        const email = getEmail();
        await startAttempt(email);
        startExam("mock");
    });

    if (restartBtn) {
        restartBtn.addEventListener("click", () => {
            resetEntireExamUI();

            // Force mock mode
            state.authPurpose = "mock";
            setActiveSidebar(mockTestBtn);

            authSection.style.display = "block";
        });
    }

    /* ================= PRACTICE CATEGORY ================= */
    function renderPracticeCategories(categoryMap) {
        practiceGrid.innerHTML = "";

        Object.entries(categoryMap).forEach(([cat, count]) => {
            const card = document.createElement("div");
            card.className = "practice-card";

            card.innerHTML = `
                <h3>${cat}</h3>
                <p>${count} Questions</p>
            `;

            card.addEventListener("click", () => {
                resetEntireExamUI();
                state.selectedCategory = cat;
                startExam("practice");
            });

            practiceGrid.appendChild(card);
        });
    }


    /* ================= START EXAM ================= */
    function startExam(mode) {

        resetState();
        state.mode = mode;

        authSection.style.display = "none";
        practiceSection.style.display = "none";
        testSection.style.display = "block";

        document.getElementById("exam-form").style.display = "block";
        document.body.classList.remove("mock-mode", "practice-mode");
        document.body.classList.add(`${mode}-mode`);

        const header = document.getElementById("rtoHeader");
        const bar = document.getElementById("candidateBar");

        if (mode === "mock") {
            header.style.display = "block";
            bar.style.display = "grid";
        } else {
            header.style.display = "none";
            bar.style.display = "grid";
        }

        const timerBox = document.querySelector(".candidate-center");

        timerBox.innerHTML =
            mode === "mock"
                ? `<div class="label">Time (Seconds)</div><div id="timer" class="time">48</div>`
                : `<div class="label">Time</div><div class="time">∞</div>`;

        loadQuestions();
        dom.nextBtn.onclick = confirmAnswer;
    }

    /* ================= REVIEW ================= */
    if (reviewBtn) {
        reviewBtn.addEventListener("click", () => {
            resultSection.hidden = true;
            reviewSection.hidden = false;
            document.getElementById("rtoHeader").style.display = "none";
            document.getElementById("candidateBar").style.display = "none";
            buildReview();
        });
    }

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            reviewSection.hidden = true;
            resultSection.hidden = false;
        });
    }

    /* ================= RESET ================= */
    function resetEntireExamUI() {
        stopTimer();
        resetState();

        state.isVerified = false;
        emailInput.value = "";
        state.authPurpose = null;
        state.mode = "mock";
        state.selectedCategory = null;

        authSection.style.display = "block";
        testSection.style.display = "none";
        practiceSection.style.display = "none";
        resultSection.hidden = true;
        reviewSection.hidden = true;

        document.getElementById("rtoHeader").style.display = "none";
        document.getElementById("candidateBar").style.display = "none";
        document.getElementById("exam-form").style.display = "block";

        startBtn.disabled = true;
        otpController.resetOtp();
        statusEl.textContent = "";
        document.getElementById("gate-otp-box").style.display = "none";

        dom.liveScoreEl.textContent = "0.0";
        dom.currentQuestionNum.textContent = "1";
        dom.footerCurrentQuestion.textContent = "1";
        dom.totalQuestionsEl.textContent = "0";
    }

    /* ================= HELPERS ================= */
    function getEmail() {
        const email =
            sessionStorage.getItem("examEmail") ||
            emailInput.value.trim() ||
            "dev@example.com";

        sessionStorage.setItem("examEmail", email);
        return email;
    }

    async function startAttempt(email) {
        try {
            await fetch("/api/exam/attempt/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email })
            });
        } catch (err) {
            console.error("Failed to start attempt", err);
        }
    }

    function setActiveSidebar(el) {
        document
            .querySelectorAll(".sidebar-item")
            .forEach(i => i.classList.remove("active"));
        el.classList.add("active");
    }

    function buildReview() {
        reviewList.innerHTML = "";

        state.questions.forEach((q, i) => {
            const userAns = state.userAnswers[i];
            const correctAns = q.answer;

            const li = document.createElement("li");
            li.className = `review-item ${userAns === correctAns ? "correct" : "wrong"}`;

            li.innerHTML = `
                <div class="review-question-row">
                    <span>Q${i + 1}. ${q.question}</span>
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="review-options" hidden>
                    ${q.options.map((opt, idx) => `
                        <div class="review-option ${
                            idx === correctAns ? "correct" :
                            idx === userAns ? "wrong" : "neutral"
                        }">
                            ${opt}
                            ${idx === correctAns ? "✔" : idx === userAns ? "✖" : ""}
                        </div>
                    `).join("")}
                </div>
            `;

            const header = li.querySelector(".review-question-row");
            const options = li.querySelector(".review-options");
            const icon = li.querySelector(".toggle-icon");

            header.addEventListener("click", () => {
                const open = !options.hidden;
                options.hidden = open;
                icon.textContent = open ? "▼" : "▲";
            });

            reviewList.appendChild(li);
        });
    }
});

