const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load the browser component with the few globals it touches at start-up.
function loadMarkSheet() {
    const noop = () => {};
    const context = { window: { addEventListener: noop }, document: { addEventListener: noop }, console };
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/js/mark-sheet.js'), 'utf8'), context);
    return context.window.MarkSheet;
}

test('mark sheet accepts marks from 0 to 20, with a dot or a comma, and explains anything else', () => {
    const { parseMark } = loadMarkSheet();
    assert.deepEqual({ ...parseMark('') }, { value: null });
    assert.deepEqual({ ...parseMark(' 12 ') }, { value: 12 });
    assert.deepEqual({ ...parseMark('12,5') }, { value: 12.5 }, 'French keyboards type a comma');
    assert.deepEqual({ ...parseMark('0') }, { value: 0 });
    assert.deepEqual({ ...parseMark('20') }, { value: 20 });
    assert.deepEqual({ ...parseMark('19.75') }, { value: 19.75 });
    assert.match(parseMark('20.5').error, /out of 20/);
    assert.match(parseMark('25').error, /out of 20/);
    assert.match(parseMark('-1').error, /Enter a number/);
    assert.match(parseMark('abc').error, /Enter a number/);
    assert.match(parseMark('12.555').error, /Enter a number/, 'at most two decimals');
    assert.match(parseMark('120').error, /Enter a number/);
});

test('mark sheet remarks use the same bands as the report cards', () => {
    const { band } = loadMarkSheet();
    assert.deepEqual([17, 14, 12, 10, 9.99, 5, 4.99, 0].map(band), ['Excellent', 'Very good', 'Good', 'Average', 'Weak', 'Weak', 'Very weak', 'Very weak']);
    assert.equal(band(null), '');
});

