// Create a KodoSchool platform console account (KodoSchool's own team; not part of any school).
//   node scripts/createPlatformAdmin.js --name "Full Name" --email someone@example.com
// Prints a one-time password once; change it under "My account" after signing in at /platform/login.
const crypto = require('node:crypto');

function arg(name) {
    const i = process.argv.indexOf('--' + name);
    return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
    const name = (arg('name') || '').trim();
    const email = (arg('email') || '').trim().toLowerCase();
    if (name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        console.error('Usage: node scripts/createPlatformAdmin.js --name "Full Name" --email someone@example.com');
        process.exit(2);
    }
    require('../config/environment').loadEnvironment();
    const PlatformAdmin = require('../model/platform/platformAdmin');
    if (await PlatformAdmin.findForLogin(email)) {
        console.error('A KodoSchool admin with this email already exists.');
        process.exit(1);
    }
    // 18 characters from an unambiguous alphabet, with at least one digit.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let password;
    do password = Array.from(crypto.randomBytes(18), b => alphabet[b % alphabet.length]).join('');
    while (!/\d/.test(password) || !/[A-Za-z]/.test(password));
    const admin = await PlatformAdmin.create({ name, email, password });
    console.log(`Created KodoSchool admin #${admin.id}: ${admin.name} <${admin.email}>`);
    console.log(`One-time password: ${password}`);
    console.log('Sign in at /platform/login and change it under "My account".');
    process.exit(0);
}

main().catch(err => { console.error(err.message); process.exit(1); });
