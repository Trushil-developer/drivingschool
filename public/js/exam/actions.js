// js/exam/actions.js
import { state, toggleMarkForReview } from "./state.js";
import { dom } from "./dom.js";
import { renderQuestion, updateNavigationPanel, updateMarkForReviewBtn, updateProgressBar } from "./render.js";
import { startTimer, stopTimer } from "./timer.js";

/* ================= SELECT ANSWER ================= */
export function selectAnswer(index) {
    // Block if already answered in practice mode
    if (
        state.mode === "practice" &&
        state.userAnswers[state.currentQuestionIndex] !== null
    ) {
        return;
    }

    state.userAnswers[state.currentQuestionIndex] = index;

    // Update selected state visually
    const options = document.querySelectorAll(".options-list li");
    options.forEach((li, i) => {
        li.classList.toggle("selected", i === index);
        const label = li.querySelector("label");
        if (label) label.classList.toggle("selected", i === index);
    });

    /* ========= PRACTICE MODE ========= */
    if (state.mode === "practice") {
        const q = state.questions[state.currentQuestionIndex];

        options.forEach((li, i) => {
            const mark = li.querySelector(".option-mark");

            li.style.pointerEvents = "none";
            li.classList.remove("correct", "wrong");
            mark.textContent = "";

            if (i === q.answer) {
                li.classList.add("correct");
                mark.textContent = "✔";
            }

            if (i === index && index !== q.answer) {
                li.classList.add("wrong");
                mark.textContent = "✖";
            }
        });

        dom.nextBtn.disabled = false;
        updateProgressBar();
        updateNavigationPanel();
        return;
    }

    /* ========= MOCK MODE ========= */
    dom.nextBtn.disabled = false;
    updateProgressBar();
    updateNavigationPanel();
}

/* ================= GO TO SPECIFIC QUESTION ================= */
export function goToQuestion(index) {
    if (index < 0 || index >= state.questions.length) return;

    if (state.mode === "mock") {
        // In mock mode, stop and restart timer when navigating
        stopTimer();
    }

    state.currentQuestionIndex = index;
    renderQuestion();

    if (state.mode === "mock") {
        startTimer();
    }
}

/* ================= PREVIOUS QUESTION ================= */
export function previousQuestion() {
    if (state.currentQuestionIndex > 0) {
        goToQuestion(state.currentQuestionIndex - 1);
    }
}

/* ================= NEXT QUESTION (without confirming) ================= */
export function nextQuestion() {
    if (state.currentQuestionIndex < state.questions.length - 1) {
        goToQuestion(state.currentQuestionIndex + 1);
    }
}

/* ================= MARK FOR REVIEW ================= */
export function markCurrentForReview() {
    toggleMarkForReview(state.currentQuestionIndex);
    updateMarkForReviewBtn();
    updateNavigationPanel();
}

/* ================= CONFIRM ANSWER ================= */
export function confirmAnswer() {
    if (state.mode === "practice") {
        state.currentQuestionIndex++;

        if (state.currentQuestionIndex < state.questions.length) {
            renderQuestion();
        } else {
            showPracticeComplete();
        }
        return;
    }

    stopTimer();

    const q = state.questions[state.currentQuestionIndex];
    const selected = state.userAnswers[state.currentQuestionIndex];

    if (selected === q.answer) {
        state.score += 1;
        dom.liveScoreEl.textContent = state.score.toFixed(1);
    }

    state.currentQuestionIndex++;

    if (state.currentQuestionIndex < state.questions.length) {
        renderQuestion();
        startTimer();
    } else {
        finishExam();
    }
}

/* ================= SUBMIT EXAM EARLY ================= */
export function submitExamEarly() {
    const unanswered = state.userAnswers.filter(a => a === null || a === undefined).length;

    if (unanswered > 0) {
        const confirm = window.confirm(
            `You have ${unanswered} unanswered question(s). Are you sure you want to submit?`
        );
        if (!confirm) return;
    } else {
        const confirm = window.confirm("Are you sure you want to submit the exam?");
        if (!confirm) return;
    }

    // Calculate score for all answered questions
    state.questions.forEach((q, i) => {
        if (state.userAnswers[i] === q.answer && !state.answeredCorrectly?.[i]) {
            state.score += 1;
        }
    });

    stopTimer();
    finishExam();
}

