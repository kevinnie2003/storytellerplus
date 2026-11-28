# 网页版移植说明

目标：把 `../说书人普拉斯/`（iPad 版 SwiftUI）一比一移植成网页，**大屏（iPad 横屏、电脑）上的界面和交互要和 iPad 版完全一致**，功能全都要有。暂不做手机布局。

技术：Vite + React 19 + TypeScript + zustand。`npm run dev` 开发，`npx tsc -b` 检查类型。

## 换算规则

- 1 个 SwiftUI point = 1 个 CSS px。iPad Pro 11 寸横屏是 1210×834。
- 字体：`.font(.system(size: N, design: .rounded))` → `rounded(N, 字重)`（ui/kit.tsx）。`.monospaced` → `mono(N, 字重)`。
  字重：regular 400、`.semibold` 600、`.bold` 700、`.heavy` 800、`.black` 900。`.fontWeight(...)` 同理。
- 颜色一律用 CSS 变量（theme.css），深色模式自动切换：
  `Color.ink`/`.ink` → `var(--ink)`；`Color.paper` → `var(--paper)`；`Color.mainbg`/`.mainbg` → `var(--mainbg)`；
  `Color.goodTextBg` → `var(--goodTextBg)`；`.evilTextBg` → `var(--evilTextBg)`；阵营色 `var(--townsfolk)` 等；
  `.demonInk`/`.minionInk` → `var(--demonInk)`/`var(--minionInk)`；`Color.neutralTeam` → `var(--neutralTeam)`。
  `Color.black.opacity(x)` 遮罩类的保持黑色。`.opacity(x)` 的文字可以用 `opacity` 或 `color-mix`。
- `.padding()` 默认 16；`HStack`/`VStack` 默认 spacing 8；`Spacer()` → `flex: 1`；`.frame(maxWidth: .infinity)` → `flex: 1` 或 `width: 100%`。
- `.overlay(RoundedRectangle(cornerRadius: r).stroke(.ink, lineWidth: w))` → `border: w px solid var(--ink); border-radius: r`（盒模型是 border-box）。
- `.shadow(color: .black.opacity(0.2), radius: 5, x: 3, y: 5)` → `box-shadow: 3px 5px 10px rgba(0,0,0,.2)`。
- 动画：`.easeInOut(duration: 0.3)` 等用 CSS transition 大致还原就行。

## 共用的东西（已写好，直接用，不要改它们的接口）

- `game/types.ts`：Character、Reminder、GameLogEntry、Jinx、OrderInfo、GameSaveData，字段和 Swift 一样。`defaultCharacter`、`makeReminder`、`reminderId`。
- `game/store.ts`：`useGame`（zustand），字段名和 StoryTellerView 的 `@State` 一样，例如 `playersAssignedCharacters`、`playersStates`、`gameState`、`showNotepad`。组件里用 `useGame(s => s.xxx)` 读，`setGame({...})` 或 `useGame.getState().set(...)` 写。**弹出的面板不传 props，直接读 store**（和 Swift 里的 @Binding 一样）。
- `game/log.ts`：`makeLog({ message, messager, source, type, characterName, playerNumbers, playerCharacters, playerTeams })`，文字和 iPad 版一样。
- `game/undo.ts`：`registerUndo(提示文字, 撤销函数)`，对应 `UndoCenter.shared.register`。
- `game/persistence.ts`：`saveGame()`、`makeSaveData()`、`applySaveData()`、`loadLastGame()`、存档列表 `archiveList/Load/Save/Delete`、复盘 `recapLoad/Save`、`recapPosterLoad/Save/Delete`、`shouldArchive()`。
- `game/loadScript.ts`：`loadGameData(json)`、`team2Int`、`imageURLString`。`game/builtins.ts`：全局旅行者、传奇、`teamCounts`、`minionInfo`/`demonInfo`。
- `game/teams.ts`：`teamColor(team)`、`teamIdColor(id)`、`isPlayerTeam`、`teamShortName`。
- `settings/store.ts`：`useSettings`，对应 AppSettings + `hideTeamColors`、`tutorialSeen`、`countdownSeconds`，`useSettings.getState().set(key, value)` 会存进 localStorage。
- `ui/kit.tsx`：`rounded()`、`mono()`、`STSection`、`STRow`、`STChoice`、`STChoiceRow`、`STBigButton`、`STPageHeader`、`panel()`。
- `ui/SFIcon.tsx`：`<SFIcon name="moon.fill" size={30} />`，名字照写 Swift 里的 SF Symbols 名字。缺的名字自己往 map 里加（只加，不要改已有的）。
- `ui/CachedImage.tsx`：`<CachedImage url size grayscale />`，对应 CachedImageView。
- `ui/gestures.ts`：`usePress({ onTap, onDoubleTap, onLongPress, longPressSeconds })`，返回的东西展开到元素上，对应 onTapGesture(count:1/2)、onLongPressGesture。
- `ui/Alert.tsx`：`showAlert({ title, message, buttons: [{ label, role, action }], input?, sheet? })`，对应 `.alert` 和 `.confirmationDialog`（`sheet: true`）。
- `ui/Sheet.tsx`：`<Sheet open onClose>`（对应 iPad 上 `.sheet` + `.presentationSizing(.page)`），`<FullScreen open>`。

## 新手教程的位置标记

iPad 版用 `.tutorialAnchor("xxx")` 标记要圈出来的位置。网页版在同一个元素上加 `data-tour="xxx"`，名字照抄，教程会按这个找位置。

## 分工

每个人只改自己负责的文件（可以在自己目录里新建文件）。需要别人负责的组件时，按 `src` 里已有的占位文件导入，接口别改。
共用文件只允许往 `ui/SFIcon.tsx` 的 map 里加图标。如果非改共用文件不可，在汇报里说明。

不要用 iOS 模拟器（会和别人冲突）。自己对照 Swift 源码还原，可以 `npm run dev -- --port <自己的端口>` 起服务，用浏览器截图看效果。
