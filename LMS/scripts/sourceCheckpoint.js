const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');

const ROOTS = ['app', 'config', 'controllers', 'middlewares', 'model', 'public', 'routes', 'scripts', 'utils', 'views', 'tests', 'migrations', 'docs'];
const ROOT_FILES = ['server.js', 'package.json', 'package-lock.json', '.gitignore', 'README.md'];

function permitted(relative) {
    if (typeof relative !== 'string' || relative.includes('\\') || relative.startsWith('/') ||
        relative.includes(':') || relative.split('/').some(part => !part || part === '.' || part === '..')) return false;
    const basename = path.posix.basename(relative);
    if (basename.startsWith('.env')) return ['config/.env.example', 'config/.env.test.local.example'].includes(relative);
    if (ROOT_FILES.includes(relative)) return true;
    if (['scripts/Start-LmsRuntime.ps1','scripts/Restart-PracticeRuntime.ps1','scripts/Start-PracticeRuntime.ps1','scripts/Recover-LegacyRuntimeOwnership.ps1'].includes(relative)) return true;
    return ROOTS.includes(relative.split('/')[0]) && /\.(js|cjs|css|ejs|md|sql|json)$/.test(relative);
}

function capture(root = path.join(__dirname, '..')) {
    const paths = ROOT_FILES.filter(file => fs.existsSync(path.join(root, file)));
    function walk(dir) {
        if (!fs.existsSync(path.join(root, dir))) return;
        for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
            const relative = `${dir}/${entry.name}`;
            // Never follow a link to an unapproved or secret directory.
            if (entry.isSymbolicLink()) continue;
            if (entry.isDirectory()) walk(relative);
            else if (permitted(relative)) paths.push(relative);
        }
    }
    ROOTS.forEach(walk);
    const files = [...new Set(paths)].sort().map(relative => {
        const bytes = fs.readFileSync(path.join(root, relative));
        return { path: relative, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), content: bytes.toString('base64') };
    });
    return { format: 'lms-source-checkpoint-v1', createdAt: new Date().toISOString(), files };
}

function verify(archive) {
    if (archive.format !== 'lms-source-checkpoint-v1' || !Array.isArray(archive.files)) throw new Error('Invalid checkpoint');
    const seen = new Set();
    for (const file of archive.files) {
        if (!permitted(file.path) || seen.has(file.path)) throw new Error('Unsafe or duplicate checkpoint path');
        const actual = crypto.createHash('sha256').update(Buffer.from(file.content, 'base64')).digest('hex');
        if (actual !== file.sha256) throw new Error('Checkpoint checksum mismatch');
        seen.add(file.path);
    }
    return archive.files.length;
}

function main() {
    const archive = capture();
    const compressed = zlib.gzipSync(JSON.stringify(archive));
    verify(JSON.parse(zlib.gunzipSync(compressed)));
    const directory = path.join(__dirname, '../backups/source');
    fs.mkdirSync(directory, { recursive: true });
    const filename = `${Date.now()}_source.json.gz`;
    fs.writeFileSync(path.join(directory, filename), compressed, { flag: 'wx' });
    console.log(`Verified source checkpoint: backups/source/${filename} (${archive.files.length} files; private environment files excluded).`);
}

if (require.main === module) main();
module.exports = { permitted, capture, verify };
