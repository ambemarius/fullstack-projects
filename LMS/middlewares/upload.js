const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');

// Stored outside public/ so files are only reachable through the authenticated /files route.
const UPLOAD_DIR = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.join(__dirname, '..', 'uploads');

const ALLOWED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/webp'],
    document: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
};
const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const MAX_SIZE = 5 * 1024 * 1024;

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
    destination(_req, _file, cb) {
        ensureDir(UPLOAD_DIR);
        cb(null, UPLOAD_DIR);
    },
    filename(req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const prefix = String(req.uploadSubDir || 'file').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'file';
        cb(null, `${prefix}-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    },
});

function fileFilter(allowedCategory) {
    const types = ALLOWED_TYPES[allowedCategory] || ALLOWED_TYPES.document;
    return (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (types.includes(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) cb(null, true);
        else cb(Object.assign(new Error(`Only ${allowedCategory} files are allowed`), { statusCode: 415 }), false);
    };
}

function uploadSingle(fieldName, { category = 'document', subDir, maxSize = MAX_SIZE } = {}) {
    return [
        (req, _res, next) => { req.uploadSubDir = subDir || fieldName; next(); },
        multer({ storage, fileFilter: fileFilter(category), limits: { fileSize: Math.min(maxSize, MAX_SIZE), files: 1 } }).single(fieldName),
    ];
}

function uploadMultiple(fieldName, maxCount = 5, { category = 'document', subDir, maxSize = MAX_SIZE } = {}) {
    return [
        (req, _res, next) => { req.uploadSubDir = subDir || fieldName; next(); },
        multer({ storage, fileFilter: fileFilter(category), limits: { fileSize: Math.min(maxSize, MAX_SIZE), files: maxCount } }).array(fieldName, maxCount),
    ];
}

// URL stored on the record; resolved by the authenticated GET /files/:name route.
function getPublicUrl(filePath) {
    if (!filePath) return null;
    return '/files/' + path.basename(filePath);
}

const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

function resolveUploadPath(name) {
    if (typeof name !== 'string' || !SAFE_NAME.test(name) || name.startsWith('.')) return null;
    const resolved = path.join(UPLOAD_DIR, name);
    return resolved.startsWith(UPLOAD_DIR + path.sep) ? resolved : null;
}

module.exports = { uploadSingle, uploadMultiple, getPublicUrl, resolveUploadPath, UPLOAD_DIR };