test('marks entry filter: four numbered steps, subject waits for a class, term labels show the year sequence numbers', () => {
    const html = fs.readFileSync(path.join(__dirname, '../views/admin-layout.ejs'), 'utf8');
    const filter = html.slice(html.indexOf('<form class="mk-filter" id="marksForm"'), html.indexOf('<div id="mkSheet">'));
    assert.deepEqual([...filter.matchAll(/data-field="(\w+)"/g)].map(m => m[1]), ['year', 'class', 'subject', 'term']);
    assert.deepEqual([...filter.matchAll(/class="mk-step"[^>]*>(\d)</g)].map(m => m[1]), ['1', '2', '3', '4']);
    assert.match(filter, /<select id="mkSubject" required disabled>/);
    assert.match(filter, /value="Second">Second Term \(Seq\. 3 &amp; 4\)/);
    assert.match(filter, /id="mkLoadBtn" disabled>/, 'opens only when all four are chosen');
    assert.match(filter, /id="mkResetBtn">Clear filters</);
    const js = fs.readFileSync(path.join(__dirname, '../public/js/admin-evaluation.js'), 'utf8');
    assert.match(js, /params\.set\('mk_' \+ name/, 'choices are kept in the URL');
    assert.match(js, /textContent = 'Required'/);
});

test('both mark entry screens use the shared mark sheet and save both sequences together', () => {
    const admin = fs.readFileSync(path.join(__dirname, '../public/js/admin-evaluation.js'), 'utf8');
    const teacher = fs.readFileSync(path.join(__dirname, '../public/js/teacher-dashboard.js'), 'utf8');
    assert.match(admin, /MarkSheet\.mount\(/);
    assert.match(admin, /\/marks\/admin\/save-all\//);
    assert.match(teacher, /MarkSheet\.mount\(/);
    assert.match(teacher, /\/marks\/save-all\//);
    for (const view of ['admin-layout.ejs', 'teacher-dashboard.ejs']) {
        const html = fs.readFileSync(path.join(__dirname, '../views', view), 'utf8');
        assert.ok(html.indexOf('/js/mark-sheet.js') > -1, `${view} loads the component`);
        assert.doesNotMatch(html, /id="mkSeq"|id="mkMaxScore"|>Total</, `${view}: no sequence picker, editable maximum or Seq1+Seq2 total`);
    }
});

test('class broadsheet grades averages out of 20 with the bulletin remarks, one heading per column', () => {
    const js = fs.readFileSync(path.join(__dirname, '../public/js/admin-evaluation.js'), 'utf8');
    assert.doesNotMatch(js, /gradeFromScore\(s\.overallAvg, 100\)/, 'a /20 average must not be graded as a percentage');
    assert.match(js, /\[\[17, 'Excellent'\], \[14, 'Very good'\], \[12, 'Good'\], \[10, 'Average'\], \[5, 'Weak'\], \[0, 'Very weak'\]\]/);
    // Header after the subject columns: Average, Remark, Position, Absence (4) = cells per row after the subjects (4).
    const header = js.match(/headerHtml \+= '<th>Average<br\/>[\s\S]*?<\/tr>';/)[0];
    assert.equal((header.match(/<th>/g) || []).length, 4);
    const ctrl = fs.readFileSync(path.join(__dirname, '../controllers/academic/reportCardCtrl.js'), 'utf8');
    assert.match(ctrl, /const passThreshold = 10;/);
    assert.match(ctrl, /\(s\.academicYearId IS NULL OR s\.academicYearId = @academicYearId\)/);
});

test('teacher panel: sidebar of sections, dashboard first, each section keeps the elements its scripts use', () => {
    const html = fs.readFileSync(path.join(__dirname, '../views/teacher-dashboard.ejs'), 'utf8');
    const links = [...html.matchAll(/class="tp-link" href="#(\w+)" data-tab="(\w+)"/g)].map(m => { assert.equal(m[1], m[2]); return m[1]; });
    assert.deepEqual(links, ['dashboard', 'timetable', 'attendance', 'marks', 'subjects', 'students', 'lab', 'duties', 'profile']);
    assert.match(html, /<h2 class="tp-section">Teaching tools<\/h2>/);
    assert.match(html, /id="tw-dashboard" aria-labelledby="tpTitle">/, 'the dashboard section is visible first');
    for (const id of ['timetable', 'attendance', 'marks', 'subjects', 'students', 'lab', 'duties', 'profile']) {
        assert.match(html, new RegExp(`id="tw-${id}" aria-labelledby="tpTitle" hidden>`), `${id} starts hidden`);
    }
    const panel = id => html.slice(html.indexOf(`id="tw-${id}"`), html.indexOf('</section>\n\n', html.indexOf(`id="tw-${id}"`)));
    assert.match(panel('dashboard'), /id="dbStats"[\s\S]*id="dbToday"[\s\S]*id="dbTodo"[\s\S]*id="dbMarks"/);
    assert.match(panel('timetable'), /id="ttGrid"/);
    assert.match(panel('attendance'), /id="attDate"[\s\S]*id="attLessons"[\s\S]*id="attRegister"/);
    assert.match(panel('lab'), /href="\/lab-requests"/);
    assert.match(panel('students'), /id="studentClasses"[\s\S]*id="studentRows"/);
    assert.match(panel('marks'), /id="msForm"[\s\S]*id="msSheet"/);
    assert.match(html, /href="#duties" data-tab="duties" id="tw-tab-duties" hidden/, 'duties only for teachers with a duty');
    assert.match(html, /id="tpMenuBtn" aria-label="Open menu" aria-controls="tpSidebar" aria-expanded="false"/, 'mobile menu button');
    assert.match(html, /id="twAttCount" hidden/);
    assert.match(html, /id="logoutBtn"/);
    const js = fs.readFileSync(path.join(__dirname, '../public/js/teacher-dashboard.js'), 'utf8');
    assert.match(js, /b\.setAttribute\('aria-current', 'page'\)/, 'the current section is announced');
    assert.match(js, /twShow\(location\.hash\.slice\(1\) \|\| 'dashboard'/, 'signing in opens the dashboard');
    assert.doesNotMatch(js, /localStorage\.getItem\('teacherTab'\)/);
    assert.match(js, /fetch\('\/lab-requests\/mine'/);
    assert.match(js, /`Register not taken · \$\{esc\(l\.startTime\)\}`/);
    assert.match(js, /\$\{items\.length\} pending/);
});

test('teacher lab request summary endpoint uses the request page gate (teachers only)', () => {
    const router = fs.readFileSync(path.join(__dirname, '../routes/inventory/inventoryRouter.js'), 'utf8');
    assert.match(router, /router\.get\(PATHS\.requests \+ '\/mine', gate\('requests'\)/);
    assert.match(router, /requests: requireStaff\(\{ allowTeacher: true, allowAdmin: false \}\)/);
});

test('teacher Enter marks filter: class and subject, term and open button on one row, like the admin filter', () => {
    const html = fs.readFileSync(path.join(__dirname, '../views/teacher-dashboard.ejs'), 'utf8');
    const form = html.slice(html.indexOf('<form id="msForm"'), html.indexOf('</form>', html.indexOf('<form id="msForm"')));
    assert.match(form, /class="mk-filter tp-mk-filter"/);
    assert.match(form, /<div class="mk-filter-row tp-mk-row">/);
    assert.deepEqual([...form.matchAll(/data-field="(\w+)"/g)].map(m => m[1]), ['subject', 'term']);
    assert.match(form, /id="msLoadBtn" disabled>/);
    assert.doesNotMatch(html, /class="ms-picker"/);
    const css = fs.readFileSync(path.join(__dirname, '../public/css/style.css'), 'utf8');
    assert.match(css, /\.tp-mk-row \{ grid-template-columns: minmax\(0, 2fr\) minmax\(0, 1fr\) auto; \}/);
    const js = fs.readFileSync(path.join(__dirname, '../public/js/teacher-dashboard.js'), 'utf8');
    assert.match(js, /document\.getElementById\('msLoadBtn'\)\.disabled = !complete;/);
});
