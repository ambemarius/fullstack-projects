function quoteCell(value) {
    let text = String(value ?? '');
    // Spreadsheet programs can evaluate quoted CSV fields as formulas.
    if (/^[\s\p{Cf}\u0000-\u001f]*[=+@\-＝＋＠－]/u.test(text) || /^[\t\r\n]/.test(text)) {
        text = "'" + text;
    }
    return '"' + text.replace(/"/g, '""') + '"';
}

function academicCsv(columns, rows) {
    const lines = [columns, ...rows].map(row => row.map(quoteCell).join(','));
    return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

module.exports = { academicCsv };
