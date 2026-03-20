import express from "express";
import { ENV } from "./config/env.js";
import { db } from "./config/db.js";
import { usersTable, favoritesTable, peerConnectionsTable, songsTable, videoScheduleTable, todosTable, todoHistoryTable, offlineMessagesTable } from "./db/schema.js";
import { and, eq, or, like, sql, desc } from "drizzle-orm";
// import job from "./config/cron.js";
import cors from "cors";
import { initializeDatabase } from "./db/init.js";
import { catchAsyncErrors } from "./config/auth.js";
import { errorMiddleware } from "./config/error.js";
import { getChoseong } from "es-hangul";
import logger from "./config/logger.js";
import orderRouter from "./routes/order.js";
import spriteRouter from "./routes/sprite.js";
import uploadRouter from "./routes/upload.js";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import http from "http";
import ExcelJS from "exceljs";
import Database from "better-sqlite3";
import { exec } from "child_process";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import admin from "firebase-admin";
import AdmZip from "adm-zip";
import { Server } from 'socket.io';

// npm install socket.io
// const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.join(__dirname, "uploads");
const FILE_TTL_MS = 60 * 60 * 1000; // 1시간

const fileStore = new Map();
const usePush = false;
const serverInfo = {};


// Firebase Admin 초기화
const firebaseKeyPath = path.join(__dirname, 'firebase-adminsdk.json');
if (fs.existsSync(firebaseKeyPath)) {
	try {
		const serviceAccount = JSON.parse(fs.readFileSync(firebaseKeyPath, 'utf8'));
		admin.initializeApp({
			credential: admin.credential.cert(serviceAccount)
		});
		logger.info("Firebase Admin Initialized successfully.");
	} catch (e) {
		logger.error("Failed to initialize Firebase Admin", e);
	}
} else {
	logger.warn("firebase-adminsdk.json not found. Push notifications will be disabled.");
}

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let activeSqliteDb = null;
// { username: WebSocket }
const onlineUsers = new Map();

function setUserInfo(ws, username, user) {
	if (!user) return;
	ws.username = username;
	ws.avatar = user.avatar || null;
	ws.nickname = user.nickname || null;
	onlineUsers.set(username, ws);
	broadcastOnlineUsers();

	// 오프라인 메시지 확인 및 전송
	db.select().from(offlineMessagesTable).where(eq(offlineMessagesTable.receiver, username)).orderBy(offlineMessagesTable.createdAt)
		.then(async (messages) => {
			if (messages.length > 0) {
				ws.send(JSON.stringify({
					type: 'text',
					senderId: 'system',
					timestamp: Date.now(),
					targetUser: username,
					text: `🔔 오프라인 동안 ${messages.length}개의 귓속말이 도착했습니다.`
				}));

				for (const msg of messages) {
					const sender = onlineUsers.get(msg.sender) || null;
					ws.send(JSON.stringify({
						type: 'text',
						senderId: msg.sender,
						senderAvatar: sender ? sender.avatar : null,
						timestamp: msg.createdAt,
						targetUser: username,
						text: msg.message
					}));
				}
				// 읽은 메시지 삭제
				await db.delete(offlineMessagesTable).where(eq(offlineMessagesTable.receiver, username));
			}
		}).catch(err => logger.error("오프라인 메시지 로드 실패", err));
}

/* #################### 카라오케 스트리밍 상태 #################### */
const RECORDINGS_DIR = path.join(__dirname, 'recordings');
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

// 현재 활성 스트리밍 세션 상태
// { sessionId, song, fd (파일 디스크립터), filename, startTime, streamerWs }
let karaokeSession = null;

