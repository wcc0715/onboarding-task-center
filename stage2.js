/* 第二階段規則：此檔僅供作品集展示，不連接真實郵件或企業帳號服務。 */
const activeThemeLink = document.createElement('link');
activeThemeLink.rel = 'stylesheet';
activeThemeLink.href = 'theme.css';
document.head.appendChild(activeThemeLink);
const HR_SUPERVISOR = { name: '展示HR主管', email: 'pei-pei.wu@example.com' };
const IT_SUPERVISOR = { name: '展示IT主管', email: 'cheng-en.li@example.com' };
const ADMIN_SUPERVISOR = { name: '展示行政主管', email: 'zhi-ming.wang@example.com' };
const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_SIZE = 20 * 1024 * 1024;
const EVIDENCE_EXTENSIONS = ['png', 'pdf', 'doc', 'docx'];
/* 2026 年（民國 115 年）行政院人事行政總處辦公日曆之放假日期。 */
const OFFICIAL_2026_HOLIDAYS = [
  '2026-01-01',
  '2026-02-14', '2026-02-15', '2026-02-16', '2026-02-17', '2026-02-18', '2026-02-19', '2026-02-20', '2026-02-21', '2026-02-22',
  '2026-02-27', '2026-02-28',
  '2026-04-03', '2026-04-04', '2026-04-05', '2026-04-06',
  '2026-05-01', '2026-05-02', '2026-05-03',
  '2026-06-19', '2026-06-20', '2026-06-21',
  '2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28',
  '2026-10-09', '2026-10-10', '2026-10-11',
  '2026-10-24', '2026-10-25', '2026-10-26',
  '2026-12-25', '2026-12-26', '2026-12-27'
];
nationalHolidays.clear();
OFFICIAL_2026_HOLIDAYS.forEach(date => nationalHolidays.add(date));

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isHoliday(date) {
  return nationalHolidays.has(isoDate(date));
}

function isWorkday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6 && !isHoliday(date);
}

/* 到職日前一個星期的星期五；遇休假日則持續往前至一般工作日。 */
friday = function (dateString) {
  const hire = new Date(`${dateString}T12:00:00`);
  const monday = new Date(hire);
  const day = hire.getDay() || 7;
  monday.setDate(hire.getDate() - day + 1);
  const due = new Date(monday);
  due.setDate(monday.getDate() - 3);
  while (!isWorkday(due)) due.setDate(due.getDate() - 1);
  return fmt(isoDate(due));
};

/* 到職日算第 1 個工作日，記滿 3 個工作日；遇休假日順延。 */
hrDue = function (dateString) {
  let due = new Date(`${dateString}T12:00:00`);
  let count = 0;
  while (count < 3) {
    if (isWorkday(due)) count += 1;
    if (count < 3) due.setDate(due.getDate() + 1);
  }
  return `${fmt(isoDate(due))} 中午前`;
};

/* 展示頁籤關閉後，下次開啟重新使用兩筆固定範例；佐證檔也不跨頁籤保留。 */
if (!sessionStorage.getItem('evidenceSessionInitialized')) {
  indexedDB.deleteDatabase('onboardingEvidence');
  sessionStorage.setItem('evidenceSessionInitialized', '1');
}

const fileInput = $('#file');
fileInput.accept = '.png,.pdf,.doc,.docx';
const uploadHelp = document.createElement('p');
uploadHelp.className = 'help';
uploadHelp.textContent = '格式：PNG、PDF、Word（DOC／DOCX）；每份上限 20MB，最多 5 份。送審前可重新選擇檔案。';
fileInput.closest('.upload').after(uploadHelp);
const selectedFilesBox = document.createElement('div');
selectedFilesBox.className = 'evidence-box';
selectedFilesBox.style.display = 'none';
uploadHelp.after(selectedFilesBox);

function renderSelectedFiles() {
  const files = [...fileInput.files];
  selectedFilesBox.style.display = files.length ? 'block' : 'none';
  selectedFilesBox.innerHTML = files.map((file, index) => `<p>${esc(file.name)}（${(file.size / 1024 / 1024).toFixed(2)} MB） <button class="link remove-selected-file" data-index="${index}">移除</button></p>`).join('');
  document.querySelectorAll('.remove-selected-file').forEach(button => button.onclick = () => {
    const transfer = new DataTransfer();
    files.forEach((file, index) => { if (index !== Number(button.dataset.index)) transfer.items.add(file); });
    fileInput.files = transfer.files;
    renderSelectedFiles();
  });
}

function evidenceError(files) {
  if (files.length > MAX_EVIDENCE_FILES) return '最多只能上傳 5 份佐證檔案。';
  for (const file of files) {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!EVIDENCE_EXTENSIONS.includes(ext)) return `「${file.name}」格式不符，僅接受 PNG、PDF、DOC、DOCX。`;
    if (file.size > MAX_EVIDENCE_SIZE) return `「${file.name}」超過每份 20MB 的上限。`;
  }
  return '';
}

/*
 * 展示版可能直接以 file:// 開啟，而部分瀏覽器會封鎖 IndexedDB。
 * 本機展示時改用頁面記憶體暫存；關閉頁面後自然清除，符合展示版重設規則。
 */
const memoryEvidence = new Map();
const indexedDbSaveEvidenceFiles = saveEvidenceFiles;
const indexedDbLoadEvidenceFiles = loadEvidenceFiles;

saveEvidenceFiles = async function (taskKey, files) {
  if (!files.length) return;
  const items = files.map(file => ({ name: file.name, type: file.type, blob: file }));
  if (location.protocol === 'file:') {
    memoryEvidence.set(taskKey, items);
    return;
  }
  try {
    await indexedDbSaveEvidenceFiles(taskKey, files);
  } catch (error) {
    console.warn('IndexedDB 無法儲存佐證，改用頁面暫存。', error);
    memoryEvidence.set(taskKey, items);
  }
};

loadEvidenceFiles = async function (taskKey) {
  if (memoryEvidence.has(taskKey)) return memoryEvidence.get(taskKey);
  if (location.protocol === 'file:') return [];
  try {
    return await indexedDbLoadEvidenceFiles(taskKey);
  } catch (error) {
    console.warn('IndexedDB 無法讀取佐證，改用頁面暫存。', error);
    return memoryEvidence.get(taskKey) || [];
  }
};

async function deleteEvidenceFiles(taskKey) {
  memoryEvidence.delete(taskKey);
  if (location.protocol === 'file:') return;
  try {
    const db = await evidenceDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').delete(taskKey);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn('無法刪除 IndexedDB 佐證資料。', error);
  }
}

fileInput.addEventListener('change', () => {
  const error = evidenceError([...fileInput.files]);
  if (!error) {
    renderSelectedFiles();
    return;
  }
  fileInput.value = '';
  renderSelectedFiles();
  $('#taskMessage').textContent = error;
  $('#taskMessage').className = 'error';
  $('#taskMessage').style.display = 'block';
});

const originalCaptureProgressWithFiles = captureProgressWithFiles;
captureProgressWithFiles = async function (submitted) {
  const selected = [...fileInput.files];
  const error = evidenceError(selected);
  if (error) throw new Error(error);
  return originalCaptureProgressWithFiles(submitted);
};

$('#saveBtn').onclick = async () => {
  try {
    await captureProgressWithFiles(false);
    returnToSystemHome('任務進度已儲存，您可以稍後繼續處理。');
  } catch (error) {
    $('#taskMessage').textContent = error.message;
    $('#taskMessage').className = 'error';
    $('#taskMessage').style.display = 'block';
  }
};

