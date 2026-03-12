# 英語文化導覽員口說評量系統

## 部署到 Vercel 步驟

### 第一步：上傳到 GitHub
1. 前往 https://github.com 登入（或免費註冊）
2. 點右上角「+」→「New repository」
3. 取名如 `tour-guide-evaluator`，選 Public 或 Private，點「Create repository」
4. 把這個專案資料夾拖曳上傳，或用以下指令：
   ```
   git init
   git add .
   git commit -m "init"
   git remote add origin https://github.com/你的帳號/tour-guide-evaluator.git
   git push -u origin main
   ```

### 第二步：部署到 Vercel
1. 前往 https://vercel.com 用 GitHub 帳號登入
2. 點「Add New Project」→ 選剛才的 repository
3. Framework 選「Vite」，其他保持預設
4. 點「Deploy」，等待約 1 分鐘
5. 完成後會得到網址：`your-project.vercel.app` ✅

### 第三步：設定 API Key（部署後在瀏覽器操作）
1. 開啟你的網站
2. 點「⚙️ 設定」
3. 前往 https://console.anthropic.com/keys 取得 API Key
4. 貼上並儲存

### 本地開發（選用）
```bash
npm install
npm run dev
```

## 資料儲存說明
- 學生名單和評分記錄儲存在**老師瀏覽器的 localStorage**
- 換瀏覽器或清除瀏覽器資料會遺失，建議定期從班級總覽頁面截圖存檔
- API Key 也存在 localStorage，不會上傳任何伺服器
