// js/exam/timer.js
import { state } from "./state.js";
import { dom } from "./dom.js";
import { confirmAnswer } from "./actions.js";

export function startTimer() {
    if (state.mode !== "mock") return;

    stopTimer();
    state.timeLeft = 48;

    if (dom.timerDisplay) {
        dom.timerDisplay.textContent = state.timeLeft;
        dom.timerDisplay.classList.remove("warning", "critical");
    }

    state.timerId = setInterval(() => {
        state.timeLeft--;

        if (dom.timerDisplay) {
            dom.timerDisplay.textContent = state.timeLeft;

            // Add warning classes based on time left
            dom.timerDisplay.classList.remove("warning", "critical");

            if (state.timeLeft <= 10 && state.timeLeft > 5) {
                dom.timerDisplay.classList.add("warning");
            } else if (state.timeLeft <= 5) {
                dom.timerDisplay.classList.add("critical");
                // Add pulse animation for critical time
                dom.timerDisplay.style.animation = "pulse 0.5s ease-in-out";
                setTimeout(() => {
                    if (dom.timerDisplay) dom.timerDisplay.style.animation = "";
                }, 500);
            }
        }

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
    if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
    }
}

export function pauseTimer() {
    stopTimer();
}

export function resumeTimer() {
    if (state.mode !== "mock") return;
    if (state.timeLeft > 0) {
        state.timerId = setInterval(() => {
            state.timeLeft--;
            if (dom.timerDisplay) {
                dom.timerDisplay.textContent = state.timeLeft;
            }
            if (state.timeLeft <= 0) {
                stopTimer();
                confirmAnswer();
            }
        }, 1000);
    }
}

export function getTimeLeft() {
    return state.timeLeft;
}
