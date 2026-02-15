import express from "express";
import { dbPool, requireAdmin, requireExamUser } from "../server.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Helper to get questions file path
const getQuestionsPath = (lang = 'en') => {
    const fileName = lang === 'gu' ? 'questions_gu.json' : 'questions_en.json';
    return path.join(__dirname, '..', 'data', fileName);
};

// Helper to read questions
const readQuestions = (lang = 'en') => {
    const filePath = getQuestionsPath(lang);
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
};

// Helper to write questions
const writeQuestions = (questions, lang = 'en') => {
    const filePath = getQuestionsPath(lang);
    fs.writeFileSync(filePath, JSON.stringify(questions, null, 2), 'utf-8');
};

/* =========================
   START EXAM ATTEMPT
========================= */
router.post("/attempt/start", requireExamUser, async (req, res) => {
    const userId = req.session.examUser.id;

    try {
        const [existing] = await dbPool.query(
            `SELECT id FROM exam_attempts
             WHERE user_id=? AND status='started'
             ORDER BY id DESC LIMIT 1`,
            [userId]
        );

        if (existing.length) {
            return res.json({ success: true, attempt_id: existing[0].id, resumed: true });
        }

        const [result] = await dbPool.query(
            `INSERT INTO exam_attempts (user_id, mode, started_at, status)
            VALUES (?, 'mock', NOW(), 'started')`,
            [userId]
        );

        res.json({ success: true, attempt_id: result.insertId });

    } catch (err) {
        console.error("START EXAM ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   FINISH EXAM ATTEMPT
========================= */
router.post("/attempt/finish", requireExamUser, async (req, res) => {
    const userId = req.session.examUser.id;
    const { score, total_questions } = req.body;

    try {
        const result = score >= 9 ? "PASS" : "FAIL";

        await dbPool.query(
            `UPDATE exam_attempts
             SET score=?, total_questions=?, correct_answers=?, result=?,
                 finished_at=NOW(), status='completed'
             WHERE user_id=? AND status='started'
             ORDER BY id DESC LIMIT 1`,
            [score, total_questions, score, result, userId]
        );

        await dbPool.query(
            `UPDATE exam_users
             SET total_attempts = total_attempts + 1,
                 last_score = ?, last_result = ?,
                 best_score = GREATEST(best_score, ?)
             WHERE id=?`,
            [score, result, score, userId]
        );

        res.json({ success: true });

    } catch (err) {
        console.error("FINISH EXAM ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   PRACTICE: SAVE ANSWER
========================= */
router.post("/practice/answer", requireExamUser, async (req, res) => {
    const userId = req.session.examUser.id;
    const { question_number, category, language = 'en', selected_answer, is_correct } = req.body;

    if (!question_number || !category || selected_answer === undefined) {
        return res.status(400).json({ success: false, error: "Missing fields" });
    }

    try {
        await dbPool.query(`
            INSERT INTO practice_progress
                (user_id, question_number, category, language, selected_answer, is_correct, answered_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
            ON DUPLICATE KEY UPDATE
                selected_answer = VALUES(selected_answer),
                is_correct = VALUES(is_correct),
                answered_at = NOW()
        `, [userId, question_number, category, language, selected_answer, is_correct ? 1 : 0]);

        res.json({ success: true });
    } catch (err) {
        console.error("SAVE PRACTICE ANSWER ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   PRACTICE: GET PROGRESS
========================= */
router.get("/practice/progress", requireExamUser, async (req, res) => {
    const userId = req.session.examUser.id;
    const { category, language = 'en' } = req.query;

    try {
        let query = `
            SELECT question_number, selected_answer, is_correct, answered_at
            FROM practice_progress
            WHERE user_id = ? AND language = ?
        `;
        const params = [userId, language];

        if (category) {
            query += " AND category = ?";
            params.push(category);
        }

        const [rows] = await dbPool.query(query, params);

        const progressMap = {};
        rows.forEach(r => {
            progressMap[r.question_number] = {
                selected_answer: r.selected_answer,
                is_correct: r.is_correct,
                answered_at: r.answered_at
            };
        });

        res.json({ success: true, progress: progressMap });
    } catch (err) {
        console.error("GET PRACTICE PROGRESS ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   PRACTICE: GET SUMMARY
========================= */
router.get("/practice/summary", requireExamUser, async (req, res) => {
    const userId = req.session.examUser.id;
    const { language = 'en' } = req.query;

    try {
        const [rows] = await dbPool.query(`
            SELECT
                category,
                COUNT(*) AS answered,
                SUM(is_correct) AS correct
            FROM practice_progress
            WHERE user_id = ? AND language = ?
            GROUP BY category
        `, [userId, language]);

        res.json({ success: true, summary: rows });
    } catch (err) {
        console.error("PRACTICE SUMMARY ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   PROGRESS MONITOR
========================= */
router.get("/progress", requireExamUser, async (req, res) => {
    const userId = req.session.examUser.id;

    try {
        const [attempts] = await dbPool.query(`
            SELECT id, score, total_questions, result, started_at, finished_at, status
            FROM exam_attempts
            WHERE user_id = ? AND status = 'completed'
            ORDER BY finished_at DESC
        `, [userId]);

        const [practiceSummary] = await dbPool.query(`
            SELECT
                category,
                COUNT(*) AS answered,
                SUM(is_correct) AS correct
            FROM practice_progress
            WHERE user_id = ?
            GROUP BY category
        `, [userId]);

        const [[userStats]] = await dbPool.query(`
            SELECT total_attempts, best_score, last_score, last_result
            FROM exam_users
            WHERE id = ?
        `, [userId]);

        res.json({
            success: true,
            mockHistory: attempts,
            practiceSummary,
            userStats: userStats || { total_attempts: 0, best_score: 0, last_score: 0, last_result: null }
        });
    } catch (err) {
        console.error("PROGRESS MONITOR ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: GET ALL EXAM USERS
========================= */
router.get("/admin/users", requireAdmin, async (req, res) => {
    try {
        const [users] = await dbPool.query(`
            SELECT
                id, email, first_verified_at, last_seen_at,
                total_attempts, best_score, last_score, last_result
            FROM exam_users
            ORDER BY last_seen_at DESC
        `);

        res.json({ success: true, users });
    } catch (err) {
        console.error("ADMIN EXAM USERS ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: GET ALL EXAM ATTEMPTS
========================= */
router.get("/admin/attempts", requireAdmin, async (req, res) => {
    try {
        const { user_id } = req.query;

        let query = `
            SELECT
                a.id, a.user_id, a.mode, a.score, a.total_questions,
                a.correct_answers, a.result, a.started_at, a.finished_at, a.status,
                u.email
            FROM exam_attempts a
            JOIN exam_users u ON a.user_id = u.id
        `;
        const params = [];

        if (user_id) {
            query += " WHERE a.user_id = ?";
            params.push(user_id);
        }

        query += " ORDER BY a.started_at DESC LIMIT 500";

        const [attempts] = await dbPool.query(query, params);

        res.json({ success: true, attempts });
    } catch (err) {
        console.error("ADMIN EXAM ATTEMPTS ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: EXAM OVERVIEW STATS
========================= */
router.get("/admin/overview", requireAdmin, async (req, res) => {
    try {
        const [[userStats]] = await dbPool.query(`
            SELECT
                COUNT(*) AS totalUsers,
                SUM(total_attempts) AS totalAttempts,
                ROUND(AVG(best_score), 1) AS avgBestScore
            FROM exam_users
        `);

        const [[attemptStats]] = await dbPool.query(`
            SELECT
                SUM(CASE WHEN result = 'PASS' THEN 1 ELSE 0 END) AS passed,
                SUM(CASE WHEN result = 'FAIL' THEN 1 ELSE 0 END) AS failed,
                ROUND(AVG(score), 1) AS avgScore
            FROM exam_attempts
            WHERE status = 'completed'
        `);

        const [recentActivity] = await dbPool.query(`
            SELECT
                DATE(started_at) AS date,
                COUNT(*) AS attempts
            FROM exam_attempts
            WHERE started_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(started_at)
            ORDER BY date ASC
        `);

        const [[practiceStats]] = await dbPool.query(`
            SELECT
                COUNT(DISTINCT user_id) AS practicingUsers,
                COUNT(*) AS totalPracticeAnswers,
                SUM(is_correct) AS correctPracticeAnswers
            FROM practice_progress
        `);

        res.json({
            success: true,
            stats: {
                totalUsers: userStats.totalUsers || 0,
                totalAttempts: userStats.totalAttempts || 0,
                avgBestScore: userStats.avgBestScore || 0,
                passed: attemptStats.passed || 0,
                failed: attemptStats.failed || 0,
                avgScore: attemptStats.avgScore || 0,
                passRate: attemptStats.passed && (attemptStats.passed + attemptStats.failed) > 0
                    ? Math.round((attemptStats.passed / (attemptStats.passed + attemptStats.failed)) * 100)
                    : 0
            },
            practiceStats: {
                practicingUsers: practiceStats.practicingUsers || 0,
                totalAnswers: practiceStats.totalPracticeAnswers || 0,
                correctAnswers: Number(practiceStats.correctPracticeAnswers) || 0
            },
            recentActivity
        });
    } catch (err) {
        console.error("ADMIN EXAM OVERVIEW ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: SCORE DISTRIBUTION
========================= */
router.get("/admin/score-distribution", requireAdmin, async (req, res) => {
    try {
        const [distribution] = await dbPool.query(`
            SELECT
                CASE
                    WHEN score >= 0 AND score < 5 THEN '0-4'
                    WHEN score >= 5 AND score < 7 THEN '5-6'
                    WHEN score >= 7 AND score < 9 THEN '7-8'
                    WHEN score >= 9 AND score < 12 THEN '9-11'
                    WHEN score >= 12 THEN '12-15'
                END AS score_range,
                COUNT(*) AS count
            FROM exam_attempts
            WHERE status = 'completed' AND score IS NOT NULL
            GROUP BY score_range
            ORDER BY MIN(score) ASC
        `);

        res.json({ success: true, distribution });
    } catch (err) {
        console.error("SCORE DISTRIBUTION ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: ATTEMPTS TRENDS
========================= */
router.get("/admin/attempts-trends", requireAdmin, async (req, res) => {
    try {
        const { granularity = 'day' } = req.query;

        let dateFormat, groupBy;
        switch (granularity) {
            case 'month':
                dateFormat = '%Y-%m';
                groupBy = "DATE_FORMAT(started_at, '%Y-%m')";
                break;
            case 'year':
                dateFormat = '%Y';
                groupBy = 'YEAR(started_at)';
                break;
            default:
                dateFormat = '%Y-%m-%d';
                groupBy = 'DATE(started_at)';
        }

        const [trends] = await dbPool.query(`
            SELECT
                DATE_FORMAT(started_at, '${dateFormat}') AS period,
                COUNT(*) AS total_attempts,
                SUM(CASE WHEN result = 'PASS' THEN 1 ELSE 0 END) AS passed,
                SUM(CASE WHEN result = 'FAIL' THEN 1 ELSE 0 END) AS failed
            FROM exam_attempts
            WHERE status = 'completed'
            GROUP BY ${groupBy}
            ORDER BY period ASC
            LIMIT 90
        `);

        res.json({ success: true, trends });
    } catch (err) {
        console.error("ATTEMPTS TRENDS ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: PRACTICE PROGRESS
========================= */
router.get("/admin/practice-progress", requireAdmin, async (req, res) => {
    const { user_id } = req.query;

    try {
        let query = `
            SELECT
                pp.user_id,
                eu.email,
                pp.category,
                COUNT(*) AS answered,
                SUM(pp.is_correct) AS correct,
                MAX(pp.answered_at) AS last_activity
            FROM practice_progress pp
            JOIN exam_users eu ON pp.user_id = eu.id
        `;
        const params = [];

        if (user_id) {
            query += " WHERE pp.user_id = ?";
            params.push(user_id);
        }

        query += " GROUP BY pp.user_id, eu.email, pp.category ORDER BY last_activity DESC";

        const [rows] = await dbPool.query(query, params);
        res.json({ success: true, progress: rows });
    } catch (err) {
        console.error("ADMIN PRACTICE PROGRESS ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: RESET USER ATTEMPTS
========================= */
router.delete("/admin/users/:id/attempts", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await dbPool.query(`DELETE FROM exam_attempts WHERE user_id = ?`, [id]);
        await dbPool.query(`DELETE FROM practice_progress WHERE user_id = ?`, [id]);
        await dbPool.query(`
            UPDATE exam_users
            SET total_attempts = 0, best_score = 0, last_score = NULL, last_result = NULL
            WHERE id = ?
        `, [id]);

        res.json({ success: true, message: "User attempts reset successfully" });
    } catch (err) {
        console.error("RESET USER ATTEMPTS ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: DELETE USER
========================= */
router.delete("/admin/users/:id", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        await dbPool.query(`DELETE FROM practice_progress WHERE user_id = ?`, [id]);
        await dbPool.query(`DELETE FROM exam_attempts WHERE user_id = ?`, [id]);
        await dbPool.query(`DELETE FROM exam_users WHERE id = ?`, [id]);

        res.json({ success: true, message: "User deleted successfully" });
    } catch (err) {
        console.error("DELETE USER ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: EXPORT ATTEMPTS CSV
========================= */
router.get("/admin/attempts/export", requireAdmin, async (req, res) => {
    try {
        const [attempts] = await dbPool.query(`
            SELECT
                a.id, u.email, a.mode, a.score, a.total_questions,
                a.result, a.started_at, a.finished_at, a.status
            FROM exam_attempts a
            JOIN exam_users u ON a.user_id = u.id
            ORDER BY a.started_at DESC
        `);

        const headers = ['ID', 'Email', 'Mode', 'Score', 'Total Questions', 'Result', 'Started At', 'Finished At', 'Status'];
        const csvRows = [headers.join(',')];

        attempts.forEach(a => {
            csvRows.push([
                a.id,
                `"${a.email}"`,
                a.mode || '',
                a.score || '',
                a.total_questions || '',
                a.result || '',
                a.started_at ? new Date(a.started_at).toISOString() : '',
                a.finished_at ? new Date(a.finished_at).toISOString() : '',
                a.status
            ].join(','));
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=exam_attempts.csv');
        res.send(csvRows.join('\n'));
    } catch (err) {
        console.error("EXPORT ATTEMPTS ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: GET ALL QUESTIONS
========================= */
router.get("/admin/questions", requireAdmin, (req, res) => {
    try {
        const { lang = 'en' } = req.query;
        const questions = readQuestions(lang);

        const categories = [...new Set(questions.map(q => q.CATEGORY).filter(Boolean))];

        res.json({ success: true, questions, categories });
    } catch (err) {
        console.error("GET QUESTIONS ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: GET SINGLE QUESTION
========================= */
router.get("/admin/questions/:qNumber", requireAdmin, (req, res) => {
    try {
        const { qNumber } = req.params;
        const { lang = 'en' } = req.query;
        const questions = readQuestions(lang);

        const question = questions.find(q => q.Q_NUMBER === qNumber);
        if (!question) {
            return res.status(404).json({ success: false, message: "Question not found" });
        }

        res.json({ success: true, question });
    } catch (err) {
        console.error("GET QUESTION ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: CREATE QUESTION
========================= */
router.post("/admin/questions", requireAdmin, (req, res) => {
    try {
        const { lang = 'en' } = req.query;
        const { CATEGORY, QUESTION, OPTION1, OPTION2, OPTION3, ANSWER, IMAGE } = req.body;

        if (!CATEGORY || !QUESTION || !OPTION1 || !OPTION2 || !OPTION3 || !ANSWER) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const questions = readQuestions(lang);
        const maxQNumber = Math.max(...questions.map(q => parseInt(q.Q_NUMBER) || 0), 0);

        const newQuestion = {
            Q_NUMBER: String(maxQNumber + 1),
            CATEGORY,
            QUESTION,
            OPTION1,
            OPTION2,
            OPTION3,
            ANSWER: String(ANSWER),
            IMAGE: IMAGE || null
        };

        questions.push(newQuestion);
        writeQuestions(questions, lang);

        res.json({ success: true, question: newQuestion, message: "Question created successfully" });
    } catch (err) {
        console.error("CREATE QUESTION ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: UPDATE QUESTION
========================= */
router.put("/admin/questions/:qNumber", requireAdmin, (req, res) => {
    try {
        const { qNumber } = req.params;
        const { lang = 'en' } = req.query;
        const { CATEGORY, QUESTION, OPTION1, OPTION2, OPTION3, ANSWER, IMAGE } = req.body;

        const questions = readQuestions(lang);
        const index = questions.findIndex(q => q.Q_NUMBER === qNumber);

        if (index === -1) {
            return res.status(404).json({ success: false, message: "Question not found" });
        }

        questions[index] = {
            ...questions[index],
            CATEGORY: CATEGORY || questions[index].CATEGORY,
            QUESTION: QUESTION || questions[index].QUESTION,
            OPTION1: OPTION1 || questions[index].OPTION1,
            OPTION2: OPTION2 || questions[index].OPTION2,
            OPTION3: OPTION3 || questions[index].OPTION3,
            ANSWER: ANSWER ? String(ANSWER) : questions[index].ANSWER,
            IMAGE: IMAGE !== undefined ? (IMAGE || null) : questions[index].IMAGE
        };

        writeQuestions(questions, lang);

        res.json({ success: true, question: questions[index], message: "Question updated successfully" });
    } catch (err) {
        console.error("UPDATE QUESTION ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: DELETE QUESTION
========================= */
router.delete("/admin/questions/:qNumber", requireAdmin, (req, res) => {
    try {
        const { qNumber } = req.params;
        const { lang = 'en' } = req.query;

        const questions = readQuestions(lang);
        const index = questions.findIndex(q => q.Q_NUMBER === qNumber);

        if (index === -1) {
            return res.status(404).json({ success: false, message: "Question not found" });
        }

        questions.splice(index, 1);
        writeQuestions(questions, lang);

        res.json({ success: true, message: "Question deleted successfully" });
    } catch (err) {
        console.error("DELETE QUESTION ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: GET QUESTION CATEGORIES
========================= */
router.get("/admin/categories", requireAdmin, (req, res) => {
    try {
        const { lang = 'en' } = req.query;
        const questions = readQuestions(lang);

        const categoryStats = {};
        questions.forEach(q => {
            if (q.CATEGORY) {
                categoryStats[q.CATEGORY] = (categoryStats[q.CATEGORY] || 0) + 1;
            }
        });

        const categories = Object.entries(categoryStats).map(([name, count]) => ({
            name,
            count
        }));

        res.json({ success: true, categories });
    } catch (err) {
        console.error("GET CATEGORIES ERROR:", err);
        res.status(500).json({ success: false });
    }
});

export default router;