$('#submitBtn').onclick = async () => {
  const submitButton = $('#submitBtn');
  const message = $('#taskMessage');
  if (submitButton.disabled) return;
  submitButton.disabled = true;
  submitButton.textContent = '送出中…';
  try {
    const checks = [...document.querySelectorAll('#taskItems input')].map(input => input.checked);
    const complete = checks.length > 0 && checks.every(Boolean);
    const note = $('#note').value.trim();
    const selected = [...fileInput.files];
    const formatError = evidenceError(selected);
    let hasEvidence = selected.length > 0;
    if (!hasEvidence) {
      const storedFiles = await loadEvidenceFiles(key());
      hasEvidence = storedFiles.length > 0;
    }
    const missing = [];
    if (!complete) missing.push('完成所有待辦項目');
    if (!hasEvidence) missing.push('上傳佐證檔案');
    if (!note) missing.push('填寫備註');
    if (formatError || missing.length) {
      message.textContent = formatError || `送出前請先：${missing.join('、')}。`;
      message.className = 'error';
      message.style.display = 'block';
      message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      return;
    }
    await captureProgressWithFiles(true);
    if (progress[key()]) delete progress[key()].rejectionReason;
    sessionStorage.setItem('onboardingTaskProgress', JSON.stringify(progress));
    if (activeTask !== 'hr') pushSystemNotification('hr', '任務已送審', `${accountFor(activeTask).name}已送出${current.name}的${activeTask === 'it' ? 'IT' : '行政'}任務，等待 HR 審核。`, `submission-${current.id}-${activeTask}-${Date.now()}`);
    returnToSystemHome('任務已送出 HR 審核。');
  } catch (error) {
    console.error('送出審核失敗', error);
    message.textContent = '送出失敗：系統無法讀取或儲存佐證資料，請重新選擇檔案後再試一次。';
    message.className = 'error';
    message.style.display = 'block';
    message.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = '送出審核';
  }
};

/* HR 退回：必填原因、通知原負責人，且僅保留下一次送審的最新結果。 */
const reviewArea = $('#hrReview');
reviewArea.insertAdjacentHTML('beforeend', `
  <label class="form-field reject-field" style="display:block;margin-top:14px">退回原因 *
    <textarea id="rejectReason" placeholder="請說明需補正的內容"></textarea>
  </label>
  <button class="btn secondary reject-button" id="rejectBtn" style="margin-top:10px">退回修改並通知負責人</button>
  <div class="error" id="rejectError"></div>
`);

$('#rejectBtn').onclick = async () => {
  if (!['hr', 'hrSupervisor'].includes($('#role').value) || !current || activeTask === 'hr') return;
  const reason = $('#rejectReason').value.trim();
  if (!reason) {
    $('#rejectError').textContent = '請先填寫退回原因。';
    $('#rejectError').style.display = 'block';
    return;
  }
  const taskKey = key();
  const old = progress[taskKey] || {};
  progress[taskKey] = { ...old, submitted: false, rejected: true, rejectionReason: reason, fileNames: [], note: '' };
  taskStatuses[taskKey] = '進行中';
  sessionStorage.setItem('onboardingTaskProgress', JSON.stringify(progress));
  sessionStorage.setItem('onboardingTaskStatuses', JSON.stringify(taskStatuses));
  await deleteEvidenceFiles(taskKey);
  $('#taskDialog').close();
  openPerson(current.id);
  showSystemToast(`已退回並模擬通知${activeTask === 'it' ? accountFor('it').name : accountFor('admin').name}修改。`);
};

const originalOpenTask = openTask;
openTask = async function (task) {
  await originalOpenTask(task);
  renderSelectedFiles();
  const state = progress[key()] || {};
  const canRejectDepartmentTask = ['hr', 'hrSupervisor'].includes($('#role').value) && task !== 'hr';
  $('.reject-field').style.display = canRejectDepartmentTask ? 'block' : 'none';
  $('.reject-button').style.display = canRejectDepartmentTask ? 'inline-block' : 'none';
  $('#rejectReason').value = '';
  $('#rejectError').style.display = 'none';
  if ($('#role').value !== 'hr' && state.rejectionReason) {
    $('#taskMessage').textContent = `HR 退回原因：${state.rejectionReason}`;
    $('#taskMessage').className = 'error';
    $('#taskMessage').style.display = 'block';
  }
};

/* HR 專用的取消入職紀錄與最近刪除。 */
let cancelledPeople = JSON.parse(sessionStorage.getItem('onboardingCancelledPeople') || '[]');
let recyclePeople = JSON.parse(sessionStorage.getItem('onboardingRecyclePeople') || '[]');

const sidebar = document.querySelector('.sidebar');
sidebar.insertAdjacentHTML('beforeend', '<button class="nav-btn" id="navCompleted">已完成流程</button><button class="nav-btn" id="navAccounts">帳號與角色</button><button class="nav-btn" id="navCancelled">取消入職紀錄</button><button class="nav-btn" id="navRecycle">最近刪除</button>');
sidebar.insertAdjacentHTML('beforeend', '<p class="help" style="padding:12px;line-height:1.6">期限配合政府公告之行事曆。</p>');
document.querySelector('main').insertAdjacentHTML('beforeend', `
  <section id="completedView" hidden><div class="eyebrow">HR 專用</div><div class="toolbar"><div><h1>已完成流程</h1><p>集中暫存 HR 已確認完成的新人流程；完成日起一個月後，系統將移入「最近刪除」。</p></div></div><div class="panel table-wrap"><table class="people"><thead><tr><th>新人</th><th>部門</th><th>到職日</th><th>完成時間</th><th>處理</th></tr></thead><tbody id="completedRows"></tbody></table></div></section>
  <section id="accountsView" hidden><div class="eyebrow">HR 專用</div><div class="toolbar"><div><h1>帳號與角色</h1><p>IT 建立或停用公司帳號；HR 主管可管理全部負責人，HR 僅可修改 IT 與行政負責人。儲存後同步套用至任務清單與通知對象。</p></div></div><div class="panel table-wrap"><table class="people"><thead><tr><th>系統角色</th><th>使用者姓名</th><th>公司信箱</th><th>帳號管理責任</th><th>操作</th></tr></thead><tbody id="accountRows"></tbody></table></div></section>
  <section id="cancelledView" hidden><div class="eyebrow">HR 專用</div><div class="toolbar"><div><h1>取消入職紀錄</h1><p>保留完整流程內容，等待 HR 人工確認。已刪除之資料，可至復原區查看。</p></div></div><div class="panel table-wrap"><table class="people"><thead><tr><th>新人</th><th>部門</th><th>到職日</th><th>處理</th></tr></thead><tbody id="cancelledRows"></tbody></table></div></section>
  <section id="recycleView" hidden><div class="eyebrow">HR 專用</div><div class="toolbar"><div><h1>最近刪除</h1><p>包含 HR 確認刪除的紀錄，以及完成後一個月自動移入的流程資料；移入後 30 日內可復原。</p></div></div><div class="panel table-wrap"><table class="people"><thead><tr><th>新人</th><th>來源</th><th>移入時間</th><th>可復原期限</th><th>處理</th></tr></thead><tbody id="recycleRows"></tbody></table></div></section>
`);

function saveArchiveData() {
  sessionStorage.setItem('onboardingCancelledPeople', JSON.stringify(cancelledPeople));
  sessionStorage.setItem('onboardingRecyclePeople', JSON.stringify(recyclePeople));
  sessionStorage.setItem('onboardingPeople', JSON.stringify(people));
}

function hideAllViews() {
  ['listView', 'detailView', 'notificationView', 'completedView', 'accountsView', 'cancelledView', 'recycleView'].forEach(id => $(`#${id}`).hidden = true);
  document.querySelectorAll('.nav-btn').forEach(button => button.classList.remove('active'));
}

let accountRoles = JSON.parse(sessionStorage.getItem('onboardingAccountRoles') || 'null') || [
  { name: '展示HR負責人', email: 'ya-ting.lin@example.com', role: 'HR 負責人' },
  { name: '展示IT負責人', email: 'bo-han.zhang@example.com', role: 'IT 任務負責人／系統管理員' },
  { name: adminAssignee || '待指派', email: adminAssigneeEmail || '尚無公司帳號', role: '行政任務負責人' }
];
if (!accountRoles.some(account => account.role === 'HR 主管')) accountRoles.splice(1, 0, { ...HR_SUPERVISOR, role: 'HR 主管' });

function accountFor(kind) {
  const roleName = kind === 'hr' ? 'HR 負責人' : kind === 'hrSupervisor' ? 'HR 主管' : kind === 'it' ? 'IT 任務負責人／系統管理員' : '行政任務負責人';
  return accountRoles.find(account => account.role === roleName) || { name: '待指派', email: '尚無公司帳號', role: roleName };
}

