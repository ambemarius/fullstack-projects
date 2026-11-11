const multer = require('multer');
const path = require('node:path');
const fs = require('node:fs');

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');

const ALLOWED_TYPES = {
    image: ['image/jpeg', 'image/png', 'image/webp'],
    document: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
};

function ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
    destination(_req, _file, cb) {
        const subDir = _req.uploadSubDir || 'general';
        const dest = path.join(UPLOAD_DIR, subDir);
        ensureDir(dest);
        cb(null, dest);
    },
    filename(_req, file, cb) {
        const ext = path.extname(file.originalname).toLowerCase();
        const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
        cb(null, uniqueName);
    },
});

function fileFilter(allowedCategory) {
    const types = ALLOWED_TYPES[allowedCategory] || ALLOWED_TYPES.document;
    return (_req, file, cb) => {
        if (types.includes(file.mimetype)) cb(null, true);
        else cb(new Error(`Only ${allowedCategory} files are allowed`), false);
    };
}

function uploadSingle(fieldName, { category = 'document', subDir, maxSize = 5 * 1024 * 1024 } = {}) {
    return [
        (req, _res, next) => { req.uploadSubDir = subDir || fieldName; next(); },
        multer({ storage, fileFilter: fileFilter(category), limits: { fileSize: maxSize } }).single(fieldName),
    ];
}

function uploadMultiple(fieldName, maxCount = 5, { category = 'document', subDir, maxSize = 5 * 1024 * 1024 } = {}) {
    return [
        (req, _res, next) => { req.uploadSubDir = subDir || fieldName; next(); },
        multer({ storage, fileFilter: fileFilter(category), limits: { fileSize: maxSize } }).array(fieldName, maxCount),
    ];
}

function getPublicUrl(filePath) {
    const idx = filePath.indexOf(path.join('public', 'uploads'));
    if (idx === -1) return null;
    return '/' + filePath.slice(idx + 'public'.length + 1).replace(/\\/g, '/');
}

module.exports = { uploadSingle, uploadMultiple, getPublicUrl, UPLOAD_DIR };
