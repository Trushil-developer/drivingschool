import { initEmailOtp } from "../otp/emailOtp.js";
import { loadQuestions } from "./loader.js";
import { dom } from "./dom.js";
import { confirmAnswer, selectAnswer, markCurrentForReview, previousQuestion, nextQuestion, submitExamEarly } from "./actions.js";
import { state, resetState } from "./state.js";
import { stopTimer } from "./timer.js";
import { renderNavigationLegend } from "./render.js";
import { renderProgressMonitor } from "./progress.js";

document.addEventListener("DOMContentLoaded", async () => {

    /* ================= DOM ================= */
    const mockTestBtn = document.getElementById("mockTestBtn");
    const practiceMenuBtn = document.getElementById("practiceMenuBtn");
    const progressMonitorBtn = document.getElementById("progressMonitorBtn");
    const dashboardBtn = document.getElementById("dashboardBtn");

    const emailInput = document.getElementById("gate-email");
    const otpInputs = document.querySelectorAll(".otp-input");
    const statusEl = document.getElementById("gate-otp-status");

    const sidebar = document.getElementById("examSidebar");
    const authSection = document.getElementById("authSection");
    const dashboardSection = document.getElementById("dashboardSection");
    const testSection = document.getElementById("testSection");
    const practiceSection = document.getElementById("practiceSection");
    const progressSection = document.getElementById("progressSection");
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

        if (state.activeView === "practice") {
            await loadPracticeCategories();
        }

        if (state.mode === "mock" && testSection.style.display !== "none") {
            await loadQuestions();
        }
    });

    /* ================= INIT OTP ================= */
    const otpController = initEmailOtp({
        emailInput,
        sendBtn: document.getElementById("gate-send-otp"),
        otpInputs,
        statusEl,
        onVerified: async () => {
            // After OTP verification, session is set server-side
            // Check session to get user info
            await checkSession();
        },
        DEV_MODE: false
    });

    /* ================= SESSION CHECK ================= */
    async function checkSession() {
        try {
            const res = await fetch('/api/exam/session');
            const data = await res.json();
            if (data.loggedIn) {
                state.sessionUser = data.user;
                showDashboard();
            } else {
                showLogin();
            }
        } catch (err) {
            showLogin();
        }
    }

    // Check session on page load
    await checkSession();

    /* ================= SHOW LOGIN ================= */
    function showLogin() {
        state.sessionUser = null;
        state.activeView = 'login';
        sidebar.style.display = "none";
        hideAllSections();
        authSection.style.display = "block";
    }

    /* ================= SHOW DASHBOARD ================= */
    function showDashboard() {
        state.activeView = 'dashboard';
        sidebar.style.display = "";
        document.getElementById("sidebarUserEmail").textContent = state.sessionUser.email;
        hideAllSections();
        dashboardSection.style.display = "block";
        setActiveSidebar(dashboardBtn);
    }

    /* ================= SIDEBAR EVENTS ================= */

    // Dashboard
    dashboardBtn.addEventListener("click", () => {
        resetForNewExam();
        showDashboard();
    });

    // Mock Test
    mockTestBtn.addEventListener("click", () => {
        setActiveSidebar(mockTestBtn);
        startMockTest();
    });

    // Practice
    practiceMenuBtn.addEventListener("click", async () => {
        setActiveSidebar(practiceMenuBtn);
        state.activeView = 'practice';
        hideAllSections();
        practiceSection.style.display = "block";
        await loadPracticeCategories();
    });

    // Progress Monitor
    progressMonitorBtn.addEventListener("click", async () => {
        setActiveSidebar(progressMonitorBtn);
        state.activeView = 'progress';
        hideAllSections();
        progressSection.style.display = "block";
        const progressContent = document.getElementById("progressContent");
        await renderProgressMonitor(progressContent);
    });

    // Logout
    document.getElementById("examLogoutBtn").addEventListener("click", async () => {
        try {
            await fetch('/api/exam/logout', { method: 'POST' });
        } catch (err) {
            console.error("Logout error", err);
        }
        resetForNewExam();
        // Reset OTP UI
        emailInput.value = "";
        otpController.resetOtp();
        statusEl.textContent = "";
        document.getElementById("gate-otp-box").style.display = "none";
        showLogin();
    });

    /* ================= DASHBOARD BUTTONS ================= */
    document.getElementById("startMockFromDash").addEventListener("click", () => {
        setActiveSidebar(mockTestBtn);
        startMockTest();
    });

    document.getElementById("goToPracticeFromDash").addEventListener("click", async () => {
        setActiveSidebar(practiceMenuBtn);
        state.activeView = 'practice';
        hideAllSections();
        practiceSection.style.display = "block";
        await loadPracticeCategories();
    });

    document.getElementById("goToProgressFromDash").addEventListener("click", async () => {
        setActiveSidebar(progressMonitorBtn);
        state.activeView = 'progress';
        hideAllSections();
        progressSection.style.display = "block";
        const progressContent = document.getElementById("progressContent");
        await renderProgressMonitor(progressContent);
    });

    /* ================= START MOCK TEST ================= */
    async function startMockTest() {
        resetForNewExam();
        // Start attempt on server
        try {
            await fetch("/api/exam/attempt/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({})
            });
        } catch (err) {
            console.error("Failed to start attempt", err);
        }
        startExam("mock");
    }

    if (restartBtn) {
        restartBtn.addEventListener("click", () => {
            startMockTest();
        });
    }

    /* ================= PRACTICE CATEGORY ================= */
    function renderPracticeCategories(categoryMap, progressMap = {}) {
        practiceGrid.innerHTML = "";

        Object.entries(categoryMap).forEach(([cat, count]) => {
            const card = document.createElement("div");
            card.className = "practice-card";

            const progress = progressMap[cat];
            const answered = progress ? progress.answered : 0;
            const correct = progress ? Number(progress.correct) : 0;
            const progressPct = count > 0 ? Math.round((answered / count) * 100) : 0;

            card.innerHTML = `
                <h3>${cat}</h3>
                <p>${count} Questions</p>
                ${answered > 0 ? `
                    <div class="practice-card-progress">
                        <div class="mini-progress-bar">
                            <div class="mini-progress-fill" style="width: ${progressPct}%"></div>
                        </div>
                        <span class="practice-card-stats">${answered}/${count} done (${correct} correct)</span>
                    </div>
                ` : '<span class="practice-card-stats">Not started</span>'}
            `;

            card.addEventListener("click", () => {
                startExam("practice", cat);
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

            // Fetch user's practice progress summary
            let progressMap = {};
            if (state.sessionUser) {
                try {
                    const progRes = await fetch(`/api/exam/practice/summary?language=${state.language}`);
                    const progData = await progRes.json();
                    if (progData.success) {
                        progData.summary.forEach(s => {
                            progressMap[s.category] = { answered: s.answered, correct: s.correct };
                        });
                    }
                } catch (err) {
                    console.error("Failed to load practice summary", err);
                }
            }

            renderPracticeCategories(categoryMap, progressMap);
        } catch (err) {
            console.error("Failed to load categories", err);
        }
    }

    /* ================= START EXAM ================= */
    function startExam(mode, category = null) {
        resetForNewExam();
        state.mode = mode;
        state.selectedCategory = category;
        state.examStartTime = new Date();

        hideAllSections();
        testSection.style.display = "block";

        document.getElementById("exam-form").style.display = "block";
        document.body.classList.remove("mock-mode", "practice-mode");
        document.body.classList.add(`${mode}-mode`);

        const header = document.getElementById("rtoHeader");
        const bar = document.getElementById("candidateBar");
        const navSection = document.getElementById("questionNavSection");

        header.style.display = mode === "mock" ? "block" : "none";
        bar.style.display = mode === "mock" ? "grid" : "none";

        // Practice mode header with back button
        const practiceModeHeader = document.getElementById("practiceModeHeader");
        if (practiceModeHeader) {
            practiceModeHeader.style.display = mode === "practice" ? "flex" : "none";
            const categoryLabel = document.getElementById("practiceCategoryLabel");
            if (categoryLabel) categoryLabel.textContent = category || '';
        }

        // Show navigation panel
        if (navSection) {
            navSection.style.display = "block";
            const legendContainer = navSection.querySelector(".nav-legend-container");
            if (legendContainer) {
                legendContainer.innerHTML = renderNavigationLegend();
            }
        }

        if (mode === "mock") {
            const timerBox = document.querySelector(".candidate-center");
            timerBox.innerHTML = `<div class="label">Time (Seconds)</div><div id="timer" class="time">48</div>`;
            const rightBox = document.querySelector(".candidate-right");
            rightBox.innerHTML = `<div class="label">Score</div><div id="live-score" class="score">0.0</div>`;
        }

        // Show/hide mark for review button based on mode
        const markBtn = document.getElementById("markForReviewBtn");
        if (markBtn) {
            markBtn.style.display = mode === "mock" ? "inline-flex" : "none";
        }

        // Show/hide navigation buttons based on mode
        const prevBtn = document.getElementById("prevQuestionBtn");
        const skipBtn = document.getElementById("skipQuestionBtn");
        const submitBtn = document.getElementById("submitExamBtn");
        if (prevBtn) prevBtn.style.display = mode === "mock" ? "inline-flex" : "none";
        if (skipBtn) skipBtn.style.display = mode === "mock" ? "inline-flex" : "none";
        if (submitBtn) submitBtn.style.display = mode === "mock" ? "inline-flex" : "none";

        loadQuestions();
        dom.nextBtn.onclick = confirmAnswer;
    }

    /* ================= REVIEW ================= */
    if (reviewBtn) {
        reviewBtn.addEventListener("click", () => {
            authSection.style.display = "none";
            practiceSection.style.display = "none";
            dashboardSection.style.display = "none";
            progressSection.style.display = "none";
            testSection.style.display = "block";

            resultSection.hidden = true;
            reviewSection.hidden = false;

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
    const prevBtnEl = document.getElementById("prevQuestionBtn");
    const skipBtnEl = document.getElementById("skipQuestionBtn");

    if (prevBtnEl) {
        prevBtnEl.addEventListener("click", previousQuestion);
    }

    if (skipBtnEl) {
        skipBtnEl.addEventListener("click", nextQuestion);
    }

    const submitExamBtn = document.getElementById("submitExamBtn");
    if (submitExamBtn) {
        submitExamBtn.addEventListener("click", submitExamEarly);
    }

    /* ================= BACK TO CATEGORIES (PRACTICE) ================= */
    const backToCatBtn = document.getElementById("backToCategoriesBtn2");
    if (backToCatBtn) {
        backToCatBtn.addEventListener("click", async () => {
            resetForNewExam();
            setActiveSidebar(practiceMenuBtn);
            state.activeView = 'practice';
            hideAllSections();
            practiceSection.style.display = "block";
            await loadPracticeCategories();
        });
    }

    /* ================= KEYBOARD NAVIGATION ================= */
    document.addEventListener("keydown", (e) => {
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

        state.selectedCategory = null;

        if (dom.liveScoreEl) dom.liveScoreEl.textContent = "0.0";
        dom.currentQuestionNum.textContent = "1";
        dom.footerCurrentQuestion.textContent = "1";
        dom.totalQuestionsEl.textContent = "0";

        const progressBar = document.getElementById("examProgressBar");
        if (progressBar) progressBar.style.width = "0%";

        // Show progress container again (might have been hidden during review)
        const progressContainer = document.querySelector(".exam-progress-container");
        if (progressContainer) progressContainer.style.display = "";
    }

    function hideAllSections() {
        authSection.style.display = "none";
        dashboardSection.style.display = "none";
        testSection.style.display = "none";
        practiceSection.style.display = "none";
        progressSection.style.display = "none";
        resultSection.hidden = true;
        reviewSection.hidden = true;
    }

    function setActiveSidebar(el) {
        document
            .querySelectorAll(".sidebar-item")
            .forEach(i => i.classList.remove("active"));
        el.classList.add("active");
    }

    function buildReview() {
        reviewList.innerHTML = "";

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
                        ${isUnanswered ? "\u2014" : userAns === correctAns ? "\u2714" : "\u2716"}
                    </span>
                    <span class="toggle-icon">\u25BC</span>
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
                icon.textContent = open ? "\u25BC" : "\u25B2";
            });

            reviewList.appendChild(li);
        });
    }

});
