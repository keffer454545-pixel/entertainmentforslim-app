// google-auth.js - Полная интеграция с Google API
class GoogleAuth {
    constructor() {
        // Конфигурация (будет переопределена из переменных окружения или мета-тегов)
        this.CLIENT_ID = null;
        this.API_KEY = null;
        
        // Области доступа
        this.SCOPES = [
            'https://www.googleapis.com/auth/drive.file',      // Доступ к файлам приложения на Диске
            'https://www.googleapis.com/auth/userinfo.profile', // Имя и аватар
            'https://www.googleapis.com/auth/userinfo.email'    // Email
        ].join(' ');
        
        // API discovery документы
        this.DISCOVERY_DOCS = [
            'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'
        ];
        
        // Состояние
        this.tokenClient = null;
        this.accessToken = null;
        this.userInfo = null;
        this.driveFolderId = null;
        this.driveFileId = null;
        this.isInitialized = false;
        
        // Определяем окружение
        this.isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
        this.isProduction = !this.isLocalhost && window.location.protocol === 'https:';
        
        // Загружаем конфигурацию
        this.loadConfiguration();
        
        // Инициализируем после загрузки страницы
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
        } else {
            this.init();
        }
    }

    /**
     * Загрузка конфигурации из разных источников
     */
    loadConfiguration() {
        // 1. Пытаемся получить из переменных окружения (для production)
        if (window.ENV) {
            this.CLIENT_ID = window.ENV.GOOGLE_CLIENT_ID || null;
            this.API_KEY = window.ENV.GOOGLE_API_KEY || null;
        }
        
        // 2. Пытаемся получить из мета-тегов
        if (!this.CLIENT_ID) {
            const clientIdMeta = document.querySelector('meta[name="google-client-id"]');
            if (clientIdMeta && clientIdMeta.content !== '__GOOGLE_CLIENT_ID__') {
                this.CLIENT_ID = clientIdMeta.content;
            }
        }
        
        if (!this.API_KEY) {
            const apiKeyMeta = document.querySelector('meta[name="google-api-key"]');
            if (apiKeyMeta && apiKeyMeta.content !== '__GOOGLE_API_KEY__') {
                this.API_KEY = apiKeyMeta.content;
            }
        }
        
        // 3. Для локальной разработки - запрашиваем у пользователя
        if (this.isLocalhost && (!this.CLIENT_ID || !this.API_KEY)) {
            this.CLIENT_ID = this.CLIENT_ID || localStorage.getItem('dev_google_client_id');
            this.API_KEY = this.API_KEY || localStorage.getItem('dev_google_api_key');
        }
        
        // 4. Загружаем сохраненные данные
        this.loadSavedState();
        
        console.log('Google Auth Configuration:', {
            hasClientId: !!this.CLIENT_ID,
            hasApiKey: !!this.API_KEY,
            isLocalhost: this.isLocalhost,
            isProduction: this.isProduction,
            hasAccessToken: !!this.accessToken,
            hasUserInfo: !!this.userInfo
        });
    }

    /**
     * Загрузка сохраненного состояния
     */
    loadSavedState() {
        try {
            const savedToken = localStorage.getItem('googleAccessToken');
            const savedUser = localStorage.getItem('googleUserInfo');
            const savedDriveFolder = localStorage.getItem('googleDriveFolderId');
            const savedDriveFile = localStorage.getItem('googleDriveFileId');
            const tokenExpiry = localStorage.getItem('googleTokenExpiry');
            
            // Проверяем, не истек ли токен
            if (savedToken && tokenExpiry) {
                const expiryTime = parseInt(tokenExpiry);
                if (Date.now() < expiryTime) {
                    this.accessToken = savedToken;
                    if (savedUser) {
                        this.userInfo = JSON.parse(savedUser);
                    }
                    this.driveFolderId = savedDriveFolder;
                    this.driveFileId = savedDriveFile;
                    
                    console.log('Загружено сохраненное состояние Google');
                } else {
                    console.log('Сохраненный токен истек, требуется новый вход');
                    this.clearSavedState();
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки сохраненного состояния:', error);
            this.clearSavedState();
        }
    }

    /**
     * Инициализация Google API
     */
    async init() {
        if (!this.CLIENT_ID || !this.API_KEY) {
            console.warn('Google API не настроен. Пропускаем инициализацию.');
            this.showSetupInstructions();
            return;
        }

        // Ждем загрузки Google API скриптов
        await this.waitForGoogleAPI();
        
        try {
            // Загружаем клиентскую библиотеку
            await this.loadGapiClient();
            
            // Инициализируем клиент с API ключом
            await this.initGapiClient();
            
            // Инициализируем OAuth клиент
            this.initOAuthClient();
            
            this.isInitialized = true;
            console.log('Google API успешно инициализирован');
            
            // Если есть сохраненный пользователь - обновляем UI
            if (this.userInfo) {
                this.updateUI(true);
                
                // Проверяем валидность токена в фоне
                this.validateToken();
            }
        } catch (error) {
            console.error('Ошибка инициализации Google API:', error);
            this.showError('Не удалось инициализировать Google API');
        }
    }

    /**
     * Ожидание загрузки Google API скриптов
     */
    async waitForGoogleAPI() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 секунд максимум
            
            const checkAPI = () => {
                if (typeof google !== 'undefined' && google.accounts) {
                    console.log('Google API загружен');
                    resolve();
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(checkAPI, 100);
                } else {
                    console.error('Google API не загрузился после ожидания');
                    resolve(); // Продолжаем без Google API
                }
            };
            
            checkAPI();
        });
    }

    /**
     * Загрузка GAPI клиента
     */
    async loadGapiClient() {
        return new Promise((resolve, reject) => {
            try {
                if (typeof gapi === 'undefined') {
                    // Создаем gapi если его нет
                    const script = document.createElement('script');
                    script.src = 'https://apis.google.com/js/api.js';
                    script.onload = () => {
                        console.log('GAPI загружен');
                        gapi.load('client', {
                            callback: resolve,
                            onerror: reject,
                            timeout: 5000,
                            ontimeout: reject
                        });
                    };
                    script.onerror = reject;
                    document.head.appendChild(script);
                } else {
                    gapi.load('client', {
                        callback: resolve,
                        onerror: reject,
                        timeout: 5000,
                        ontimeout: reject
                    });
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Инициализация GAPI клиента
     */
    async initGapiClient() {
        try {
            await gapi.client.init({
                apiKey: this.API_KEY,
                discoveryDocs: this.DISCOVERY_DOCS,
            });
            console.log('GAPI клиент инициализирован');
        } catch (error) {
            console.error('Ошибка инициализации GAPI клиента:', error);
            throw error;
        }
    }

    /**
     * Инициализация OAuth клиента
     */
    initOAuthClient() {
        try {
            this.tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: this.CLIENT_ID,
                scope: this.SCOPES,
                callback: (tokenResponse) => {
                    this.handleTokenResponse(tokenResponse);
                },
                error_callback: (error) => {
                    console.error('Ошибка OAuth:', error);
                    app.showToast('❌ Ошибка авторизации Google', 'error');
                }
            });
            console.log('OAuth клиент инициализирован');
        } catch (error) {
            console.error('Ошибка инициализации OAuth клиента:', error);
        }
    }

    /**
     * Обработка ответа с токеном
     */
    async handleTokenResponse(tokenResponse) {
        if (tokenResponse.error) {
            console.error('Ошибка получения токена:', tokenResponse.error);
            app.showToast('❌ Ошибка авторизации', 'error');
            return;
        }

        this.accessToken = tokenResponse.access_token;
        
        // Сохраняем токен с временем истечения
        const expiryTime = Date.now() + (tokenResponse.expires_in * 1000);
        this.saveState(expiryTime);
        
        // Загружаем информацию о пользователе
        await this.loadUserInfo();
    }

    /**
     * Загрузка информации о пользователе
     */
    async loadUserInfo() {
        try {
            const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.userInfo = await response.json();
            console.log('Информация о пользователе загружена:', this.userInfo.email);
            
            // Сохраняем информацию
            localStorage.setItem('googleUserInfo', JSON.stringify(this.userInfo));
            
            // Создаем или находим папку Vault на Google Диске
            await this.findOrCreateVaultFolder();
            
            // Обновляем UI
            this.updateUI(true);
            
            app.showToast('✅ Вход выполнен: ' + this.userInfo.name);
        } catch (error) {
            console.error('Ошибка загрузки информации пользователя:', error);
            app.showToast('❌ Не удалось загрузить профиль', 'error');
        }
    }

    /**
     * Вход в Google аккаунт
     */
    async login() {
        if (!this.CLIENT_ID) {
            app.showToast('❌ Google Client ID не настроен', 'error');
            this.requestDevCredentials();
            return;
        }
        
        if (!this.tokenClient) {
            app.showToast('❌ Google API не инициализирован. Перезагрузите страницу.', 'error');
            return;
        }

        try {
            // Для локальной разработки может потребоваться дополнительная настройка
            if (this.isLocalhost) {
                console.log('Запрос токена для локальной разработки');
            }
            
            this.tokenClient.requestAccessToken({
                prompt: 'consent' // Всегда показываем окно выбора аккаунта
            });
        } catch (error) {
            console.error('Ошибка входа:', error);
            app.showToast('❌ Ошибка входа. Проверьте консоль.', 'error');
        }
    }

    /**
     * Проверка валидности токена
     */
    async validateToken() {
        if (!this.accessToken) return;
        
        try {
            const response = await fetch(
                `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${this.accessToken}`
            );
            
            if (!response.ok) {
                console.log('Токен невалиден, требуется повторный вход');
                await this.refreshToken();
            } else {
                console.log('Токен валиден');
            }
        } catch (error) {
            console.error('Ошибка проверки токена:', error);
            await this.refreshToken();
        }
    }

    /**
     * Обновление токена
     */
    async refreshToken() {
        console.log('Попытка обновления токена...');
        
        try {
            // Пытаемся получить новый токен без показа окна
            this.tokenClient.requestAccessToken({
                prompt: '' // Без показа окна, если возможно
            });
        } catch (error) {
            console.error('Не удалось обновить токен:', error);
            this.disconnect(true); // Тихое отключение
            app.showToast('⚠️ Сессия истекла. Войдите снова.', 'error');
        }
    }

    /**
     * Поиск или создание папки Vault на Google Диске
     */
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
                console.log('Найдена существующая папка Vault:', this.driveFolderId);
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
                console.log('Создана новая папка Vault:', this.driveFolderId);
            }

            localStorage.setItem('googleDriveFolderId', this.driveFolderId);
            
            // Ищем последний файл бэкапа
            await this.findLatestBackup();
        } catch (error) {
            console.error('Ошибка создания папки:', error);
            app.showToast('❌ Не удалось создать папку на Диске', 'error');
        }
    }

    /**
     * Поиск последнего бэкапа
     */
    async findLatestBackup() {
        try {
            const response = await gapi.client.drive.files.list({
                q: `'${this.driveFolderId}' in parents and mimeType='application/json' and trashed=false`,
                fields: 'files(id, name, modifiedTime)',
                orderBy: 'modifiedTime desc',
                pageSize: 1
            });

            if (response.result.files.length > 0) {
                this.driveFileId = response.result.files[0].id;
                localStorage.setItem('googleDriveFileId', this.driveFileId);
                
                const fileInfo = response.result.files[0];
                console.log('Найден последний бэкап:', fileInfo.name, 
                           'от', new Date(fileInfo.modifiedTime).toLocaleString());
            }
        } catch (error) {
            console.error('Ошибка поиска бэкапа:', error);
        }
    }

    /**
     * Синхронизация с Google Диском
     */
    async syncToDrive() {
        if (!this.accessToken) {
            app.showToast('❌ Войдите в Google аккаунт', 'error');
            return;
        }

        app.showToast('🔄 Синхронизация с Google Диском...');
        
        const syncBtn = document.getElementById('syncToDriveBtn');
        if (syncBtn) {
            syncBtn.disabled = true;
            syncBtn.innerHTML = '⏳ Синхронизация...';
        }

        try {
            const vaultData = JSON.stringify(app.data, null, 2);
            const fileName = `vault_backup_${new Date().toISOString().split('T')[0]}.json`;

            if (this.driveFileId) {
                // Обновляем существующий файл
                await gapi.client.request({
                    path: `/upload/drive/v3/files/${this.driveFileId}`,
                    method: 'PATCH',
                    params: {
                        uploadType: 'media'
                    },
                    body: vaultData
                });
                console.log('Файл обновлен:', this.driveFileId);
            } else {
                // Создаем новый файл
                const file = new Blob([vaultData], { type: 'application/json' });
                const metadata = {
                    name: fileName,
                    mimeType: 'application/json',
                    parents: [this.driveFolderId]
                };

                const form = new FormData();
                form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
                form.append('file', file);

                const response = await gapi.client.request({
                    path: '/upload/drive/v3/files',
                    method: 'POST',
                    params: {
                        uploadType: 'multipart'
                    },
                    body: form
                });

                this.driveFileId = response.result.id;
                localStorage.setItem('googleDriveFileId', this.driveFileId);
                console.log('Создан новый файл:', this.driveFileId);
            }

            // Обновляем информацию о файле
            this.updateDriveFileInfo(fileName);
            app.showToast('✅ Синхронизировано с Google Диском');
        } catch (error) {
            console.error('Ошибка синхронизации:', error);
            app.showToast('❌ Ошибка синхронизации с Диском', 'error');
        } finally {
            if (syncBtn) {
                syncBtn.disabled = false;
                syncBtn.innerHTML = '🔄 Синхронизировать с Диском';
            }
        }
    }

    /**
     * Экспорт на Google Диск
     */
    async exportToDrive() {
        if (!this.accessToken) {
            app.showToast('❌ Войдите в Google аккаунт', 'error');
            return;
        }

        app.showToast('📤 Экспорт на Google Диск...');
        
        const exportBtn = document.getElementById('exportToDriveBtn');
        if (exportBtn) {
            exportBtn.disabled = true;
            exportBtn.innerHTML = '⏳ Экспорт...';
        }

        try {
            const vaultData = JSON.stringify(app.data, null, 2);
            const fileName = `vault_export_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

            const file = new Blob([vaultData], { type: 'application/json' });
            const metadata = {
                name: fileName,
                mimeType: 'application/json',
                parents: [this.driveFolderId]
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', file);

            const response = await gapi.client.request({
                path: '/upload/drive/v3/files',
                method: 'POST',
                params: {
                    uploadType: 'multipart'
                },
                body: form
            });

            console.log('Файл экспортирован:', response.result.id);
            
            this.updateDriveFileInfo(fileName);
            app.showToast('✅ Экспортировано на Google Диск');
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            app.showToast('❌ Ошибка экспорта на Диск', 'error');
        } finally {
            if (exportBtn) {
                exportBtn.disabled = false;
                exportBtn.innerHTML = '📤 Экспорт на Диск';
            }
        }
    }

    /**
     * Импорт с Google Диска
     */
    async importFromDrive() {
        if (!this.accessToken) {
            app.showToast('❌ Войдите в Google аккаунт', 'error');
            return;
        }

        app.showToast('📥 Загрузка списка файлов...');
        
        const importBtn = document.getElementById('importFromDriveBtn');
        if (importBtn) {
            importBtn.disabled = true;
            importBtn.innerHTML = '⏳ Загрузка...';
        }

        try {
            // Получаем список файлов в папке Vault
            const response = await gapi.client.drive.files.list({
                q: `'${this.driveFolderId}' in parents and mimeType='application/json' and trashed=false`,
                fields: 'files(id, name, modifiedTime, size)',
                orderBy: 'modifiedTime desc',
                pageSize: 10
            });

            const files = response.result.files;

            if (files.length === 0) {
                app.showToast('❌ Нет файлов на Google Диске', 'error');
                return;
            }

            // Показываем диалог выбора файла
            const fileList = files.map((f, i) => 
                `${i + 1}. ${f.name} (${this.formatFileSize(f.size)}, ${new Date(f.modifiedTime).toLocaleString()})`
            ).join('\n');
            
            const choice = prompt(
                `Выберите файл для импорта:\n\n${fileList}\n\nВведите номер:`,
                '1'
            );

            if (!choice) return;

            const index = parseInt(choice) - 1;
            if (index < 0 || index >= files.length) {
                app.showToast('❌ Неверный выбор', 'error');
                return;
            }

            // Загружаем выбранный файл
            app.showToast('📥 Загрузка файла...');
            
            const fileResponse = await gapi.client.drive.files.get({
                fileId: files[index].id,
                alt: 'media'
            });

            const importedData = JSON.parse(fileResponse.body);

            if (importedData.categories && Array.isArray(importedData.categories)) {
                if (confirm(
                    `Импортировать данные из "${files[index].name}"?\n\n` +
                    `Дата: ${new Date(files[index].modifiedTime).toLocaleString()}\n` +
                    `Размер: ${this.formatFileSize(files[index].size)}\n\n` +
                    `Текущие данные будут заменены.`
                )) {
                    app.data = importedData;
                    app.saveData();
                    app.currentCategory = null;
                    app.renderCategories();
                    app.renderCards();
                    app.showToast('✅ Данные импортированы с Google Диска');
                }
            } else {
                app.showToast('❌ Неверный формат файла', 'error');
            }
        } catch (error) {
            console.error('Ошибка импорта:', error);
            app.showToast('❌ Ошибка импорта с Диска', 'error');
        } finally {
            if (importBtn) {
                importBtn.disabled = false;
                importBtn.innerHTML = '📥 Импорт с Диска';
            }
        }
    }

    /**
     * Обновление информации о файле на Диске
     */
    updateDriveFileInfo(fileName = null) {
        const info = document.getElementById('driveFileInfo');
        if (!info) return;
        
        if (fileName) {
            info.style.display = 'block';
            info.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 4px;">📄 Последняя синхронизация</div>
                <div>🕒 ${new Date().toLocaleString()}</div>
                <div>📁 ${fileName}</div>
            `;
        }
    }

    /**
     * Выход из Google аккаунта
     */
    disconnect(silent = false) {
        if (!silent) {
            if (!confirm('Отключить Google аккаунт?\n\nЛокальные данные сохранятся.')) {
                return;
            }
        }
        
        // Отзываем токен
        if (this.accessToken) {
            try {
                google.accounts.oauth2.revoke(this.accessToken, () => {
                    console.log('Токен отозван');
                });
            } catch (error) {
                console.error('Ошибка отзыва токена:', error);
            }
        }
        
        // Очищаем состояние
        this.clearSavedState();
        this.accessToken = null;
        this.userInfo = null;
        this.driveFolderId = null;
        this.driveFileId = null;
        
        // Обновляем UI
        this.updateUI(false);
        
        if (!silent) {
            app.showToast('Google аккаунт отключен');
        }
    }

    /**
     * Очистка сохраненного состояния
     */
    clearSavedState() {
        localStorage.removeItem('googleAccessToken');
        localStorage.removeItem('googleUserInfo');
        localStorage.removeItem('googleDriveFolderId');
        localStorage.removeItem('googleDriveFileId');
        localStorage.removeItem('googleTokenExpiry');
    }

    /**
     * Сохранение состояния
     */
    saveState(tokenExpiry) {
        localStorage.setItem('googleAccessToken', this.accessToken);
        localStorage.setItem('googleTokenExpiry', tokenExpiry.toString());
        if (this.userInfo) {
            localStorage.setItem('googleUserInfo', JSON.stringify(this.userInfo));
        }
        if (this.driveFolderId) {
            localStorage.setItem('googleDriveFolderId', this.driveFolderId);
        }
        if (this.driveFileId) {
            localStorage.setItem('googleDriveFileId', this.driveFileId);
        }
    }

    /**
     * Обновление UI в зависимости от состояния авторизации
     */
    updateUI(isConnected) {
        const authSection = document.getElementById('googleAuthSection');
        if (!authSection) return;

        const syncBtn = document.getElementById('syncToDriveBtn');
        const exportBtn = document.getElementById('exportToDriveBtn');
        const importBtn = document.getElementById('importFromDriveBtn');
        const driveInfo = document.getElementById('driveFileInfo');

        if (isConnected && this.userInfo) {
            // Показываем информацию о пользователе
            authSection.innerHTML = `
                <div class="google-user-info">
                    <img class="google-avatar" 
                         src="${this.escapeHtml(this.userInfo.picture)}" 
                         alt="${this.escapeHtml(this.userInfo.name)}"
                         onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👤</text></svg>'">
                    <div style="flex: 1; min-width: 0;">
                        <div class="google-user-name" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${this.escapeHtml(this.userInfo.name)}
                        </div>
                        <div class="google-user-email" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${this.escapeHtml(this.userInfo.email)}
                        </div>
                    </div>
                    <button class="disconnect-btn" onclick="googleAuth.disconnect()" title="Отключить аккаунт">
                        ✕
                    </button>
                </div>
            `;
            
            // Активируем кнопки
            [syncBtn, exportBtn, importBtn].forEach(btn => {
                if (btn) {
                    btn.disabled = false;
                    btn.style.opacity = '1';
                }
            });
            
            // Показываем информацию о файле, если есть
            if (this.driveFileId && driveInfo) {
                driveInfo.style.display = 'block';
            }
        } else {
            // Показываем кнопку входа
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
            
            // Деактивируем кнопки
            [syncBtn, exportBtn, importBtn].forEach(btn => {
                if (btn) {
                    btn.disabled = true;
                    btn.style.opacity = '0.5';
                }
            });
            
            // Скрываем информацию о файле
            if (driveInfo) {
                driveInfo.style.display = 'none';
            }
        }
    }

    /**
     * Показать инструкции по настройке
     */
    showSetupInstructions() {
        const authSection = document.getElementById('googleAuthSection');
        if (!authSection) return;
        
        authSection.innerHTML = `
            <div style="padding: 12px; background: var(--bg-tertiary); border-radius: 8px;">
                <div style="font-weight: 600; margin-bottom: 8px;">🔧 Настройка Google интеграции</div>
                <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.5;">
                    <p style="margin-bottom: 8px;">Для работы с Google Диском необходимо настроить Google Cloud:</p>
                    <ol style="margin: 8px 0; padding-left: 16px;">
                        <li>Создать проект в <a href="https://console.cloud.google.com/" target="_blank" style="color: var(--accent-blue);">Google Cloud Console</a></li>
                        <li>Включить Google Drive API</li>
                        <li>Создать OAuth 2.0 Client ID</li>
                        <li>Добавить этот домен в разрешенные</li>
                    </ol>
                    ${this.isLocalhost ? `
                        <button onclick="googleAuth.requestDevCredentials()" 
                                style="margin-top: 8px; padding: 6px 12px; background: var(--accent-blue); border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px; width: 100%;">
                            🔑 Ввести ключи для разработки
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Деактивируем кнопки
        ['syncToDriveBtn', 'exportToDriveBtn', 'importFromDriveBtn'].forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
            }
        });
    }

    /**
     * Показать ошибку
     */
    showError(message) {
        const authSection = document.getElementById('googleAuthSection');
        if (!authSection) return;
        
        authSection.innerHTML = `
            <div style="padding: 12px; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3);">
                <div style="font-weight: 600; color: var(--accent-red); margin-bottom: 4px;">❌ Ошибка</div>
                <div style="font-size: 12px; color: var(--text-secondary);">${this.escapeHtml(message)}</div>
                <button onclick="location.reload()" 
                        style="margin-top: 8px; padding: 6px 12px; background: var(--accent-red); border: none; border-radius: 6px; color: white; cursor: pointer; font-size: 12px;">
                    🔄 Перезагрузить страницу
                </button>
            </div>
        `;
    }

    /**
     * Запрос учетных данных для разработки
     */
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

    /**
     * Форматирование размера файла
     */
    formatFileSize(bytes) {
        if (!bytes) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
    }

    /**
     * Экранирование HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Создаем глобальный экземпляр
let googleAuth;
document.addEventListener('DOMContentLoaded', () => {
    googleAuth = new GoogleAuth();
    
    // Экспортируем для использования в других скриптах
    window.googleAuth = googleAuth;
});

// Для отладки
if (typeof module !== 'undefined' && module.exports) {
    module.exports = GoogleAuth;
}