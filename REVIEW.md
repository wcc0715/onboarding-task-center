# 發布前檢查紀錄（2026-10-14）

來源：使用者上傳之新人入職任務中心-Prototype-2026-10-14.zip，包含 index.html、theme.css、stage2.js。

## 判定

適合以 GitHub Pages 發布為作品集展示；不具備正式後端、真正登入或 AI API 整合。

## 檢查與處理

- 未發現 HTTP 外部資源或 fetch、XMLHttpRequest、WebSocket、sendBeacon 呼叫。
- 未發現常見 OpenAI、Google、AWS、GitHub 金鑰格式或私鑰；demo1234 為公開展示密碼。
- 信箱均為 example.com；原始中文姓名是否真實未提供，因此發布副本統一替換為展示標籤。
- 原始包無附件或實際員工文件；佐證上传功能使用本機 IndexedDB。
- 增加明確展示提示，提醒勿使用個資或真實文件。
- stage2.js 與 HTML 內嵌 JavaScript 通過 Node 語法檢查。
- 本機瀏覽器實測 HR 登入、新人清單及新人詳情成功；查看過程未捕捉到 console error 或 warn。
- 未完整實測各角色、檔案上傳、審核與復原分支，亦未驗證官方行事曆日期。
- 部門任務卡顯示「進行中」，整體流程顯示「未開始」，保留原始邏輯，作品集講解時應避免將兩者混同。

## 發布狀態

已準備 README、GitHub Pages workflow、.gitignore 與 .nojekyll。GitHub repository 已建立：https://github.com/wcc0715/onboarding-task-center。連線工具寫入回傳 403，改用使用者已登入的 GitHub 網頁上傳；部署結果須另行確認。
