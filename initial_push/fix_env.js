
const fs = require('fs');
const path = require('path');

const envPath = path.join(process.cwd(), '.env');

try {
    let content = fs.readFileSync(envPath, 'utf8');
    // Strip BOM
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    // Also strip any other non-ascii from start if present (lazy fix for )
    content = content.replace(/^[^\w#]+/, '');
    // Normalize newlines
    const lines = content.split(/\r?\n/);
    const env = {};

    lines.forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return;
        const parts = line.split('=');
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        if (key) env[key] = val;
    });

    // Ensure necessary keys
    if (!env['AUTH_SECRET']) env['AUTH_SECRET'] = '336f32877a5b33d062828e833f6a297e';
    if (env['AUTH_URL'] && !env['AUTH_URL'].includes('5000')) env['AUTH_URL'] = 'http://localhost:5000'; // Update usage if wrong port
    if (!env['AUTH_URL']) env['AUTH_URL'] = 'http://localhost:5000';
    if (!env['AUTH_TRUST_HOST']) env['AUTH_TRUST_HOST'] = 'true';

    if (!env['AUTH_USERNAME']) env['AUTH_USERNAME'] = 'admin';
    if (!env['AUTH_PASSWORD']) env['AUTH_PASSWORD'] = 'admin';

    // Reconstruct file
    const newContent = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n');

    fs.writeFileSync(envPath, newContent);
    console.log('.env fixed successfully');
    console.log('Keys present:', Object.keys(env).join(', '));
} catch (error) {
    console.error('Error fixing .env:', error);
}
