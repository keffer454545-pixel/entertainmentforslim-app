// google-auth.js - Полная интеграция с Google API
class GoogleAuth {
    constructor() {
        this.CLIENT_ID = null;
        this.API_KEY = null;
        this.accessToken = null;
        this.userInfo = null;
        this.tokenClient = null;
        this.driveFolderId = null;
        
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
        
        this.init();
    }

    async init() {
        // Загружаем конфигурацию
        this.loadConfiguration();
        
        if (!this.CLIENT_ID || !this.API_KEY) {
            console.warn('Google API ключи не настроены');
            this.showSetupInstructions();
            return;
        }

        try {
            // Ждем загрузки Google API
            await this.waitForGoogleAPI();
            
            // Инициализируем GAPI клиент
            await this.initGapiClient();
            
            // Инициализируем OAuth клиент
            this.initTokenClient();
            
            console.log('Google API успешно инициализирован');
            
            // Проверяем сохраненную сессию
            await this.checkSavedSession();
        } catch (error) {
            console.error('Ошибка инициализации Google API:', error);
            this.showSetupInstructions();
        }
    }

    loadConfiguration() {
        // Из переменных окружения
        if (window.ENV) {
            this.CLIENT_ID = window.ENV.GOOGLE_CLIENT_ID || null;
            this.API_KEY = window.ENV.GOOGLE_API_KEY || null;
        }
        
        // Из localStorage (для локальной разработки)
        if (!this.CLIENT_ID) {
            this.CLIENT_ID = localStorage.getItem('dev_google_client_id');
        }
        if (!this.API_KEY) {
            this.API_KEY = localStorage.getItem('dev_google_api_key');
        }
        
        // Загружаем сохраненные данные
        const savedToken = localStorage.getItem('googleAccessToken');
        const savedUser = localStorage.getItem('googleUserInfo');
        const savedFolder = localStorage.getItem('googleDriveFolderId');
        const tokenExpiry = localStorage.getItem('googleTokenExpiry');
        
        if (savedToken && tokenExpiry && Date.now() < parseInt(tokenExpiry)) {
            this.accessToken = savedToken;
            if (savedUser) {
                this.userInfo = JSON.parse(savedUser);
            }
            this.driveFolderId = savedFolder;
        }
    }

    async waitForGoogleAPI() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50;
            
