const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
function fixture() {
    const elements = new Map(), pending = [];
    const document = {
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, { value: '', hidden: false, textContent: '', children: [],
                replaceChildren(...children) { this.children = children; }, reset() { this.resets = (this.resets || 0) + 1; } });
            return elements.get(id);
        },
        querySelectorAll(selector) { return selector === 'form' ? ['studentForm', 'teacherForm'].map(id => this.getElementById(id)) : []; }
    };
    const context = vm.createContext({ document, fetch: (path, options) => new Promise(resolve => pending.push({ path, options, resolve })) });
    const source = fs.readFileSync(require.resolve('../public/js/m1-original-registration.js'), 'utf8');
    vm.runInContext(source.slice(0, source.indexOf('\nfor(const kind of')) + '\nglobalThis.subject={switchSchool,load,model};', context);
    document.getElementById('schoolSwitch').value = 'SCHOOL_B';
    for (const id of ['studentTableBody', 'teacherTableBody']) document.getElementById(id).children = ['SCHOOL_A_PRIVATE_ROW'];
    Object.assign(context.subject.model, { csrf: 'old-token', selected: { student: 91 }, edits: { student: { id: 91 } }, rows: { student: ['old'], teacher: ['old'] } });
    return { document, elements, pending, context, subject: context.subject };
}
const response = (data, status = 200) => ({ status, ok: status === 200, json: async () => data });
test('registration school switch clears private DOM immediately and rejects an older in-flight roster response', async () => {
    const f = fixture();
    vm.runInContext("start=async()=>{byId('studentTableBody').replaceChildren('SCHOOL_B_ROW');byId('registrationWorkspace').hidden=false;return true;};", f.context);
    const oldLoad = f.subject.load('student');
    const switching = f.subject.switchSchool();
    for (const id of ['studentTableBody', 'teacherTableBody']) assert.deepEqual(f.elements.get(id).children, []);
    assert.equal(f.elements.get('registrationWorkspace').hidden, true);
    assert.equal(Object.keys(f.subject.model.selected).length, 0);
    assert.equal(Object.keys(f.subject.model.edits).length, 0);
    f.pending[0].resolve(response({ data: [{ id: 91, firstName: 'Old-school' }] }));
    await oldLoad;
    assert.deepEqual(f.elements.get('studentTableBody').children, []);
    assert.equal(JSON.parse(f.pending[1].options.body).schoolCode, 'SCHOOL_B');
    f.pending[1].resolve(response({ csrfToken: 'new-token' }));
    await switching;
    assert.deepEqual(f.elements.get('studentTableBody').children, ['SCHOOL_B_ROW']);
    assert.equal(f.subject.model.csrf, 'new-token');
    assert.equal(f.elements.get('workspaceMessage').textContent, 'School switched.');
});
test('registration switch does not announce success after the new school bootstrap denies access', async () => {
    const f = fixture();
    vm.runInContext("start=async()=>{lockout();say('Membership unavailable',true);return false;};", f.context);
    const switching = f.subject.switchSchool();
    f.pending[0].resolve(response({ csrfToken: 'new-token' }));
    await switching;
    assert.equal(f.subject.model.csrf, null);
    assert.equal(f.elements.get('registrationWorkspace').hidden, true);
    assert.equal(f.elements.get('workspaceMessage').textContent, 'Membership unavailable');
});
test('failed registration school switch leaves private data hidden and requires sign-in', async () => {
    const f = fixture(), switching = f.subject.switchSchool();
    f.pending[0].resolve(response({ message: 'Switch failed' }, 500));
    await assert.rejects(switching, /Switch failed/);
    assert.equal(f.subject.model.csrf, null);
    assert.equal(f.elements.get('registrationWorkspace').hidden, true);
    assert.equal(f.elements.get('signInNotice').hidden, false);
});
