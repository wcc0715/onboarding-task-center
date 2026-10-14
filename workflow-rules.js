/* Shared validation for the prototype. This is not server-side authorization. */
(function (root) {
  const rules = {
    validEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
    },
    canWork(role, task, live) {
      return live && ['hr', 'it', 'admin'].includes(task) && role === task;
    },
    canReview(role, task, live) {
      return live && ['hr', 'it', 'admin'].includes(task) && (role === 'hrSupervisor' || (role === 'hr' && task !== 'hr'));
    },
    completeness(state, count, files) {
      const missing = [];
      if (!state || count < 1 || state.checks?.length !== count || !state.checks.every(value => value === true)) missing.push('完成所有待辦項目');
      if (!files.length) missing.push('上傳佐證檔案');
      if (!String(state?.note || '').trim()) missing.push('填寫備註');
      return missing;
    },
    transitionError(from, to) {
      if (!['未開始', '進行中', '已完成'].includes(to)) return '不合法的任務狀態。';
      if (from === '已完成' && to !== '已完成') return '已完成任務請透過「退回修改」或主管「重新開啟流程」處理，並填寫原因。';
      if (from === '進行中' && to === '未開始') return '已開始的任務不可直接倒退；請透過退回修改並填寫原因。';
      return '';
    }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = rules;
  else root.WorkflowRules = rules;
})(typeof window !== 'undefined' ? window : this);
