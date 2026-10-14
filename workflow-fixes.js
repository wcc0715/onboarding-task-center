/* Negative-UAT fixes, loaded after stage2.js. All data and notifications remain local simulations. */
const workflowRules = window.WorkflowRules;
const taskAudit = JSON.parse(sessionStorage.getItem('onboardingTaskAudit') || '[]');
const deliveryHistory = JSON.parse(sessionStorage.getItem('onboardingDeliveryHistory') || '[]');
let workflowBusy = false;

function livePerson(person = current) {
  return !!person && people.some(item => item.id === person.id && item.confirmed === '是');
}
function workflowError(message, container = $('#taskMessage')) {
  container.textContent = message;
  container.className = 'error';
  container.style.display = 'block';
  container.setAttribute('role', 'alert');
}
function auditTask(action, reason = '') {
  taskAudit.push({ personId: current.id, task: activeTask, role: $('#role').value, action, reason, at: new Date().toISOString() });
  sessionStorage.setItem('onboardingTaskAudit', JSON.stringify(taskAudit));
}
function persistWorkflow() {
  syncOverall();
  sessionStorage.setItem('onboardingTaskProgress', JSON.stringify(progress));
  sessionStorage.setItem('onboardingTaskStatuses', JSON.stringify(taskStatuses));
  sessionStorage.setItem('onboardingPeople', JSON.stringify(people));
  renderList();
}
function reviewerError(message) { workflowError(message, $('#reviewError')); }
$('#reviewBtn').after(Object.assign(document.createElement('div'), { id: 'reviewError', className: 'error' }));
$('#assignBtn').before(Object.assign(document.createElement('div'), { id: 'assignError', className: 'error' }));
$('#editForm .actions').before(Object.assign(document.createElement('div'), { id: 'editError', className: 'error' }));
$('#workArea > label b').textContent = '佐證資料上傳 *';
$('#note').closest('label').querySelector('b').textContent = '備註 *';

async function fileContentError(files) {
  const metadataError = evidenceError(files);
  if (metadataError) return metadataError;
  for (const file of files) {
    const blob = file.blob || file;
    if (!blob.size) return `「${file.name}」是空檔案，請重新上傳。`;
    const bytes = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    const ext = file.name.split('.').pop().toLowerCase();
    const starts = signature => signature.every((byte, i) => bytes[i] === byte);
    const valid = ext === 'png' ? starts([137,80,78,71,13,10,26,10])
      : ext === 'pdf' ? starts([37,80,68,70,45])
      : ext === 'doc' ? starts([208,207,17,224,161,177,26,225])
      : ext === 'docx' ? starts([80,75,3,4]) : false;
    if (!valid) return `「${file.name}」內容與檔案格式不符，請使用有效的 PNG、PDF 或 Word 文件。`;
    if (ext === 'png') {
      try { const bitmap = await createImageBitmap(blob); bitmap.close(); }
      catch { return `「${file.name}」無法讀取為 PNG 圖片，請重新上傳。`; }
    }
  }
  return '';
}
function storedFileDescriptors(files) {
  return files.map(file => ({ name: file.name, size: file.blob?.size || 0, blob: file.blob }));
}
async function submissionMissing(state, task, files) {
  const missing = workflowRules.completeness(state, taskData(task).items.length, files);
  if (task === 'hr' && !['it', 'admin'].every(type => statusOf(current.id, type) === '已完成')) missing.push('完成 IT 與行政任務審核');
  return missing;
}
async function withWorkflowLock(action) {
  if (workflowBusy) return;
  workflowBusy = true;
  const controls = [...document.querySelectorAll('#taskDialog button, #taskDialog input, #taskDialog textarea, #taskDialog select')];
  const previous = controls.map(control => control.disabled);
  controls.forEach(control => { control.disabled = true; });
  try { await action(); }
  catch (error) { workflowError('資料無法讀取或儲存，請重新選擇附件後再試。'); console.error(error); }
  finally { workflowBusy = false; controls.forEach((control, i) => { control.disabled = previous[i]; }); }
}
$('#taskDialog').addEventListener('cancel', event => { if (workflowBusy) event.preventDefault(); });

