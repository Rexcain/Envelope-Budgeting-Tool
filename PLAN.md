# PLAN — 信封账本 Envelope Ledger

作者：Menghan Rex Jiang · 最后更新：2026-10-17 16:30 EDT（mac-mini）

## 现状（v0.1.0）

- 单页 web app，纯 HTML/CSS/ES modules，无构建、无依赖，数据存在 localStorage。
- 已实现：首次设置向导、示例数据、记账/编辑/删除/撤销、四层水位条（低线 / 高低线额度 / 上月结余 / 超出）、滚动结余与超支扣减、信封进度、预算建议（统计 + 75% 参考线）、每日趋势图、JSON 备份导入导出、CSV 导出、中英双语、深色模式、PWA 离线安装。
- 模型测试：`npm test`（9 个用例）。

## 接下来（按优先级）

1. **发布**
   - [ ] 在 GitHub 创建公开仓库 `Rexcain/envelope-ledger`，推送 `main`
   - [ ] Settings → Pages → Source 选 GitHub Actions，确认线上地址可用
   - [ ] 手机（iOS Safari / Android Chrome）实测「添加到主屏幕」与离线
2. **体验**
   - [ ] 水位条的消费顺序可选：先花额度 / 先花结余（设置项）
   - [ ] 示例数据的信封名在切换语言时同步（目前信封名是用户数据，不翻译）
   - [ ] 记一笔后的提示在小屏上更短
   - [ ] 年度汇总页（每月花费、结余曲线、各信封月均）
3. **数据**
   - [ ] CSV 导入（从银行导出或其他记账 app 迁移）
   - [ ] 可选的跨设备同步（如用户自己的 GitHub Gist / WebDAV），默认仍为纯本地
4. **工程**
   - [ ] UI 冒烟测试（Playwright，390px 与桌面宽度各一遍）
   - [ ] 发布时自动更新 `sw.js` 的缓存版本号
   - [ ] 无障碍检查（色盲可辨的水位条纹理、键盘操作）
