const path = require("path");
const fs = require("fs-extra");
const { mergeChunks, removeTempDir } = require("../utils/fileHelper");

// 定义目录常量
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const TEMP_DIR = path.resolve(UPLOAD_DIR, "temp");
const META_FILE = path.resolve(UPLOAD_DIR, "meta.json");

// 初始化目录函数
const initDirectories = async () => {
  try {
    await fs.ensureDir(UPLOAD_DIR);
    await fs.ensureDir(TEMP_DIR);
    // 如果 meta.json 不存在，可以创建一个空文件（可选）
    if (!(await fs.pathExists(META_FILE))) {
      await fs.writeJson(META_FILE, {}, { spaces: 2 });
    }
    console.log("✅ 上传目录初始化成功");
  } catch (err) {
    console.error("❌ 初始化上传目录失败:", err);
    process.exit(1); // 启动失败
  }
};

/**
 * 上传分片
 */
const uploadChunk = async (req, res) => {
  try {
    const { fileHash, chunkIndex } = req.body;
    const file = req.file;

    if (!fileHash || chunkIndex === undefined || !file) {
      return res.status(400).json({
        code: 400,
        message: "缺少必要参数 fileHash、chunkIndex 或分片文件",
      });
    }

    const chunkDir = path.resolve(TEMP_DIR, fileHash);
    await fs.ensureDir(chunkDir);

    const chunkPath = path.resolve(chunkDir, `${chunkIndex}`);
    await fs.move(file.path, chunkPath, { overwrite: true });

    res
      .status(200)
      .json({ code: 200, message: "分片上传成功", index: chunkIndex });
  } catch (error) {
    if (error.message === "Request aborted" || error.code === "ECONNABORTED") {
      // 客户端主动取消，不记录错误
      console.log(`分片 ${chunkIndex} 上传被客户端取消`);
      return res.status(499).json({ code: 499, message: "客户端取消" });
    }
    console.error("分片上传失败:", error);
    res.status(500).json({ code: 500, message: "服务器内部错误" });
  }
};

/**
 * 合并分片
 */
const mergeChunksHandler = async (req, res) => {
  try {
    const { fileHash, totalChunks, fileName } = req.body;

    if (!fileHash || !totalChunks || !fileName) {
      return res.status(400).json({
        code: 400,
        message: "缺少必要参数 fileHash、totalChunks、fileName",
      });
    }

    const chunkDir = path.resolve(TEMP_DIR, fileHash);
    const exists = await fs.pathExists(chunkDir);
    if (!exists) {
      return res
        .status(400)
        .json({ code: 400, message: "未找到对应分片文件夹" });
    }

    // const finalName = ext ? `${fileName}${ext}` : fileName;
    // const targetPath = path.resolve(UPLOAD_DIR, finalName);
    const targetPath = path.resolve(UPLOAD_DIR, fileHash);

    await mergeChunks(chunkDir, targetPath, totalChunks);
    // 记录元数据（哈希 -> 原始文件名）
    try {
      await fs.ensureDir(UPLOAD_DIR);
      let meta = {};
      if (await fs.pathExists(META_FILE)) {
        meta = await fs.readJson(META_FILE);
      }
      meta[fileHash] = {
        fileName,
        // ext: ext || "",
        uploadTime: new Date().toISOString(),
      };
      console.log("writeJson--------------");
      await fs.writeJson(META_FILE, meta, { spaces: 2 });
      console.log(`元数据写入成功: ${fileHash} -> ${fileName}`);
    } catch (metaError) {
      // 即使元数据写入失败，也返回合并成功（但秒传功能会受影响）
      console.error("写入元数据失败:", metaError);
      // 可选：返回警告信息，或尝试降级处理
    }

    // 删除临时目录
    await removeTempDir(chunkDir);

    // 返回下载路径（可配置静态服务）
    res.status(200).json({
      code: 200,
      message: "文件合并成功",
      filePath: `/uploads/${fileHash}`, // 静态路径
      fileName: fileName,
    });
  } catch (error) {
    console.error("文件合并失败:", error);
    res.status(500).json({ code: 500, message: "服务器内部错误" });
  }
};

