import express from "express";
import { dbPool } from "../server.js";

const router = express.Router();

/* ============================
   LIST ALL CMS PAGES (PUBLIC)
   GET /api/cms
============================ */
router.get("/", async (req, res) => {
    try {
        const [rows] = await dbPool.query(
            `SELECT id, slug, title, updated_at
             FROM cms_pages
             WHERE status = 1
             ORDER BY id ASC`
        );

        res.json({
            success: true,
            pages: rows
        });
    } catch (err) {
        console.error("CMS LIST ERROR:", err);
        res.status(500).json({
            success: false,
            error: "Failed to load CMS pages"
        });
    }
});

/* ============================
   GET CMS PAGE BY SLUG (PUBLIC)
   GET /api/cms/:slug
============================ */
router.get("/:slug", async (req, res) => {
    const { slug } = req.params;

    try {
        const [rows] = await dbPool.query(
            `SELECT slug, title, content, updated_at
             FROM cms_pages
             WHERE slug = ? AND status = 1
             LIMIT 1`,
            [slug]
        );

        if (!rows.length) {
            return res.status(404).json({
                success: false,
                error: "Page not found"
            });
        }

        res.json({
            success: true,
            page: rows[0]
        });
    } catch (err) {
        console.error("CMS FETCH ERROR:", err);
        res.status(500).json({
            success: false,
            error: "Failed to load page"
        });
    }
});

/* ============================
   UPDATE CMS PAGE (ADMIN)
   PUT /api/cms/:id
============================ */
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    const { title, content, slug, status } = req.body;

    if (!title || !content) {
        return res.status(400).json({
            success: false,
            error: "Title and content are required"
        });
    }

    try {
        const [result] = await dbPool.query(
            `UPDATE cms_pages
             SET title = ?,
                 content = ?,
                 slug = COALESCE(?, slug),
                 status = COALESCE(?, status)
             WHERE id = ?`,
            [title, content, slug ?? null, status ?? null, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: "CMS page not found"
            });
        }

        res.json({
            success: true,
            message: "CMS page updated successfully"
        });
    } catch (err) {
        console.error("CMS UPDATE ERROR:", err);

        if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({
                success: false,
                error: "Slug already exists"
            });
        }

        res.status(500).json({
            success: false,
            error: "Failed to update CMS page"
        });
    }
});

export default router;
