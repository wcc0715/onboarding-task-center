# 新人入職任務中心 Prototype

以企業新人入職協作為情境的互動作品集，展示 HR、IT、行政及 HR 主管之任務分工、期限與審核流程。

> 本專案為前端展示原型。AI 郵件、通知與登入均為模擬，未串接 AI 模型、企業帳號或郵件服務。請勿輸入個資或上傳真實文件。

## 功能

- 新人清單、搜尋、狀態篩選與基本資料編輯。
- HR、IT、行政任務與 HR 主管審核介面。
- 依內建 2026 年日期表計算任務期限。
- 通知紀錄、通知中心及郵件草稿模擬。
- 佐證檔案選擇、瀏覽器儲存及審核。
- 取消入職、30 日可復原區及角色管理展示。

## 技術架構

瀏覽器 → index.html（介面及基礎邏輯）→ stage2.js（流程規則）＋ theme.css（樣式）。

使用 HTML、CSS、原生 JavaScript，無第三方前端套件、後端、套件安裝或建置步驟。靜態資源採相對路徑，可部署於 GitHub Pages 專案子路徑。

- sessionStorage：新人、任務狀態、角色、通知及郵件草稿。
- IndexedDB：佐證檔案，資料保留在本機瀏覽器。
- 登入密碼 `demo1234` 是公開的展示字串，不提供真正身分驗證。

## 本機預覽

在專案目錄執行 `python3 -m http.server 8000`，開啟 http://localhost:8000。

選擇體驗角色，使用畫面提供的 example.com 帳號與 `demo1234` 登入。

建議展示順序：新人清單 → 新人詳情 → AI 郵件草稿 → 部門任務 → 通知紀錄 → 切換角色與主管審核。

## 發布至 GitHub Pages

1. 在 GitHub 建立公開 repository，建議名稱 `onboarding-task-center`，預設分支為 `main`。
2. 上傳本資料夾所有檔案，包含 `.github/workflows/pages.yml`。不要上傳原始 ZIP 或 work 暫存資料。
3. 在 Settings → Pages → Build and deployment 將 Source 設為 GitHub Actions。
4. 在 Actions 執行 Deploy GitHub Pages，或推送 main 觸發部署。
5. 成功後由工作流程的 github-pages environment 開啟網址；一般格式為 `https://<帳號>.github.io/onboarding-task-center/`。

工作流程只發布三個網頁資源與 `.nojekyll`，README 與檢查報告保留於 repo。Repository：https://github.com/wcc0715/onboarding-task-center

展示網址（已部署並驗證 HR 登入）：https://wcc0715.github.io/onboarding-task-center/

官方說明：https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## 公開資料與限制

發布版本已將原始中文姓名替換成「展示新人甲／乙」與角色標籤；信箱均使用 example.com。原始姓名是否為真實人物：未提供資料，無法判定。

原始 ZIP 僅含三個程式檔，沒有佐證文件、資料庫或環境設定。靜態檢查未發現常見 API keys、私鑰或外部 API 呼叫，此結論不等同完整安全稽核。

角色限制僅為前端介面控制；資料不跨裝置同步，不能作為正式企業系統。30 日復原、通知與行事曆規則為展示實作，不是後端排程；2026 日期表未另行核對政府公告，跨年度需要更新。

清除展示資料：在瀏覽器網站資料設定中清除此網站的儲存資料，包含 sessionStorage 與 IndexedDB。關閉頁籤不保證立即移除 IndexedDB 佐證檔案。

本專案未附開源授權；公開展示不代表授予他人重用授權。
