// Code 128 (subset B) barcode as an inline SVG, used for the matricule on printed report cards.
// No dependency: subset B covers printable ASCII (space to ~), which is enough for matricules.

// Bar/space widths for symbol values 0-106 (each symbol is 11 modules; the stop symbol is 13).
const PATTERNS = (
    '212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 221312 231212 112232 122132 122231 113222 ' +
    '123122 123221 223211 221132 221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 212123 212321 ' +
    '232121 111323 131123 131321 112313 132113 132311 211313 231113 231311 112133 112331 132131 113123 113321 133121 ' +
    '313121 211331 231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 314111 221411 431111 111224 ' +
    '111422 121124 121421 141122 141221 112214 112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
    '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 214121 412121 111143 111341 131141 114113 ' +
    '114311 411113 411311 113141 114131 311141 411131 211412 211214 211232 2331112'
).split(' ');
const START_B = 104, STOP = 106, QUIET = 10;

const escapeXml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function encode(text) {
    const values = [...text].map(ch => ch.charCodeAt(0) - 32);
    if (!values.length || values.some(v => v < 0 || v > 94)) return null;
    const checksum = values.reduce((sum, v, i) => sum + v * (i + 1), START_B) % 103;
    return [START_B, ...values, checksum, STOP];
}

function code128Svg(text, { height = 40 } = {}) {
    const symbols = encode(String(text ?? ''));
    if (!symbols) return '';
    let x = QUIET;
    const bars = [];
    for (const symbol of symbols) {
        [...PATTERNS[symbol]].forEach((w, i) => {
            const width = Number(w);
            if (i % 2 === 0) bars.push(`<rect x="${x}" y="0" width="${width}" height="${height}"/>`);
            x += width;
        });
    }
    const total = x + QUIET;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${height}" preserveAspectRatio="none" shape-rendering="crispEdges" role="img" aria-label="${escapeXml(text)}"><title>${escapeXml(text)}</title><g fill="#000">${bars.join('')}</g></svg>`;
}

module.exports = { code128Svg, encode, PATTERNS };
