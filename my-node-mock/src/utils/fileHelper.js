const path = require("path");
const fs = require("fs-extra");

/**
 * 合并分片文件
 * @param {string} tempDir 分片临时目录
 * @param {string} targetPath 目标文件路径
 * @param {number} chunkCount 总分片数
 */
const mergeChunks = async (tempDir, targetPath, chunkCount) => {
  await fs.ensureDir(path.dirname(targetPath));

  const writeStream = fs.createWriteStream(targetPath);

  for (let i = 0; i < chunkCount; i++) {
    const chunkPath = path.join(tempDir, `${i}`);
    const exists = await fs.pathExists(chunkPath);
    if (!exists) {
      writeStream.close();
      throw new Error(`分片 ${i} 缺失，合并失败`);
    }
    const chunkData = await fs.readFile(chunkPath);
    writeStream.write(chunkData);
  }

  writeStream.end();

  return new Promise((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });
};

/**
 * 删除临时目录
 * @param {string} tempDir 临时目录路径
 */
const removeTempDir = async (tempDir) => {
  await fs.remove(tempDir);
};

module.exports = { mergeChunks, removeTempDir };
