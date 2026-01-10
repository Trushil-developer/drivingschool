export const dom = {
    questionText: document.getElementById("question-text"),
    optionsList: document.getElementById("options-list"),
    currentQuestionNum: document.getElementById("current-question"),
    footerCurrentQuestion: document.getElementById("footer-current-question"),
    totalQuestionsEl: document.getElementById("total-questions"),
    get timerDisplay() {
        return document.getElementById("timer");
    },

    nextBtn: document.getElementById("next-btn"),
    liveScoreEl: document.getElementById("live-score")
};
