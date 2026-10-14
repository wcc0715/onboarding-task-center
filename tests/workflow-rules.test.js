const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../workflow-rules');

test('task ownership excludes cross-role editing and cancelled processes', () => {
  for (const role of ['hr', 'it', 'admin', 'hrSupervisor']) {
    for (const task of ['hr', 'it', 'admin']) {
      assert.equal(rules.canWork(role, task, true), role === task);
      assert.equal(rules.canWork(role, task, false), false);
    }
  }
});
test('review rights cannot include HR self-approval, invalid tasks or stopped processes', () => {
  assert.equal(rules.canReview('hr', 'hr', true), false);
  assert.equal(rules.canReview('hr', 'it', true), true);
  assert.equal(rules.canReview('hrSupervisor', 'hr', true), true);
  for (const role of ['hr','it','admin','hrSupervisor']) {
    assert.equal(rules.canReview(role, 'it', false), false);
    assert.equal(rules.canReview(role, 'invalid', true), false);
  }
  assert.equal(rules.canReview('it', 'admin', true), false);
});
test('evidence, non-whitespace notes and every expected task are independently required', () => {
  const complete = { checks:[true,true], note:'測試備註' };
  assert.deepEqual(rules.completeness(complete, 2, [{}]), []);
  assert.deepEqual(rules.completeness(complete, 2, []), ['上傳佐證檔案']);
  assert.deepEqual(rules.completeness({...complete,note:' \t\n'}, 2, [{}]), ['填寫備註']);
  assert.deepEqual(rules.completeness({...complete,checks:[true,false]}, 2, [{}]), ['完成所有待辦項目']);
  assert.deepEqual(rules.completeness({...complete,checks:[true]}, 2, [{}]), ['完成所有待辦項目']);
  assert.deepEqual(rules.completeness({...complete,checks:[]}, 0, [{}]), ['完成所有待辦項目']);
});
test('company email validation rejects missing domains and malformed values', () => {
  for (const value of ['bad@','a@b','@example.com','a@@example.com','a b@example.com','a@example.','a@example.com\nother']) assert.equal(rules.validEmail(value), false, value);
  for (const value of ['admin.demo@example.com',' name+test@sub.example.com ']) assert.equal(rules.validEmail(value), true);
});
test('direct state changes cannot roll back completed or active tasks', () => {
  assert.ok(rules.transitionError('已完成', '未開始'));
  assert.ok(rules.transitionError('已完成', '進行中'));
  assert.ok(rules.transitionError('進行中', '未開始'));
  assert.ok(rules.transitionError('進行中', 'invalid'));
  assert.equal(rules.transitionError('進行中', '已完成'), '');
  assert.equal(rules.transitionError('未開始', '進行中'), '');
});
