# 信封账本 · Envelope Ledger

[中文](#中文) · [English](#english)

![icon](icons/icon-192.png)

> 🤖 本项目由 Menghan Rex Jiang 与 [Claude](https://claude.ai)（Anthropic）以 vibe coding 的方式共同设计和编写：需求、规则和取舍来自作者的真实记账经历，代码主要由 Claude 生成，作者审阅并迭代。
>
> 🤖 Vibe-coded with [Claude](https://claude.ai) (Anthropic). The rules and trade-offs come from the author's own budgeting; most of the code was written by Claude, then reviewed and iterated on by the author.

---

## 中文

一个**本地优先**的信封预算 web app。没有账号、没有服务器，数据只存在你自己的浏览器里。

### 它和普通记账有什么不同

每月的自由支配花销用两条线来管：

| 层 | 含义 |
|---|---|
| 🟩 **低线以内** | 花到这里都很舒服 |
| 🟧 **高低线额度** | 低线到高线之间的钱，过了低线先花它 |
| 🟦 **上月结余** | 上个月没花完的钱，**叠加在高线之上**，额度花完再花它 |
| 🟥 **超出本月高线** | 硬上限，不能超 |

- **本月高线 = 基础高线 + 上月结余。** 上月结余 = 上月高线 − 上月实际花费。省下来的钱一个月一个月往下滚，下个月的实际上限会越来越高。
- **上月超支**时，超出的部分会从本月高线里扣掉。
- **水位条**用颜色告诉你：现在花的这笔钱来自哪一层。
- **预算建议**：从第二个月起，根据前几个月每个信封的日均花费，自动给出下个月的信封预算：
  - 近的月份更重要；
  - 单笔大件不计入日常；
  - 「必需」信封多留一点余量；
  - 每次最多调 25%；
  - 信封合计约为本月高线的 75%（可在设置里改）。这只是参考线，不是限制。

### 使用方法

**方式一：直接在线用（推荐）**

1. 打开 <https://rexcain.github.io/envelope-ledger/>
2. 第一次打开时填好：第一个记账月、低线、高线、货币符号和你的信封。也可以先点「用示例数据试试」看看效果。
3. **装到手机桌面**（像 App 一样离线使用）：
   - iPhone（Safari）：点「分享」→「添加到主屏幕」
   - Android（Chrome）：点菜单 →「安装应用」或「添加到主屏幕」

**方式二：在自己电脑上运行**

需要装好 [Git](https://git-scm.com/) 和 Python 3（macOS 自带）。

```bash
git clone https://github.com/Rexcain/envelope-ledger.git
cd envelope-ledger
python3 -m http.server 8080
```

然后在浏览器打开 <http://localhost:8080>。

> 必须通过本地服务器打开，直接双击 `index.html` 不行（浏览器不允许 `file://` 加载 JS 模块）。

**方式三：部署你自己的一份**

1. 在 GitHub 上 **Fork** 这个仓库。
2. 进入你 fork 的仓库 → **Settings → Pages**，把 **Source** 设为 **GitHub Actions**。
3. 推送任何改动到 `main`，几分钟后就能在 `https://<你的用户名>.github.io/envelope-ledger/` 打开。

### 数据与隐私

- 所有记录、预算和设置都保存在浏览器的 `localStorage` 里，**不会上传到任何地方**。
- 换手机、换浏览器或清理浏览器数据之前，在页面底部点 **「导出备份 (JSON)」**；到新设备上点 **「导入备份」** 恢复。
- 「导出 CSV」可以拿到 Excel / Numbers 里分析。
- 同一个浏览器里不同网址（比如在线版和 localhost）的数据是分开的。

### 常见问题

- **怎么改低线、高线或信封？** 右上角「设置」。改信封名称和颜色不会影响已有记录；删除信封后，这个信封里的记录不再计入花费。
- **为什么第一个月没有结余？** 第一个月之前没有数据，结余从第二个月开始滚。
- **预算建议会自动生效吗？** 不会。点「采用建议预算」才会保存，并且可以撤销。

---

## English

A **local-first** envelope budgeting web app. No account, no server — your data stays in your own browser.

### What makes it different

Monthly discretionary spending is managed with two lines:

| Layer | Meaning |
|---|---|
| 🟩 **Within the low line** | Comfortable spending |
| 🟧 **Quota** | Money between the low and high line, spent first after the low line |
| 🟦 **Carry-over** | Last month's unspent money, **stacked on top of the high line**, spent after the quota |
| 🟥 **Over this month's cap** | A hard limit |

- **This month's cap = base high line + carry-over.** Carry-over = last month's cap − last month's spending. What you save keeps rolling forward, so your real cap grows month after month.
- **Overspending** last month lowers this month's cap by the same amount.
- The **water meter** shows, by color, which layer the money you're spending right now comes from.
- **Budget suggestions**: from your second month on, the app suggests next month's envelope budgets from each envelope's average daily spending:
  - recent months count more;
  - large one-off purchases are left out of the baseline;
  - envelopes marked "need" get a little headroom;
  - each change is capped at 25%;
  - envelopes add up to about 75% of this month's cap (changeable in Settings). That 75% is a guide, not a limit.

### Getting started

**Option 1: use it online (recommended)**

1. Open <https://rexcain.github.io/envelope-ledger/>
2. On first launch, set your first month, low line, high line, currency symbol and envelopes — or tap **Try with sample data** to look around first.
3. **Install it on your phone** (works offline, like an app):
   - iPhone (Safari): Share → **Add to Home Screen**
   - Android (Chrome): menu → **Install app** / **Add to Home screen**

**Option 2: run it on your own computer**

You need [Git](https://git-scm.com/) and Python 3 (preinstalled on macOS).

```bash
git clone https://github.com/Rexcain/envelope-ledger.git
cd envelope-ledger
python3 -m http.server 8080
```

Then open <http://localhost:8080> in your browser.

> It has to be served over HTTP; double-clicking `index.html` won't work because browsers block JS modules on `file://`.

**Option 3: host your own copy**

1. **Fork** this repository on GitHub.
2. In your fork, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push any change to `main`; a few minutes later it's live at `https://<your-username>.github.io/envelope-ledger/`.

### Data & privacy

- Entries, budgets and settings are stored in your browser's `localStorage` and **never leave your device**.
- Before switching phones or browsers, or clearing browser data, tap **Export backup (JSON)** at the bottom of the page; use **Import backup** on the new device.
- **Export CSV** gives you a file for Excel / Numbers.
- Different addresses (e.g. the online version vs. localhost) keep separate data, even in the same browser.

### FAQ

- **How do I change the lines or envelopes?** Tap **Settings** at the top right. Renaming or recoloring an envelope keeps its entries; entries in a deleted envelope stop counting toward spending.
- **Why is there no carry-over in my first month?** There's nothing before it — carry-over starts in month two.
- **Are suggestions applied automatically?** No. They're saved only when you tap **Use suggested budgets**, and you can undo it.

---

## For developers · 开发者

- Plain HTML/CSS/ES modules, no build step, no dependencies.
- `js/model.js` — all budgeting math (pure functions); `js/app.js` — UI; `js/i18n.js` — zh/en strings; `js/store.js` — localStorage, backup, sample data.
- Tests: `npm test` (Node 20+, uses the built-in `node:test`).
- Deploys to GitHub Pages via `.github/workflows/pages.yml` after tests pass.
- Roadmap: see [PLAN.md](PLAN.md). Dev log: [CLAUDE.md](CLAUDE.md).

## License

MIT © 2026 Menghan Rex Jiang
