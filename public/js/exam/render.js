// js/exam/render.js
import { state, isMarkedForReview } from "./state.js";
import { dom } from "./dom.js";
import { selectAnswer, goToQuestion } from "./actions.js";

export function renderQuestion() {
    const q = state.questions[state.currentQuestionIndex];
    if (!q) return;

    const qNum = state.currentQuestionIndex + 1;

    // Update counters
    dom.currentQuestionNum.textContent = qNum;
    dom.footerCurrentQuestion.textContent = qNum;
    dom.totalQuestionsEl.textContent = state.questions.length;

    // Update progress bar
    updateProgressBar();

    // Update navigation panel
    updateNavigationPanel();

    // Button
    dom.nextBtn.textContent = state.mode === "practice" ? "Next" : "Confirm";
    dom.nextBtn.disabled = true;

    // If already answered in mock mode, enable confirm
    if (state.mode === "mock" && state.userAnswers[state.currentQuestionIndex] !== null && state.userAnswers[state.currentQuestionIndex] !== undefined) {
        dom.nextBtn.disabled = false;
    }

    // Question text
    dom.questionText.innerHTML = `
        ${q.image ? `<img src="${q.image}" alt="" class="question-image">` : ""}
        <span>${q.question}</span>
    `;

    // Clear options
    dom.optionsList.innerHTML = "";

    q.options.forEach((opt, index) => {
        const li = document.createElement("li");
        const isSelected = state.userAnswers[state.currentQuestionIndex] === index;

        li.innerHTML = `
            <label class="${isSelected ? 'selected' : ''}">
                ${state.mode === "mock" ? `<input type="radio" name="option" ${isSelected ? 'checked' : ''} />` : ""}
                <span class="option-letter">${String.fromCharCode(65 + index)}</span>
                <span class="option-text">${opt}</span>
                <span class="option-mark"></span>
            </label>
        `;

        li.style.pointerEvents = "auto";
        li.classList.remove("correct", "wrong");
        if (isSelected) li.classList.add("selected");

        if (state.mode === "practice") {
            // In practice mode, if already answered, show result
            if (state.userAnswers[state.currentQuestionIndex] !== null) {
                li.style.pointerEvents = "none";
                const mark = li.querySelector(".option-mark");
                if (index === q.answer) {
                    li.classList.add("correct");
                    mark.textContent = "✔";
                } else if (index === state.userAnswers[state.currentQuestionIndex]) {
                    li.classList.add("wrong");
                    mark.textContent = "✖";
                }
            } else {
                li.addEventListener("click", () => selectAnswer(index));
            }
        } else {
            li.querySelector("input").addEventListener("change", () => {
                selectAnswer(index);
            });
            li.addEventListener("click", () => {
                const radio = li.querySelector("input");
                if (radio && !radio.checked) {
                    radio.checked = true;
                    selectAnswer(index);
                }
            });
        }

        dom.optionsList.appendChild(li);
    });

    // Update mark for review button state
    updateMarkForReviewBtn();
}

export function updateProgressBar() {
    const progressBar = document.getElementById("examProgressBar");
    const progressText = document.getElementById("examProgressText");

    if (!progressBar) return;

    const answered = state.userAnswers.filter(a => a !== null && a !== undefined).length;
    const total = state.questions.length;
    const percentage = total > 0 ? (answered / total) * 100 : 0;

    progressBar.style.width = `${percentage}%`;

    if (progressText) {
        progressText.textContent = `${answered}/${total} Answered`;
    }
}

export function updateNavigationPanel() {
    const navPanel = document.getElementById("questionNavPanel");
    if (!navPanel) return;

    navPanel.innerHTML = state.questions.map((_, i) => {
        const isCurrent = i === state.currentQuestionIndex;
        const isAnswered = state.userAnswers[i] !== null && state.userAnswers[i] !== undefined;
        const isMarked = isMarkedForReview(i);

        let statusClass = "nav-btn";
        if (isCurrent) statusClass += " current";
        if (isAnswered) statusClass += " answered";
        if (isMarked) statusClass += " marked";

        return `<button class="${statusClass}" data-index="${i}" title="Question ${i + 1}${isMarked ? ' (Marked for Review)' : ''}">${i + 1}</button>`;
    }).join("");

    // Add click handlers
    navPanel.querySelectorAll(".nav-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const index = parseInt(btn.dataset.index);
            goToQuestion(index);
        });
    });
}

export function updateMarkForReviewBtn() {
    const btn = document.getElementById("markForReviewBtn");
    if (!btn) return;

    const isMarked = isMarkedForReview(state.currentQuestionIndex);
    btn.classList.toggle("marked", isMarked);
    btn.innerHTML = isMarked
        ? '<span class="mark-icon">★</span> Marked'
        : '<span class="mark-icon">☆</span> Mark for Review';
}

export function renderNavigationLegend() {
    return `
        <div class="nav-legend">
            <span class="legend-item"><span class="legend-dot current"></span> Current</span>
            <span class="legend-item"><span class="legend-dot answered"></span> Answered</span>
            <span class="legend-item"><span class="legend-dot marked"></span> Marked</span>
            <span class="legend-item"><span class="legend-dot"></span> Not Visited</span>
        </div>
    `;
}
