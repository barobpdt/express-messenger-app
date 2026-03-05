import { pgTable, serial, text, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
	id: serial("id").primaryKey(),
	username: text("username").notNull().unique(),
	password: text("password").notNull(),
	fcmToken: text("fcm_token"),
	createdAt: timestamp("created_at").defaultNow(),
});

export const favoritesTable = pgTable("favorites", {
	id: serial("id").primaryKey(),
	userId: text("user_id").notNull(),
	recipeId: integer("recipe_id").notNull(),
	title: text("title").notNull(),
	image: text("image"),
	cookTime: text("cook_time"),
	servings: text("servings"),
	createdAt: timestamp("created_at").defaultNow(),
});

export const peerConnectionsTable = pgTable("peer_connections", {
	id: serial("id").primaryKey(),
	roomId: text("room_id").notNull(),
	peerId: text("peer_id").notNull(),
	userId: text("user_id"),
	sdp: text("sdp"),
	type: text("type"),
	status: text("status").default("active"),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export const songsTable = pgTable("songs", {
	id: serial("id").primaryKey(),
	artist: text("artist").notNull(),              // 아티스트명
	title: text("title").notNull(),                // 곡 제목
	lyrics: text("lyrics"),                        // 가사 본문
	source: text("source").default("lyrics.ovh"),  // 가사 출처 API
	artistChosung: text("artist_chosung"),          // 아티스트 초성 (예: ㅇㅇㅇ)
	titleChosung: text("title_chosung"),           // 곡 제목 초성 (예: ㅂㄹㅁ)
	createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
	uniq: unique().on(t.artist, t.title),          // 동일 아티스트+제목 중복 저장 방지
}));

// ─── 테이블 주문 시스템 ──────────────────────────────────────────────────────
// 매장 테이블
export const restaurantTables = pgTable("restaurant_tables", {
	id: serial("id").primaryKey(),
	tableNumber: integer("table_number").notNull().unique(),  // 테이블 번호
	capacity: integer("capacity").default(4),                 // 수용 인원
	status: text("status").default("available"),              // available|occupied|reserved
	createdAt: timestamp("created_at").defaultNow(),
});

// 메뉴 카테고리
export const categoriesTable = pgTable("categories", {
	id: serial("id").primaryKey(),
	name: text("name").notNull().unique(),                    // 음료, 주류, 안주, 식사
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at").defaultNow(),
});

// 메뉴 항목
export const menuItemsTable = pgTable("menu_items", {
	id: serial("id").primaryKey(),
	categoryId: integer("category_id").notNull(),             // categories 참조
	name: text("name").notNull(),
	price: integer("price").notNull(),                        // 가격 (원)
	description: text("description"),
	image: text("image"),
	isAvailable: boolean("is_available").default(true),       // 판매 가능 여부
	createdAt: timestamp("created_at").defaultNow(),
});

// 주문 (테이블별)
export const ordersTable = pgTable("orders", {
	id: serial("id").primaryKey(),
	tableId: integer("table_id").notNull(),                   // restaurant_tables 참조
	status: text("status").default("pending"),                // pending|confirmed|served|paid
	totalAmount: integer("total_amount").default(0),
	memo: text("memo"),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

// 주문 세부 항목
export const orderItemsTable = pgTable("order_items", {
	id: serial("id").primaryKey(),
	orderId: integer("order_id").notNull(),                   // orders 참조
	menuItemId: integer("menu_item_id").notNull(),            // menu_items 참조
	quantity: integer("quantity").default(1),
	unitPrice: integer("unit_price").notNull(),               // 주문 시점 단가
	subtotal: integer("subtotal").notNull(),                  // quantity × unit_price
	createdAt: timestamp("created_at").defaultNow(),
});

// ─── 영상 스케줄 ─────────────────────────────────────────────────────────────
export const videoScheduleTable = pgTable("video_schedule", {
	id: serial("id").primaryKey(),
	title: text("title").notNull(),
	filename: text("filename").notNull(),               // /videos/ 하위 파일명
	sortOrder: integer("sort_order").default(0),         // 같은 시간대 내 재생 순서
	playDate: text("play_date"),                        // YYYY-MM-DD (NULL = 매일)
	startTime: text("start_time").default("00:00"),      // HH:MM
	endTime: text("end_time").default("23:59"),        // HH:MM
	repeatType: text("repeat_type").default("once"),      // once | daily | weekly
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at").defaultNow(),
});

// ─── Todo 애플리케이션 ───────────────────────────────────────────────────────
export const todosTable = pgTable("todos", {
	id: serial("id").primaryKey(),
	title: text("title").notNull(),
	description: text("description"),
	status: text("status").default("계획"), // 계획, 진행, 대기, 반려, 완료, 삭제
	issueTrackerText: text("issue_tracker_text"),
	remindAt: timestamp("remind_at"),
	startDate: text("start_date"), // YYYY-MM-DD
	endDate: text("end_date"), // YYYY-MM-DD
	progress: integer("progress").default(0), // 0 ~ 100
	dependencies: text("dependencies"), // 콤마(,)로 구분된 선행 Todo ID 문자열 혹은 빈 값
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export const todoHistoryTable = pgTable("todo_history", {
	id: serial("id").primaryKey(),
	todoId: integer("todo_id").notNull(), // todos 참조
	oldStatus: text("old_status"),
	newStatus: text("new_status"),
	note: text("note"), // 변경 사유/메모
	changedAt: timestamp("changed_at").defaultNow(),
});