/* ================= FINISH EXAM ================= */
async function finishExam() {
    state.examEndTime = new Date();

    document.getElementById("exam-form").style.display = "none";
    document.getElementById("result-section").hidden = false;
    document.getElementById("rtoHeader").style.display = "none";
    document.getElementById("candidateBar").style.display = "none";

    // Hide navigation panel
    const navSection = document.getElementById("questionNavSection");
    if (navSection) navSection.style.display = "none";

    const email = sessionStorage.getItem("examEmail");
    const score = state.score;
    const total = state.questions.length;
    const passed = score >= 9;

    // Calculate statistics
    const answered = state.userAnswers.filter(a => a !== null && a !== undefined).length;
    const unanswered = total - answered;
    const incorrect = answered - score;
    const accuracy = answered > 0 ? Math.round((score / answered) * 100) : 0;

    // Calculate time taken
    let timeTaken = "N/A";
    if (state.examStartTime && state.examEndTime) {
        const diff = Math.floor((state.examEndTime - state.examStartTime) / 1000);
        const mins = Math.floor(diff / 60);
        const secs = diff % 60;
        timeTaken = `${mins}m ${secs}s`;
    }

    document.getElementById("final-score").textContent = score.toFixed(0);
    document.getElementById("final-total").textContent = total;
    document.getElementById("result-email").textContent = email;

    document.getElementById("result-pass").classList.toggle("hidden", !passed);
    document.getElementById("result-fail").classList.toggle("hidden", passed);

    document.getElementById("result-message").textContent =
        passed
            ? "Congratulations! You have passed the LL Test"
            : "You have not passed the LL Test";

    document.getElementById("ll-footer-message").textContent =
        passed
            ? "Learner License Generated successfully for this application"
            : "Please reattempt the test after preparation";

    // Render detailed stats
    const statsContainer = document.getElementById("result-stats");
    if (statsContainer) {
        statsContainer.innerHTML = `
            <div class="result-stats-grid">
                <div class="result-stat">
                    <span class="stat-label">Correct</span>
                    <span class="stat-value correct">${score.toFixed(0)}</span>
                </div>
                <div class="result-stat">
                    <span class="stat-label">Incorrect</span>
                    <span class="stat-value incorrect">${incorrect}</span>
                </div>
                <div class="result-stat">
                    <span class="stat-label">Unanswered</span>
                    <span class="stat-value unanswered">${unanswered}</span>
                </div>
                <div class="result-stat">
                    <span class="stat-label">Accuracy</span>
                    <span class="stat-value">${accuracy}%</span>
                </div>
                <div class="result-stat">
                    <span class="stat-label">Time Taken</span>
                    <span class="stat-value">${timeTaken}</span>
                </div>
                <div class="result-stat">
                    <span class="stat-label">Pass Mark</span>
                    <span class="stat-value">9/15</span>
                </div>
            </div>
        `;
    }

    if (state.mode === "practice") return;

    try {
        await fetch("/api/exam/attempt/finish", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                score,
                total_questions: total
            })
        });
    } catch (err) {
        console.error(err);
    }
}

function showPracticeComplete() {
    document.getElementById("exam-form").style.display = "none";

    // Hide navigation panel
    const navSection = document.getElementById("questionNavSection");
    if (navSection) navSection.style.display = "none";

    const practiceSection = document.getElementById("practiceSection");
    const testSection = document.getElementById("testSection");

    testSection.style.display = "none";
    practiceSection.style.display = "block";

    // Calculate stats
    const total = state.questions.length;
    let correct = 0;
    state.questions.forEach((q, i) => {
        if (state.userAnswers[i] === q.answer) correct++;
    });

    practiceSection.innerHTML = `
        <div class="practice-complete">
            <div class="complete-icon">✅</div>
            <h2 class="practice-title">Practice Completed!</h2>
            <p class="practice-subtitle">You have completed all questions in this category.</p>

            <div class="practice-stats">
                <div class="practice-stat">
                    <span class="stat-number">${correct}</span>
                    <span class="stat-label">Correct</span>
                </div>
                <div class="practice-stat">
                    <span class="stat-number">${total - correct}</span>
                    <span class="stat-label">Incorrect</span>
                </div>
                <div class="practice-stat">
                    <span class="stat-number">${Math.round((correct / total) * 100)}%</span>
                    <span class="stat-label">Accuracy</span>
                </div>
            </div>

            <button id="backToCategoriesBtn" class="primary-btn">
                Back to Practice Categories
            </button>
        </div>
    `;

    document
        .getElementById("backToCategoriesBtn")
        .addEventListener("click", () => {
            window.location.reload();
        });
}

// Export for keyboard navigation
export { finishExam };
