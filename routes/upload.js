import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

const router = Router();
// 임시 파일 저장소 설정
const upload = multer({ dest: "uploads/temp/" });

const UPLOADS_BASE = path.join(process.cwd(), "uploads");
const CHUNKS_DIR = path.join(UPLOADS_BASE, "chunks");
const UPLOAD_AVATAR_DIR = path.join(process.cwd(), "public/images/avatar");
const UPLOAD_FILES_DIR = path.join(process.cwd(), "public/uploads/files");
console.log('>>> upload file dir == ' + UPLOAD_FILES_DIR)
// 디렉토리 생성 확인
if (!fs.existsSync(CHUNKS_DIR)) fs.mkdirSync(CHUNKS_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_AVATAR_DIR)) fs.mkdirSync(UPLOAD_AVATAR_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_FILES_DIR)) fs.mkdirSync(UPLOAD_FILES_DIR, { recursive: true });

const uploadAvatar = multer({
    storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, UPLOAD_AVATAR_DIR),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 최대 10MB
});
const uploadFile = multer({
    storage: multer.diskStorage({
        destination: (_, __, cb) => cb(null, UPLOAD_FILES_DIR),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
        }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 최대 10MB
});

router.post("/avatar", uploadAvatar.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "파일이 없습니다." });
    const fileId = req.file.filename;
    const url = '/images/avatar/' + fileId
    console.log('upload avatar=>', req.body.nickName, url)
    res.status(201).json({ fileId, name: req.file.originalname, url });
});
router.post("/file", uploadFile.single("file"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "파일이 없습니다." });
    const fileId = req.file.filename;
    const url = '/uploads/files/' + fileId
    res.status(201).json({ fileId, name: req.file.originalname, url });
});

/**
 * 청크 업로드 API
 * multipart/form-data 로 전송된 chunk 파일을 지정된 uploadId 폴더에 index 이름으로 저장합니다.
 */
router.post("/chunk", upload.single("chunk"), (req, res) => {
    const { uploadId, chunkIndex } = req.body;
    const chunkFile = req.file;

    if (!uploadId || chunkIndex === undefined || !chunkFile) {
        return res.status(400).json({ error: "필수 파라미터가 누락되었습니다. (uploadId, chunkIndex, chunk)" });
    }

    const chunkDir = path.join(CHUNKS_DIR, uploadId);
    if (!fs.existsSync(chunkDir)) {
        fs.mkdirSync(chunkDir, { recursive: true });
    }

    const chunkPath = path.join(chunkDir, `${chunkIndex}`);

    // multer 로 생성된 임시 파일을 청크 저장소로 이동
    try {
        fs.renameSync(chunkFile.path, chunkPath);
        res.json({ success: true, message: `Chunk ${chunkIndex} uploaded successfully.` });
    } catch (error) {
        console.error("Chunk rename error:", error);
        res.status(500).json({ error: "청크 저장 중 오류가 발생했습니다." });
    }
});

/**
 * 청크 병합 API
 * 업로드된 모든 청크를 순서대로 읽어 하나의 파일로 합치고 임시 폴더를 삭제합니다.
 */
router.post("/merge", async (req, res) => {
    const { uploadId, fileName, totalChunks } = req.body;

    if (!uploadId || !fileName || !totalChunks) {
        return res.status(400).json({ error: "필수 파라미터가 누락되었습니다. (uploadId, fileName, totalChunks)" });
    }

    const chunkDir = path.join(CHUNKS_DIR, uploadId);
    const finalPath = path.join(UPLOADS_BASE, fileName);

    if (!fs.existsSync(chunkDir)) {
        return res.status(404).json({ error: "해당 uploadId의 청크 디렉토리를 찾을 수 없습니다." });
    }

    try {
        const writeStream = fs.createWriteStream(finalPath);

        for (let i = 0; i < totalChunks; i++) {
            const chunkPath = path.join(chunkDir, `${i}`);
            if (!fs.existsSync(chunkPath)) {
                writeStream.end();
                return res.status(400).json({ error: `청크 ${i}번이 존재하지 않습니다.` });
            }

            // 동기적으로 청크를 읽어서 스트림에 쓰기
            const data = fs.readFileSync(chunkPath);
            writeStream.write(data);

            // 병합 완료된 청크는 삭제
            fs.unlinkSync(chunkPath);
        }

        writeStream.end();

        writeStream.on("finish", () => {
            // 모든 청크가 병합되었으므로 임시 디렉토리 삭제
            try {
                fs.rmdirSync(chunkDir);
                console.log(`File merged successfully: ${fileName}`);
                res.json({ success: true, message: "파일 병합 완료", filePath: `/uploads/${fileName}` });
            } catch (rmError) {
                console.error("Directory removal error:", rmError);
                // 디렉토리 삭제 실패는 치명적이지 않으므로 성공 응답을 보낼 수 있음
                res.json({ success: true, message: "파일 병합 완료 (임시 폴더 삭제 실패)", filePath: `/uploads/${fileName}` });
            }
        });

        writeStream.on("error", (err) => {
            console.error("WriteStream error:", err);
            res.status(500).json({ error: "파일 병합 중 오류가 발생했습니다." });
        });

    } catch (error) {
        console.error("Merge error:", error);
        res.status(500).json({ error: "서버 오류로 인해 파일 병합에 실패했습니다." });
    }
});

export default router;
