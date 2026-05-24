# Настройка Google авторизации для Vault

## Шаг 1: Создание проекта в Google Cloud Console

1. Перейдите на [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Перейдите в раздел **APIs & Services** > **Credentials**

## Шаг 2: Настройка OAuth 2.0

1. Нажмите **Create Credentials** > **OAuth client ID**
2. Выберите **Web application**
3. Назовите приложение (например, "Vault App")
4. Добавьте разрешенные источники:
   - `http://localhost` (для локальной разработки)
   - `http://localhost:3000`
   - URL вашего сайта (если будете хостить)
5. Добавьте разрешенные URI перенаправления:
   - `http://localhost`
   - `http://localhost:3000`
6. Нажмите **Create**
7. Сохраните **Client ID** и **Client Secret**

## Шаг 3: Включение API

1. Перейдите в **APIs & Services** > **Library**
2. Найдите и включите:
   - **Google Drive API**
   - **Google People API** (для информации о пользователе)

## Шаг 4: Настройка экрана согласия OAuth

1. Перейдите в **APIs & Services** > **OAuth consent screen**
2. Выберите **External** (если для личного использования - можно выбрать Internal)
3. Заполните:
   - App name: "Vault"
   - User support email: ваш email
   - Developer contact information: ваш email
4. Добавьте области (scopes):
   - `auth/drive.file`
   - `auth/userinfo.profile`
   - `auth/userinfo.email`
5. Добавьте тестовых пользователей (ваш email)
6. Нажмите **Save and Continue**

## Шаг 5: Настройка приложения

1. Откройте файл `google-auth.js`
2. Замените:
   ```javascript
   this.CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com';
   this.API_KEY = 'YOUR_API_KEY';