async function saveOrSubmit(submitted) {
  if (!workflowRules.canWork($('#role').value, activeTask, livePerson())) return workflowError('目前角色無權操作，或入職流程已停止。');
  const taskKey = key();
  const old = progress[taskKey] || {};
  if (old.submitted || statusOf(current.id, activeTask) === '已完成') return workflowError('此任務已送審或完成，請等待審核；需要修改時請由審核者退回。');
  const selected = [...fileInput.files];
  const files = selected.length ? selected : storedFileDescriptors(await loadEvidenceFiles(taskKey));
  const state = { ...old, checks: [...document.querySelectorAll('#taskItems input')].map(input => input.checked), note: $('#note').value.trim(), submitted };
  const formatError = await fileContentError(files);
  if (formatError) return workflowError(formatError);
  if (submitted) {
    const missing = await submissionMissing(state, activeTask, files);
    if (missing.length) return workflowError(`送出前請先：${missing.join('、')}。`);
  }
  if (!livePerson()) return workflowError('入職流程已停止，不能儲存或送審。');
  if (selected.length) await saveEvidenceFiles(taskKey, selected);
  state.fileNames = files.map(file => file.name);
  state.rejected = false;
  delete state.rejectionReason;
  if (submitted) state.submissionVersion = (old.submissionVersion || 0) + 1;
  progress[taskKey] = state;
  taskStatuses[taskKey] = '進行中';
  persistWorkflow();
  auditTask(submitted ? '送審' : '儲存草稿');
  if (submitted) {
    const target = activeTask === 'hr' ? 'hrSupervisor' : 'hr';
    pushSystemNotification(target, '任務已送審', `${current.name}的${taskData(activeTask).title}等待審核。`, `submission-${taskKey}-v${state.submissionVersion}`);
  }
  returnToSystemHome(submitted ? '任務已送審，待審期間內容已鎖定。' : '任務草稿已儲存，尚未送審。');
}
$('#submitBtn').onclick = () => withWorkflowLock(() => saveOrSubmit(true));
$('#saveBtn').onclick = () => withWorkflowLock(() => saveOrSubmit(false));

$('#reviewBtn').onclick = () => withWorkflowLock(async () => {
  if (!workflowRules.canReview($('#role').value, activeTask, livePerson())) return reviewerError('目前角色無審核權限，或流程已停止。');
  const to = $('#reviewStatus').value;
  const transitionError = workflowRules.transitionError(statusOf(current.id, activeTask), to);
  if (transitionError) return reviewerError(transitionError);
  if (to === '已完成') {
    const state = progress[key()] || {};
    const files = storedFileDescriptors(await loadEvidenceFiles(key()));
    const missing = await submissionMissing(state, activeTask, files);
    if (!state.submitted) missing.unshift('由負責人送出審核');
    if (missing.length) return reviewerError(`無法核准：請先${missing.join('、')}。`);
    const error = await fileContentError(files);
    if (error) return reviewerError(error);
  }
  if (!livePerson()) return reviewerError('流程已停止。');
  taskStatuses[key()] = to;
  auditTask(`狀態更新：${to}`);
  persistWorkflow();
  $('#taskDialog').close();
  openPerson(current.id);
});

