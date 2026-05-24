# 🚀 Деплой на Vercel

## Быстрый деплой

[![Deploy to Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/vault-app)

## Пошаговая инструкция

### 1. Подготовка Google Cloud

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте проект или выберите существующий
3. Включите API:
   - Google Drive API
   - Google People API
4. Создайте OAuth 2.0 Client ID:
   - Тип: Web application
   - Authorized JavaScript origins:
     - `http://localhost` (для разработки)
     - `https://YOUR_APP.vercel.app` (после деплоя)
   - Сохраните Client ID и API Key

### 2. Загрузка на GitHub

```bash
# Клонируйте репозиторий
git clone https://github.com/YOUR_USERNAME/vault-app.git
cd vault-app

# Добавьте файлы
git add .

# Создайте коммит
git commit -m "Initial commit"

# Отправьте на GitHub
git push origin main