wss.on('connection', (ws) => {
	// 임시 ID (로그인 전)
	ws.id = uuidv4();
	ws.joinedRooms = new Set(); // 속한 게임 방 추적용

	ws.on('message', (message, isBinary) => {
		/* ── 카라오케: binary 청크 수신 (스트리머 → 서버 → 시청자) ── */
		if (karaokeSession && isBinary) {
			// 서버-사이드 녹화 파일에 append
			if (Buffer.isBuffer(message) && karaokeSession.fd !== null) {
				try {
					fs.writeSync(karaokeSession.fd, message);
				} catch (e) {
					logger.error('카라오케 녹화 쓰기 실패', e);
				}
			}
			// 시청자(karaoke-viewer 방)에게 binary 중계
			wss.clients.forEach(client => {
				if (client !== ws && client.readyState === 1 && client.joinedRooms?.has('karaoke-viewer')) {
					client.send(message, { binary: true });
				}
			});
			return;
		}

		try {
			const parsed = JSON.parse(message);
			console.log(">> type==" + parsed.type)
			if (parsed.type === 'init') {
				const username = parsed.username;
				if (username) {
					// DB에서 아바타 가져오기
					db.select({ avatar: usersTable.avatar, nickname: usersTable.nickname }).from(usersTable).where(eq(usersTable.username, username)).limit(1)
						.then(users => setUserInfo(ws, username, users[0]))
						.catch(err => {
							logger.error("Failed to fetch avatar for init", err);
							setUserInfo(ws, username, { avatar: null, nickname: username })
						});
				}
				return;
			}

			/* ── 태블릿 모니터링: 태블릿 등록 ── */
			if (parsed.type === 'tablet-init') {
				ws.isTablet = true;
				ws.tableId = parsed.tableId;
				ws.tabletLastSeen = Date.now();
				logger.info(`태블릿 등록: 테이블 ${parsed.tableId}`);
				// 관리자들에게 새 태블릿 접속 알림
				wss.clients.forEach(client => {
					if (client.readyState === 1 && client.isTabletAdmin) {
						client.send(JSON.stringify({ type: 'tablet-connected', tableId: parsed.tableId, timestamp: parsed.timestamp, url: parsed.url }));
					}
				});
				return;
			}

			/* ── 태블릿 모니터링: 관리자 등록 ── */
			if (parsed.type === 'tablet-admin-init') {
				ws.isTabletAdmin = true;
				// 현재 접속 중인 태블릿 목록 전달
				const tablets = [];
				wss.clients.forEach(client => {
					if (client.isTablet) tablets.push({ tableId: client.tableId, lastSeen: client.tabletLastSeen });
				});
				ws.send(JSON.stringify({ type: 'tablet-list', tablets }));
				logger.info(`태블릿 관리자 접속`);
				return;
			}

			/* ── 태블릿 모니터링: 오류/스크린샷 보고 → 관리자로 포워딩 ── */
			if (parsed.type === 'tablet-error' || parsed.type === 'tablet-screenshot') {
				if (ws.isTablet) ws.tabletLastSeen = Date.now();
				wss.clients.forEach(client => {
					if (client.readyState === 1 && client.isTabletAdmin) {
						client.send(JSON.stringify(parsed));
					}
				});
				return;
			}

			/* ── 태블릿 모니터링: 관리자 → 특정 태블릿 명령 전달 ── */
			if (parsed.type === 'tablet-cmd') {
				if (!ws.isTabletAdmin) return; // 관리자만 명령 가능
				const targetTableId = parsed.tableId;
				let sent = false;
				wss.clients.forEach(client => {
					if (client.readyState === 1 && client.isTablet &&
						(targetTableId === 'all' || String(client.tableId) === String(targetTableId))) {
						client.send(JSON.stringify(parsed));
						sent = true;
					}
				});
				// 결과를 관리자에게 에코
				ws.send(JSON.stringify({ type: 'tablet-cmd-ack', tableId: targetTableId, cmd: parsed.cmd, sent, timestamp: Date.now() }));
				return;
			}

			/* ── 카라오케: 스트림 시작 ── */
			if (parsed.type === 'karaoke-start') {
				const sessionId = uuidv4();
				const now = new Date();
				const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
				const songTitle = parsed.song?.title ? parsed.song.title.replace(/[\\/:*?"<>|]/g, '_') : 'unknown';
				const filename = `${dateStr}_${songTitle}_${sessionId.slice(0, 8)}.webm`;
				const filepath = path.join(RECORDINGS_DIR, filename);
				const fd = fs.openSync(filepath, 'w');
				karaokeSession = { sessionId, song: parsed.song || {}, fd, filename, filepath, startTime: Date.now(), streamerWs: ws };
				ws.isKaraokeStreamer = true;
				logger.info(`카라오케 스트리밍 시작: ${filename}`);
				// 시청자에게 곡 정보 + 세션 시작 알림
				const startMsg = JSON.stringify({ type: 'karaoke-session-start', sessionId, song: parsed.song });
				wss.clients.forEach(client => {
					if (client.readyState === 1 && client.joinedRooms?.has('karaoke-viewer')) {
						client.send(startMsg);
					}
				});
				ws.send(JSON.stringify({ type: 'karaoke-start-ack', sessionId, filename }));
				return;
			}

			/* ── 카라오케: 스트림 중지 ── */
			if (parsed.type === 'karaoke-stop') {
				if (karaokeSession && karaokeSession.fd !== null) {
					try { fs.closeSync(karaokeSession.fd); } catch (e) { /* ignore */ }
					const { filename, song, startTime } = karaokeSession;
					const duration = Math.round((Date.now() - startTime) / 1000);
					logger.info(`카라오케 스트리밍 종료: ${filename} (${duration}초)`);
					const stopMsg = JSON.stringify({ type: 'karaoke-session-stop', filename, song, duration });
					wss.clients.forEach(client => {
						if (client.readyState === 1 && client.joinedRooms?.has('karaoke-viewer')) {
							client.send(stopMsg);
						}
					});
					karaokeSession = null;
				}
				return;
			}

			// 방 접속/퇴장 상태 관리 (서버 내 기록)
			if (parsed.type && parsed.room) {
				if (parsed.type.endsWith('-join') || parsed.type === 'sys-join') {
					ws.joinedRooms.add(parsed.room);
					if (parsed.type === 'sys-join') return; // sys-join은 서버 등록용이므로 브로드캐스트 안 함
				} else if (parsed.type.endsWith('-leave')) {
					ws.joinedRooms.delete(parsed.room);
				}
			}

			// Broadcast to all clients (WebSocket) or Direct Message
			const targetUser = parsed.targetUser;

			if (targetUser) {
				// 귓속말 (Direct Message)
				const targetWs = onlineUsers.get(targetUser);
				parsed.senderAvatar = ws.avatar;
				if (targetWs && targetWs.readyState === 1) {
					targetWs.send(JSON.stringify(parsed));
				} else if (parsed.type === 'text') {
					// 상대방이 오프라인일 때 전송한 텍스트 메시지를 DB에 보관
					db.insert(offlineMessagesTable).values({
						sender: parsed.senderId || 'Unknown',
						receiver: targetUser,
						message: parsed.text
					}).then(() => {
						// 보낸 사람에게 안내 메시지
						if (ws.readyState === 1) {
							ws.send(JSON.stringify({
								type: 'text',
								senderId: 'system',
								timestamp: Date.now(),
								targetUser: parsed.senderId,
								text: `(안내) ${targetUser}님이 오프라인 상태입니다. 메시지가 보관되어 접속 시 전달됩니다.`
							}));
						}
					}).catch(err => logger.error("오프라인 메시지 저장 실패", err));
				}

				// 본인에게도 에코
				if (ws.readyState === 1 && targetWs !== ws) {
					ws.send(JSON.stringify(parsed));
				}
			} else {
				// 전체 채팅 또는 방 채팅
				wss.clients.forEach(client => {
					if (client.readyState === 1 /* WebSocket.OPEN */) {
						if (parsed.room && !parsed.type.endsWith('-invite')) {
							// 특정 방 게임 메시지: 본인이거나 해당 방에 속한 접속자에게만 전송
							if (client === ws || (client.joinedRooms && client.joinedRooms.has(parsed.room))) {
								client.send(JSON.stringify(parsed));
							}
						} else {
							// 일반 채팅 메시지 또는 초대 메시지: 전체 브로드캐스트
							client.send(JSON.stringify(parsed));
						}
					}
				});
			}

			// FCM 푸시 알림 발송 (일반 텍스트 메시지나 파일인 경우에만)
			if (usePush && admin.apps.length > 0 && (parsed.type === 'text' || parsed.type === 'file')) {
				const senderId = parsed.senderId || 'Unknown';
				// 알림 제목/내용 구성
				let title = `메시지 도착 (${senderId})`;
				let body = parsed.type === 'text' ? parsed.text : '📁 파일 전송됨';

				if (targetUser) {
					title = `귓속말 도착 (${senderId})`;
				}

				// DB에서 fcmToken을 가져와서 푸시 발송
				// 타겟이 있으면 타겟의 토큰만, 없으면 본인 제외 전체 토큰
				const queryFilter = targetUser
					? sql`${usersTable.fcmToken} IS NOT NULL AND ${usersTable.username} = ${targetUser}`
					: sql`${usersTable.fcmToken} IS NOT NULL AND ${usersTable.username} != ${senderId}`;

				db.select({ fcmToken: usersTable.fcmToken }).from(usersTable)
					.where(queryFilter)
					.then(users => {
						const tokens = users.map(u => u.fcmToken).filter(t => !!t);
						if (tokens.length > 0) {
							const payload = {
								notification: { title, body },
								data: { type: parsed.type, senderId },
								tokens: tokens
							};
							admin.messaging().sendMulticast(payload)
								.then(response => {
									logger.info(`FCM Push: ${response.successCount} messages sent successfully.`);
								})
								.catch(err => logger.error("FCM Push Error", err));
						}
					}).catch(err => logger.error("DB Error retrieving tokens", err));
			}

		} catch (e) {
			logger.error("Failed to parse websocket message", { stack: e.stack });
		}
	});

	ws.on('close', () => {
		// 카라오케 스트리머가 끊어질 때 녹화 정리
		if (ws.isKaraokeStreamer && karaokeSession && karaokeSession.streamerWs === ws) {
			try { fs.closeSync(karaokeSession.fd); } catch (e) { /* ignore */ }
			const stopMsg = JSON.stringify({ type: 'karaoke-session-stop', filename: karaokeSession.filename, song: karaokeSession.song, duration: Math.round((Date.now() - karaokeSession.startTime) / 1000) });
			wss.clients.forEach(client => {
				if (client.readyState === 1 && client.joinedRooms?.has('karaoke-viewer')) client.send(stopMsg);
			});
			karaokeSession = null;
		}
		// 끊어질 때, 참여 중이던 모든 게임 방에 퇴장 이벤트 전송
		for (const room of ws.joinedRooms) {
			const gameType = room.split('-')[0]; // e.g., 'ladder', 'roulette'
			const leaveMsg = JSON.stringify({
				type: `${gameType}-leave`,
				room: room,
				senderId: ws.username || 'Unknown',
				senderAvatar: ws.avatar || null
			});
			wss.clients.forEach(client => {
				const roomCheck = client.joinedRooms.has(room);
				if (client.readyState === 1 && client !== ws && roomCheck) {
					client.send(leaveMsg);
				}
			});
		}

		if (ws.username) {
			// Check if the user has another active tab/socket open
			let stillOnline = false;
			for (const client of wss.clients) {
				if (client.readyState === 1 && client !== ws && client.username === ws.username) {
					stillOnline = true;
					onlineUsers.set(ws.username, client); // Ensure onlineUsers points to an active socket
					break;
				}
			}

			if (!stillOnline) {
				onlineUsers.delete(ws.username);
			}
			broadcastOnlineUsers();
		}
	});
});

async function broadcastOnlineUsers() {
	try {
		// DB에서 전체 사용자 목록 조회
		const allUsers = await db.select({ username: usersTable.username, avatar: usersTable.avatar, nickname: usersTable.nickname }).from(usersTable);

		const onlineCount = onlineUsers.size;
		const users = allUsers.map(u => ({
			username: u.username,
			avatar: u.avatar || null,
			nickname: u.nickname || null,
			isOnline: onlineUsers.has(u.username)
		}));

		// 온라인 사용자가 위로 오게 정렬
		users.sort((a, b) => b.isOnline - a.isOnline);

		const msg = JSON.stringify({ type: 'onlineUsers', users, count: onlineCount });
		wss.clients.forEach(client => {
			if (client.readyState === 1) {
				client.send(msg);
			}
		});
	} catch (err) {
		logger.error("Failed to broadcast complete user list", err);
	}
}

// if (ENV.NODE_ENV === "production") job.start();

// 미들웨어
app.use(cors({
	origin: "*",                                              // 모든 IP 허용
	methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(express.static("public"));
app.use("/api/sprite", spriteRouter);
app.use("/api/upload", uploadRouter);

// 헬스 체크
app.get("/api/health", (req, res) => {
	res.status(200).json({ success: true });
});

const CMD_JWT_SECRET = ENV.JWT_SECRET || "fallback_super_secret_cmd_key_for_local_only";

// ─── 사용자 가입 및 로그인 (메신저 앱용) ───
app.post("/api/register", async (req, res) => {
	const { username, password, fcmToken } = req.body;
	if (!username || !password) return res.status(400).json({ success: false, error: "Username and password required" });

	try {
		const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
		if (existing.length > 0) return res.status(409).json({ success: false, error: "Username already exists" });

		const hashedPassword = await bcrypt.hash(password, 10);
		await db.insert(usersTable).values({
			username,
			password: hashedPassword,
			fcmToken: fcmToken || null
		});
		res.json({ success: true, message: "User registered successfully" });
	} catch (error) {
		logger.error("Register Error", error);
		res.status(500).json({ success: false, error: "Server error" });
	}
});

app.post("/api/user/login", async (req, res) => {
	const { username, password, fcmToken } = req.body;
	if (!username || !password) return res.status(400).json({ success: false, error: "Username and password required" });

	try {
		const users = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
		if (users.length === 0) return res.status(401).json({ success: false, error: "Invalid credentials" });

		const user = users[0];
		const isMatch = await bcrypt.compare(password, user.password);
		if (!isMatch) return res.status(401).json({ success: false, error: "Invalid credentials" });

		if (fcmToken && fcmToken !== user.fcmToken) {
			await db.update(usersTable).set({ fcmToken }).where(eq(usersTable.id, user.id));
		}

		const token = jwt.sign({ userId: user.id, username: user.username }, CMD_JWT_SECRET, { expiresIn: '30d' });
		res.json({ success: true, token, username: user.username, avatar: user.avatar, nickname: user.nickname });
	} catch (error) {
		logger.error("Login Error", error);
		res.status(500).json({ success: false, error: "Server error" });
	}
});
app.get("/api/user/info", async (req, res) => {
	const { username } = req.query;
	if (!username) return res.status(400).json({ success: false, error: "Username required" });

	try {
		const users = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
		if (users.length === 0) return res.status(401).json({ success: false, error: "Invalid credentials" });
		const user = users[0];
		const token = jwt.sign({ userId: user.id, username: user.username }, CMD_JWT_SECRET, { expiresIn: '30d' });
		// console.log("user info=>", user);
		res.json({ success: true, token, username: user.username, avatar: user.avatar, nickname: user.nickname || null });
	} catch (error) {
		logger.error("Login Error", error);
		res.status(500).json({ success: false, error: "Server error" });
	}
});
// ─── 사용자 아바타 변경 API ───
app.post("/api/user/avatar", async (req, res) => {
	const { username, avatar, nickname } = req.body;
	if (!username) return res.status(400).json({ success: false, error: "Username processing error" });

	try {
		await db.update(usersTable).set({ avatar, nickname }).where(eq(usersTable.username, username));

		// 해당 유저가 온라인이라면 웹소켓 객체에도 아바타 업데이트 후 브로드캐스트
		if (onlineUsers.has(username)) {
			onlineUsers.get(username).avatar = avatar;
			broadcastOnlineUsers();
		}

		res.json({ success: true, message: "Avatar updated successfully" });
	} catch (error) {
		logger.error("Avatar Update Error", error);
		res.status(500).json({ success: false, error: "Server error" });
	}
});

// CMD 인증용 로그인 엔드포인트
app.post("/api/cmd/login", (req, res) => {
	const { username, password } = req.body;
	if (username === "admin" && password === "admin123") {
		const token = jwt.sign({ user: "admin" }, CMD_JWT_SECRET, { expiresIn: '12h' });
		return res.json({ success: true, token });
	}
	return res.status(401).json({ success: false, error: 'Invalid credentials' });
});

// 시스템 명령어(CMD) 실행 엔드포인트 (로컬 네트워크 + JWT 인증 제한)
app.post("/api/cmd", (req, res) => {
	const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
	// 간단한 로컬 네트워크(사설 IP) 대역 필터링
	const isLocal = clientIp === 'localhost' ||
		clientIp === '127.0.0.1' ||
		clientIp.includes('192.168.') ||
		clientIp.includes('172.');

	if (!isLocal) {
		logger.warn(`Rejected unauthorized CMD access from ${clientIp}`);
		// return res.status(403).json({ success: false, error: 'Permission denied. Local network only.' });
	}

	// JWT 인증 확인
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res.status(401).json({ success: false, error: 'Authentication required. Please login first using /login id pw' });
	}

	const token = authHeader.split(" ")[1];
	try {
		jwt.verify(token, CMD_JWT_SECRET);
	} catch (err) {
		return res.status(403).json({ success: false, error: 'Invalid or expired token. Please login again.' });
	}

	const { command } = req.body;
	if (!command) {
		return res.status(400).json({ success: false, error: '명령어가 없습니다.' });
	}
	if (command == 'networkGameStart') {
		if (serverInfo.backEndPlayer) {
			return res.json({ success: false, output: '이미 네트워크 게임이 진행 중입니다.' });
		}
		const { ngPlayers, ngProjectiles } = networkGameStart();
		serverInfo.ngPlayers = ngPlayers;
		serverInfo.ngProjectiles = ngProjectiles;
		return res.json({ success: true, output: '네트워크 게임 시작 성공' });
	} else if (command == 'serverInfo') {
		console.log('server info=>', serverInfo)
		return res.json({ success: true, output: JSON.stringify(serverInfo) });
	} else {
		exec(command, (error, stdout, stderr) => {
			if (error) {
				return res.status(500).json({ success: false, error: error.message, output: stderr });
			}
			// Windows cmd 환경에서 한글 깨짐 방지는 일단 그대로 반환
			res.json({ success: true, output: stdout });
		});
	}
});

// 파일에 로그 저장하는 엔드포인트 (/log 명령어용)
app.post("/api/log", (req, res) => {
	const { text } = req.body;
	if (!text) {
		return res.status(400).json({ success: false, error: '저장할 내용이 없습니다.' });
	}

	try {
		const now = new Date();
		// YYYY-MM-DD 포맷
		const dateStr = now.getFullYear() + '-'
			+ String(now.getMonth() + 1).padStart(2, '0') + '-'
			+ String(now.getDate()).padStart(2, '0');

		// HH:mm:ss 포맷
		const timeStr = String(now.getHours()).padStart(2, '0') + ':'
			+ String(now.getMinutes()).padStart(2, '0') + ':'
			+ String(now.getSeconds()).padStart(2, '0');

		const logDir = path.join(process.cwd(), 'logs');
		if (!fs.existsSync(logDir)) {
			fs.mkdirSync(logDir, { recursive: true });
		}

		const logFile = path.join(logDir, `${dateStr}.log`);
		const logLine = `[${timeStr}] ${text}\n`;

		fs.appendFileSync(logFile, logLine);
		res.json({ success: true, message: '로그가 성공적으로 저장되었습니다.', file: `${dateStr}.log` });
	} catch (err) {
		logger.error("Failed to write log file", { error: err.message });
		res.status(500).json({ success: false, error: '로그 파일 쓰기 실패' });
	}
});

const activeWatchers = {};

// 파일 모니터링 엔드포인트 (/monitor 명령어용)
app.post("/api/monitor", (req, res) => {
	// JWT 인증 확인
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return res.status(401).json({ success: false, error: 'Authentication required. Please login first.' });
	}

	const token = authHeader.split(" ")[1];
	try {
		jwt.verify(token, CMD_JWT_SECRET);
	} catch (err) {
		return res.status(403).json({ success: false, error: 'Invalid or expired token.' });
	}

	let { action, targetFile } = req.body;

	if (!targetFile) {
		const now = new Date();
		const dateStr = now.getFullYear() + '-'
			+ String(now.getMonth() + 1).padStart(2, '0') + '-'
			+ String(now.getDate()).padStart(2, '0');
		targetFile = path.join(process.cwd(), 'logs', `${dateStr}.log`);
	} else {
		if (!path.isAbsolute(targetFile)) {
			targetFile = path.join(process.cwd(), targetFile);
		}
	}

	if (action === 'start') {
		if (activeWatchers[targetFile]) {
			return res.json({ success: false, error: '이미 모니터링 중인 파일입니다.' });
		}
		if (!fs.existsSync(targetFile)) {
			return res.status(404).json({ success: false, error: '파일을 찾을 수 없습니다.' });
		}

		try {
			let lastSize = fs.statSync(targetFile).size;

			const watcher = fs.watch(targetFile, (eventType, filename) => {
				if (eventType === 'change') {
					try {
						const currentSize = fs.statSync(targetFile).size;
						if (currentSize > lastSize) {
							const lengthToRead = currentSize - lastSize;
							const buffer = Buffer.alloc(lengthToRead);
							const fd = fs.openSync(targetFile, 'r');
							fs.readSync(fd, buffer, 0, lengthToRead, lastSize);
							fs.closeSync(fd);

							const newText = buffer.toString('utf-8');
							lastSize = currentSize;

							// Broadcast to all clients
							wss.clients.forEach(client => {
								if (client.readyState === 1 /* WebSocket.OPEN */) {
									client.send(JSON.stringify({
										type: 'file-monitor',
										file: path.basename(targetFile),
										content: newText,
										timestamp: Date.now()
									}));
								}
							});
						} else if (currentSize < lastSize) {
							lastSize = currentSize;
						}
					} catch (e) {
						logger.error('Error reading monitored file', { error: e.message });
					}
				}
			});

			activeWatchers[targetFile] = watcher;
			res.json({ success: true, message: `[${path.basename(targetFile)}] 감시를 시작합니다.` });
		} catch (e) {
			res.status(500).json({ success: false, error: '모니터링 시작 실패: ' + e.message });
		}
	} else if (action === 'stop') {
		if (activeWatchers[targetFile]) {
			activeWatchers[targetFile].close();
			delete activeWatchers[targetFile];
			res.json({ success: true, message: `[${path.basename(targetFile)}] 감시를 종료합니다.` });
		} else {
			res.json({ success: false, error: '모니터링 중이지 않은 파일입니다.' });
		}
	} else {
		res.status(400).json({ success: false, error: '잘못된 액션입니다.' });
	}
});

// 즐겨찾기 추가
app.post("/api/favorites", catchAsyncErrors(async (req, res, next) => {
	const { userId, recipeId, title, image, cookTime, servings } = req.body;
	if (!userId || !recipeId || !title) {
		return res.status(400).json({ error: "Missing required fields" });
	}
	const newFavorite = await db.insert(favoritesTable).values({
		userId,
		recipeId,
		title,
		image,
		cookTime,
		servings,
	}).returning();
	res.status(201).json(newFavorite[0]);
}));

// 즐겨찾기 조회
app.get("/api/favorites/:userId", catchAsyncErrors(async (req, res, next) => {
	const { userId } = req.params;
	const userFavorites = await db.select().from(favoritesTable).where(
		eq(favoritesTable.userId, userId)
	);
	res.status(200).json(userFavorites);
}));

// 즐겨찾기 삭제
app.delete("/api/favorites/:userId/:recipeId", catchAsyncErrors(async (req, res, next) => {
	const { userId, recipeId } = req.params;
	await db.delete(favoritesTable).where(and(
		eq(favoritesTable.userId, userId),
		eq(favoritesTable.recipeId, parseInt(recipeId))
	));
	res.status(200).json({ message: "Favorite removed successfully" });
}));

// ─── WebRTC PeerConnection API ───────────────────────────────────────────────

// 피어 등록 (offer/answer SDP 저장)
app.post("/api/peers", catchAsyncErrors(async (req, res, next) => {
	const { roomId, peerId, userId, sdp, type } = req.body;
	if (!roomId || !peerId) {
		return res.status(400).json({ error: "roomId and peerId are required" });
	}
	const newPeer = await db.insert(peerConnectionsTable).values({
		roomId, peerId, userId, sdp, type, status: "active",
	}).returning();
	res.status(201).json(newPeer[0]);
}));

// 룸 내 전체 피어 조회
app.get("/api/peers/room/:roomId", catchAsyncErrors(async (req, res, next) => {
	const { roomId } = req.params;
	const peers = await db.select().from(peerConnectionsTable).where(
		eq(peerConnectionsTable.roomId, roomId)
	);
	res.status(200).json(peers);
}));

// 룸 내 특정 타입 피어 조회 (offer 또는 answer 피어 찾기)
app.get("/api/peers/room/:roomId/type/:type", catchAsyncErrors(async (req, res, next) => {
	const { roomId, type } = req.params;
	const peers = await db.select().from(peerConnectionsTable).where(and(
		eq(peerConnectionsTable.roomId, roomId),
		eq(peerConnectionsTable.type, type)
	));
	res.status(200).json(peers);
}));

// 특정 피어 단건 조회
app.get("/api/peers/:peerId", catchAsyncErrors(async (req, res, next) => {
	const { peerId } = req.params;
	const peers = await db.select().from(peerConnectionsTable).where(
		eq(peerConnectionsTable.peerId, peerId)
	);
	if (!peers.length) {
		return res.status(404).json({ error: "Peer not found" });
	}
	res.status(200).json(peers[0]);
}));

// 피어 상태 업데이트 (예: disconnected 처리)
app.patch("/api/peers/:peerId/status", catchAsyncErrors(async (req, res, next) => {
	const { peerId } = req.params;
	const { status } = req.body;
	if (!status) {
		return res.status(400).json({ error: "status is required" });
	}
	const updated = await db.update(peerConnectionsTable)
		.set({ status, updatedAt: new Date() })
		.where(eq(peerConnectionsTable.peerId, peerId))
		.returning();
	if (!updated.length) {
		return res.status(404).json({ error: "Peer not found" });
	}
	res.status(200).json(updated[0]);
}));

// 룸 전체 삭제 (세션 종료) — ⚠️ :roomId/:peerId 보다 반드시 먼저 등록해야 함
app.delete("/api/peers/room/:roomId", catchAsyncErrors(async (req, res, next) => {
	const { roomId } = req.params;
	await db.delete(peerConnectionsTable).where(eq(peerConnectionsTable.roomId, roomId));
	res.status(200).json({ message: "Room cleared" });
}));

// 피어 삭제 (룸에서 퇴장)
app.delete("/api/peers/:roomId/:peerId", catchAsyncErrors(async (req, res, next) => {
	const { roomId, peerId } = req.params;
	await db.delete(peerConnectionsTable).where(and(
		eq(peerConnectionsTable.roomId, roomId),
		eq(peerConnectionsTable.peerId, peerId)
	));
	res.status(200).json({ message: "Peer removed successfully" });
}));

// SDP 업데이트 (Offer/Answer 교환 시그널링)
app.patch("/api/peers/:roomId/:peerId/sdp", catchAsyncErrors(async (req, res, next) => {
	const { roomId, peerId } = req.params;
	const { sdp, type } = req.body;
	if (!sdp) return res.status(400).json({ error: "sdp is required" });
	const updated = await db.update(peerConnectionsTable)
		.set({ sdp, type, updatedAt: new Date() })
		.where(and(
			eq(peerConnectionsTable.roomId, roomId),
			eq(peerConnectionsTable.peerId, peerId)
		))
		.returning();
	if (!updated.length) return res.status(404).json({ error: "Peer not found" });
	res.status(200).json(updated[0]);
}));


// ─────────────────────────────────────────────────────────────────────────────
// ─── 노래 가사 API (lyrics.ovh 조회 + DB 캐싱) ─────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// 노래가사 저장
app.post("/api/songs/save", catchAsyncErrors(async (req, res, next) => {
	const { artist, title, lyrics } = req.body;
	if (!artist || !title || !lyrics) {
		return res.status(400).json({ error: "artist, title, lyrics가 필요합니다." });
	}

	// 삽입 시도 - 중복이면 무시
	const inserted = await db.insert(songsTable)
		.values({
			artist, title, lyrics,
			artistChosung: getChoseong(artist),
			titleChosung: getChoseong(title),
			source: "manual",
		})
		.onConflictDoNothing()
		.returning();

	// 충돌(이미 존재)한 경우 기존 레코드 조회 후 반환
	if (!inserted.length) {
		const existing = await db.select().from(songsTable).where(and(
			eq(songsTable.artist, artist),
			eq(songsTable.title, title)
		));
		return res.status(200).json({ ...existing[0], already: true });
	}
	res.status(201).json({ ...inserted[0], already: false });
}));

// 가사 조회 (DB 캐시 우선 → 없으면 외부 API 조회 후 저장)
app.get("/api/songs/lyrics", catchAsyncErrors(async (req, res, next) => {
	const { artist, title } = req.query;
	if (!artist || !title) {
		return res.status(400).json({ error: "artist와 title 쿼리 파라미터가 필요합니다." });
	}

	// 1) DB 캐시 확인
	const cached = await db.select().from(songsTable).where(
		and(eq(songsTable.artist, artist), eq(songsTable.title, title))
	);
	if (cached.length) {
		return res.status(200).json({ ...cached[0], cached: true });
	}

	// 2) 외부 API (lyrics.ovh) 조회
	const encoded = `${encodeURIComponent(artist)}/${encodeURIComponent(title)}`;
	const apiRes = await fetch(`https://api.lyrics.ovh/v1/${encoded}`);
	if (!apiRes.ok) {
		return res.status(404).json({ error: "가사를 찾을 수 없습니다." });
	}
	const { lyrics } = await apiRes.json();

	// 3) DB에 저장 (초성 포함, 중복 시 기존 반환)
	const saved = await db.insert(songsTable)
		.values({
			artist, title, lyrics,
			artistChosung: getChoseong(artist),
			titleChosung: getChoseong(title),
			source: "lyrics.ovh",
		})
		.onConflictDoNothing()
		.returning();

	res.status(201).json({ ...(saved[0] ?? { artist, title, lyrics }), cached: false });
}));

// ─── 초성 검색 ────────────────────────────────────────────────────────────────
app.get("/api/songs/search", catchAsyncErrors(async (req, res) => {
	const { q } = req.query; // 예: "ㅂㄹㅁ" 또는 "블루밍"
	if (!q) return res.status(400).json({ error: "검색어(q)가 필요합니다." });

	// 초성이면 초성 컬럼에서, 일반 텍스트면 artist/title에서도 검색
	const chosung = getChoseong(q);
	const songs = await db.select().from(songsTable).where(
		or(
			like(songsTable.titleChosung, `%${chosung}%`),
			like(songsTable.artistChosung, `%${chosung}%`),
			like(songsTable.title, `%${q}%`),
			like(songsTable.artist, `%${q}%`),
		)
	);
	res.status(200).json({ query: q, chosung, count: songs.length, songs });
}));

// ─── pg_trgm 유사도 검색 (?q=검색어&threshold=0.1&limit=20) ──────────────────
// score: 0~1 (1에 가까울수록 유사)
// target: lyrics(기본) | title | artist | all
app.get("/api/songs/similar", catchAsyncErrors(async (req, res) => {
	const { q, threshold = 0.1, limit = 20, target = "lyrics" } = req.query;
	if (!q) return res.status(400).json({ error: "검색어(q)가 필요합니다." });

	const maxLimit = Math.min(parseInt(limit), 100);
	const minScore = parseFloat(threshold);

	let rows;

	if (target === "title") {
		rows = await sql`
			SELECT id, artist, title,
			       ROUND(similarity(title, ${q})::numeric, 4)  AS score
			FROM songs
			WHERE similarity(title, ${q}) >= ${minScore}
			ORDER BY score DESC
			LIMIT ${maxLimit}
		`;
	} else if (target === "artist") {
		rows = await sql`
			SELECT id, artist, title,
			       ROUND(similarity(artist, ${q})::numeric, 4) AS score
			FROM songs
			WHERE similarity(artist, ${q}) >= ${minScore}
			ORDER BY score DESC
			LIMIT ${maxLimit}
		`;
	} else if (target === "all") {
		// 제목·아티스트·가사 중 가장 높은 유사도를 기준으로 정렬
		rows = await sql`
			SELECT id, artist, title,
			       ROUND(GREATEST(
			           similarity(lyrics,  ${q}),
			           similarity(title,   ${q}),
			           similarity(artist,  ${q})
			       )::numeric, 4) AS score
			FROM songs
			WHERE GREATEST(
			          similarity(lyrics,  ${q}),
			          similarity(title,   ${q}),
			          similarity(artist,  ${q})
			      ) >= ${minScore}
			ORDER BY score DESC
			LIMIT ${maxLimit}
		`;
	} else {
		// 기본: 가사 유사도
		rows = await sql`
			SELECT id, artist, title,
			       ROUND(similarity(lyrics, ${q})::numeric, 4) AS score
			FROM songs
			WHERE lyrics IS NOT NULL
			  AND similarity(lyrics, ${q}) >= ${minScore}
			ORDER BY score DESC
			LIMIT ${maxLimit}
		`;
	}

	res.status(200).json({
		query: q, target, threshold: minScore,
		count: rows.length,
		songs: rows,
	});
}));

// 저장된 가사 목록 조회 (?limit=30&offset=0&artist=...)
app.get("/api/songs", catchAsyncErrors(async (req, res) => {
	const { artist, limit, offset } = req.query;
	const maxLimit = Math.min(parseInt(limit) || 30, 100); // 기본 30, 최대 100
	const skip = Math.max(parseInt(offset) || 0, 0);   // 기본 0

	const base = db.select().from(songsTable);
	const countBase = db.select({ count: sql`count(*)` }).from(songsTable);

	const [songs, [{ count }]] = await Promise.all([
		artist
			? base.where(eq(songsTable.artist, artist)).limit(maxLimit).offset(skip)
			: base.limit(maxLimit).offset(skip),
		artist
			? countBase.where(eq(songsTable.artist, artist))
			: countBase,
	]);

	res.status(200).json({
		total: parseInt(count),
		limit: maxLimit,
		offset: skip,
		songs,
	});
}));

// 저장된 가사 단건 조회
app.get("/api/songs/:id", catchAsyncErrors(async (req, res) => {
	const { id } = req.params;
	const result = await db.select().from(songsTable)
		.where(eq(songsTable.id, parseInt(id)));
	if (!result.length) return res.status(404).json({ error: "No song found" });
	res.status(200).json(result[0]);
}));

// 저장된 가사 삭제
app.delete("/api/songs/:id", catchAsyncErrors(async (req, res) => {
	const { id } = req.params;
	await db.delete(songsTable).where(eq(songsTable.id, parseInt(id)));
	res.status(200).json({ message: "Song deleted successfully" });
}));

// ─────────────────────────────────────────────────────────────────────────────

// ─── 영상 스케줄 API ──────────────────────────────────────────────────────────
const VIDEO_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'videos');
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

const schedUpload = multer({
	storage: multer.diskStorage({
		destination: (_, __, cb) => cb(null, VIDEO_DIR),
		filename: (_, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
	}),
	fileFilter: (_, file, cb) =>
		file.mimetype.startsWith('video/') ? cb(null, true) : cb(new Error('동영상만 가능')),
	limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2 GB
});

// 스케줄 전체 목록
app.get('/api/schedule', catchAsyncErrors(async (req, res) => {
	const items = await db.select().from(videoScheduleTable)
		.where(eq(videoScheduleTable.isActive, true))
		.orderBy(videoScheduleTable.playDate, videoScheduleTable.startTime, videoScheduleTable.sortOrder);
	res.json(items);
}));

// 특정 날짜의 스케줄 조회 (FullCalendar 이벤트 소스용)
app.get('/api/schedule/date/:date', catchAsyncErrors(async (req, res) => {
	const { date } = req.params; // YYYY-MM-DD
	const dayOfWeek = new Date(date).getDay(); // 0=일,1=월...6=토

	const all = await db.select().from(videoScheduleTable)
		.where(eq(videoScheduleTable.isActive, true))
		.orderBy(videoScheduleTable.startTime, videoScheduleTable.sortOrder);

	const filtered = all.filter(item => {
		if (item.repeatType === 'once') return item.playDate === date;
		if (item.repeatType === 'daily') return true;
		if (item.repeatType === 'weekly') return item.playDate && new Date(item.playDate).getDay() === dayOfWeek;
		return false;
	});
	res.json(filtered);
}));

// 현재 시각에 재생해야 할 영상 조회
app.get('/api/schedule/now', catchAsyncErrors(async (req, res) => {
	const now = new Date();
	const date = now.toISOString().slice(0, 10);          // YYYY-MM-DD
	const time = now.toTimeString().slice(0, 5);          // HH:MM
	const dow = now.getDay();

	const all = await db.select().from(videoScheduleTable)
		.where(eq(videoScheduleTable.isActive, true))
		.orderBy(videoScheduleTable.startTime, videoScheduleTable.sortOrder);

	const current = all.find(item => {
		const inTime = item.startTime <= time && time <= item.endTime;
		if (!inTime) return false;
		if (item.repeatType === 'once') return item.playDate === date;
		if (item.repeatType === 'daily') return true;
		if (item.repeatType === 'weekly') return item.playDate && new Date(item.playDate).getDay() === dow;
		return false;
	});

	if (!current) return res.status(404).json({ error: '현재 시간에 해당하는 스케줄 없음' });
	res.json(current);
}));

// FullCalendar 이벤트 형식으로 기간 내 스케줄 조회 (?start=&end=)
app.get('/api/schedule/events', catchAsyncErrors(async (req, res) => {
	const { start, end } = req.query;
	const all = await db.select().from(videoScheduleTable)
		.where(eq(videoScheduleTable.isActive, true));

	const events = [];
	const startDate = new Date(start || Date.now());
	const endDate = new Date(end || Date.now() + 30 * 86400000);

	for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
		const dateStr = d.toISOString().slice(0, 10);
		const dow = d.getDay();

		for (const item of all) {
			let include = false;
			if (item.repeatType === 'once' && item.playDate === dateStr) include = true;
			if (item.repeatType === 'daily') include = true;
			if (item.repeatType === 'weekly' && item.playDate && new Date(item.playDate).getDay() === dow) include = true;

			if (include) {
				events.push({
					id: item.id,
					title: item.title,
					start: `${dateStr}T${item.startTime}:00`,
					end: `${dateStr}T${item.endTime}:00`,
					extendedProps: { filename: item.filename, repeatType: item.repeatType, sortOrder: item.sortOrder },
					color: item.repeatType === 'daily' ? '#1d6feb' : item.repeatType === 'weekly' ? '#6d28d9' : '#166534',
				});
			}
		}
	}
	res.json(events);
}));

// 스케줄 등록
app.post('/api/schedule', schedUpload.single('video'), catchAsyncErrors(async (req, res) => {
	const { title, sortOrder = 0, playDate, startTime = '00:00', endTime = '23:59', repeatType = 'once' } = req.body;
	if (!title) return res.status(400).json({ error: 'title 필수' });
	const filename = req.file ? req.file.filename : req.body.filename;
	if (!filename) return res.status(400).json({ error: 'video 파일 또는 filename 필수' });
	const [item] = await db.insert(videoScheduleTable)
		.values({ title, filename, sortOrder: parseInt(sortOrder), playDate: playDate || null, startTime, endTime, repeatType })
		.returning();
	res.status(201).json(item);
}));

// 스케줄 수정
app.patch('/api/schedule/:id', catchAsyncErrors(async (req, res) => {
	const { title, sortOrder, isActive, playDate, startTime, endTime, repeatType } = req.body;
	const [updated] = await db.update(videoScheduleTable)
		.set({
			...(title !== undefined && { title }),
			...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
			...(isActive !== undefined && { isActive }),
			...(playDate !== undefined && { playDate }),
			...(startTime !== undefined && { startTime }),
			...(endTime !== undefined && { endTime }),
			...(repeatType !== undefined && { repeatType }),
		})
		.where(eq(videoScheduleTable.id, parseInt(req.params.id)))
		.returning();
	if (!updated) return res.status(404).json({ error: '없는 스케줄' });
	res.json(updated);
}));

// 스케줄 삭제
app.delete('/api/schedule/:id', catchAsyncErrors(async (req, res) => {
	const [item] = await db.delete(videoScheduleTable)
		.where(eq(videoScheduleTable.id, parseInt(req.params.id))).returning();
	if (!item) return res.status(404).json({ error: '없는 스케줄' });
	fs.unlink(path.join(VIDEO_DIR, item.filename), () => { });
	res.json({ message: '삭제 완료' });
}));

// 영상 스트리밍 (Range 헤더 지원 → 탐색 가능)
app.get('/api/videos/:filename', (req, res) => {
	const filePath = path.join(VIDEO_DIR, path.basename(req.params.filename));
	if (!fs.existsSync(filePath)) return res.status(404).json({ error: '파일 없음' });

	const stat = fs.statSync(filePath);
	const fileSize = stat.size;
	const range = req.headers.range;
	const ext = path.extname(req.params.filename).toLowerCase();
	const mime = ext === '.webm' ? 'video/webm' : ext === '.ogv' ? 'video/ogg' : 'video/mp4';

	if (range) {
		const [s, e] = range.replace(/bytes=/, '').split('-');
		const start = parseInt(s);
		const end = e ? parseInt(e) : fileSize - 1;
		res.writeHead(206, {
			'Content-Range': `bytes ${start}-${end}/${fileSize}`,
			'Accept-Ranges': 'bytes',
			'Content-Length': end - start + 1,
			'Content-Type': mime,
		});
		fs.createReadStream(filePath, { start, end }).pipe(res);
	} else {
		res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': mime });
		fs.createReadStream(filePath).pipe(res);
	}
});




// ─── 파일 공유 API (업로드 → 다운로드 링크) ──────────────────────────────────

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({
	storage: multer.diskStorage({
		destination: (_, __, cb) => cb(null, UPLOAD_DIR),
		filename: (_, __, cb) => cb(null, uuidv4()),
	}),
	limits: { fileSize: 200 * 1024 * 1024 }, // 최대 200MB
});

setInterval(() => {
	const now = Date.now();
	for (const [id, meta] of fileStore) {
		if (now - meta.createdAt > FILE_TTL_MS) {
			fs.unlink(meta.path, () => { });
			fileStore.delete(id);
			logger.info(`파일 만료 삭제: ${id}`);
		}
	}
}, 10 * 60 * 1000);

app.get("/api/files-list", (req, res) => {
	let { folder } = req.query;
	if (folder == 'docs') {
		folder = 'DOCS';
	} else if (folder == 'images') {
		folder = 'public/images';
	} else if (folder == 'videos') {
		folder = 'videos';
	}
	const dirPath = path.join(__dirname, folder);
	// if (!fs.existsSync(dirPath)) return res.status(404).json({ error: "폴더를 찾을 수 없습니다." });
	try {
		const stats = fs.statSync(dirPath);
		if (!stats.isDirectory()) return res.status(404).json({ error: "폴더를 찾을 수 없습니다." });
		const files = fs.readdirSync(dirPath);
		const fileInfos = files.map(file => {
			const filePath = path.join(dirPath, file);
			const fileStats = fs.statSync(filePath);
			return {
				name: file,
				size: fileStats.size,
				isDirectory: fileStats.isDirectory(),
				mtime: fileStats.mtime,
				extension: path.extname(file)
			};
		});
		res.json({ success: true, files: fileInfos });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "폴더를 찾을 수 없습니다." });
	}
});
app.get("/api/files-text", (req, res) => {
	let { folder, name } = req.query;
	const dirPath = path.join(__dirname, folder);
	try {
		const filePath = path.join(dirPath, name);
		if (!fs.existsSync(filePath)) return res.status(404).json({ error: "파일을 찾을 수 없습니다." });
		const fileContent = fs.readFileSync(filePath, 'utf-8');
		res.json({ success: true, content: fileContent });
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: "파일을 찾을 수 없습니다." });
	}
});

