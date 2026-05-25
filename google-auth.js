class GoogleAuth {
    constructor() {
        this.CLIENT_ID = window.ENV?.GOOGLE_CLIENT_ID;
        this.API_KEY = window.ENV?.GOOGLE_API_KEY;
        this.accessToken = null;
        this.userInfo = null;
        this.tokenClient = null;
        
        this.SCOPES = 'https://www.googleapis.com/auth/drive.file';
        
        this.init();
    }

    async init() {
        if (!this.CLIENT_ID || !this.API_KEY) {
            console.error('Google API ключи не настроены');
            this.showSetupInstructions();
            return;
        }

        try {
            await this.waitForGoogleAPI();
            await this.initGapiClient();
            this.initTokenClient();
            console.log('Google API инициализирован');
        } catch (error) {
            console.error('Ошибка инициализации:', error);
        }
    }

    async waitForGoogleAPI() {
        return new Promise((resolve) => {
            const check = () => {
                if (typeof google !== 'undefined' && google.accounts) {
                    resolve();
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    async initGapiClient() {
        return new Promise((resolve, reject) => {
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
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: (response) => {
                if (response.error) {
                    console.error('Ошибка авторизации:', response.error);
                    return;
                }
                this.accessToken = response.access_token;
                this.loadUserInfo();
            },
        });
    }

    async loadUserInfo() {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            this.userInfo = await response.json();
            this.updateUI(true);
            app.showToast('✅ Вход выполнен: ' + this.userInfo.name);
        } catch (error) {
            console.error('Ошибка загрузки профиля:', error);
        }
    }

    login() {
        if (!this.tokenClient) {
            app.showToast('❌ Google API не инициализирован', 'error');
            return;
        }
        this.tokenClient.requestAccessToken({ prompt: 'consent' });
    }

    disconnect() {
        this.accessToken = null;
        this.userInfo = null;
        this.updateUI(false);
        app.showToast('🔌 Аккаунт отключен');
    }

    updateUI(isConnected) {
        const authSection = document.getElementById('googleAuthSection');
        if (!authSection) return;

        if (isConnected && this.userInfo) {
            authSection.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                    <img src="${this.userInfo.picture}" style="width: 40px; height: 40px; border-radius: 50%;">
                    <div style="flex: 1;">
                        <div style="font-weight: 600;">${this.userInfo.name}</div>
                        <div style="font-size: 12px; color: var(--text-secondary);">${this.userInfo.email}</div>
                    </div>
                    <button onclick="googleAuth.disconnect()" style="padding: 6px 12px; background: var(--accent-red); border: none; border-radius: 6px; color: white; cursor: pointer;">Выйти</button>
                </div>
            `;
        } else {
            authSection.innerHTML = `
                <button onclick="googleAuth.login()" style="width: 100%; padding: 12px; background: #4285F4; border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;">
                    <svg width="20" height="20" viewBox="0 0 24 24"><path fill="white" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="white" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="white" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="white" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Войти через Google
                </button>
            `;
        }
    }

    showSetupInstructions() {
        const authSection = document.getElementById('googleAuthSection');
        if (!authSection) return;
        
        authSection.innerHTML = `
            <div style="padding: 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; text-align: center;">
                <p style="color: var(--accent-red); margin-bottom: 8px;">⚠️ Google API не настроен</p>
                <p style="font-size: 12px; color: var(--text-secondary);">Добавьте GOOGLE_CLIENT_ID и GOOGLE_API_KEY в переменные окружения Vercel</p>
            </div>
        `;
    }
}

let googleAuth;
window.addEventListener('DOMContentLoaded', () => {
    googleAuth = new GoogleAuth();
    window.googleAuth = googleAuth;
});