/**
 * 验证已上传分片（断点续传/秒传）
 */
const verifyChunks = async (req, res) => {
  try {
    const { fileHash, totalChunks } = req.body;
    const chunkDir = path.resolve(TEMP_DIR, fileHash);
    const finalFile = path.resolve(UPLOAD_DIR, fileHash);

    // 秒传判断：完整文件已存在（以哈希命名）
    if (await fs.pathExists(finalFile)) {
      // 可附加返回原始文件名
      let fileName = "";
      try {
        if (await fs.pathExists(META_FILE)) {
          const meta = await fs.readJson(META_FILE);
          fileName = meta[fileHash]?.fileName || "";
        }
      } catch (e) {}

      // let meta = {};
      // if (await fs.pathExists(META_FILE)) {
      //   meta = await fs.readJson(META_FILE);
      // }
      // const fileInfo = meta[fileHash] || {};
      return res.status(200).json({
        code: 200,
        complete: true,
        message: "文件已存在，无需上传",
        fileName: fileName || "",
      });
    }
    // 收集已上传的分片
    const uploadedChunks = [];
    if (await fs.pathExists(chunkDir)) {
      const files = await fs.readdir(chunkDir);
      files.forEach((file) => {
        const index = parseInt(file, 10);
        if (!isNaN(index)) uploadedChunks.push(index);
      });
    }

    res.status(200).json({
      code: 200,
      complete: false,
      uploadedChunks,
      total: totalChunks,
      message: "已上传分片信息",
    });
  } catch (error) {
    console.error("验证分片失败:", error);
    res.status(500).json({ code: 500, message: "服务器错误" });
  }
};

/**
 * 取消上传（删除临时分片）
 * 请求参数：fileHash（必填）
 */
const cancelUpload = async (req, res) => {
  try {
    const { fileHash } = req.body; // 或 req.body，根据前端约定
    if (!fileHash) {
      return res.status(400).json({
        code: 400,
        message: "缺少参数 fileHash",
      });
    }

    const chunkDir = path.resolve(TEMP_DIR, fileHash);
    if (await fs.pathExists(chunkDir)) {
      await removeTempDir(chunkDir);
      return res.status(200).json({
        code: 200,
        message: "临时分片已删除",
      });
    } else {
      return res.status(404).json({
        code: 404,
        message: "未找到该文件的上传记录",
      });
    }
  } catch (error) {
    console.error("取消上传失败:", error);
    res.status(500).json({ code: 500, message: "服务器内部错误" });
  }
};

/**
 * 根据 fileHash 获取文件信息（用于下载）
 */
const getFileInfo = async (req, res) => {
  try {
    const { fileHash } = req.params;
    if (!fileHash) {
      return res.status(400).json({ code: 400, message: "缺少 fileHash" });
    }
    const finalFile = path.resolve(UPLOAD_DIR, fileHash);
    if (!(await fs.pathExists(finalFile))) {
      return res.status(404).json({ code: 404, message: "文件不存在" });
    }

    let meta = {};
    if (await fs.pathExists(META_FILE)) {
      meta = await fs.readJson(META_FILE);
    }
    const info = meta[fileHash] || {};
    res.status(200).json({
      code: 200,
      fileHash,
      fileName: info.fileName || "",
      filePath: `/uploads/${fileHash}`,
    });
  } catch (error) {
    console.error("获取文件信息失败:", error);
    res.status(500).json({ code: 500, message: "服务器错误" });
  }
};

module.exports = {
  UPLOAD_DIR,
  TEMP_DIR,
  META_FILE,
  uploadChunk,
  mergeChunksHandler,
  verifyChunks,
  cancelUpload,
  getFileInfo,
  initDirectories,
};
