import { Router } from "express";
import { db } from "../config/db.js";
import { boardPostsTable, boardCommentsTable, boardLikesTable, usersTable } from "../db/schema.js";
import { eq, and, desc, asc, sql, ilike, or } from "drizzle-orm";

const router = Router();

// ─── 미들웨어: 간단한 인증 (username을 헤더 or body로 전달) ───────────────────
function getUsername(req) {
	return req.headers["x-username"] || req.body?.username || req.query?.username || null;
}

// ─── 게시글 목록 조회 ─────────────────────────────────────────────────────────
// GET /api/board/posts?type=qna&page=1&limit=20&search=
router.get("/posts", async (req, res) => {
	try {
		const { type = "qna", page = 1, limit = 20, search = "", tag = "" } = req.query;
		const offset = (parseInt(page) - 1) * parseInt(limit);

		let query = db.select().from(boardPostsTable).where(eq(boardPostsTable.boardType, type));

		// 검색어 필터
		if (search) {
			query = db.select().from(boardPostsTable).where(
				and(
					eq(boardPostsTable.boardType, type),
					or(
						ilike(boardPostsTable.title, `%${search}%`),
						ilike(boardPostsTable.content, `%${search}%`),
						ilike(boardPostsTable.authorNickname, `%${search}%`)
					)
				)
			);
		}

		// 전체 카운트
		const countResult = await db.select({ count: sql`COUNT(*)` }).from(boardPostsTable)
			.where(
				search
					? and(
						eq(boardPostsTable.boardType, type),
						or(
							ilike(boardPostsTable.title, `%${search}%`),
							ilike(boardPostsTable.content, `%${search}%`)
						)
					)
					: eq(boardPostsTable.boardType, type)
			);

		const total = parseInt(countResult[0].count);

		// 실제 데이터
		const posts = await db.select().from(boardPostsTable)
			.where(
				search
					? and(
						eq(boardPostsTable.boardType, type),
						or(
							ilike(boardPostsTable.title, `%${search}%`),
							ilike(boardPostsTable.content, `%${search}%`)
						)
					)
					: eq(boardPostsTable.boardType, type)
			)
			.orderBy(desc(boardPostsTable.isPinned), desc(boardPostsTable.createdAt))
			.limit(parseInt(limit))
			.offset(offset);

		res.json({
			success: true,
			posts,
			pagination: {
				total,
				page: parseInt(page),
				limit: parseInt(limit),
				totalPages: Math.ceil(total / parseInt(limit))
			}
		});
	} catch (err) {
		console.error("Board posts list error:", err);
		res.status(500).json({ success: false, error: "서버 오류" });
	}
});

// ─── 게시글 단건 조회 (조회수 증가) ──────────────────────────────────────────
// GET /api/board/posts/:id
router.get("/posts/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const postId = parseInt(id);

		// 조회수 증가
		await db.update(boardPostsTable)
			.set({ viewCount: sql`view_count + 1` })
			.where(eq(boardPostsTable.id, postId));

		const posts = await db.select().from(boardPostsTable).where(eq(boardPostsTable.id, postId)).limit(1);
		if (!posts.length) return res.status(404).json({ success: false, error: "게시글을 찾을 수 없습니다." });

		// 댓글 목록 함께 반환
		const comments = await db.select().from(boardCommentsTable)
			.where(eq(boardCommentsTable.postId, postId))
			.orderBy(asc(boardCommentsTable.createdAt));

		res.json({ success: true, post: posts[0], comments });
	} catch (err) {
		console.error("Board post detail error:", err);
		res.status(500).json({ success: false, error: "서버 오류" });
	}
});

// ─── 게시글 작성 ─────────────────────────────────────────────────────────────
// POST /api/board/posts
router.post("/posts", async (req, res) => {
	try {
		const { boardType, title, content, author, authorNickname, authorAvatar, tags } = req.body;
		if (!boardType || !title || !content || !author) {
			return res.status(400).json({ success: false, error: "필수 항목이 누락되었습니다." });
		}

		const [post] = await db.insert(boardPostsTable).values({
			boardType,
			title: title.trim(),
			content: content.trim(),
			author,
			authorNickname: authorNickname || author,
			authorAvatar: authorAvatar || null,
			tags: tags || null,
		}).returning();

		res.status(201).json({ success: true, post });
	} catch (err) {
		console.error("Board post create error:", err);
		res.status(500).json({ success: false, error: "서버 오류" });
	}
});

