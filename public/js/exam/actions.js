// js/exam/actions.js
import { state } from "./state.js";
import { dom } from "./dom.js";
import { renderQuestion } from "./render.js";
import { startTimer, stopTimer } from "./timer.js";

/* ================= SELECT ANSWER ================= */
export function selectAnswer(index) {

    // ✅ FIX: block only if already answered (not null)
    if (
        state.mode === "practice" &&
        state.userAnswers[state.currentQuestionIndex] !== null
    ) {
        return;
    }

    state.userAnswers[state.currentQuestionIndex] = index;

    /* ========= PRACTICE MODE ========= */
    if (state.mode === "practice") {
        const q = state.questions[state.currentQuestionIndex];
        const options = document.querySelectorAll(".options-list li");

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
        return;
    }

    /* ========= MOCK MODE ========= */
    dom.nextBtn.disabled = false;
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

/* ================= FINISH EXAM ================= */
async function finishExam() {
    document.getElementById("exam-form").style.display = "none";
    document.getElementById("result-section").hidden = false;
    document.getElementById("rtoHeader").style.display = "none";
    document.getElementById("candidateBar").style.display = "none";

    const email = sessionStorage.getItem("examEmail");
    const score = state.score;
    const total = state.questions.length;
    const passed = score >= 9;

    document.getElementById("final-score").textContent = score.toFixed(1);
    document.getElementById("final-total").textContent = total;
    document.getElementById("result-email").textContent = email;

    document.getElementById("result-pass").classList.toggle("hidden", !passed);
    document.getElementById("result-fail").classList.toggle("hidden", passed);

    document.getElementById("result-message").textContent =
        passed
            ? "Congratulations you have passed in LL Test"
            : "You have not passed the LL Test";

    document.getElementById("ll-footer-message").textContent =
        passed
            ? "Learner License Generated successfully for this application"
            : "Please reattempt the test after preparation";

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

    const practiceSection = document.getElementById("practiceSection");
    const testSection = document.getElementById("testSection");

    testSection.style.display = "none";
    practiceSection.style.display = "block";

    practiceSection.innerHTML = `
        <h2 class="practice-title">✅ Practice Completed</h2>
        <p>You have completed all questions in this category.</p>
        <button id="backToCategoriesBtn" class="primary-btn">
            Back to Practice Categories
        </button>
    `;

    document
        .getElementById("backToCategoriesBtn")
        .addEventListener("click", () => {
            window.location.reload(); // safe reset
        });
}