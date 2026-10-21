# SQL探案室

用库存、退款、权限审查三个虚构案件练习查询和证据判断。原生 HTML/CSS/JavaScript，数据库通过独立 Web Worker 中的 sql.js 真实执行，不需要服务器数据库或模型额度。

## 当前功能

- 三个案件，各含两张证据表、任务口径与分级提示。
- 运行单条 SELECT，显示真实结果、SQL 错误、空结果和超出显示上限的提示。
- 结果按类型及行的多重集合比较：允许行序不同，不忽略重复行；要求输出列的顺序相同，不强制列别名。
- 结果吻合后完成证据判断；会话进度、最近十次查询、可下载的 TXT 复盘。
- 查询上限 6000 字符、显示上限 200 行、执行超时 1.5 秒后终止 Worker 并恢复引擎。
- 两层只读约束：输入限定 SELECT + SQLite `PRAGMA query_only=ON`；每次查询重建虚构数据库。

## 能力边界

当前引擎是 **SQLite，不是 MySQL**。表结构面板使用常见 SQL 类型说明；实际 DDL 在 cases.js 内可查。可练习共同支持的连接、聚合与子查询，MySQL 专属语法、系统权限和执行计划均不在当前范围。权限案件只是模拟台账比较，不会核查或修改真实 MySQL 权限。

辅导是预设规则，**尚未接入 Coze 或大模型 API**。固定样本的结果相同无法证明 SQL 在所有数据上均正确，硬编码结果也可能吻合；当前为学习原型，不是考试防作弊系统。未来可增加隐藏测试集、真实 MySQL 沙箱和 Coze 工作流。

所有数据均为虚构。页面不上传查询，不使用分析埋点或账号系统，也不将查询写入本地持久存储；进度在刷新后重置。下载 TXT 由用户浏览器保存。不要输入真实密钥、账号或客户数据。GitHub Pages 提供静态托管，访问日志由托管方管理。

## 本地运行

在本目录启动任意静态 HTTP 服务，例如 `python3 -m http.server 4192`，打开 `http://127.0.0.1:4192/`。不能通过双击 HTML 的 file 协议运行 Worker。

测试：Node.js 22 或更新版本运行 `node --test tests/*.test.mjs`。测试仅使用内置模块及随项目分发的数据库引擎。已覆盖输入限制、结果比较、三个参考查询、业务口径反例与只读保护。

## 依赖与许可

本项目随附 [sql.js](https://github.com/sql-js/sql.js) **1.13.0**，从 npm 官方包 `https://registry.npmjs.org/sql.js/-/sql.js-1.13.0.tgz` 提取 `dist/sql-wasm.js`、`dist/sql-wasm.wasm` 与原许可。sql.js 采用 MIT 许可，见 [vendor/sql.js-LICENSE.txt](vendor/sql.js-LICENSE.txt)。所有运行文件同源加载，无第三方脚本或字体 CDN 依赖。

视觉流程使用了 GitHub 的 [interface-design skill](https://github.com/Dammyjay93/interface-design)。候选文档覆盖对比保存在本地开发目录 skill-review 中；没有将静态覆盖分数解释为生成效果的客观命中率。
