const test = require('node:test');
const assert = require('node:assert/strict');
const { academicCsv } = require('../utils/academicCsv');

test('academic CSV preserves quoted multilingual text and treats formula prefixes as literal text', () => {
    const value = 'École, "A"\r\nÉtage 2';
    const cells = ['  =1+1','\t@x','+123','-1','\uFEFF＝1','\u200B@x','＠x'];
    const csv = academicCsv(['Label'], [[value],[null], ...cells.map(cell => [cell])]);
    assert.equal(csv, '\uFEFF"Label"\r\n"École, ""A""\r\nÉtage 2"\r\n""\r\n' +
        cells.map(cell => '"\'' + cell + '"\r\n').join(''));
});
