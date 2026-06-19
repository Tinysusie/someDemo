const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const uploadRouter = require("./src/routes/upload");
const { initDirectories } = require("./src/controllers/uploadController");
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件（如果需要模拟图片等）
app.use("/static", express.static("static"));
// 静态文件服务（让上传后的文件可访问）
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// 工具延迟函数
const delay = (ms) => (req, res, next) => setTimeout(next, ms);

// 定义目录常量

// 模拟数据
const data = {
  users: [
    { id: 1, name: "Alice", role: "admin" },
    { id: 2, name: "Bob", role: "user" },
  ],
};
// 上传接口
app.use("/api/upload", uploadRouter);

// === 业务路由 ===
app.get("/api/hello", (req, res) =>
  res.json({ code: 200, message: "Hello from mock server!" }),
);

app.get("/api/users", (req, res) => res.json(data.users));

app.get("/api/user/:id", (req, res) => {
  const user = data.users.find((u) => u.id == req.params.id);
  user
    ? res.json(user)
    : res.status(404).json({ code: 404, message: "Not found" });
});

app.post("/api/user", (req, res) => {
  const newUser = { id: Date.now(), ...req.body };
  data.users.push(newUser);
  res.status(200).json(newUser);
});

// 带延迟的列表
app.get("/api/products", delay(800), (req, res) => {
  res.json({
    code: 200,
    data: [
      { id: 1, name: "Product A", price: 99 },
      { id: 2, name: "Product B", price: 149 },
    ],
  });
});

// 全局 404 处理
app.use((req, res) =>
  res.status(404).json({ code: 404, message: "接口不存在" }),
);

app.use((err, req, res, next) => {
  if (err.message === "Request aborted") {
    // 忽略，不记录错误日志
    return res.status(499).end();
  }
  // 其他错误正常处理
  next(err);
});

// 在启动服务器前调用
initDirectories().then(() => {
  app.listen(PORT, () =>
    console.log(`Mock server on http://localhost:${PORT}`),
  );
});