app.post("/api/files", upload.single("file"), (req, res) => {
	if (!req.file) return res.status(400).json({ error: "파일이 없습니다." });
	const fileId = req.file.filename;
	fileStore.set(fileId, {
		originalName: req.file.originalname,
		size: req.file.size,
		mime: req.file.mimetype,
		path: req.file.path,
		createdAt: Date.now(),
	});
	res.status(201).json({ fileId, name: req.file.originalname, size: req.file.size, expiresIn: FILE_TTL_MS / 1000 });
});

app.get("/api/files", (req, res) => {
	const now = Date.now();
	res.json([...fileStore.entries()].map(([id, m]) => ({
		fileId: id, name: m.originalName, size: m.size,
		expiresIn: Math.max(0, Math.round((m.createdAt + FILE_TTL_MS - now) / 1000)),
	})));
});

app.get("/api/files/:id", (req, res) => {
	const meta = fileStore.get(req.params.id);
	if (!meta) return res.status(404).json({ error: "파일이 없거나 만료되었습니다." });
	res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(meta.originalName)}`);
	res.setHeader("Content-Type", meta.mime || "application/octet-stream");
	res.sendFile(meta.path);
});

app.delete("/api/files/:id", (req, res) => {
	const meta = fileStore.get(req.params.id);
	if (!meta) return res.status(404).json({ error: "파일 없음" });
	fs.unlink(meta.path, () => { });
	fileStore.delete(req.params.id);
	res.json({ message: "삭제 완료" });
});

// ─── Todo 애플리케이션 API ───────────────────────────────────────────────────

// Todo 목록 조회
app.get("/api/todos", catchAsyncErrors(async (req, res) => {
	const { status, keyword } = req.query;
	const conditions = [];
	if (status && status !== '전체') {
		conditions.push(eq(todosTable.status, status));
	}
	if (keyword) {
		conditions.push(
			or(
				like(todosTable.title, `%${keyword}%`),
				like(todosTable.description, `%${keyword}%`)
			)
		);
	}
	const todos = await db.select().from(todosTable)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(todosTable.createdAt));
	res.status(200).json(todos);
}));

// 단일 Todo 조회
app.get("/api/todos/:id", catchAsyncErrors(async (req, res) => {
	const { id } = req.params;
	const todos = await db.select().from(todosTable).where(eq(todosTable.id, parseInt(id)));
	if (!todos.length) return res.status(404).json({ error: "Todo not found" });
	res.status(200).json(todos[0]);
}));

// Todo 생성
app.post("/api/todos", catchAsyncErrors(async (req, res) => {
	const { title, description, issueTrackerText, remindAt, startDate, endDate, progress, dependencies } = req.body;
	if (!title) return res.status(400).json({ error: "title is required" });

	const [newTodo] = await db.insert(todosTable).values({
		title,
		description,
		issueTrackerText,
		remindAt: remindAt ? new Date(remindAt) : null,
		startDate: startDate || null,
		endDate: endDate || null,
		progress: progress ? parseInt(progress) : 0,
		dependencies: dependencies || null,
		status: '계획'
	}).returning();

	// 생성 이력
	await db.insert(todoHistoryTable).values({
		todoId: newTodo.id,
		newStatus: '계획',
		note: '초기 생성'
	});

	res.status(201).json(newTodo);
}));

// Todo 수정 (상태 변경 시 이력 저장)
app.patch("/api/todos/:id", catchAsyncErrors(async (req, res) => {
	const { id } = req.params;
	const { title, description, status, issueTrackerText, remindAt, note, startDate, endDate, progress, dependencies } = req.body;

	const existing = await db.select().from(todosTable).where(eq(todosTable.id, parseInt(id)));
	if (!existing.length) return res.status(404).json({ error: "Todo not found" });
	const oldItem = existing[0];

	const updateData = { updatedAt: new Date() };
	if (title !== undefined) updateData.title = title;
	if (description !== undefined) updateData.description = description;
	if (status !== undefined) updateData.status = status;
	if (issueTrackerText !== undefined) updateData.issueTrackerText = issueTrackerText;
	if (remindAt !== undefined) updateData.remindAt = remindAt ? new Date(remindAt) : null;
	if (startDate !== undefined) updateData.startDate = startDate;
	if (endDate !== undefined) updateData.endDate = endDate;
	if (progress !== undefined) updateData.progress = parseInt(progress);
	if (dependencies !== undefined) updateData.dependencies = dependencies;

	const [updatedTodo] = await db.update(todosTable)
		.set(updateData)
		.where(eq(todosTable.id, parseInt(id)))
		.returning();

	// 상태가 변경되었거나, 명시적으로 note(메모)를 남긴 경우 이력 추가
	if (oldItem.status !== updatedTodo.status || note) {
		await db.insert(todoHistoryTable).values({
			todoId: updatedTodo.id,
			oldStatus: oldItem.status,
			newStatus: updatedTodo.status,
			note: note || '상태 변경'
		});
	}

	res.status(200).json(updatedTodo);
}));

// Todo 삭제 (실제로는 Soft Delete 처리: status = '삭제')
app.delete("/api/todos/:id", catchAsyncErrors(async (req, res) => {
	const { id } = req.params;

	const existing = await db.select().from(todosTable).where(eq(todosTable.id, parseInt(id)));
	if (!existing.length) return res.status(404).json({ error: "Todo not found" });

	const [deletedTodo] = await db.update(todosTable)
		.set({ status: '삭제', updatedAt: new Date() })
		.where(eq(todosTable.id, parseInt(id)))
		.returning();

	await db.insert(todoHistoryTable).values({
		todoId: deletedTodo.id,
		oldStatus: existing[0].status,
		newStatus: '삭제',
		note: '사용자 삭제 처리'
	});

	res.status(200).json({ message: "Deleted successfully", deletedTodo });
}));

// 특정 Todo 변경 이력 조회
app.get("/api/todos/:id/history", catchAsyncErrors(async (req, res) => {
	const { id } = req.params;
	const history = await db.select().from(todoHistoryTable)
		.where(eq(todoHistoryTable.todoId, parseInt(id)))
		.orderBy(desc(todoHistoryTable.changedAt));
	res.status(200).json(history);
}));

// 리포트/통계 대시보드
app.get("/api/todos-report", catchAsyncErrors(async (req, res) => {
	const allTodos = await db.select().from(todosTable);
	const stats = {
		total: allTodos.length,
		계획: 0, 진행: 0, 대기: 0, 반려: 0, 완료: 0, 삭제: 0
	};
	allTodos.forEach(t => {
		if (stats[t.status] !== undefined) stats[t.status]++;
	});
	res.status(200).json(stats);
}));

// Excel 다운로드 API
app.get("/api/todos-export", catchAsyncErrors(async (req, res) => {
	// 진행 밎 완료 건만 엑셀로 노출
	const exportQuery = await db.select().from(todosTable).where(
		or(eq(todosTable.status, '진행'), eq(todosTable.status, '완료'))
	).orderBy(desc(todosTable.createdAt));

	const workbook = new ExcelJS.Workbook();
	const worksheet = workbook.addWorksheet('Todo List');

	worksheet.columns = [
		{ header: 'ID', key: 'id', width: 10 },
		{ header: '제목', key: 'title', width: 30 },
		{ header: '상태', key: 'status', width: 15 },
		{ header: '이슈 번호', key: 'issueTrackerText', width: 20 },
		{ header: '상세 내용', key: 'description', width: 40 },
		{ header: '리마인드 일시', key: 'remindAt', width: 20 },
		{ header: '생성 일시', key: 'createdAt', width: 20 },
		{ header: '최종 수정', key: 'updatedAt', width: 20 },
	];

	worksheet.getRow(1).font = { bold: true };

	exportQuery.forEach(todo => {
		worksheet.addRow({
			...todo,
			remindAt: todo.remindAt ? new Date(todo.remindAt).toLocaleString() : '',
			createdAt: todo.createdAt ? new Date(todo.createdAt).toLocaleString() : '',
			updatedAt: todo.updatedAt ? new Date(todo.updatedAt).toLocaleString() : '',
		});
	});

	res.setHeader(
		'Content-Type',
		'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
	);
	res.setHeader(
		'Content-Disposition',
		'attachment; filename=' + encodeURIComponent('TodoList_Export.xlsx')
	);

	await workbook.xlsx.write(res);
	res.end();
}));

// ─── PostgreSQL Web Client API ───────────────────────────────────────────────

app.get("/api/pg/schema", catchAsyncErrors(async (req, res) => {
	const query = `
		SELECT 
			table_schema, 
			table_name, 
			table_type 
		FROM information_schema.tables 
		WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
		ORDER BY table_schema, table_type DESC, table_name;
	`;
	const schemaList = await db.execute(sql.raw(query));

	// Convert into jstree data format
	const treeData = [
		{
			id: 'root',
			text: 'PostgreSQL DB',
			state: { opened: true },
			icon: 'fa-solid fa-database text-primary',
			children: []
		}
	];

	const rows = Array.isArray(schemaList) ? schemaList : (schemaList.rows || []);
	const schemaMap = {};

	rows.forEach(row => {
		const schemaName = row.table_schema;
		const tableName = row.table_name;
		const tableType = row.table_type;

		if (!schemaMap[schemaName]) {
			schemaMap[schemaName] = {
				id: 'schema_' + schemaName,
				text: schemaName,
				state: { opened: true },
				icon: 'fa-solid fa-folder-open',
				children: []
			};
			treeData[0].children.push(schemaMap[schemaName]);
		}

		schemaMap[schemaName].children.push({
			id: 'table_' + schemaName + '_' + tableName,
			text: tableName,
			icon: tableType === 'VIEW' ? 'fa-solid fa-eye' : 'fa-regular fa-window-maximize',
		});
	});

	res.json(treeData);
}));

app.get("/api/pg/columns/:schema/:table", catchAsyncErrors(async (req, res) => {
	const { schema, table } = req.params;
	const query = `
		SELECT 
			column_name, 
			data_type, 
			is_nullable, 
			column_default
		FROM information_schema.columns 
		WHERE table_schema = '${schema}' AND table_name = '${table}'
		ORDER BY ordinal_position;
	`;
	const result = await db.execute(sql.raw(query));
	const rows = Array.isArray(result) ? result : (result.rows || []);
	res.json(rows);
}));

app.post("/api/pg/execute", catchAsyncErrors(async (req, res) => {
	const { query } = req.body;
	if (!query) return res.status(400).json({ error: "No query provided" });
	const startTime = Date.now();
	try {
		// Drizzle의 raw 쿼리 실행
		const result = await db.execute(sql.raw(query));
		const duration = Date.now() - startTime;
		res.json({ success: true, data: result, duration });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message, duration: Date.now() - startTime });
	}
}));

// ─── SQLite Web Client API ───────────────────────────────────────────────

app.post("/api/sqlite/connect", catchAsyncErrors(async (req, res) => {
	const { dbPath } = req.body;
	if (!dbPath) return res.status(400).json({ error: "DB path is required" });

	try {
		if (activeSqliteDb) {
			activeSqliteDb.close();
			activeSqliteDb = null;
		}
		activeSqliteDb = new Database(dbPath, { fileMustExist: false });
		res.json({ success: true, message: `Connected to SQLite Database: ${dbPath}` });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message });
	}
}));

app.get("/api/sqlite/schema", catchAsyncErrors(async (req, res) => {
	if (!activeSqliteDb) {
		return res.json([]); // DB가 연결되지 않았을 때는 빈 배열 반환하여 400 에러 로그 방지
	}

	const query = `
		SELECT name, type 
		FROM sqlite_master 
		WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%'
		ORDER BY type DESC, name;
	`;
	const rows = activeSqliteDb.prepare(query).all();

	const treeData = [
		{
			id: 'root',
			text: 'SQLite DB',
			state: { opened: true },
			icon: 'fa-solid fa-database text-primary',
			children: [
				{
					id: 'schema_public', // Dummy schema layer to match pg-client logic
					text: 'main',
					state: { opened: true },
					icon: 'fa-solid fa-folder-open',
					children: []
				}
			]
		}
	];

	rows.forEach(row => {
		treeData[0].children[0].children.push({
			id: 'table_public_' + row.name, // Format: table_schema_table
			text: row.name,
			icon: row.type === 'view' ? 'fa-solid fa-eye' : 'fa-regular fa-window-maximize',
		});
	});

	res.json(treeData);
}));

app.get("/api/sqlite/columns/:schema/:table", catchAsyncErrors(async (req, res) => {
	if (!activeSqliteDb) return res.status(400).json({ error: "No SQLite DB connected" });
	const { table } = req.params;

	try {
		const columns = activeSqliteDb.prepare(`PRAGMA table_info("${table}")`).all();
		const formatted = columns.map(c => ({
			column_name: c.name,
			data_type: c.type,
			is_nullable: c.notnull === 0 ? 'YES' : 'NO',
			column_default: c.dflt_value || null
		}));
		res.json(formatted);
	} catch (error) {
		res.status(400).json({ error: error.message });
	}
}));

app.post("/api/sqlite/execute", catchAsyncErrors(async (req, res) => {
	if (!activeSqliteDb) return res.status(400).json({ error: "No SQLite DB connected" });
	const { query } = req.body;
	if (!query) return res.status(400).json({ error: "No query provided" });

	const startTime = Date.now();
	try {
		let result;
		if (query.trim().toLowerCase().startsWith('select') || query.trim().toLowerCase().startsWith('pragma')) {
			result = activeSqliteDb.prepare(query).all();
		} else {
			const info = activeSqliteDb.prepare(query).run();
			result = [{ affectedRows: info.changes, lastInsertRowid: info.lastInsertRowid }];
		}
		const duration = Date.now() - startTime;
		res.json({ success: true, data: result, duration });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message, duration: Date.now() - startTime });
	}
}));

app.post("/api/sqlite/update", catchAsyncErrors(async (req, res) => {
	if (!activeSqliteDb) return res.status(400).json({ error: "No SQLite DB connected" });
	const { table, pk, updates } = req.body;
	if (!table || !pk || !updates || Object.keys(updates).length === 0) {
		return res.status(400).json({ error: "Missing required update parameters (table, pk, updates)" });
	}

	const startTime = Date.now();
	try {
		const updateCols = Object.keys(updates);
		const setClause = updateCols.map(col => `"${col}" = ?`).join(', ');
		const setValues = Object.values(updates);

		const pkCols = Object.keys(pk);
		const whereClause = pkCols.map(col => `"${col}" = ?`).join(' AND ');
		const whereValues = Object.values(pk);

		const query = `UPDATE "${table}" SET ${setClause} WHERE ${whereClause}`;
		const stmt = activeSqliteDb.prepare(query);
		const info = stmt.run(...setValues, ...whereValues);

		const duration = Date.now() - startTime;
		res.json({ success: true, affectedRows: info.changes, duration });
	} catch (error) {
		res.status(400).json({ success: false, error: error.message, duration: Date.now() - startTime });
	}
}));


// 주문 시스템 라우터
app.use("/api/order", orderRouter);

// 에러 핸들러 미들웨어 (라우트 뒤에 위치해야 함)
app.use(errorMiddleware);

(async () => {
	try {
		// console.log("Server is running on PORT: " + ENV.PORT);
		// await initializeDatabase();
		server.listen(ENV.PORT, () => {
			logger.info(`Server (HTTP & WS) is running on PORT: ${ENV.PORT}`);
		});
	} catch (err) {
		logger.error("Failed to start server", { stack: err.stack });
		process.exit(1);
	}
})();

// ══════════════════════════════════════════
// ZIP 파일 브라우저 API
// ══════════════════════════════════════════

// ZIP 안의 파일 목록 조회
// GET /api/zip/list?path=uploads/archive.zip
app.get("/api/zip/list", (req, res) => {
	try {
		let zipPath = req.query.zipPath;
		if (!zipPath) {
			const relPath = req.query.path;
			if (!relPath) return res.status(400).json({ error: "path 파라미터가 필요합니다" });
			zipPath = path.resolve(__dirname, relPath);
			// 보안: 프로젝트 루트 외부 접근 차단
			if (!zipPath.startsWith(__dirname)) {
				return res.status(403).json({ error: "접근 불가 경로입니다" });
			}
		}
		if (!fs.existsSync(zipPath)) {
			return res.status(404).json({ error: "ZIP 파일을 찾을 수 없습니다: " + relPath });
		}
		const zip = new AdmZip(zipPath);
		const entries = zip.getEntries().map(entry => ({
			name: entry.entryName,
			isDirectory: entry.isDirectory,
			size: entry.header.size,
			compressedSize: entry.header.compressedSize,
			ratio: entry.header.size > 0
				? ((1 - entry.header.compressedSize / entry.header.size) * 100).toFixed(1)
				: '0.0',
			date: entry.header.time ? new Date(entry.header.time).toISOString() : null,
			comment: entry.comment || ''
		}));

		const files = entries.filter(e => !e.isDirectory);
		const totalSize = files.reduce((s, f) => s + f.size, 0);
		const totalCompressed = files.reduce((s, f) => s + f.compressedSize, 0);

		res.json({
			file: path.basename(zipPath),
			fileCount: files.length,
			totalSize,
			totalCompressed,
			savedRatio: totalSize > 0
				? ((1 - totalCompressed / totalSize) * 100).toFixed(1)
				: '0.0',
			entries
		});
	} catch (err) {
		logger.error("ZIP list error", { error: err.message });
		res.status(500).json({ error: err.message });
	}
});

// ZIP 내 단일 파일 다운로드
// GET /api/zip/download-entry?path=uploads/archive.zip&entry=folder/file.txt
app.get("/api/zip/download-entry", (req, res) => {
	try {
		const { path: relPath, entry: entryName } = req.query;
		if (!relPath || !entryName) {
			return res.status(400).json({ error: "path와 entry 파라미터가 필요합니다" });
		}

		const zipPath = path.resolve(__dirname, relPath);
		if (!zipPath.startsWith(__dirname)) {
			return res.status(403).json({ error: "접근 불가 경로입니다" });
		}
		if (!fs.existsSync(zipPath)) {
			return res.status(404).json({ error: "ZIP 파일을 찾을 수 없습니다" });
		}

		const zip = new AdmZip(zipPath);
		const entry = zip.getEntry(entryName);
		if (!entry || entry.isDirectory) {
			return res.status(404).json({ error: "항목을 찾을 수 없습니다" });
		}

		const fileData = zip.readFile(entry);
		const fileName = path.basename(entryName);
		res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
		res.setHeader("Content-Type", "application/octet-stream");
		res.setHeader("Content-Length", fileData.length);
		res.send(fileData);
	} catch (err) {
		logger.error("ZIP download-entry error", { error: err.message });
		res.status(500).json({ error: err.message });
	}
});

// ZIP 전체 다운로드 (archiver 대신 adm-zip 활용)
// GET /api/zip/download?path=uploads/archive.zip
app.get("/api/zip/download", (req, res) => {
	try {
		const relPath = req.query.path;
		if (!relPath) return res.status(400).json({ error: "path 파라미터가 필요합니다" });

		const zipPath = path.resolve(__dirname, relPath);
		if (!zipPath.startsWith(__dirname)) {
			return res.status(403).json({ error: "접근 불가 경로입니다" });
		}
		if (!fs.existsSync(zipPath)) {
			return res.status(404).json({ error: "ZIP 파일을 찾을 수 없습니다" });
		}

		const fileName = path.basename(zipPath);
		res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`);
		res.setHeader("Content-Type", "application/zip");
		res.sendFile(zipPath);
	} catch (err) {
		logger.error("ZIP download error", { error: err.message });
		res.status(500).json({ error: err.message });
	}
});