function applyAccountDirectory() {
  const hrAccount = accountFor('hr');
  const hrSupervisorAccount = accountFor('hrSupervisor');
  const itAccount = accountFor('it');
  const adminAccount = accountFor('admin');
  adminAssignee = adminAccount.name === '待指派' ? '' : adminAccount.name;
  adminAssigneeEmail = adminAccount.email === '尚無公司帳號' ? '' : adminAccount.email;
  people.forEach(person => { person.hr = hrAccount.name; });
  sessionStorage.setItem('onboardingAccountRoles', JSON.stringify(accountRoles));
  sessionStorage.setItem('onboardingAdminAssignee', JSON.stringify({ name: adminAssignee, email: adminAssigneeEmail }));
  sessionStorage.setItem('onboardingPeople', JSON.stringify(people));
  demoUsers.hr.account = hrAccount.email;
  demoUsers.hrSupervisor = { account: hrSupervisorAccount.email, password: 'demo1234' };
  demoUsers.it.account = itAccount.email;
  demoUsers.admin.account = adminAssigneeEmail || 'admin.demo@example.com';
  if (!$('#role').querySelector('option[value="hrSupervisor"]')) $('#role').insertAdjacentHTML('beforeend', '<option value="hrSupervisor">HR 主管</option>');
  if (!$('#loginRole').querySelector('option[value="hrSupervisor"]')) $('#loginRole').insertAdjacentHTML('beforeend', '<option value="hrSupervisor">HR 主管</option>');
  $('#role').querySelector('option[value="hr"]').textContent = `體驗 HR｜${hrAccount.name}`;
  $('#role').querySelector('option[value="hrSupervisor"]').textContent = `體驗 HR 主管｜${hrSupervisorAccount.name}`;
  $('#role').querySelector('option[value="it"]').textContent = `體驗 IT｜${itAccount.name}`;
  $('#role').querySelector('option[value="admin"]').textContent = `體驗行政｜${adminAccount.name}`;
  $('#loginRole').querySelector('option[value="hr"]').textContent = `HR 負責人｜${hrAccount.name}`;
  $('#loginRole').querySelector('option[value="hrSupervisor"]').textContent = `HR 主管｜${hrSupervisorAccount.name}`;
  $('#loginRole').querySelector('option[value="it"]').textContent = `IT 任務負責人｜${itAccount.name}`;
  $('#loginRole').querySelector('option[value="admin"]').textContent = `行政任務負責人｜${adminAccount.name}`;
  if (typeof syncLoginFields === 'function') syncLoginFields();
  if (typeof updateAccountMenu === 'function' && !$('#appHeader').hidden) updateAccountMenu();
}

function renderAccounts() {
  const orderedAccounts = [accountFor('hr'), accountFor('hrSupervisor'), accountFor('it'), accountFor('admin')];
  const signedInRole = $('#role').value;
  $('#accountRows').innerHTML = orderedAccounts.map((account, index) => {
    const canEdit = signedInRole === 'hrSupervisor'
      || (signedInRole === 'hr' && ['IT 任務負責人／系統管理員', '行政任務負責人'].includes(account.role));
    return `<tr><td><b>${esc(account.role)}</b></td><td><input class="input account-name-input" data-index="${index}" value="${esc(account.name)}" aria-label="${esc(account.role)}姓名" ${canEdit ? '' : 'disabled'}></td><td><input class="input account-email-input" data-index="${index}" type="email" value="${esc(account.email)}" aria-label="${esc(account.role)}公司信箱" ${canEdit ? '' : 'disabled'}></td><td>${account.role === 'IT 任務負責人／系統管理員' ? 'IT 建立、停用帳號及管理系統' : 'HR 指定本系統角色'}</td><td>${canEdit ? `<button class="btn secondary save-account" data-index="${index}">儲存</button>` : '僅供查看'}</td></tr>`;
  }).join('');
  document.querySelectorAll('.save-account').forEach(button => button.onclick = () => {
    const index = Number(button.dataset.index);
    const name = document.querySelector(`.account-name-input[data-index="${index}"]`).value.trim();
    const email = document.querySelector(`.account-email-input[data-index="${index}"]`).value.trim();
    if (!name || !email.includes('@')) {
      showSystemToast('請填寫負責人姓名與有效的公司信箱。');
      return;
    }
    orderedAccounts[index].name = name;
    orderedAccounts[index].email = email;
    applyAccountDirectory();
    renderAccounts();
    showSystemToast(`${orderedAccounts[index].role}資料已更新，並同步套用至任務清單與通知對象。`);
  });
}

applyAccountDirectory();

const directoryTaskData = taskData;
taskData = function (type) {
  const data = directoryTaskData(type);
  const account = accountFor(type);
  const label = type === 'hr' ? 'HR 負責人' : type === 'it' ? 'IT 負責人' : '行政負責人';
  data.fields = data.fields.filter(fieldItem => !['HR 負責人', '負責人', 'IT 負責人', '行政負責人'].includes(fieldItem[0]));
  data.fields.push([label, account.name]);
  return data;
};

const directoryOpenPerson = openPerson;
openPerson = function (id) {
  directoryOpenPerson(id);
  const cards = { hr: accountFor('hr'), it: accountFor('it'), admin: accountFor('admin') };
  Object.entries(cards).forEach(([task, account]) => {
    const paragraph = document.querySelector(`.card[data-task="${task}"] p`);
    if (paragraph) paragraph.insertAdjacentHTML('afterbegin', `<b>負責人：${esc(account.name)}</b><br>`);
  });
};

preview = function () {
  const date = $('#nDate').value;
  const dept = $('#nDept').value;
  let items = [];
  if (date && dept) {
    items = [
      `HR ${accountFor('hr').name}：文件準備、報到安排與審核；期限 ${hrDue(date)}`,
      `IT ${accountFor('it').name}：帳號、設備與權限；期限 ${friday(date)} 中午`,
      adminAssignee ? `行政 ${accountFor('admin').name}：座位、門禁、識別證與用品；期限 ${friday(date)} 中午` : '行政部門：目前無有效負責人，建立後將標示通知失敗並通知 HR 指派',
      `${dept}主管${managers[dept]}：僅知會，不追蹤進度`
    ];
  }
  $('#preview').innerHTML = (items.length ? items : ['請先填寫到職日期與所屬部門。']).map(item => `<li>${esc(item)}</li>`).join('');
};

renderNotifications = function () {
  const managerEmails = { '財務部門': 'pei-shan.wu@example.com', '業務部門': 'guan-yu.huang@example.com', '行銷部門': 'yong-ching.chao@example.com', '客服部門': 'tzu-han.chou@example.com' };
  const records = [];
  const groups = people.map(person => {
    const notices = [
      ['HR 任務通知', accountFor('hr').name, accountFor('hr').email, '模擬發送成功'],
      ['IT 任務通知', accountFor('it').name, accountFor('it').email, '模擬發送成功'],
      ['行政任務通知', accountFor('admin').name, accountFor('admin').email, adminAssignee ? '模擬發送成功' : '發送失敗'],
      ['部門主管知會', managers[person.dept], managerEmails[person.dept], '模擬發送成功']
    ];
    records.push(...notices);
    return { person, notices };
  });
  $('#notificationRows').innerHTML = groups.map(({ person, notices }) => {
    const failed = notices.filter(notice => notice[3] === '發送失敗').length;
    const detailId = `notice-detail-${person.id}`;
    const detail = notices.map(notice => `<div class="notice-detail-item"><div><b>${esc(notice[0])}</b></div><div>${esc(notice[1])}<small>${esc(notice[2])}</small></div><div><span class="pill ${notice[3] === '發送失敗' ? 'overdue' : 'progress'}">${esc(notice[3])}</span></div><div>尚無真實寄送時間<small>原型未連接郵件服務</small></div></div>`).join('');
    return `<tr class="notice-person-row"><td><b>${esc(person.name)}</b><small>${esc(person.dept)}｜到職日 ${fmt(person.date)}</small></td><td>${notices.length} 筆通知<small>HR、IT、行政與部門主管</small></td><td><span class="pill ${failed ? 'overdue' : 'done'}">${failed ? `${failed} 筆發送失敗` : '全部模擬發送成功'}</span></td><td><button class="link notice-toggle" data-target="${detailId}" aria-expanded="false">展開通知 <span class="notice-chevron">⌄</span></button></td></tr><tr class="notice-detail-row" id="${detailId}" hidden><td colspan="4"><div class="notice-detail">${detail}</div></td></tr>`;
  }).join('');
  document.querySelectorAll('.notice-toggle').forEach(button => button.onclick = () => {
    const row = $(`#${button.dataset.target}`);
    const opening = row.hidden;
    row.hidden = !opening;
    button.setAttribute('aria-expanded', String(opening));
    button.childNodes[0].nodeValue = opening ? '收合通知 ' : '展開通知 ';
  });
  $('#noticeTotal').textContent = records.length;
  $('#noticeSuccess').textContent = records.filter(record => record[3] !== '發送失敗').length;
  $('#noticeFailed').textContent = records.filter(record => record[3] === '發送失敗').length;
};