$('#rejectBtn').onclick = () => withWorkflowLock(async () => {
  if (!workflowRules.canReview($('#role').value, activeTask, livePerson())) return reviewerError('目前角色無退回權限，或流程已停止。');
  const reason = $('#rejectReason').value.trim();
  if (!reason) return workflowError('請先填寫退回原因。', $('#rejectError'));
  const state = progress[key()] || {};
  if (!state.submitted && statusOf(current.id, activeTask) !== '已完成') return reviewerError('任務尚未送審，不能退回。');
  await deleteEvidenceFiles(key());
  progress[key()] = { ...state, submitted: false, rejected: true, rejectionReason: reason, checks: [], fileNames: [], note: '' };
  taskStatuses[key()] = '進行中';
  delete current.completedAt;
  delete current.completionNotificationSent;
  auditTask('退回修改', reason);
  persistWorkflow();
  pushSystemNotification(activeTask, '任務退回修改', `${current.name}：${reason}`, `rejected-${key()}-v${state.submissionVersion || 0}`);
  $('#taskDialog').close();
  openPerson(current.id);
  showSystemToast('已退回並保留退回原因，請負責人重新補件。');
});

const fixedOpenTaskBase = openTask;
openTask = async function (task) {
  if (!livePerson() || !canOpen(task)) return showSystemToast('無權開啟任務，或入職流程已停止。');
  await fixedOpenTaskBase(task);
  $('#reviewError').style.display = $('#assignError').style.display = 'none';
  $('#rejectError').style.display = 'none';
  $('#rejectReason').value = '';
  const state = progress[key()] || {};
  const locked = !!state.submitted || statusOf(current.id, task) === '已完成';
  $('#workArea input').disabled = locked;
  $('#note').disabled = locked;
  $('#saveBtn').disabled = $('#submitBtn').disabled = locked;
  document.querySelectorAll('#taskItems input').forEach(input => { input.disabled = locked; });
  if (locked && $('#workArea').style.display !== 'none') {
    $('#evidenceSummary').style.display = 'block';
    $('#evidenceSummary').innerHTML = `<h3>已提交內容</h3><p>佐證檔案：${(state.fileNames || []).map(esc).join('、') || '尚未上傳'}</p><p>備註：${esc(state.note || '尚未填寫')}</p>`;
    workflowError('此任務已送審或完成，待審內容已鎖定；請等待審核或退回。');
    $('#taskMessage').className = 'preview';
  }
  $('#rejectBtn').style.display = workflowRules.canReview($('#role').value, task, true) ? '' : 'none';
  $('#rejectReason').closest('label').style.display = $('#rejectBtn').style.display;
  if (state.rejected) workflowError(`退回原因：${state.rejectionReason || '請補件'}`);
};

function validatePersonForm(prefix, errorBox) {
  const name = $(`#${prefix}Name`).value.trim();
  if (!name) { workflowError('請填寫新人姓名，不能只有空白。', errorBox); $(`#${prefix}Name`).focus(); return false; }
  const date = $(`#${prefix}Date`);
  if (!date.value || !date.checkValidity()) { workflowError('請填寫有效的到職日期。', errorBox); return false; }
  if (!Object.hasOwn(managers, $(`#${prefix}Dept`).value) || !['正職', '約聘', '實習'].includes($(`#${prefix}Type`).value)) { workflowError('請選擇有效的部門與員工類型。', errorBox); return false; }
  $(`#${prefix}Name`).value = name;
  return true;
}
const fixedAddBase = $('#addForm').onsubmit;
$('#addForm').onsubmit = event => {
  event.preventDefault();
  if ($('#role').value !== 'hr' || !$('#addDialog').open) return;
  if (!validatePersonForm('n', $('#formError'))) return;
  const previous = new Set(people.map(person => person.id));
  fixedAddBase(event);
  const created = people.find(person => !previous.has(person.id));
  if (created) recordDeliveries(created, '建立流程');
};
const fixedEditBase = $('#editForm').onsubmit;
$('#editForm').onsubmit = event => {
  event.preventDefault();
  if (!['hr', 'hrSupervisor'].includes($('#role').value) || !livePerson() || !validatePersonForm('e', $('#editError'))) return;
  // Both HR roles use the same cancellation path and preserve the cancelled record.
  if ($('#eConfirmed').value === '否') {
    current.name = $('#eName').value.trim();
    current.confirmed = '否';
    recordDeliveries(current, '停止任務');
    cancelledPeople.unshift({ person: { ...current }, cancelledAt: new Date().toISOString() });
    people = people.filter(person => person.id !== current.id);
    saveArchiveData();
    $('#editDialog').close();
    showPeople();
    showSystemToast('已停止任務並移入取消入職紀錄。');
    return;
  }
  fixedEditBase(event);
};

