// setup-env.js - Скрипт для настройки окружения
const fs = require('fs');
const path = require('path');

// Читаем переменные окружения
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
const VERCEL_URL = process.env.VERCEL_URL || '';

console.log('Настройка переменных окружения...');
console.log('GOOGLE_CLIENT_ID:', GOOGLE_CLIENT_ID ? 'найден' : 'не найден');
console.log('GOOGLE_API_KEY:', GOOGLE_API_KEY ? 'найден' : 'не найден');

// Обновляем index.html
const indexPath = path.join(__dirname, 'index.html');

try {
    let indexContent = fs.readFileSync(indexPath, 'utf8');
    
    // Заменяем плейсхолдеры на реальные значения
    indexContent = indexContent.replace('%%GOOGLE_CLIENT_ID%%', GOOGLE_CLIENT_ID);
    indexContent = indexContent.replace('%%GOOGLE_API_KEY%%', GOOGLE_API_KEY);
    indexContent = indexContent.replace('%%VERCEL_URL%%', VERCEL_URL);
    
    fs.writeFileSync(indexPath, indexContent);
    console.log('✅ index.html обновлен с переменными окружения');
} catch (error) {
    console.error('❌ Ошибка обновления index.html:', error);
}

// Создаем env-config.js для дополнительной совместимости
const envConfig = `
// Автоматически сгенерированный файл конфигурации
window.ENV = window.ENV || {};
window.ENV.GOOGLE_CLIENT_ID = '${GOOGLE_CLIENT_ID}';
window.ENV.GOOGLE_API_KEY = '${GOOGLE_API_KEY}';
window.ENV.VERCEL_URL = '${VERCEL_URL}';
`;

fs.writeFileSync(path.join(__dirname, 'env-config.js'), envConfig);
console.log('✅ env-config.js создан');