const directoryBuildAiDrafts = buildAiDrafts;
buildAiDrafts = function () {
  return directoryBuildAiDrafts().map(draft => {
    const kind = draft.type.startsWith('HR') ? 'hr' : draft.type.startsWith('IT') ? 'it' : draft.type.startsWith('行政') ? 'admin' : '';
    if (!kind) return draft;
    const account = accountFor(kind);
    return { ...draft, to: account.name, email: account.email, body: draft.body.replace(/^[^\n]+您好：/, `${account.name}您好：`) };
  });
};

const directoryUpdateAccountMenu = updateAccountMenu;
updateAccountMenu = function () {
  directoryUpdateAccountMenu();
  const role = $('#role').value;
  const account = accountFor(role);
  $('#accountName').textContent = $('#menuName').textContent = account.name;
};

$('#navAccounts').onclick = () => {
  if (!['hr', 'hrSupervisor'].includes($('#role').value)) return;
  hideAllViews();
  $('#accountsView').hidden = false;
  $('#navAccounts').classList.add('active');
  renderAccounts();
};

function renderCompleted() {
  const completedPeople = people.filter(person => person.status === '已完成');
  const isSupervisor = $('#role').value === 'hrSupervisor';
  $('#completedRows').innerHTML = completedPeople.length ? completedPeople.map(person => `<tr><td><b>${esc(person.name)}</b></td><td>${esc(person.dept)}</td><td>${fmt(person.date)}</td><td>${person.completedAt ? new Date(person.completedAt).toLocaleString('zh-TW') : 'HR 已確認完成'}</td><td><button class="link open-completed" data-id="${person.id}">查看詳情 →</button>${isSupervisor ? ` <button class="btn secondary reopen-completed" data-id="${person.id}">重新開啟</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="5" class="empty">目前沒有已完成流程。</td></tr>';
  document.querySelectorAll('.open-completed').forEach(button => button.onclick = () => openPerson(Number(button.dataset.id)));
  document.querySelectorAll('.reopen-completed').forEach(button => button.onclick = () => {
    $('#reopenPersonId').value = button.dataset.id;
    $('#reopenReason').value = '';
    $('#reopenError').style.display = 'none';
    $('#reopenDialog').showModal();
  });
}

$('#navCompleted').onclick = () => {
  if (!['hr', 'hrSupervisor'].includes($('#role').value)) return;
  hideAllViews();
  $('#completedView').hidden = false;
  $('#navCompleted').classList.add('active');
  renderCompleted();
};

function addOneMonth(iso) {
  const date = new Date(iso);
  date.setMonth(date.getMonth() + 1);
  return date;
}

function addDays(iso, days) {
  const date = new Date(iso);
  date.setDate(date.getDate() + days);
  return date;
}

function cleanExpiredRecycle() {
  recyclePeople = recyclePeople.filter(item => addDays(item.archivedAt, 30) > new Date());
  saveArchiveData();
}

function renderCancelled() {
  $('#cancelledRows').innerHTML = cancelledPeople.length ? cancelledPeople.map(item => `<tr><td><b>${esc(item.person.name)}</b></td><td>${esc(item.person.dept)}</td><td>${fmt(item.person.date)}</td><td><button class="btn secondary confirm-cancel" data-id="${item.person.id}">刪除</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty">目前沒有取消入職紀錄。</td></tr>';
  document.querySelectorAll('.confirm-cancel').forEach(button => button.onclick = () => {
    const index = cancelledPeople.findIndex(item => item.person.id === Number(button.dataset.id));
    const [item] = cancelledPeople.splice(index, 1);
    recyclePeople.unshift({ person: item.person, source: '取消入職', archivedAt: new Date().toISOString() });
    saveArchiveData();
    renderCancelled();
  });
}

function renderRecycle() {
  cleanExpiredRecycle();
  $('#recycleRows').innerHTML = recyclePeople.length ? recyclePeople.map((item, index) => `<tr><td><b>${esc(item.person.name)}</b></td><td>${esc(item.source)}</td><td>${new Date(item.archivedAt).toLocaleString('zh-TW')}</td><td>${new Date(addDays(item.archivedAt, 30)).toLocaleDateString('zh-TW')}</td><td><button class="btn secondary restore-record" data-index="${index}">復原</button></td></tr>`).join('') : '<tr><td colspan="5" class="empty">目前沒有可復原紀錄。</td></tr>';
  document.querySelectorAll('.restore-record').forEach(button => button.onclick = () => {
    const [item] = recyclePeople.splice(Number(button.dataset.index), 1);
    people.unshift(item.person);
    saveArchiveData();
    renderRecycle();
    showSystemToast(`已復原${item.person.name}的流程資料。`);
  });
}

$('#navCancelled').onclick = () => {
  if ($('#role').value !== 'hr') return;
  hideAllViews();
  $('#cancelledView').hidden = false;
  $('#navCancelled').classList.add('active');
  renderCancelled();
};

$('#navRecycle').onclick = () => {
  if ($('#role').value !== 'hr') return;
  hideAllViews();
  $('#recycleView').hidden = false;
  $('#navRecycle').classList.add('active');
  renderRecycle();
};

const originalEditSubmit = $('#editForm').onsubmit;
$('#editForm').onsubmit = event => {
  if ($('#eConfirmed').value !== '否') return originalEditSubmit(event);
  event.preventDefault();
  if ($('#role').value !== 'hr' || !current) return;
  current.name = $('#eName').value.trim();
  current.date = $('#eDate').value;
  current.dept = $('#eDept').value;
  current.type = $('#eType').value;
  current.confirmed = '否';
  current.hr = $('#eHr').value;
  current.equipment = $('#eEquipment').value.trim();
  current.permission = $('#ePermission').value.trim();
  cancelledPeople.unshift({ person: { ...current }, cancelledAt: new Date().toISOString() });
  people = people.filter(person => person.id !== current.id);
  saveArchiveData();
  $('#editDialog').close();
  showPeople();
  showSystemToast('已模擬發送停止任務通知，並移入取消入職紀錄。');
};

/* 僅 HR 可刪除，採兩次確認，刪除後進入「最近刪除」。 */
$('#editBtn').insertAdjacentHTML('afterend', ' <button class="btn secondary" id="deletePersonBtn">刪除流程</button>');
$('#deletePersonBtn').onclick = () => {
  if (!['hr', 'hrSupervisor'].includes($('#role').value) || !current) return;
  if (!confirm(`第一次確認：確定要刪除「${current.name}」的流程嗎？`)) return;
  if (!confirm('第二次確認：刪除後將移入「最近刪除」，是否繼續？')) return;
  recyclePeople.unshift({ person: { ...current }, source: 'HR 手動刪除', archivedAt: new Date().toISOString() });
  people = people.filter(person => person.id !== current.id);
  saveArchiveData();
  showPeople();
  showSystemToast('流程已移入「最近刪除」。');
};

/* 整體完成日起一個月後移入「最近刪除」。 */
const originalSyncOverall = syncOverall;
function hasRecordedTaskActivity(person) {
  const tasks = ['hr', 'it', 'admin'];
  const hasStatus = tasks.some(task => {
    const value = taskStatuses[`${person.id}-${task}`];
    return value === '進行中' || value === '已完成';
  });
  const hasProgress = Object.entries(progress).some(([progressKey, state]) => {
    if (!progressKey.startsWith(`${person.id}-`)) return false;
    return state?.submitted || state?.note || state?.fileNames?.length || state?.checks?.some(Boolean);
  });
  return hasStatus || hasProgress;
}

syncOverall = function () {
  if (!current) return;
  const allCompleted = ['hr', 'it', 'admin'].every(task => statusOf(current.id, task) === '已完成');
  const started = current.notificationsSent === true || hasRecordedTaskActivity(current);
  current.status = allCompleted ? '已完成' : started ? '進行中' : '未開始';
  $('#overallStatus').textContent = `整體流程：${current.status}`;
  $('#overallStatus').className = `pill ${current.status === '已完成' ? 'done' : current.status === '未開始' ? 'waiting' : 'progress'}`;
  if (current.status === '已完成' && !current.completedAt) {
    current.completedAt = new Date().toISOString();
    saveArchiveData();
  }
};

function archiveCompletedProcesses() {
  const now = new Date();
  const archived = people.filter(person => person.completedAt && addOneMonth(person.completedAt) <= now);
  if (!archived.length) return;
  archived.forEach(person => recyclePeople.unshift({ person, source: '流程完成滿一個月', archivedAt: new Date().toISOString() }));
  people = people.filter(person => !archived.includes(person));
  saveArchiveData();
}
archiveCompletedProcesses();

/* 忘記密碼：展示系統僅建立通知 IT 人工處理的流程，不實際重設密碼。 */
const forgotButton = document.createElement('button');
forgotButton.type = 'button';
forgotButton.className = 'link forgot-password';
forgotButton.textContent = '忘記密碼？';
$('#loginPassword').closest('label').after(forgotButton);
document.body.insertAdjacentHTML('beforeend', `<dialog id="forgotDialog"><div class="modal-head"><div><div class="eyebrow">帳號協助</div><h2>忘記密碼</h2></div><button class="btn secondary" id="closeForgot">關閉</button></div><div class="modal-body"><p>系統將模擬通知 IT 人員人工確認與處理，不會在展示版中實際寄信或修改密碼。</p><div class="preview"><h3>帳號管理責任</h3><ul><li>IT：建立、停用公司帳號及管理系統。</li><li>HR：指定公司帳號在本系統中的角色。</li></ul></div><p class="help">正式上線時可考慮導向公司的單一登入密碼重設頁，並要求重新驗證身分；此項目前僅為建議，尚未列入正式規則。</p><div class="actions"><button class="btn primary" id="notifyItPassword">通知 IT 人工處理</button></div><div class="success" id="passwordNotice"></div></div></dialog>`);
forgotButton.onclick = () => $('#forgotDialog').showModal();
$('#closeForgot').onclick = () => $('#forgotDialog').close();
$('#notifyItPassword').onclick = () => {
  $('#passwordNotice').textContent = '已建立模擬通知：請 IT 人員協助確認公司帳號與密碼問題。';
  $('#passwordNotice').style.display = 'block';
};

/* 角色可見性與責任說明。 */
const originalApplyRoleView = applyRoleView;
applyRoleView = function () {
  originalApplyRoleView();
  const isHr = $('#role').value === 'hr';
  $('#navCompleted').style.display = isHr ? '' : 'none';
  $('#navAccounts').style.display = isHr ? '' : 'none';
  $('#navCancelled').style.display = isHr ? '' : 'none';
  $('#navRecycle').style.display = isHr ? '' : 'none';
  $('#deletePersonBtn').style.display = isHr ? '' : 'none';
  if (!isHr && (!$('#accountsView').hidden || !$('#cancelledView').hidden || !$('#recycleView').hidden)) showPeople();
};

const originalShowPeople = showPeople;
showPeople = function () {
  $('#completedView').hidden = true;
  $('#accountsView').hidden = true;
  $('#cancelledView').hidden = true;
  $('#recycleView').hidden = true;
  document.querySelectorAll('.nav-btn').forEach(button => button.classList.remove('active'));
  originalShowPeople();
};
$('#navPeople').onclick = showPeople;

const originalNotificationClick = $('#navNotifications').onclick;
$('#navNotifications').onclick = () => {
  $('#completedView').hidden = true;
  $('#accountsView').hidden = true;
  $('#cancelledView').hidden = true;
  $('#recycleView').hidden = true;
  document.querySelectorAll('.nav-btn').forEach(button => button.classList.remove('active'));
  originalNotificationClick();
};

/* 左側主選單為互斥選取；任何點擊都先清除其他選取狀態。 */
sidebar.addEventListener('click', event => {
  const selected = event.target.closest('.nav-btn');
  if (!selected) return;
  document.querySelectorAll('.nav-btn').forEach(button => {
    button.classList.remove('active');
    button.removeAttribute('aria-current');
  });
  selected.classList.add('active');
  selected.setAttribute('aria-current', 'page');
}, true);

/* 模擬逾期通知：每日提醒負責人、主管與 HR；HR 任務提醒 HR 及 HR 主管。 */
function dueDateAtNoon(person, task) {
  const text = task === 'hr' ? hrDue(person.date) : `${friday(person.date)} 中午前`;
  const matched = text.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  return matched ? new Date(`${matched[1]}-${matched[2]}-${matched[3]}T12:00:00`) : null;
}

const originalRenderNotifications = renderNotifications;
renderNotifications = function () {
  originalRenderNotifications();
  const overdue = [];
  for (const person of people) {
    for (const task of ['hr', 'it', 'admin']) {
      const due = dueDateAtNoon(person, task);
      if (!due || new Date() <= due || statusOf(person.id, task) === '已完成') continue;
      const recipients = task === 'hr'
        ? `${accountFor('hr').name}、HR 主管${HR_SUPERVISOR.name}`
        : task === 'it'
          ? `${accountFor('it').name}、IT 主管${IT_SUPERVISOR.name}、HR ${accountFor('hr').name}`
          : `${accountFor('admin').name}、行政主管${ADMIN_SUPERVISOR.name}、HR ${accountFor('hr').name}`;
      overdue.push(`${person.name}｜${task.toUpperCase()} 任務｜每日模擬通知：${recipients}`);
    }
  }
  if (overdue.length) {
    const box = document.createElement('div');
    box.className = 'notice overdue-notice';
    box.innerHTML = `<div>!</div><div><strong>逾期每日通知（模擬）</strong>${overdue.map(esc).join('<br>')}</div>`;
    $('#notificationView .notify-summary').before(box);
  }
};

/* 系統異常的判定先以可驗證事件呈現，不將人工刪除直接視為異常。 */
const anomalyInfo = document.createElement('div');
anomalyInfo.className = 'preview';
anomalyInfo.innerHTML = '<h3>刪除異常監控（展示規則）</h3><ul><li>未經 HR 二次確認即出現刪除紀錄。</li><li>非 HR 身分觸發刪除。</li><li>30 日屆滿前資料被永久清除。</li><li>復原後出現資料缺漏或任務對應錯誤。</li><li>同一筆資料短時間重複刪除或復原。</li></ul><p class="help">一般人工誤刪仍視為刪除行為，可由「最近刪除」處理；偵測到上述情況時才標示「系統異常」並通知 IT 人工處理。</p>';
$('#recycleView .toolbar').after(anomalyInfo);

applyRoleView();

/* 儀表板摘要：僅根據既有流程與任務狀態計算，不新增業務規則。 */
function dashboardRoleInfo() {
  const role = $('#role').value;
  if (role === 'hr') return { name: accountFor('hr').name, label: 'HR 入職流程總覽' };
  if (role === 'hrSupervisor') return { name: accountFor('hrSupervisor').name, label: 'HR 主管監督總覽' };
  if (role === 'it') return { name: accountFor('it').name, label: 'IT 任務總覽' };
  return { name: accountFor('admin').name, label: '行政任務總覽' };
}

function renderDashboardOverview() {
  const listView = $('#listView');
  if (!listView) return;
  let overview = $('#dashboardOverview');
  if (!overview) {
    overview = document.createElement('section');
    overview.id = 'dashboardOverview';
    overview.className = 'dashboard-overview';
    listView.querySelector('.toolbar').after(overview);
  }
  const role = $('#role').value;
  const info = dashboardRoleInfo();
  const completed = people.filter(person => person.status === '已完成').length;
  const inProgress = people.filter(person => person.status === '進行中').length;
  const pending = people.filter(person => statusOf(person.id, role) !== '已完成').length;
  const hrView = ['hr', 'hrSupervisor'].includes(role);
  overview.innerHTML = `<article class="overview-welcome"><small>${esc(info.label)}</small><h2>歡迎回來，${esc(info.name)}</h2><p>在同一個頁面掌握新人資料、任務進度與待處理事項。</p></article><article class="overview-metric"><span>目前流程</span><b>${people.length}</b><em>系統中的新人流程</em></article><article class="overview-metric"><span>進行中</span><b>${inProgress}</b><em>尚在處理的流程</em></article><article class="overview-metric"><span>${hrView ? '已完成' : '我的待處理'}</span><b>${hrView ? completed : pending}</b><em>${hrView ? '整體流程完成' : '所屬任務未完成'}</em></article>`;
}

const themedRenderList = renderList;
renderList = function () {
  themedRenderList();
  renderDashboardOverview();
};
renderDashboardOverview();

/* 系統名稱獨立固定於系統外框；左側欄僅保留選單與收合操作。 */
function setupCollapsibleSidebar() {
  const shell = $('#appShell');
  const sidebar = document.querySelector('.sidebar');
  const brand = document.querySelector('#appHeader .brand');
  const account = document.querySelector('#appHeader .account');
  if (!shell || !sidebar || !brand || !account || $('.side-header')) return;

  const sideHeader = document.createElement('div');
  sideHeader.className = 'side-header';
  const collapseButton = document.createElement('button');
  collapseButton.type = 'button';
  collapseButton.className = 'sidebar-collapse';
  collapseButton.setAttribute('aria-label', '收合側邊欄');
  collapseButton.title = '收合側邊欄';
  collapseButton.textContent = '‹';
  brand.classList.add('shell-brand');
  sideHeader.append(collapseButton);
  sidebar.prepend(sideHeader);
  const topbar = document.createElement('div');
  topbar.className = 'shell-topbar';
  topbar.append(brand, account);
  shell.prepend(topbar);

  const savedState = sessionStorage.getItem('onboardingSidebarCollapsed') === '1';
  shell.classList.toggle('sidebar-collapsed', savedState);
  collapseButton.setAttribute('aria-expanded', String(!savedState));
  collapseButton.setAttribute('aria-label', savedState ? '展開側邊欄' : '收合側邊欄');
  collapseButton.title = savedState ? '展開側邊欄' : '收合側邊欄';

  collapseButton.onclick = () => {
    const collapsed = shell.classList.toggle('sidebar-collapsed');
    sessionStorage.setItem('onboardingSidebarCollapsed', collapsed ? '1' : '0');
    collapseButton.setAttribute('aria-expanded', String(!collapsed));
    collapseButton.setAttribute('aria-label', collapsed ? '展開側邊欄' : '收合側邊欄');
    collapseButton.title = collapsed ? '展開側邊欄' : '收合側邊欄';
  };
}

setupCollapsibleSidebar();

/* 建立資料與發送通知分開記錄；只有通知成功後流程才會啟動。 */
function normalizeNotificationState() {
  let changed = false;
  people.forEach(person => {
    if (person.status === '已完成') {
      if (person.notificationsSent !== true) {
        person.notificationsSent = true;
        changed = true;
      }
      return;
    }
    const hasActivity = hasRecordedTaskActivity(person);
    if (hasActivity && person.notificationsSent !== true) {
      person.notificationsSent = true;
      person.status = '進行中';
      changed = true;
      return;
    }
    if (!hasActivity && person.notificationsSent !== true && person.status !== '未開始') {
      person.status = '未開始';
      changed = true;
    }
  });
  if (changed) sessionStorage.setItem('onboardingPeople', JSON.stringify(people));
}

const originalMockSend = $('#confirmMockSend').onclick;
$('#confirmMockSend').onclick = event => {
  originalMockSend(event);
  if (!current) return;
  current.notificationsSent = true;
  current.notificationSentAt = new Date().toISOString();
  current.status = '進行中';
  sessionStorage.setItem('onboardingPeople', JSON.stringify(people));
  syncOverall();
  renderList();
};

const originalAddFormSubmit = $('#addForm').onsubmit;
$('#addForm').onsubmit = event => {
  const beforeCount = people.length;
  originalAddFormSubmit(event);
  if (people.length <= beforeCount) return;
  const created = people[0];
  created.notificationsSent = true;
  created.notificationSentAt = new Date().toISOString();
  created.status = '進行中';
  sessionStorage.setItem('onboardingPeople', JSON.stringify(people));
  if (current?.id === created.id) syncOverall();
  renderList();
};

normalizeNotificationState();
renderList();
if (current) syncOverall();

/* 已完成流程自首頁移出，保留在 HR 的暫存頁至完成滿一個月。 */
renderList = function () {
  const query = $('#search').value.trim();
  const filter = $('#filter').value;
  const activePeople = people.filter(person => person.status !== '已完成' && (!query || (person.name + person.dept).includes(query)) && (!filter || person.status === filter));
  $('#rows').innerHTML = activePeople.map(person => `<tr><td><b>${esc(person.name)}</b></td><td>${esc(person.dept)}</td><td>${fmt(person.date)}</td><td>${esc(person.type)}</td><td><span class="pill ${statusClass(person.status)}">${esc(person.status)}</span></td><td><button class="link open" data-id="${person.id}">查看詳情 →</button></td></tr>`).join('');
  $('#empty').hidden = Boolean(activePeople.length);
  document.querySelectorAll('.open').forEach(button => button.onclick = () => openPerson(Number(button.dataset.id)));
  renderDashboardOverview();
};

/* 角色通知中心：新人任務、HR 退回、部門送審與整體完成。 */
let systemNotifications = JSON.parse(sessionStorage.getItem('onboardingSystemNotifications') || '[]');

function pushSystemNotification(targetRole, title, message, notificationKey) {
  if (notificationKey && systemNotifications.some(item => item.key === notificationKey)) return;
  systemNotifications.unshift({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    key: notificationKey || '',
    targetRole,
    title,
    message,
    createdAt: new Date().toISOString(),
    readBy: []
  });
  sessionStorage.setItem('onboardingSystemNotifications', JSON.stringify(systemNotifications));
  renderNotificationBell();
}

const accountBlock = document.querySelector('.app-shell .shell-topbar > .account');
const notificationCenter = document.createElement('div');
notificationCenter.className = 'notification-center';
notificationCenter.innerHTML = `<button type="button" class="notification-bell" id="notificationBell" aria-label="開啟通知" aria-expanded="false"><span aria-hidden="true">♢</span><i id="notificationUnreadDot" hidden></i></button><section class="notification-popover" id="notificationPopover" hidden><div class="notification-popover-head"><div><small>通知中心</small><h3>待處理通知</h3></div><button type="button" class="link" id="closeNotificationPopover">關閉</button></div><div id="systemNotificationList"></div></section>`;
accountBlock.before(notificationCenter);

function roleNotifications() {
  const role = $('#role').value;
  return systemNotifications.filter(item => item.targetRole === role);
}

function renderNotificationBell() {
  const role = $('#role').value;
  const items = roleNotifications();
  const unread = items.filter(item => !item.readBy.includes(role));
  $('#notificationUnreadDot').hidden = unread.length === 0;
  $('#notificationBell').setAttribute('aria-label', unread.length ? `開啟通知，${unread.length} 則未讀` : '開啟通知');
  $('#systemNotificationList').innerHTML = items.length ? items.map(item => `<article class="system-notification ${item.readBy.includes(role) ? '' : 'unread'}"><div class="notification-item-dot"></div><div><b>${esc(item.title)}</b><p>${esc(item.message)}</p><time>${new Date(item.createdAt).toLocaleString('zh-TW')}</time></div></article>`).join('') : '<p class="empty">目前沒有通知。</p>';
}

function openNotificationCenter() {
  const popover = $('#notificationPopover');
  const opening = popover.hidden;
  popover.hidden = !opening;
  $('#notificationBell').setAttribute('aria-expanded', String(opening));
  if (!opening) return;
  const role = $('#role').value;
  systemNotifications.forEach(item => {
    if (item.targetRole === role && !item.readBy.includes(role)) item.readBy.push(role);
  });
  sessionStorage.setItem('onboardingSystemNotifications', JSON.stringify(systemNotifications));
  renderNotificationBell();
}

$('#notificationBell').onclick = event => { event.stopPropagation(); openNotificationCenter(); };
$('#closeNotificationPopover').onclick = event => { event.stopPropagation(); $('#notificationPopover').hidden = true; $('#notificationBell').setAttribute('aria-expanded', 'false'); };
notificationCenter.onclick = event => event.stopPropagation();
document.addEventListener('click', () => { $('#notificationPopover').hidden = true; $('#notificationBell').setAttribute('aria-expanded', 'false'); });

const notificationApplyRoleView = applyRoleView;
applyRoleView = function () {
  notificationApplyRoleView();
  $('#notificationPopover').hidden = true;
  renderNotificationBell();
};

const notificationSyncOverall = syncOverall;
syncOverall = function () {
  const wasCompleted = current?.status === '已完成';
  notificationSyncOverall();
  if (!current || current.status !== '已完成' || wasCompleted || current.completionNotificationSent) return;
  current.completionNotificationSent = true;
  sessionStorage.setItem('onboardingPeople', JSON.stringify(people));
  pushSystemNotification('it', '新人入職流程已完成', `${current.name}的新人入職流程已由 HR 確認完成。`, `completed-${current.id}-it`);
  pushSystemNotification('admin', '新人入職流程已完成', `${current.name}的新人入職流程已由 HR 確認完成。`, `completed-${current.id}-admin`);
};

const notificationMockSend = $('#confirmMockSend').onclick;
$('#confirmMockSend').onclick = event => {
  notificationMockSend(event);
  if (!current) return;
  pushSystemNotification('it', '新的新人入職任務', `${current.name}將於${fmt(current.date)}到職，請查看 IT 任務。`, `new-person-${current.id}-it`);
  pushSystemNotification('admin', '新的新人入職任務', `${current.name}將於${fmt(current.date)}到職，請查看行政任務。`, `new-person-${current.id}-admin`);
};

const notificationAddSubmit = $('#addForm').onsubmit;
$('#addForm').onsubmit = event => {
  const existingIds = new Set(people.map(person => person.id));
  notificationAddSubmit(event);
  const created = people.find(person => !existingIds.has(person.id));
  if (!created) return;
  pushSystemNotification('it', '新的新人入職任務', `${created.name}將於${fmt(created.date)}到職，請查看 IT 任務。`, `new-person-${created.id}-it`);
  pushSystemNotification('admin', '新的新人入職任務', `${created.name}將於${fmt(created.date)}到職，請查看行政任務。`, `new-person-${created.id}-admin`);
};

const notificationReject = $('#rejectBtn').onclick;
$('#rejectBtn').onclick = async event => {
  const rejectedTask = activeTask;
  const rejectedPerson = current;
  const reason = $('#rejectReason').value.trim();
  await notificationReject(event);
  if (!reason || !rejectedPerson || !['it', 'admin'].includes(rejectedTask)) return;
  pushSystemNotification(rejectedTask, 'HR 退回任務', `${rejectedPerson.name}的${rejectedTask === 'it' ? 'IT' : '行政'}任務需修改：${reason}`, `rejected-${rejectedPerson.id}-${rejectedTask}-${Date.now()}`);
};

/* 固定範例亦視為已建立任務，便於展示未讀通知。 */
people.filter(person => person.notificationsSent).forEach(person => {
  pushSystemNotification('it', '新的新人入職任務', `${person.name}將於${fmt(person.date)}到職，請查看 IT 任務。`, `new-person-${person.id}-it`);
  pushSystemNotification('admin', '新的新人入職任務', `${person.name}將於${fmt(person.date)}到職，請查看行政任務。`, `new-person-${person.id}-admin`);
});

renderList();
renderNotificationBell();

/* HR 主管：監督 HR 任務、查看全流程、管理 HR 負責人與重新開啟完成流程。 */
const supervisorCanOpen = canOpen;
canOpen = function (task) {
  return $('#role').value === 'hrSupervisor' || supervisorCanOpen(task);
};

document.body.insertAdjacentHTML('beforeend', `<dialog id="reopenDialog"><div class="modal-head"><div><div class="eyebrow">HR 主管權限</div><h2>重新開啟已完成流程</h2></div><button class="btn secondary" data-close-supervisor="reopenDialog">關閉</button></div><div class="modal-body"><input type="hidden" id="reopenPersonId"><label class="form-field">重新開啟原因 *<textarea id="reopenReason" placeholder="請說明需要重新處理的原因"></textarea></label><div class="error" id="reopenError"></div><div class="actions"><button class="btn primary" id="confirmReopen">確認重新開啟</button></div></div></dialog>`);
document.querySelectorAll('[data-close-supervisor]').forEach(button => button.onclick = () => $(`#${button.dataset.closeSupervisor}`).close());
$('#confirmReopen').onclick = () => {
  if ($('#role').value !== 'hrSupervisor') return;
  const reason = $('#reopenReason').value.trim();
  const person = people.find(item => item.id === Number($('#reopenPersonId').value));
  if (!reason || !person) {
    $('#reopenError').textContent = '請填寫重新開啟原因。';
    $('#reopenError').style.display = 'block';
    return;
  }
  person.status = '進行中';
  delete person.completedAt;
  delete person.completionNotificationSent;
  taskStatuses[`${person.id}-hr`] = '進行中';
  sessionStorage.setItem('onboardingTaskStatuses', JSON.stringify(taskStatuses));
  sessionStorage.setItem('onboardingPeople', JSON.stringify(people));
  pushSystemNotification('hr', 'HR 主管重新開啟流程', `${person.name}的流程已重新開啟：${reason}`, `reopen-${person.id}-${Date.now()}`);
  $('#reopenDialog').close();
  renderCompleted();
  showSystemToast('流程已重新開啟，並通知 HR 負責人。');
};

const supervisorOpenTask = openTask;
openTask = async function (task) {
  await supervisorOpenTask(task);
  const role = $('#role').value;
  if (role === 'hr') {
    $('#hrReview h3').textContent = 'HR 任務狀態審核';
    $('#hrReview .help').textContent = '僅 HR 可修改；確認佐證資料後再設為「已完成」。';
    if (task === 'hr') $('#hrReview').style.display = 'none';
  }
  if (role !== 'hrSupervisor') return;
  const state = progress[key()] || {};
  $('#workArea').style.display = 'none';
  $('#assignBox').style.display = 'none';
  $('#taskItems').innerHTML = taskData(task).items.map((item, index) => `<li>${state.checks?.[index] ? '✓' : '○'} ${esc(item)}</li>`).join('');
  const files = await loadEvidenceFiles(key());
  const fileHtml = files.length
    ? files.map((file, index) => `<a class="link supervisor-evidence-link" data-index="${index}" href="#">開啟 ${esc(file.name)}</a>`).join('<br>')
    : state.fileNames?.length
      ? `${state.fileNames.map(esc).join('、')}（舊紀錄僅保存檔名，請負責人重新上傳）`
      : '尚未上傳';
  $('#evidenceSummary').style.display = 'block';
  $('#evidenceSummary').innerHTML = `<h3>任務提交內容</h3><p><b>送審狀態：</b>${state.submitted ? '已送出審核' : '尚未送審'}</p><p><b>佐證檔案：</b><br>${fileHtml}</p><p><b>備註：</b>${state.note ? esc(state.note) : '尚未填寫'}</p>`;
  document.querySelectorAll('.supervisor-evidence-link').forEach(link => {
    link.onclick = event => {
      event.preventDefault();
      const file = files[Number(link.dataset.index)];
      if (!file?.blob) return;
      window.open(URL.createObjectURL(file.blob), '_blank');
    };
  });
  $('#hrReview').style.display = 'block';
  $('#hrReview h3').textContent = task === 'hr' ? 'HR 主管審核 HR 任務狀態' : `HR 主管審核 ${task === 'it' ? 'IT' : '行政'}任務狀態`;
  $('#hrReview .help').textContent = task === 'hr'
    ? '確認 HR 任務進度與佐證後，可修改任務狀態。'
    : '權限與 HR 負責人相同：可修改任務狀態、審核完成或退回修改。';
};

const supervisorReview = $('#reviewBtn').onclick;
$('#reviewBtn').onclick = () => {
  const role = $('#role').value;
  if (role === 'hrSupervisor') {
    taskStatuses[key()] = $('#reviewStatus').value;
    sessionStorage.setItem('onboardingTaskStatuses', JSON.stringify(taskStatuses));
    $('#taskDialog').close();
    openPerson(current.id);
    return;
  }
  if (role === 'hr' && activeTask === 'hr') return;
  supervisorReview();
};

$('#hrReview').insertAdjacentHTML('beforeend', `<div class="supervisor-anomaly" style="display:none;margin-top:16px"><label class="form-field">任務異常說明 *<textarea id="supervisorAnomalyReason" placeholder="請說明 HR 任務的異常或遺漏"></textarea></label><button class="btn secondary" id="sendSupervisorAnomaly" style="margin-top:10px">標記異常並通知 HR</button><div class="error" id="supervisorAnomalyError"></div></div>`);
const supervisorOpenTaskWithAnomaly = openTask;
openTask = async function (task) {
  await supervisorOpenTaskWithAnomaly(task);
  $('.supervisor-anomaly').style.display = $('#role').value === 'hrSupervisor' && task === 'hr' ? 'block' : 'none';
  $('#supervisorAnomalyReason').value = '';
  $('#supervisorAnomalyError').style.display = 'none';
};
$('#sendSupervisorAnomaly').onclick = () => {
  if ($('#role').value !== 'hrSupervisor' || activeTask !== 'hr' || !current) return;
  const reason = $('#supervisorAnomalyReason').value.trim();
  if (!reason) {
    $('#supervisorAnomalyError').textContent = '請先填寫任務異常說明。';
    $('#supervisorAnomalyError').style.display = 'block';
    return;
  }
  pushSystemNotification('hr', 'HR 主管任務異常提醒', `${current.name}的 HR 任務需要確認：${reason}`, `hr-anomaly-${current.id}-${Date.now()}`);
  pushSystemNotification('hrSupervisor', 'HR 任務異常紀錄', `${current.name}的 HR 任務已標記異常：${reason}`, `hr-anomaly-supervisor-${current.id}-${Date.now()}`);
  $('#taskDialog').close();
  showSystemToast('已標記異常，HR 與 HR 主管皆已收到通知。');
};

const supervisorApplyRoleView = applyRoleView;
applyRoleView = function () {
  supervisorApplyRoleView();
  const privileged = ['hr', 'hrSupervisor'].includes($('#role').value);
  $('#navNotifications').style.display = privileged ? '' : 'none';
  $('#navCompleted').style.display = privileged ? '' : 'none';
  $('#navAccounts').style.display = privileged ? '' : 'none';
  $('#navCancelled').style.display = privileged ? '' : 'none';
  $('#navRecycle').style.display = privileged ? '' : 'none';
  $('#editBtn').style.display = privileged ? '' : 'none';
  $('#deletePersonBtn').style.display = privileged ? '' : 'none';
  if (current) bindCards();
};

const supervisorAccountMenu = updateAccountMenu;
updateAccountMenu = function () {
  if ($('#role').value !== 'hrSupervisor') return supervisorAccountMenu();
  const account = accountFor('hrSupervisor');
  $('#accountName').textContent = $('#menuName').textContent = account.name;
  $('#accountRole').textContent = 'HR 主管';
  $('#menuRole').textContent = 'HR 主管｜人力資源部';
  $('#roleActions').innerHTML = '<button class="menu-action" id="menuNotices">查看通知紀錄</button><button class="menu-action" id="menuCompleted">查看已完成流程</button><button class="menu-action menu-logout" id="menuLogout">登出</button>';
  $('#menuNotices').onclick = () => { $('#accountMenu').hidden = true; $('#navNotifications').click(); };
  $('#menuCompleted').onclick = () => { $('#accountMenu').hidden = true; $('#navCompleted').click(); };
  $('#menuLogout').onclick = logoutDemo;
};

$('#navNotifications').onclick = () => {
  if (!['hr', 'hrSupervisor'].includes($('#role').value)) return;
  hideAllViews();
  $('#notificationView').hidden = false;
  $('#navNotifications').classList.add('active');
  renderNotifications();
};

$('#navCancelled').onclick = () => {
  if (!['hr', 'hrSupervisor'].includes($('#role').value)) return;
  hideAllViews();
  $('#cancelledView').hidden = false;
  $('#navCancelled').classList.add('active');
  renderCancelled();
};
$('#navRecycle').onclick = () => {
  if (!['hr', 'hrSupervisor'].includes($('#role').value)) return;
  hideAllViews();
  $('#recycleView').hidden = false;
  $('#navRecycle').classList.add('active');
  renderRecycle();
};

const supervisorEditClick = $('#editBtn').onclick;
$('#editBtn').onclick = () => {
  if ($('#role').value !== 'hrSupervisor') return supervisorEditClick();
  if (!current) return;
  $('#eName').value = current.name;
  $('#eDate').value = current.date;
  $('#eDept').value = current.dept;
  $('#eType').value = current.type;
  $('#eConfirmed').value = current.confirmed;
  $('#eHr').value = current.hr;
  $('#eEquipment').value = current.equipment || '';
  $('#ePermission').value = current.permission || '';
  $('#editDialog').showModal();
};
const supervisorEditSubmit = $('#editForm').onsubmit;
$('#editForm').onsubmit = event => {
  if ($('#role').value !== 'hrSupervisor') return supervisorEditSubmit(event);
  event.preventDefault();
  if (!current) return;
  current.name = $('#eName').value.trim();
  current.date = $('#eDate').value;
  current.dept = $('#eDept').value;
  current.type = $('#eType').value;
  current.confirmed = $('#eConfirmed').value;
  current.hr = accountFor('hr').name;
  current.equipment = $('#eEquipment').value.trim();
  current.permission = $('#ePermission').value.trim();
  sessionStorage.setItem('onboardingPeople', JSON.stringify(people));
  $('#editDialog').close();
  openPerson(current.id);
  showSystemToast('新人基本資料已由 HR 主管更新。');
};

/* HR 完成自身任務送審時，通知 HR 主管進行最終審核。 */
const supervisorSubmit = $('#submitBtn').onclick;
$('#submitBtn').onclick = async event => {
  const submittedTask = activeTask;
  const submittedPerson = current;
  await supervisorSubmit(event);
  if (submittedTask === 'hr' && submittedPerson && progress[`${submittedPerson.id}-hr`]?.submitted) {
    pushSystemNotification('hrSupervisor', 'HR 任務等待主管審核', `${submittedPerson.name}的 HR 任務已送審，請檢查流程進度與佐證。`, `hr-review-${submittedPerson.id}-${Date.now()}`);
  }
};

people.forEach(person => {
  const due = dueDateAtNoon(person, 'hr');
  if (!due || new Date() <= due || statusOf(person.id, 'hr') === '已完成') return;
  const message = `${person.name}的 HR 任務已逾期，請確認進度與遺漏事項。`;
  pushSystemNotification('hr', 'HR 任務逾期提醒', message, `hr-overdue-${person.id}-hr`);
  pushSystemNotification('hrSupervisor', 'HR 任務逾期監督', message, `hr-overdue-${person.id}-supervisor`);
});

applyRoleView();
renderNotificationBell();
