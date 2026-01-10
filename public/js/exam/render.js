// js/exam/render.js
import { state } from "./state.js";
import { dom } from "./dom.js";
import { selectAnswer } from "./actions.js";

export function renderQuestion() {
    const q = state.questions[state.currentQuestionIndex];
    if (!q) return;

    const qNum = state.currentQuestionIndex + 1;

    // Update counters
    dom.currentQuestionNum.textContent = qNum;
    dom.footerCurrentQuestion.textContent = qNum;
    dom.totalQuestionsEl.textContent = state.questions.length;

    // Button
    dom.nextBtn.textContent = state.mode === "practice" ? "Next" : "Confirm";
    dom.nextBtn.disabled = true;

    // Question text
    dom.questionText.innerHTML = `
        ${q.image ? `<img src="${q.image}" alt="">` : ""}
        <span>${q.question}</span>
    `;

    // Clear options
    dom.optionsList.innerHTML = "";

    q.options.forEach((opt, index) => {
        const li = document.createElement("li");

        li.innerHTML = `
            <label>
                ${state.mode === "mock" ? `<input type="radio" name="option" />` : ""}
                <span class="option-text">${opt}</span>
                <span class="option-mark"></span>
            </label>
        `;

        li.style.pointerEvents = "auto";
        li.classList.remove("correct", "wrong");

        if (state.mode === "practice") {
            li.addEventListener("click", () => selectAnswer(index));
        } else {
            li.querySelector("input").addEventListener("change", () => {
                selectAnswer(index);
            });
        }

        dom.optionsList.appendChild(li);
    });
}
