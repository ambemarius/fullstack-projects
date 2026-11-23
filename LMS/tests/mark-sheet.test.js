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
