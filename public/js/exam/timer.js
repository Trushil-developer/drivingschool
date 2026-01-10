// js/exam/timer.js
import { state } from "./state.js";
import { dom } from "./dom.js";
import { confirmAnswer } from "./actions.js";

export function startTimer() {
    if (state.mode !== "mock") return;

    stopTimer();
    state.timeLeft = 48;
    dom.timerDisplay.textContent = state.timeLeft;

    state.timerId = setInterval(() => {
        state.timeLeft--;
        dom.timerDisplay.textContent = state.timeLeft;

        if (state.timeLeft <= 0) {
            stopTimer();
            if (state.userAnswers[state.currentQuestionIndex] === undefined) {
                state.userAnswers[state.currentQuestionIndex] = null;
            }
            confirmAnswer();
        }
    }, 1000);
}

export function stopTimer() {
    clearInterval(state.timerId);
}
