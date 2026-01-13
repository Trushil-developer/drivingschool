    import { state } from "./state.js";
    import { dom } from "./dom.js";
    import { renderQuestion } from "./render.js";
    import { startTimer } from "./timer.js";

    export function loadQuestions() {
        fetch(`/api/questions?lang=${state.language}`)
            .then(res => res.json())
            .then(data => {

                console.log("RAW QUESTIONS RESPONSE:", data);

                // 👇 HARD FAIL if data is wrong
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

                state.questions = filtered
                    .sort(() => Math.random() - 0.5)
                    .slice(0, state.mode === "mock" ? 15 : filtered.length)
                    .map(q => ({
                        question: q.QUESTION.replace(/\n/g, " "),
                        options: [q.OPTION1, q.OPTION2, q.OPTION3],
                        answer: Number(q.ANSWER) - 1,
                        image: q.IMAGE ? `/images/questions/${q.IMAGE}` : null
                    }));

                state.userAnswers = Array(state.questions.length).fill(null);

                dom.totalQuestionsEl.textContent = state.questions.length;
                dom.liveScoreEl.textContent = state.score.toFixed(1);

                renderQuestion();
                if (state.mode === "mock") startTimer();
            });
    }
