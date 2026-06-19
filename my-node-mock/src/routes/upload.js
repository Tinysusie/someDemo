const { Router } = require("express");
const multer = require("multer");
const path = require("path");

const {
  UPLOAD_DIR,
  TEMP_DIR,
  META_FILE,
  uploadChunk,
  mergeChunksHandler,
  verifyChunks,
  cancelUpload,
  getFileInfo, // 如果有
} = require("../controllers/uploadController");

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // const tempRoot = path.resolve(process.cwd(), "uploads", "temp");
    // cb(null, tempRoot);
    // 此时 TEMP_DIR 已存在
    cb(null, TEMP_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

// 三个接口
router.post("/chunk", upload.single("chunk"), uploadChunk);
router.post("/merge", mergeChunksHandler);
router.post("/verify", verifyChunks);

router.post("/cancel", cancelUpload); // 取消上传（删除临时分片）
router.get("/file/:fileHash", getFileInfo); // 获取文件信息（可选）

module.exports = router;
