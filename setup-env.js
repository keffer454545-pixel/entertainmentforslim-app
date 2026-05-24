// setup-env.js - Скрипт для настройки окружения
const fs = require('fs');
const path = require('path');

// Читаем переменные окружения
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const VERCEL_URL = process.env.VERCEL_URL;

if (!GOOGLE_CLIENT_ID || !GOOGLE_API_KEY) {
    console.warn('⚠️  Google переменные не найдены. Google функции будут отключены.');
    console.warn('Добавьте GOOGLE_CLIENT_ID и GOOGLE_API_KEY в переменные окружения Vercel.');
}

// Обновляем index.html
const indexPath = path.join(__dirname, 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');

indexContent = indexContent.replace(
    'content="__GOOGLE_CLIENT_ID__"',
    `content="${GOOGLE_CLIENT_ID || ''}"`
);
indexContent = indexContent.replace(
    'content="__GOOGLE_API_KEY__"',
    `content="${GOOGLE_API_KEY || ''}"`
);

fs.writeFileSync(indexPath, indexContent);
console.log('✅ index.html обновлен');

// Создаем env-config.js для клиентской стороны
const envConfig = `
// Автоматически сгенерированный файл конфигурации
window.ENV = {
    GOOGLE_CLIENT_ID: '${GOOGLE_CLIENT_ID || ''}',
    GOOGLE_API_KEY: '${GOOGLE_API_KEY || ''}',
    VERCEL_URL: '${VERCEL_URL || ''}',
    IS_PRODUCTION: ${!!VERCEL_URL}
};
`;

fs.writeFileSync(path.join(__dirname, 'env-config.js'), envConfig);
console.log('✅ env-config.js создан');