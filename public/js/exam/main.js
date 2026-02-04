import { initEmailOtp } from "../otp/emailOtp.js";
import { loadQuestions } from "./loader.js";
import { dom } from "./dom.js";
import { confirmAnswer, selectAnswer, markCurrentForReview, previousQuestion, nextQuestion } from "./actions.js";
import { state, resetState } from "./state.js";
import { stopTimer } from "./timer.js";
import { renderNavigationLegend } from "./render.js";

/**
 * Set true ONLY for local testing
 */
const DEV_MODE = false;

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

    const languageSelect = document.getElementById("languageSelect");

    /* ================= LANGUAGE ================= */
    state.language = localStorage.getItem("examLang") || "en";
    languageSelect.value = state.language;

    languageSelect.addEventListener("change", async () => {
        state.language = languageSelect.value;
        localStorage.setItem("examLang", state.language);

        await loadPracticeCategories()

        if (state.mode === "mock" && testSection.style.display !== "none") {
            await loadQuestions();
        }
    });

    /* ================= GLOBAL STATE ================= */
    state.isVerified = false;
    state.authPurpose = null;

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
    await loadPracticeCategories();

    /* ================= SIDEBAR EVENTS ================= */

    // Mock Test
    mockTestBtn.addEventListener("click", () => {
        setActiveSidebar(mockTestBtn);
        showSection(authSection);
        state.authPurpose = "mock";
    });

    // Practice
    practiceMenuBtn.addEventListener("click", () => {
        setActiveSidebar(practiceMenuBtn);
        showSection(practiceSection);
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
            resetForNewExam();
            setActiveSidebar(mockTestBtn);
            showSection(authSection);
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
                resetForNewExam();
                state.selectedCategory = cat;
                startExam("practice");
            });

            practiceGrid.appendChild(card);
        });
    }

    async function loadPracticeCategories() {
        try {
            const res = await fetch(`/api/questions?lang=${state.language}`);
            const questions = await res.json();

            const categoryMap = {};
            questions.forEach(q => {
                if (!q.CATEGORY) return;
                categoryMap[q.CATEGORY] = (categoryMap[q.CATEGORY] || 0) + 1;
            });

            renderPracticeCategories(categoryMap);
        } catch (err) {
            console.error("Failed to load categories", err);
        }
    }

    /* ================= START EXAM ================= */
    function startExam(mode) {
        resetForNewExam();
        state.mode = mode;
        state.examStartTime = new Date();

        hideAllSections();
        showSection(testSection);

        document.getElementById("exam-form").style.display = "block";
        document.body.classList.remove("mock-mode", "practice-mode");
        document.body.classList.add(`${mode}-mode`);

        const header = document.getElementById("rtoHeader");
        const bar = document.getElementById("candidateBar");
        const navSection = document.getElementById("questionNavSection");

        header.style.display = mode === "mock" ? "block" : "none";
        bar.style.display = "grid";

        // Show navigation panel
        if (navSection) {
            navSection.style.display = "block";
            // Add legend
            const legendContainer = navSection.querySelector(".nav-legend-container");
            if (legendContainer) {
                legendContainer.innerHTML = renderNavigationLegend();
            }
        }

        const timerBox = document.querySelector(".candidate-center");
        timerBox.innerHTML =
            mode === "mock"
                ? `<div class="label">Time (Seconds)</div><div id="timer" class="time">48</div>`
                : `<div class="label">Time</div><div class="time">∞</div>`;

        // Show/hide mark for review button based on mode
        const markBtn = document.getElementById("markForReviewBtn");
        if (markBtn) {
            markBtn.style.display = mode === "mock" ? "inline-flex" : "none";
        }

        // Show/hide navigation buttons based on mode
        const prevBtn = document.getElementById("prevQuestionBtn");
        const skipBtn = document.getElementById("skipQuestionBtn");
        if (prevBtn) prevBtn.style.display = mode === "mock" ? "inline-flex" : "none";
        if (skipBtn) skipBtn.style.display = mode === "mock" ? "inline-flex" : "none";

        loadQuestions();
        dom.nextBtn.onclick = confirmAnswer;
    }

    /* ================= REVIEW ================= */
    if (reviewBtn) {
        reviewBtn.addEventListener("click", () => {
            // Hide other sections but keep testSection visible since review is inside it
            authSection.style.display = "none";
            practiceSection.style.display = "none";
            testSection.style.display = "block";

            // Hide result, show review
            resultSection.hidden = true;
            reviewSection.hidden = false;

            // Hide nav section and candidate bar during review
            const navSection = document.getElementById("questionNavSection");
            if (navSection) navSection.style.display = "none";
            document.getElementById("candidateBar").style.display = "none";
            document.getElementById("rtoHeader").style.display = "none";
            document.querySelector(".exam-progress-container").style.display = "none";

            buildReview();
        });
    }

    if (backBtn) {
        backBtn.addEventListener("click", () => {
            // Hide review, show result
            reviewSection.hidden = true;
            resultSection.hidden = false;
        });
    }

    /* ================= MARK FOR REVIEW ================= */
    const markForReviewBtn = document.getElementById("markForReviewBtn");
    if (markForReviewBtn) {
        markForReviewBtn.addEventListener("click", markCurrentForReview);
    }

    /* ================= NAVIGATION BUTTONS ================= */
    const prevBtn = document.getElementById("prevQuestionBtn");
    const skipBtn = document.getElementById("skipQuestionBtn");

    if (prevBtn) {
        prevBtn.addEventListener("click", previousQuestion);
    }

    if (skipBtn) {
        skipBtn.addEventListener("click", nextQuestion);
    }

    /* ================= KEYBOARD NAVIGATION ================= */
    document.addEventListener("keydown", (e) => {
        // Only handle if exam is active
        if (testSection.style.display === "none") return;
        if (document.getElementById("exam-form").style.display === "none") return;

        switch (e.key) {
            case "1":
            case "a":
            case "A":
                selectAnswer(0);
                break;
            case "2":
            case "b":
            case "B":
                selectAnswer(1);
                break;
            case "3":
            case "c":
            case "C":
                selectAnswer(2);
                break;
            case "Enter":
                if (!dom.nextBtn.disabled) {
                    confirmAnswer();
                }
                break;
            case "ArrowLeft":
                if (state.mode === "mock") previousQuestion();
                break;
            case "ArrowRight":
                if (state.mode === "mock") nextQuestion();
                break;
            case "m":
            case "M":
                if (state.mode === "mock") markCurrentForReview();
                break;
        }
    });

    /* ================= RESET / HELPERS ================= */
    function resetForNewExam() {
        stopTimer();
        resetState();

        state.isVerified = false;
        state.selectedCategory = null;

        emailInput.value = "";
        otpController.resetOtp();
        statusEl.textContent = "";
        document.getElementById("gate-otp-box").style.display = "none";

        dom.liveScoreEl.textContent = "0.0";
        dom.currentQuestionNum.textContent = "1";
        dom.footerCurrentQuestion.textContent = "1";
        dom.totalQuestionsEl.textContent = "0";

        // Reset progress bar
        const progressBar = document.getElementById("examProgressBar");
        if (progressBar) progressBar.style.width = "0%";
    }

    function hideAllSections() {
        authSection.style.display = "none";
        testSection.style.display = "none";
        practiceSection.style.display = "none";
        resultSection.hidden = true;
        reviewSection.hidden = true;
    }

    function showSection(section) {
        hideAllSections();
        section.style.display = "block";
    }

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

        // Summary stats
        let correct = 0, incorrect = 0, unanswered = 0;
        state.questions.forEach((q, i) => {
            if (state.userAnswers[i] === null || state.userAnswers[i] === undefined) {
                unanswered++;
            } else if (state.userAnswers[i] === q.answer) {
                correct++;
            } else {
                incorrect++;
            }
        });

        const summaryDiv = document.createElement("div");
        summaryDiv.className = "review-summary";
        summaryDiv.innerHTML = `
            <div class="summary-item correct"><span>${correct}</span> Correct</div>
            <div class="summary-item incorrect"><span>${incorrect}</span> Incorrect</div>
            <div class="summary-item unanswered"><span>${unanswered}</span> Unanswered</div>
        `;
        reviewList.appendChild(summaryDiv);

        state.questions.forEach((q, i) => {
            const userAns = state.userAnswers[i];
            const correctAns = q.answer;
            const isUnanswered = userAns === null || userAns === undefined;

            const li = document.createElement("li");
            li.className = `review-item ${isUnanswered ? "unanswered" : userAns === correctAns ? "correct" : "wrong"}`;

            li.innerHTML = `
                <div class="review-question-row">
                    <span class="review-q-num">Q${i + 1}</span>
                    <span class="review-q-text">${q.question}</span>
                    <span class="review-status ${isUnanswered ? "unanswered" : userAns === correctAns ? "correct" : "wrong"}">
                        ${isUnanswered ? "—" : userAns === correctAns ? "✔" : "✖"}
                    </span>
                    <span class="toggle-icon">▼</span>
                </div>
                <div class="review-options" hidden>
                    ${q.options.map((opt, idx) => `
                        <div class="review-option ${
                            idx === correctAns ? "correct" :
                            idx === userAns && userAns !== correctAns ? "wrong" : "neutral"
                        }">
                            <span class="option-indicator">${String.fromCharCode(65 + idx)}</span>
                            ${opt}
                            ${idx === correctAns ? '<span class="option-badge correct">Correct</span>' : ""}
                            ${idx === userAns && userAns !== correctAns ? '<span class="option-badge wrong">Your Answer</span>' : ""}
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