const fixedRenderAccountsBase = renderAccounts;
renderAccounts = function () {
  fixedRenderAccountsBase();
  document.querySelectorAll('.save-account').forEach(button => {
    button.onclick = () => {
      const index = Number(button.dataset.index);
      const kinds = ['hr', 'hrSupervisor', 'it', 'admin'];
      const kind = kinds[index];
      const role = $('#role').value;
      if (role !== 'hrSupervisor' && !(role === 'hr' && ['it','admin'].includes(kind))) return;
      const name = document.querySelector(`.account-name-input[data-index="${index}"]`).value.trim();
      const email = document.querySelector(`.account-email-input[data-index="${index}"]`).value.trim();
      if (!name || !workflowRules.validEmail(email)) return showSystemToast('請填寫姓名與有效的公司信箱，例如 name@example.com。');
      Object.assign(accountFor(kind), { name, email });
      applyAccountDirectory();
      renderAccounts();
      showSystemToast('負責人資料已更新；歷史通知保留原收件人與結果。');
    };
  });
};
$('#assignBtn').onclick = () => {
  if (!livePerson() || !['hr','hrSupervisor'].includes($('#role').value)) return;
  const name = $('#assignee').value.trim();
  const email = $('#assigneeEmail').value.trim();
  if (!name || name === '待指派' || !workflowRules.validEmail(email)) return workflowError('請填寫負責人姓名與有效的公司 Email。', $('#assignError'));
  Object.assign(accountFor('admin'), { name, email });
  applyAccountDirectory();
  recordDeliveries(current, '重新指派並重送', ['admin']);
  pushSystemNotification('admin', '行政任務重新指派', `${current.name}的行政任務已指派給${name}。`, `assignment-${current.id}-${deliveryHistory.length}`);
  $('#taskDialog').close();
  openPerson(current.id);
  showSystemToast('已更新負責人並建立新的模擬重送紀錄。');
};