// 선택 항목만 ZIP으로 다운로드
// POST /api/zip/download-selected  body: { path, entries: ["a.txt","folder/b.jpg"] }
app.post("/api/zip/download-selected", express.json(), (req, res) => {
	try {
		const { path: relPath, entries: selectedEntries, filename = "selected_files.zip" } = req.body;
		if (!relPath || !Array.isArray(selectedEntries) || selectedEntries.length === 0) {
			return res.status(400).json({ error: "path와 entries 배열이 필요합니다" });
		}

		const zipPath = path.resolve(__dirname, relPath);
		if (!zipPath.startsWith(__dirname)) {
			return res.status(403).json({ error: "접근 불가 경로입니다" });
		}
		if (!fs.existsSync(zipPath)) {
			return res.status(404).json({ error: "ZIP 파일을 찾을 수 없습니다" });
		}

		const srcZip = new AdmZip(zipPath);
		const outZip = new AdmZip();

		for (const entryName of selectedEntries) {
			const entry = srcZip.getEntry(entryName);
			if (entry && !entry.isDirectory) {
				const data = srcZip.readFile(entry);
				outZip.addFile(entryName, data);
			}
		}

		const buffer = outZip.toBuffer();
		const safeFilename = encodeURIComponent(filename);
		res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${safeFilename}`);
		res.setHeader("Content-Type", "application/zip");
		res.setHeader("Content-Length", buffer.length);
		res.send(buffer);
	} catch (err) {
		logger.error("ZIP download-selected error", { error: err.message });
		res.status(500).json({ error: err.message });
	}
});

/* ==================== 카라오케 녹화 REST API ==================== */

// 녹화 목록 조회
app.get('/api/karaoke/recordings', (req, res) => {
	try {
		if (!fs.existsSync(RECORDINGS_DIR)) return res.json({ success: true, recordings: [] });
		const files = fs.readdirSync(RECORDINGS_DIR)
			.filter(f => f.endsWith('.webm'))
			.map(f => {
				const filepath = path.join(RECORDINGS_DIR, f);
				const stat = fs.statSync(filepath);
				return {
					filename: f,
					size: stat.size,
					sizeKB: Math.round(stat.size / 1024),
					createdAt: stat.birthtime,
					modifiedAt: stat.mtime,
				};
			})
			.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
		res.json({ success: true, recordings: files });
	} catch (err) {
		logger.error('녹화 목록 조회 실패', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// 녹화 파일 다운로드
app.get('/api/karaoke/download/:filename', (req, res) => {
	try {
		const filename = path.basename(req.params.filename); // path traversal 방지
		if (!filename.endsWith('.webm')) return res.status(400).json({ error: '잘못된 파일 형식입니다' });
		const filepath = path.join(RECORDINGS_DIR, filename);
		if (!fs.existsSync(filepath)) return res.status(404).json({ error: '파일을 찾을 수 없습니다' });
		res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
		res.setHeader('Content-Type', 'video/webm');
		res.sendFile(filepath);
	} catch (err) {
		logger.error('녹화 다운로드 실패', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// 녹화 파일 삭제
app.delete('/api/karaoke/recordings/:filename', (req, res) => {
	try {
		const filename = path.basename(req.params.filename);
		if (!filename.endsWith('.webm')) return res.status(400).json({ error: '잘못된 파일 형식입니다' });
		const filepath = path.join(RECORDINGS_DIR, filename);
		if (!fs.existsSync(filepath)) return res.status(404).json({ error: '파일을 찾을 수 없습니다' });
		fs.unlinkSync(filepath);
		res.json({ success: true, message: `${filename} 삭제 완료` });
	} catch (err) {
		logger.error('녹화 삭제 실패', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// 현재 스트리밍 상태 조회
app.get('/api/karaoke/status', (req, res) => {
	if (karaokeSession) {
		res.json({
			success: true,
			streaming: true,
			sessionId: karaokeSession.sessionId,
			song: karaokeSession.song,
			startTime: karaokeSession.startTime,
			filename: karaokeSession.filename,
		});
	} else {
		res.json({ success: true, streaming: false });
	}
});


/* #################### network game start #################### */
function networkGameStart() {
	const ngPlayers = {}
	const ngProjectiles = {}
	const ngBombs = {}
	const ioServer = http.createServer();
	const io = new Server(ioServer, { cors: { origin: "*" }, pingInterval: 2000, pingTimeout: 5000 });
	ioServer.listen(8082, () => { logger.info(`socket io server is running on port 8082`) });
	const SPEED = 5
	const RADIUS = 10
	let PROJECTILE_RADIUS = 5
	let projectileId = 0
	let bombId = 0

	io.on('connection', (socket) => {
		console.log('a user connected')
		io.emit('updatePlayers', ngPlayers)
		socket.on('shoot', ({ x, y, angle }) => {
			projectileId++
			const velocity = {
				x: Math.cos(angle) * 5,
				y: Math.sin(angle) * 5
			}
			ngProjectiles[projectileId] = {
				x,
				y,
				velocity,
				playerId: socket.id
			}
		})

		socket.on('dropBomb', ({ x, y }) => {
			bombId++
			const currentBombId = bombId
			ngBombs[currentBombId] = {
				x,
				y,
				playerId: socket.id,
				timer: 2000
			}

			// Explosion logic
			setTimeout(() => {
				if (!ngBombs[currentBombId]) return

				const bomb = ngBombs[currentBombId]
				// Target all other players
				for (const targetId in ngPlayers) {
					if (targetId === bomb.playerId) continue

					const target = ngPlayers[targetId]
					const angle = Math.atan2(target.y - bomb.y, target.x - bomb.x)

					projectileId++
					ngProjectiles[projectileId] = {
						x: bomb.x,
						y: bomb.y,
						velocity: {
							x: Math.cos(angle) * 7, // Faster projectiles for bomb
							y: Math.sin(angle) * 7
						},
						playerId: bomb.playerId
					}
				}

				delete ngBombs[currentBombId]
			}, 2000)
		})

		socket.on('initGame', ({ username, width, height, character }) => {
			ngPlayers[socket.id] = {
				x: 1024 * Math.random(),
				y: 576 * Math.random(),
				color: `hsl(${360 * Math.random()}, 100%, 50%)`,
				sequenceNumber: 0,
				score: 0,
				username,
				character: character || 'circle',
				angle: 0
			}

			// where we init our canvas
			ngPlayers[socket.id].canvas = {
				width,
				height
			}

			ngPlayers[socket.id].radius = RADIUS
		})

		socket.on('disconnect', (reason) => {
			console.log(reason)
			delete ngPlayers[socket.id]
			io.emit('updatePlayers', ngPlayers)
		})

		socket.on('keydown', ({ keycode, sequenceNumber }) => {
			const backEndPlayer = ngPlayers[socket.id]

			if (!ngPlayers[socket.id]) return

			ngPlayers[socket.id].sequenceNumber = sequenceNumber

			let dx = 0
			let dy = 0
			switch (keycode) {
				case 'KeyW':
				case 'ArrowUp':
					ngPlayers[socket.id].y -= SPEED
					dy = -1
					break

				case 'KeyA':
				case 'ArrowLeft':
					ngPlayers[socket.id].x -= SPEED
					dx = -1
					break

				case 'KeyS':
				case 'ArrowDown':
					ngPlayers[socket.id].y += SPEED
					dy = 1
					break

				case 'KeyD':
				case 'ArrowRight':
					ngPlayers[socket.id].x += SPEED
					dx = 1
					break
			}

			// Update angle if moving
			if (dx !== 0 || dy !== 0) {
				ngPlayers[socket.id].angle = Math.atan2(dy, dx)
			}

			const playerSides = {
				left: backEndPlayer.x - backEndPlayer.radius,
				right: backEndPlayer.x + backEndPlayer.radius,
				top: backEndPlayer.y - backEndPlayer.radius,
				bottom: backEndPlayer.y + backEndPlayer.radius
			}

			if (playerSides.left < 0) ngPlayers[socket.id].x = backEndPlayer.radius

			if (playerSides.right > 1024)
				ngPlayers[socket.id].x = 1024 - backEndPlayer.radius

			if (playerSides.top < 0) ngPlayers[socket.id].y = backEndPlayer.radius

			if (playerSides.bottom > 576)
				ngPlayers[socket.id].y = 576 - backEndPlayer.radius
		})
	})

	// backend ticker
	setInterval(() => {
		// update projectile positions
		for (const id in ngProjectiles) {
			ngProjectiles[id].x += ngProjectiles[id].velocity.x
			ngProjectiles[id].y += ngProjectiles[id].velocity.y

			PROJECTILE_RADIUS = 5
			if (
				ngProjectiles[id].x - PROJECTILE_RADIUS >=
				ngPlayers[ngProjectiles[id].playerId]?.canvas?.width ||
				ngProjectiles[id].x + PROJECTILE_RADIUS <= 0 ||
				ngProjectiles[id].y - PROJECTILE_RADIUS >=
				ngPlayers[ngProjectiles[id].playerId]?.canvas?.height ||
				ngProjectiles[id].y + PROJECTILE_RADIUS <= 0
			) {
				delete ngProjectiles[id]
				continue
			}

			for (const playerId in ngPlayers) {
				const backEndPlayer = ngPlayers[playerId]

				const DISTANCE = Math.hypot(
					ngProjectiles[id].x - backEndPlayer.x,
					ngProjectiles[id].y - backEndPlayer.y
				)

				// collision detection
				if (
					DISTANCE < PROJECTILE_RADIUS + backEndPlayer.radius &&
					ngProjectiles[id].playerId !== playerId
				) {
					if (ngPlayers[ngProjectiles[id].playerId])
						ngPlayers[ngProjectiles[id].playerId].score++

					console.log(ngPlayers[ngProjectiles[id].playerId])

					// Identify the absolute winner (highest score) before person dies
					const sortedPlayers = Object.values(ngPlayers).sort((a, b) => b.score - a.score);
					const ranking = sortedPlayers.map(p => ({ username: p.username, score: p.score }));
					const absoluteWinner = sortedPlayers[0]?.username || 'Unknown';

					io.to(playerId).emit('gameOver', { winner: absoluteWinner, ranking });

					delete ngProjectiles[id]
					delete ngPlayers[playerId]
					break
				}
			}
		}

		io.emit('updateProjectiles', ngProjectiles)
		io.emit('updatePlayers', ngPlayers)
		io.emit('updateBombs', ngBombs)

		// player-to-player collision detection
		const playerIds = Object.keys(ngPlayers)
		for (let i = 0; i < playerIds.length; i++) {
			for (let j = i + 1; j < playerIds.length; j++) {
				const idA = playerIds[i]
				const idB = playerIds[j]
				const playerA = ngPlayers[idA]
				const playerB = ngPlayers[idB]

				const distance = Math.hypot(playerA.x - playerB.x, playerA.y - playerB.y)
				if (distance < playerA.radius + playerB.radius) {
					// Both players die. Get rankings first.
					const sortedPlayers = Object.values(ngPlayers).sort((a, b) => b.score - a.score);
					const ranking = sortedPlayers.map(p => ({ username: p.username, score: p.score }));
					const absoluteWinner = sortedPlayers[0]?.username || 'Unknown';

					io.to(idA).emit('gameOver', { winner: absoluteWinner, ranking });
					io.to(idB).emit('gameOver', { winner: absoluteWinner, ranking });

					delete ngPlayers[idA]
					delete ngPlayers[idB]

					// Since they are deleted, break the inner loop and re-check outer? 
					// Actually, deleting them mid-loop is fine as long as we break or handle it.
					// Breaking the inner loop and proceeding to next i is safer if i+1 is still valid.
					break
				}
			}
		}
	}, 15)

	return { ngPlayers, ngProjectiles, ngBombs }
}

// 미처리 예외 → 로그 파일 기록
process.on("uncaughtException", (err) => logger.error("Uncaught Exception", { stack: err.stack }));
process.on("unhandledRejection", (err) => logger.error("Unhandled Rejection", { stack: err?.stack }));
