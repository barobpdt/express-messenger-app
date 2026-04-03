import { sql } from "../config/db.js";

export const initializeDatabase = async () => {
	try {
		await sql`
		CREATE TABLE IF NOT EXISTS users (
			id SERIAL PRIMARY KEY,
			username TEXT NOT NULL UNIQUE,
			password TEXT NOT NULL,
			fcm_token TEXT,
			nickname TEXT,
			avatar TEXT,
			created_at TIMESTAMP DEFAULT NOW()
		)`;
		await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT`;
		await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT`;

		await sql`
		CREATE TABLE IF NOT EXISTS favorites (
			id        SERIAL PRIMARY KEY,
			user_id   TEXT    NOT NULL,
			recipe_id INTEGER NOT NULL,
			title     TEXT    NOT NULL,
			image     TEXT,
			cook_time TEXT,
			servings  TEXT,
			created_at TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS peer_connections (
			id         SERIAL PRIMARY KEY,
			room_id    TEXT    NOT NULL,
			peer_id    TEXT    NOT NULL,
			user_id    TEXT,
			sdp        TEXT,
			type       TEXT,
			status     TEXT DEFAULT 'active',
			created_at TIMESTAMP DEFAULT NOW(),
			updated_at TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS songs (
			id             SERIAL PRIMARY KEY,
			artist         TEXT    NOT NULL,
			title          TEXT    NOT NULL,
			lyrics         TEXT,
			source         TEXT DEFAULT 'lyrics.ovh',
			artist_chosung TEXT,
			title_chosung  TEXT,
			created_at     TIMESTAMP DEFAULT NOW(),
			UNIQUE(artist, title)
		)`;
		await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS artist_chosung TEXT`;
		await sql`ALTER TABLE songs ADD COLUMN IF NOT EXISTS title_chosung  TEXT`;

		// ── pg_trgm 확장 + GIN 인덱스 (가사 유사도 검색 성능) ─────────────────
		await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
		await sql`CREATE INDEX IF NOT EXISTS idx_songs_lyrics_trgm ON songs USING GIN (lyrics  gin_trgm_ops)`;
		await sql`CREATE INDEX IF NOT EXISTS idx_songs_title_trgm  ON songs USING GIN (title   gin_trgm_ops)`;
		await sql`CREATE INDEX IF NOT EXISTS idx_songs_artist_trgm ON songs USING GIN (artist  gin_trgm_ops)`;

		// ── 주문 시스템 테이블 ──────────────────────────────────────────────────
		await sql`
		CREATE TABLE IF NOT EXISTS restaurant_tables (
			id           SERIAL PRIMARY KEY,
			table_number INTEGER NOT NULL UNIQUE,
			capacity     INTEGER DEFAULT 4,
			status       TEXT DEFAULT 'available',
			created_at   TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS categories (
			id         SERIAL PRIMARY KEY,
			name       TEXT NOT NULL UNIQUE,
			sort_order INTEGER DEFAULT 0,
			created_at TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS menu_items (
			id           SERIAL PRIMARY KEY,
			category_id  INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
			name         TEXT    NOT NULL,
			price        INTEGER NOT NULL,
			description  TEXT,
			image        TEXT,
			is_available BOOLEAN DEFAULT TRUE,
			created_at   TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS orders (
			id           SERIAL PRIMARY KEY,
			table_id     INTEGER NOT NULL REFERENCES restaurant_tables(id),
			status       TEXT DEFAULT 'pending',
			total_amount INTEGER DEFAULT 0,
			memo         TEXT,
			created_at   TIMESTAMP DEFAULT NOW(),
			updated_at   TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS order_items (
			id           SERIAL PRIMARY KEY,
			order_id     INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
			menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
			quantity     INTEGER DEFAULT 1,
			unit_price   INTEGER NOT NULL,
			subtotal     INTEGER NOT NULL,
			created_at   TIMESTAMP DEFAULT NOW()
		)`;

		// ── 영상 스케줄 테이블 ────────────────────────────────────────────────────
		await sql`
		CREATE TABLE IF NOT EXISTS video_schedule (
			id          SERIAL PRIMARY KEY,
			title       TEXT    NOT NULL,
			filename    TEXT    NOT NULL,
			sort_order  INTEGER DEFAULT 0,
			play_date   TEXT,
			start_time  TEXT    DEFAULT '00:00',
			end_time    TEXT    DEFAULT '23:59',
			repeat_type TEXT    DEFAULT 'once',
			is_active   BOOLEAN DEFAULT TRUE,
			created_at  TIMESTAMP DEFAULT NOW()
		)`;
		// 기존 테이블에 컬럼이 없으면 추가
		await sql`ALTER TABLE video_schedule ADD COLUMN IF NOT EXISTS play_date   TEXT`;
		await sql`ALTER TABLE video_schedule ADD COLUMN IF NOT EXISTS start_time  TEXT DEFAULT '00:00'`;
		await sql`ALTER TABLE video_schedule ADD COLUMN IF NOT EXISTS end_time    TEXT DEFAULT '23:59'`;
		await sql`ALTER TABLE video_schedule ADD COLUMN IF NOT EXISTS repeat_type TEXT DEFAULT 'once'`;

		// ─── Todo 애플리케이션 테이블 ────────────────────────────────────────────────
		await sql`
		CREATE TABLE IF NOT EXISTS todos (
			id                 SERIAL PRIMARY KEY,
			title              TEXT NOT NULL,
			description        TEXT,
			status             TEXT DEFAULT '계획',
			issue_tracker_text TEXT,
			remind_at          TIMESTAMP,
			start_date         TEXT,
			end_date           TEXT,
			progress           INTEGER DEFAULT 0,
			dependencies       TEXT,
			created_at         TIMESTAMP DEFAULT NOW(),
			updated_at         TIMESTAMP DEFAULT NOW()
		)`;

		// 기존 테이블에 컬럼이 없으면 추가 (WBS 마이그레이션)
		await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS start_date TEXT`;
		await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS end_date   TEXT`;
		await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS progress   INTEGER DEFAULT 0`;
		await sql`ALTER TABLE todos ADD COLUMN IF NOT EXISTS dependencies TEXT`;


		await sql`
		CREATE TABLE IF NOT EXISTS todo_history (
			id         SERIAL PRIMARY KEY,
			todo_id    INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
			old_status TEXT,
			new_status TEXT,
			note       TEXT,
			changed_at TIMESTAMP DEFAULT NOW()
		)`;

		// ─── 오프라인 메시지 보관 테이블 ───────────────────────────────────────────────
		await sql`
		CREATE TABLE IF NOT EXISTS offline_messages (
			id         SERIAL PRIMARY KEY,
			sender     TEXT NOT NULL,
			receiver   TEXT NOT NULL,
			message    TEXT NOT NULL,
			created_at TIMESTAMP DEFAULT NOW()
		)`;

		// ─── 채팅방 테이블 ────────────────────────────────────────────────────────
		await sql`
		CREATE TABLE IF NOT EXISTS chat_rooms (
			id          SERIAL PRIMARY KEY,
			room_code   TEXT NOT NULL UNIQUE,
			name        TEXT NOT NULL,
			room_type   TEXT DEFAULT 'public',
			description TEXT,
			owner       TEXT NOT NULL,
			created_at  TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS chat_room_users (
			id         SERIAL PRIMARY KEY,
			room_id    INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
			username   TEXT NOT NULL,
			nickname   TEXT,
			role       TEXT DEFAULT 'member',
			status     TEXT DEFAULT 'active',
			joined_at  TIMESTAMP DEFAULT NOW()
		)`;

		// ─── Task Manager (Jira-like) 시스템 테이블 ────────────────────────────────
		await sql`
		CREATE TABLE IF NOT EXISTS teams (
			id          SERIAL PRIMARY KEY,
			name        TEXT NOT NULL UNIQUE,
			webhook_url TEXT,
			channel_id  TEXT,
			created_at  TIMESTAMP DEFAULT NOW()
		)`;

		await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE SET NULL`;
		await sql`ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS team_id INTEGER REFERENCES teams(id) ON DELETE CASCADE`;

		await sql`
		CREATE TABLE IF NOT EXISTS projects (
			id          SERIAL PRIMARY KEY,
			name        TEXT NOT NULL,
			description TEXT,
			status      TEXT DEFAULT 'active',
			team_id     INTEGER REFERENCES teams(id) ON DELETE CASCADE,
			created_at  TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS tasks (
			id          SERIAL PRIMARY KEY,
			project_id  INTEGER REFERENCES projects(id) ON DELETE CASCADE,
			reporter_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
			title       TEXT NOT NULL,
			description TEXT,
			status      TEXT DEFAULT 'todo',
			priority    TEXT DEFAULT 'medium',
			progress    INTEGER DEFAULT 0,
			start_date  TEXT,
			due_date    TEXT,
			created_at  TIMESTAMP DEFAULT NOW(),
			updated_at  TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS task_histories (
			id            SERIAL PRIMARY KEY,
			task_id       INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
			user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
			field_changed TEXT,
			old_value     TEXT,
			new_value     TEXT,
			changed_at    TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS artifacts (
			id              SERIAL PRIMARY KEY,
			task_id         INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
			type            TEXT,
			title           TEXT NOT NULL,
			current_version INTEGER DEFAULT 1,
			created_at      TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS artifact_versions (
			id             SERIAL PRIMARY KEY,
			artifact_id    INTEGER REFERENCES artifacts(id) ON DELETE CASCADE,
			version_number INTEGER NOT NULL,
			file_url       TEXT,
			content        TEXT,
			uploader_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
			uploaded_at    TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS artifact_feedbacks (
			id                  SERIAL PRIMARY KEY,
			artifact_version_id INTEGER REFERENCES artifact_versions(id) ON DELETE CASCADE,
			user_id             INTEGER REFERENCES users(id) ON DELETE SET NULL,
			content             TEXT NOT NULL,
			status              TEXT DEFAULT 'open',
			created_at          TIMESTAMP DEFAULT NOW()
		)`;

		// ─── 게시판 테이블 (QnA / 정보공유) ─────────────────────────────────────
		await sql`
		CREATE TABLE IF NOT EXISTS board_posts (
			id                  SERIAL PRIMARY KEY,
			board_type          TEXT NOT NULL DEFAULT 'qna',
			title               TEXT NOT NULL,
			content             TEXT NOT NULL,
			author              TEXT NOT NULL,
			author_nickname     TEXT,
			author_avatar       TEXT,
			tags                TEXT,
			view_count          INTEGER DEFAULT 0,
			like_count          INTEGER DEFAULT 0,
			comment_count       INTEGER DEFAULT 0,
			is_accepted         BOOLEAN DEFAULT FALSE,
			accepted_comment_id INTEGER,
			is_pinned           BOOLEAN DEFAULT FALSE,
			created_at          TIMESTAMP DEFAULT NOW(),
			updated_at          TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS board_comments (
			id               SERIAL PRIMARY KEY,
			post_id          INTEGER NOT NULL REFERENCES board_posts(id) ON DELETE CASCADE,
			author           TEXT NOT NULL,
			author_nickname  TEXT,
			author_avatar    TEXT,
			content          TEXT NOT NULL,
			parent_id        INTEGER,
			like_count       INTEGER DEFAULT 0,
			is_accepted      BOOLEAN DEFAULT FALSE,
			created_at       TIMESTAMP DEFAULT NOW(),
			updated_at       TIMESTAMP DEFAULT NOW()
		)`;

		await sql`
		CREATE TABLE IF NOT EXISTS board_likes (
			id          SERIAL PRIMARY KEY,
			target_type TEXT NOT NULL,
			target_id   INTEGER NOT NULL,
			username    TEXT NOT NULL,
			created_at  TIMESTAMP DEFAULT NOW(),
			UNIQUE(target_type, target_id, username)
		)`;

		await sql`CREATE INDEX IF NOT EXISTS idx_board_posts_type ON board_posts(board_type)`;
		await sql`CREATE INDEX IF NOT EXISTS idx_board_posts_author ON board_posts(author)`;
		await sql`CREATE INDEX IF NOT EXISTS idx_board_comments_post ON board_comments(post_id)`;

		console.log("✅ Database tables initialized successfully.");
	} catch (error) {
		console.error("❌ Failed to initialize database tables:", error);
		process.exit(1);
	}
};