            const check = () => {
                if (typeof google !== 'undefined' && google.accounts) {
                    resolve();
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(check, 100);
                } else {
                    resolve();
                }
            };
            check();
        });
    }

    async initGapiClient() {
        return new Promise((resolve, reject) => {
            if (typeof gapi === 'undefined') {
                reject(new Error('GAPI не загружен'));
                return;
            }
            
            gapi.load('client', {
                callback: async () => {
                    try {
                        await gapi.client.init({
                            apiKey: this.API_KEY,
                            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
                        });
                        resolve();
                    } catch (error) {
                        reject(error);
                    }
                },
                onerror: reject
            });
        });
    }

    initTokenClient() {
        try {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (response) => {
                    if (response.error) {
                        console.error('Ошибка авторизации:', response.error);
                        app.showToast('❌ Ошибка авторизации');
                        return;
                    }
                    this.handleTokenResponse(response);
                },
                error_callback: (error) => {
                    console.error('Ошибка OAuth:', error);
                    app.showToast('❌ Ошибка авторизации Google');
                }
            });
            console.log('OAuth клиент инициализирован');
        } catch (error) {
            console.error('Ошибка инициализации OAuth клиента:', error);
        }
    }

    async handleTokenResponse(response) {
        this.accessToken = response.access_token;
        
        // Сохраняем токен
        const expiryTime = Date.now() + (response.expires_in * 1000);
        localStorage.setItem('googleAccessToken', this.accessToken);
        localStorage.setItem('googleTokenExpiry', expiryTime.toString());
        
        // Загружаем информацию о пользователе
        await this.loadUserInfo();
    }

    async loadUserInfo() {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            
            if (!response.ok) {
                throw new Error('Не удалось загрузить профиль');
            }
            
            this.userInfo = await response.json();
            localStorage.setItem('googleUserInfo', JSON.stringify(this.userInfo));
            
            console.log('Пользователь авторизован:', this.userInfo.email);
            
            // Обновляем UI
            this.updateUI();
            app.showToast('✅ Вход выполнен: ' + this.userInfo.name);
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
            app.showToast('❌ Не удалось загрузить профиль');
        }
    }

    async checkSavedSession() {
        if (this.accessToken && this.userInfo) {
            // Проверяем валидность токена
            try {
                const response = await fetch(
                    `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${this.accessToken}`
                );
                
                if (response.ok) {
                    console.log('Сохраненная сессия активна');
                    this.updateUI();
                } else {
                    console.log('Сохраненный токен невалиден');
                    this.clearSession();
                }
            } catch (error) {
                console.error('Ошибка проверки токена:', error);
                this.clearSession();
            }
        } else {
            this.showLoginButton();
        }
    }

    login() {
        if (!this.tokenClient) {
            app.showToast('❌ Google API не инициализирован');
            return;
        }
        
        if (!this.CLIENT_ID) {
            this.requestDevCredentials();
            return;
        }
        
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
    }

    disconnect() {
        if (confirm('Отключить Google аккаунт?\n\nЛокальные данные сохранятся.')) {
            if (this.accessToken) {
                google.accounts.oauth2.revoke(this.accessToken, () => {
                    console.log('Токен отозван');
                });
            }
            
            this.clearSession();
            this.showLoginButton();
            app.showToast('🔌 Аккаунт отключен');
        }
    }

    async syncToDrive() {
        if (!this.accessToken) {
            app.showToast('❌ Войдите в Google аккаунт');
            return;
        }

        app.showToast('🔄 Синхронизация с Google Диском...');

        try {
            // Создаем или находим папку Vault
            if (!this.driveFolderId) {
                await this.findOrCreateVaultFolder();
            }

            // Сохраняем данные
            const vaultData = JSON.stringify(app.data, null, 2);
            const fileName = `vault_backup_${new Date().toISOString().split('T')[0]}.json`;
            
            const file = new Blob([vaultData], { type: 'application/json' });
            const metadata = {
                name: fileName,
                mimeType: 'application/json',
                parents: [this.driveFolderId]
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            await gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: { uploadType: 'multipart' },
                body: form
            });

            app.showToast('✅ Синхронизировано с Google Диском');
        } catch (error) {
            console.error('Ошибка синхронизации:', error);
            app.showToast('❌ Ошибка синхронизации: ' + error.message);
        }
    }

    async findOrCreateVaultFolder() {
        try {
            // Ищем существующую папку
            const response = await gapi.client.drive.files.list({
                q: "name='Vault Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false",
                fields: 'files(id, name)',
                spaces: 'drive'
            });

            if (response.result.files.length > 0) {
                this.driveFolderId = response.result.files[0].id;
            } else {
                // Создаем новую папку
                const folder = await gapi.client.drive.files.create({
                    resource: {
                        name: 'Vault Backups',
                        mimeType: 'application/vnd.google-apps.folder'
                    },
                    fields: 'id'
                });
                this.driveFolderId = folder.result.id;
            }

            localStorage.setItem('googleDriveFolderId', this.driveFolderId);
        } catch (error) {
            console.error('Ошибка создания папки:', error);
            throw error;
        }
    }

    clearSession() {
        this.accessToken = null;
        this.userInfo = null;
        this.driveFolderId = null;
        localStorage.removeItem('googleAccessToken');
        localStorage.removeItem('googleUserInfo');
        localStorage.removeItem('googleDriveFolderId');
        localStorage.removeItem('googleTokenExpiry');
    }

    updateUI() {
        const authSection = document.getElementById('googleAuthSection');
        if (!authSection) return;

        if (this.userInfo) {
            authSection.innerHTML = `
                <div class="user-info">
                    <img src="${this.userInfo.picture}" alt="${this.userInfo.name}" class="user-avatar" 
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👤</text></svg>'">
                    <div style="flex: 1; min-width: 0;">
                        <div class="user-name">${this.escapeHtml(this.userInfo.name)}</div>
                        <div class="user-email">${this.escapeHtml(this.userInfo.email)}</div>
                    </div>
                    <button class="logout-btn" onclick="googleAuth.disconnect()">Выйти</button>
                </div>
            `;
        } else {
            this.showLoginButton();
        }
    }

    showLoginButton() {
        const authSection = document.getElementById('googleAuthSection');
        if (!authSection) return;

        authSection.innerHTML = `
            <button class="google-btn" onclick="googleAuth.login()">
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Войти через Google
            </button>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px; text-align: center;">
                Для синхронизации с Google Диском
            </div>
        `;
    }

    showSetupInstructions() {
        const authSection = document.getElementById('googleAuthSection');
        if (!authSection) return;

        authSection.innerHTML = `
            <div style="padding: 12px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; text-align: center;">
                <p style="color: var(--accent-red); margin-bottom: 8px;">⚠️ Google API не настроен</p>
                <p style="font-size: 12px; color: var(--text-secondary);">
                    Добавьте GOOGLE_CLIENT_ID и GOOGLE_API_KEY в переменные окружения Vercel
                </p>
                <button onclick="googleAuth.requestDevCredentials()" 
                        style="margin-top: 8px; padding: 6px 12px; background: var(--accent-blue); border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px;">
                    🔑 Ввести ключи для разработки
                </button>
            </div>
        `;
    }

    requestDevCredentials() {
        const clientId = prompt(
            'Введите Google Client ID для локальной разработки:\n\n' +
            'Можно получить в Google Cloud Console → APIs & Services → Credentials\n\n' +
            'Текущее значение: ' + (this.CLIENT_ID || 'не задано'),
            this.CLIENT_ID || ''
        );
        
        if (clientId) {
            this.CLIENT_ID = clientId;
            localStorage.setItem('dev_google_client_id', clientId);
        }
        
        const apiKey = prompt(
            'Введите Google API Key для локальной разработки:\n\n' +
            'Можно получить в Google Cloud Console → APIs & Services → Credentials\n\n' +
            'Текущее значение: ' + (this.API_KEY || 'не задано'),
            this.API_KEY || ''
        );
        
        if (apiKey) {
            this.API_KEY = apiKey;
            localStorage.setItem('dev_google_api_key', apiKey);
        }
        
        if (clientId && apiKey) {
            app.showToast('✅ Ключи сохранены. Перезагрузите страницу.');
            setTimeout(() => location.reload(), 1500);
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Создаем глобальный экземпляр
let googleAuth;
window.addEventListener('DOMContentLoaded', () => {
    googleAuth = new GoogleAuth();
    window.googleAuth = googleAuth;
});
