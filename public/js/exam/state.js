export const state = {
    questions: [],
    currentQuestionIndex: 0,
    userAnswers: [],
    score: 0.0,
    timerId: null,
    timeLeft: 48,
    mode: "mock", 
    isVerified: false,
    selectedCategory: null
};
export function resetState() {
    state.questions = [];
    state.currentQuestionIndex = 0;
    state.userAnswers = [];
    state.score = 0;
    state.timeLeft = 48;
}
