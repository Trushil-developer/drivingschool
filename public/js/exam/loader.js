import { state } from "./state.js";
import { dom } from "./dom.js";
import { renderQuestion } from "./render.js";
import { startTimer } from "./timer.js";

export async function loadQuestions() {
    try {
        const res = await fetch(`/api/questions?lang=${state.language}`);
        const data = await res.json();

        if (!Array.isArray(data)) {
            console.error("Questions API did not return an array");
            return;
        }

        let filtered = data;

        if (state.mode === "practice" && state.selectedCategory) {
            filtered = data.filter(
                q => q.CATEGORY === state.selectedCategory
            );
        }

        if (state.mode === "mock") {
            // Mock: shuffle and pick 15
            state.questions = filtered
                .sort(() => Math.random() - 0.5)
                .slice(0, 15)
                .map(q => ({
                    qNumber: q.Q_NUMBER,
                    question: q.QUESTION.replace(/\n/g, " "),
                    options: [q.OPTION1, q.OPTION2, q.OPTION3],
                    answer: Number(q.ANSWER) - 1,
                    image: q.IMAGE ? `/images/questions/${q.IMAGE}` : null
                }));
        } else {
            // Practice: keep stable order (no shuffle)
            state.questions = filtered
                .map(q => ({
                    qNumber: q.Q_NUMBER,
                    question: q.QUESTION.replace(/\n/g, " "),
                    options: [q.OPTION1, q.OPTION2, q.OPTION3],
                    answer: Number(q.ANSWER) - 1,
                    image: q.IMAGE ? `/images/questions/${q.IMAGE}` : null
                }));
        }

        state.userAnswers = Array(state.questions.length).fill(null);

        // For practice mode: load saved progress from server
        if (state.mode === "practice" && state.sessionUser && state.selectedCategory) {
            try {
                const progRes = await fetch(
                    `/api/exam/practice/progress?category=${encodeURIComponent(state.selectedCategory)}&language=${state.language}`
                );
                const progData = await progRes.json();

                if (progData.success) {
                    state.practiceProgress = progData.progress;
                    // Pre-fill userAnswers for previously answered questions
                    state.questions.forEach((q, i) => {
                        const prev = progData.progress[q.qNumber];
                        if (prev) {
                            state.userAnswers[i] = prev.selected_answer;
                        }
                    });

                    // Skip to first unanswered question
                    const firstUnanswered = state.userAnswers.findIndex(a => a === null);
                    if (firstUnanswered > 0) {
                        state.currentQuestionIndex = firstUnanswered;
                    }
                }
            } catch (err) {
                console.error("Failed to load practice progress", err);
            }
        }

        dom.totalQuestionsEl.textContent = state.questions.length;
        if (dom.liveScoreEl) dom.liveScoreEl.textContent = state.score.toFixed(1);

        renderQuestion();
        if (state.mode === "mock") startTimer();
    } catch (err) {
        console.error("Failed to load questions", err);
    }
}