function recordDeliveries(person, action, kinds = ['hr','it','admin','manager']) {
  const managerEmails = { '財務部門':'pei-shan.wu@example.com', '業務部門':'guan-yu.huang@example.com', '行銷部門':'yong-ching.chao@example.com', '客服部門':'zi-qing.zhao@example.com' };
  kinds.forEach(kind => {
    const account = kind === 'manager' ? { name: managers[person.dept], email: managerEmails[person.dept] } : accountFor(kind);
    const valid = account.name && account.name !== '待指派' && workflowRules.validEmail(account.email);
    deliveryHistory.push({ personId: person.id, personName: person.name, kind, action, name: account.name, email: account.email, status: valid ? '模擬發送成功' : '發送失敗', reason: valid ? '' : '缺少有效負責人或公司信箱', at: new Date().toISOString() });
  });
  sessionStorage.setItem('onboardingDeliveryHistory', JSON.stringify(deliveryHistory));
}
people.forEach(person => {
  if (!deliveryHistory.some(item => item.personId === person.id)) recordDeliveries(person, '展示初始快照（非歷史寄送事件）');
});
const fixedMockSendBase = $('#confirmMockSend').onclick;
$('#confirmMockSend').onclick = event => {
  if (!livePerson() || $('#role').value !== 'hr') return;
  fixedMockSendBase(event);
  recordDeliveries(current, '郵件草稿模擬發送');
};
renderNotifications = function () {
  document.querySelectorAll('.overdue-notice').forEach(box => box.remove());
  const labels = { hr:'HR 任務通知', it:'IT 任務通知', admin:'行政任務通知', manager:'部門主管知會' };
  const ids = [...new Set(deliveryHistory.map(item => item.personId))];
  $('#notificationRows').innerHTML = ids.map(id => {
    const notices = deliveryHistory.filter(item => item.personId === id);
    const failed = notices.filter(item => item.status === '發送失敗').length;
    const detailId = `delivery-${id}`;
    return `<tr><td><b>${esc(notices[0].personName)}</b></td><td>${notices.length} 筆事件</td><td>${failed ? `含 ${failed} 筆失敗歷史` : '全部模擬成功'}</td><td><button class="link notice-toggle" data-target="${detailId}" aria-expanded="false">展開通知</button></td></tr><tr id="${detailId}" hidden><td colspan="4"><div class="notice-detail">${notices.map(item => `<div class="notice-detail-item"><div><b>${labels[item.kind]}</b><small>${esc(item.action)}</small></div><div>${esc(item.name)}<small>${esc(item.email)}</small></div><div>${item.status}<small>${esc(item.reason)}</small></div><div>${new Date(item.at).toLocaleString('zh-TW', {timeZone:'Asia/Taipei'})}<small>模擬事件記錄時間</small></div></div>`).join('')}</div></td></tr>`;
  }).join('');
  document.querySelectorAll('.notice-toggle').forEach(button => { button.onclick = () => {
    const row = document.getElementById(button.dataset.target);
    row.hidden = !row.hidden;
    button.setAttribute('aria-expanded', String(!row.hidden));
    button.textContent = row.hidden ? '展開通知' : '收合通知';
  }; });
  $('#noticeTotal').textContent = deliveryHistory.length;
  $('#noticeSuccess').textContent = deliveryHistory.filter(item => item.status !== '發送失敗').length;
  $('#noticeFailed').textContent = deliveryHistory.filter(item => item.status === '發送失敗').length;
  const overdue = [];
  for (const person of people) {
    for (const task of ['hr', 'it', 'admin']) {
      const due = dueDateAtNoon(person, task);
      if (!due || new Date() <= due || statusOf(person.id, task) === '已完成') continue;
      overdue.push(`${person.name}｜${taskDataLabel(task)}｜負責人：${accountFor(task).name}`);
    }
  }
  if (overdue.length) {
    const box = document.createElement('div');
    box.className = 'notice overdue-notice';
    box.innerHTML = `<div>!</div><div><strong>逾期任務提醒（模擬）</strong>${overdue.map(esc).join('<br>')}</div>`;
    $('#notificationView .notify-summary').before(box);
  }
};
function taskDataLabel(task) { return task === 'hr' ? 'HR 任務' : task === 'it' ? 'IT 任務' : '行政任務'; }

const fixedReopenBase = $('#confirmReopen').onclick;
$('#confirmReopen').onclick = async () => {
  const person = people.find(item => item.id === Number($('#reopenPersonId').value));
  const reason = $('#reopenReason').value.trim();
  if ($('#role').value !== 'hrSupervisor' || !livePerson(person) || !reason) return fixedReopenBase();
  const button = $('#confirmReopen');
  if (button.disabled) return;
  button.disabled = true;
  try {
  await deleteEvidenceFiles(`${person.id}-hr`);
  fixedReopenBase();
  const state = progress[`${person.id}-hr`] || {};
  progress[`${person.id}-hr`] = { ...state, submitted:false, rejected:true, rejectionReason:reason, checks:[], note:'', fileNames:[] };
  taskAudit.push({ personId:person.id, task:'hr', role:'hrSupervisor', action:'重新開啟', reason, at:new Date().toISOString() });
  sessionStorage.setItem('onboardingTaskAudit', JSON.stringify(taskAudit));
  sessionStorage.setItem('onboardingTaskProgress', JSON.stringify(progress));
  } catch (error) {
    workflowError('無法清除舊佐證，流程未重新開啟，請稍後再試。', $('#reopenError'));
    console.error(error);
  } finally { button.disabled = false; }
};