// ─── 게시글 수정 ─────────────────────────────────────────────────────────────
// PUT /api/board/posts/:id
router.put("/posts/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const { title, content, tags, username } = req.body;
		const postId = parseInt(id);

		const posts = await db.select().from(boardPostsTable).where(eq(boardPostsTable.id, postId)).limit(1);
		if (!posts.length) return res.status(404).json({ success: false, error: "게시글을 찾을 수 없습니다." });
		if (posts[0].author !== username) return res.status(403).json({ success: false, error: "수정 권한이 없습니다." });

		const [updated] = await db.update(boardPostsTable)
			.set({ title, content, tags, updatedAt: new Date() })
			.where(eq(boardPostsTable.id, postId))
			.returning();

		res.json({ success: true, post: updated });
	} catch (err) {
		console.error("Board post update error:", err);
		res.status(500).json({ success: false, error: "서버 오류" });
	}
});

// ─── 게시글 삭제 ─────────────────────────────────────────────────────────────
// DELETE /api/board/posts/:id
router.delete("/posts/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const username = req.query.username || req.body.username;
		const postId = parseInt(id);

		const posts = await db.select().from(boardPostsTable).where(eq(boardPostsTable.id, postId)).limit(1);
		if (!posts.length) return res.status(404).json({ success: false, error: "게시글을 찾을 수 없습니다." });
		if (posts[0].author !== username) return res.status(403).json({ success: false, error: "삭제 권한이 없습니다." });

		await db.delete(boardPostsTable).where(eq(boardPostsTable.id, postId));
		res.json({ success: true, message: "게시글이 삭제되었습니다." });
	} catch (err) {
		console.error("Board post delete error:", err);
		res.status(500).json({ success: false, error: "서버 오류" });
	}
});

// ─── 댓글 작성 ──────────────────────────────────────────────────────────────
// POST /api/board/posts/:id/comments
router.post("/posts/:id/comments", async (req, res) => {
	try {
		const { id } = req.params;
		const { author, authorNickname, authorAvatar, content, parentId } = req.body;
		const postId = parseInt(id);

		if (!author || !content) return res.status(400).json({ success: false, error: "필수 항목 누락" });

		const [comment] = await db.insert(boardCommentsTable).values({
			postId,
			author,
			authorNickname: authorNickname || author,
			authorAvatar: authorAvatar || null,
			content: content.trim(),
			parentId: parentId ? parseInt(parentId) : null,
		}).returning();

		// 댓글 카운트 증가
		await db.update(boardPostsTable)
			.set({ commentCount: sql`comment_count + 1` })
			.where(eq(boardPostsTable.id, postId));

		res.status(201).json({ success: true, comment });
	} catch (err) {
		console.error("Board comment create error:", err);
		res.status(500).json({ success: false, error: "서버 오류" });
	}
});

// ─── 댓글 삭제 ──────────────────────────────────────────────────────────────
// DELETE /api/board/comments/:id
router.delete("/comments/:id", async (req, res) => {
	try {
		const { id } = req.params;
		const username = req.query.username || req.body.username;
		const commentId = parseInt(id);

		const comments = await db.select().from(boardCommentsTable).where(eq(boardCommentsTable.id, commentId)).limit(1);
		if (!comments.length) return res.status(404).json({ success: false, error: "댓글을 찾을 수 없습니다." });
		if (comments[0].author !== username) return res.status(403).json({ success: false, error: "삭제 권한이 없습니다." });

		const { postId } = comments[0];
		await db.delete(boardCommentsTable).where(eq(boardCommentsTable.id, commentId));

		// 댓글 카운트 감소
		await db.update(boardPostsTable)
			.set({ commentCount: sql`GREATEST(comment_count - 1, 0)` })
			.where(eq(boardPostsTable.id, postId));

		res.json({ success: true, message: "댓글이 삭제되었습니다." });
	} catch (err) {
		console.error("Board comment delete error:", err);
		res.status(500).json({ success: false, error: "서버 오류" });
	}
});

