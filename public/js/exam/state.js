export const state = {
    questions: [],
    currentQuestionIndex: 0,
    userAnswers: [],
    markedForReview: [],
    score: 0.0,
    timerId: null,
    timeLeft: 48,
    mode: "mock",
    isVerified: false,
    selectedCategory: null,
    language: "en",
    examStartTime: null,
    examEndTime: null
};

export function resetState() {
    state.questions = [];
    state.currentQuestionIndex = 0;
    state.userAnswers = [];
    state.markedForReview = [];
    state.score = 0;
    state.timeLeft = 48;
    state.examStartTime = null;
    state.examEndTime = null;
}

export function toggleMarkForReview(index) {
    const idx = state.markedForReview.indexOf(index);
    if (idx > -1) {
        state.markedForReview.splice(idx, 1);
    } else {
        state.markedForReview.push(index);
    }
}

export function isMarkedForReview(index) {
    return state.markedForReview.includes(index);
}