// ─── 좋아요 토글 ─────────────────────────────────────────────────────────────
// POST /api/board/like
// body: { targetType: 'post'|'comment', targetId, username }
router.post("/like", async (req, res) => {
	try {
		const { targetType, targetId, username } = req.body;
		if (!targetType || !targetId || !username) {
			return res.status(400).json({ success: false, error: "필수 항목 누락" });
		}

		const existing = await db.select().from(boardLikesTable).where(
			and(
				eq(boardLikesTable.targetType, targetType),
				eq(boardLikesTable.targetId, parseInt(targetId)),
				eq(boardLikesTable.username, username)
			)
		).limit(1);

		if (existing.length > 0) {
			// 좋아요 취소
			await db.delete(boardLikesTable).where(eq(boardLikesTable.id, existing[0].id));

			if (targetType === "post") {
				await db.update(boardPostsTable)
					.set({ likeCount: sql`GREATEST(like_count - 1, 0)` })
					.where(eq(boardPostsTable.id, parseInt(targetId)));
			} else {
				await db.update(boardCommentsTable)
					.set({ likeCount: sql`GREATEST(like_count - 1, 0)` })
					.where(eq(boardCommentsTable.id, parseInt(targetId)));
			}
			res.json({ success: true, liked: false });
		} else {
			// 좋아요 추가
			await db.insert(boardLikesTable).values({
				targetType, targetId: parseInt(targetId), username
			});

			if (targetType === "post") {
				await db.update(boardPostsTable)
					.set({ likeCount: sql`like_count + 1` })
					.where(eq(boardPostsTable.id, parseInt(targetId)));
			} else {
				await db.update(boardCommentsTable)
					.set({ likeCount: sql`like_count + 1` })
					.where(eq(boardCommentsTable.id, parseInt(targetId)));
			}
			res.json({ success: true, liked: true });
		}
	} catch (err) {
		console.error("Board like error:", err);
		res.status(500).json({ success: false, error: "서버 오류" });
	}
});

// ─── QnA: 답변 채택 ──────────────────────────────────────────────────────────
// PATCH /api/board/posts/:id/accept
router.patch("/posts/:id/accept", async (req, res) => {
	try {
		const { id } = req.params;
		const { commentId, username } = req.body;
		const postId = parseInt(id);

		const posts = await db.select().from(boardPostsTable).where(eq(boardPostsTable.id, postId)).limit(1);
		if (!posts.length) return res.status(404).json({ success: false, error: "게시글을 찾을 수 없습니다." });
		if (posts[0].author !== username) return res.status(403).json({ success: false, error: "채택 권한이 없습니다." });
		if (posts[0].boardType !== "qna") return res.status(400).json({ success: false, error: "QnA 게시글에서만 채택 가능합니다." });

		// 이전 채택 취소
		if (posts[0].acceptedCommentId) {
			await db.update(boardCommentsTable)
				.set({ isAccepted: false })
				.where(eq(boardCommentsTable.id, posts[0].acceptedCommentId));
		}

		// 새 댓글 채택
		await db.update(boardCommentsTable)
			.set({ isAccepted: true })
			.where(eq(boardCommentsTable.id, parseInt(commentId)));

		await db.update(boardPostsTable)
			.set({ isAccepted: true, acceptedCommentId: parseInt(commentId), updatedAt: new Date() })
			.where(eq(boardPostsTable.id, postId));

		res.json({ success: true, message: "답변이 채택되었습니다." });
	} catch (err) {
		console.error("Board accept error:", err);
		res.status(500).json({ success: false, error: "서버 오류" });
	}
});

// ─── 내가 좋아요한 목록 조회 ─────────────────────────────────────────────────
// GET /api/board/likes?username=&targetType=post
router.get("/likes", async (req, res) => {
	try {
		const { username, targetType } = req.query;
		if (!username) return res.status(400).json({ success: false, error: "username 필수" });

		const where = targetType
			? and(eq(boardLikesTable.username, username), eq(boardLikesTable.targetType, targetType))
			: eq(boardLikesTable.username, username);

		const likes = await db.select().from(boardLikesTable).where(where);
		res.json({ success: true, likes });
	} catch (err) {
		res.status(500).json({ success: false, error: "서버 오류" });
	}
});

export default router;
