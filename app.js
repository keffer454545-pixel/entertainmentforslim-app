// app.js
class VaultApp {
    constructor() {
        this.data = {
            categories: [],
            settings: { theme: 'dark', view: 'grid' }
        };
        
        this.currentCategory = null;
        this.currentFilter = 'all';
        this.currentCard = null;
        this.currentCoverIndex = 0;
        this.googleLoggedIn = false;
        
        this.init();
    }

    init() {
        this.loadData();
        this.applyTheme();
        this.renderCategories();
        this.renderCards();
        this.setupEventListeners();
        this.tryLoadFromCloud();
    }

    loadData() {
        const saved = localStorage.getItem('vaultData');
        if (saved) {
            try {
                this.data = JSON.parse(saved);
            } catch (e) {
                console.error('Ошибка загрузки:', e);
            }
        }
    }

    saveData() {
        localStorage.setItem('vaultData', JSON.stringify(this.data));
    }

    applyTheme() {
        document.body.className = this.data.settings.theme === 'light' ? 'light-theme' : '';
    }

    setTheme(theme) {
        this.data.settings.theme = theme;
        this.saveData();
        this.applyTheme();
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent.includes(theme === 'dark' ? 'Темная' : 'Светлая'));
        });
        this.showToast(`Тема изменена на ${theme === 'dark' ? 'темную' : 'светлую'}`);
    }

    // Категории
    renderCategories() {
        const container = document.getElementById('categoriesList');
        container.innerHTML = '';
        
        const allItem = document.createElement('div');
        allItem.className = `category-item ${!this.currentCategory ? 'active' : ''}`;
        allItem.innerHTML = `
            <span class="category-color" style="background: linear-gradient(135deg, #667eea, #764ba2);"></span>
            <span class="category-name">📚 Все карточки</span>
            <span class="category-count">${this.getTotalCards()}</span>
        `;
        allItem.onclick = () => this.selectCategory(null);
        container.appendChild(allItem);
        
        this.data.categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = `category-item ${this.currentCategory === cat.id ? 'active' : ''}`;
            item.innerHTML = `
                <span class="category-color" style="background: ${cat.color};"></span>
                <span class="category-name">${cat.icon} ${cat.name}</span>
                <span class="category-count">${cat.cards.length}</span>
            `;
            item.onclick = () => this.selectCategory(cat.id);
            item.oncontextmenu = (e) => {
                e.preventDefault();
                this.showCategoryMenu(e, cat);
            };
            container.appendChild(item);
        });
    }

    selectCategory(categoryId) {
        this.currentCategory = categoryId;
        document.getElementById('categoryTitle').textContent = 
            categoryId ? this.data.categories.find(c => c.id === categoryId)?.name || 'Категория' : 'Все карточки';
        this.renderCategories();
        this.renderCards();
        
        // Очищаем поиск при смене категории
        document.getElementById('globalSearch').value = '';
    }

    showAddCategoryModal() {
        document.getElementById('modalCategoryId').value = '';
        document.getElementById('modalCategoryName').value = '';
        document.getElementById('modalCategoryIcon').value = '📁';
        document.getElementById('modalCategoryColor').value = '#8b5cf6';
        document.getElementById('categoryModal').classList.add('active');
    }

    saveCategory() {
        const id = document.getElementById('modalCategoryId').value;
        const category = {
            id: id || 'cat_' + Date.now(),
            name: document.getElementById('modalCategoryName').value,
            icon: document.getElementById('modalCategoryIcon').value,
            color: document.getElementById('modalCategoryColor').value,
            cards: id ? this.data.categories.find(c => c.id === id)?.cards || [] : []
        };
        
        if (!category.name) {
            this.showToast('Введите название категории!', 'error');
            return;
        }
        
        if (id) {
            const index = this.data.categories.findIndex(c => c.id === id);
            if (index !== -1) this.data.categories[index] = { ...this.data.categories[index], ...category };
        } else {
            this.data.categories.push(category);
        }
        
        this.saveData();
        this.renderCategories();
        this.closeCategoryModal();
        this.showToast('Категория сохранена');
    }

    closeCategoryModal() {
        document.getElementById('categoryModal').classList.remove('active');
    }

    showCategoryMenu(e, category) {
        const menu = document.createElement('div');
        menu.style.cssText = `
            position: fixed;
            background: var(--bg-secondary);
            border: 1px solid var(--glass-border);
            border-radius: 8px;
            padding: 8px 0;
            z-index: 3000;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;
        
        const edit = document.createElement('div');
        edit.textContent = '✏️ Редактировать';
        edit.style.cssText = 'padding: 8px 16px; cursor: pointer;';
        edit.onclick = () => {
            document.getElementById('modalCategoryId').value = category.id;
            document.getElementById('modalCategoryName').value = category.name;
            document.getElementById('modalCategoryIcon').value = category.icon;
            document.getElementById('modalCategoryColor').value = category.color;
            document.getElementById('categoryModal').classList.add('active');
            menu.remove();
        };
        
        const del = document.createElement('div');
        del.textContent = '🗑️ Удалить';
        del.style.cssText = 'padding: 8px 16px; cursor: pointer; color: #ef4444;';
        del.onclick = () => {
            if (confirm(`Удалить категорию "${category.name}" и все карточки?`)) {
                this.data.categories = this.data.categories.filter(c => c.id !== category.id);
                if (this.currentCategory === category.id) this.currentCategory = null;
                this.saveData();
                this.renderCategories();
                this.renderCards();
                this.showToast('Категория удалена');
            }
            menu.remove();
        };
        
        menu.appendChild(edit);
        menu.appendChild(del);
        document.body.appendChild(menu);
        
        setTimeout(() => {
            const close = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', close);
                }
            };
            document.addEventListener('click', close);
        }, 0);
    }

    // Карточки
    getCardsToDisplay() {
        let cards = [];
        
        if (this.currentCategory) {
            const category = this.data.categories.find(c => c.id === this.currentCategory);
            if (category) cards = category.cards;
        } else {
            this.data.categories.forEach(cat => cards = cards.concat(cat.cards));
        }
        
        if (this.currentFilter !== 'all') {
            cards = cards.filter(card => card.status === this.currentFilter);
        }
        
        return cards;
    }

    renderCards(cards = null) {
        const container = document.getElementById('cardsContainer');
        const cardsToRender = cards || this.getCardsToDisplay();
        
        container.className = 'cards-container';
        if (this.data.settings.view === 'list') {
            container.classList.add('list-view');
        }
        
        container.innerHTML = '';
        
        cardsToRender.forEach(card => {
            if (this.data.settings.view === 'grid') {
                container.appendChild(this.createGridCard(card));
            } else {
                container.appendChild(this.createListCard(card));
            }
        });
        
        if (cardsToRender.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; color: var(--text-secondary); grid-column: 1 / -1;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
                    <h3>Нет карточек</h3>
                    <p>Создайте категорию и добавьте первую карточку</p>
                </div>
            `;
        }
    }

    createGridCard(card) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        
        const coverUrl = card.coverUrls?.[0] || card.coverUrl || '';
        
        cardEl.innerHTML = `
            <div class="card-cover-container">
                ${coverUrl ? 
                    `<img class="card-cover" src="${coverUrl}" alt="${card.title}">` :
                    `<div class="card-cover-placeholder">${card.title?.charAt(0) || '?'}</div>`
                }
            </div>
            <div class="card-body">
                <div class="card-title">${card.title || 'Без названия'}</div>
                <div class="card-tags">
                    ${(card.tags || []).slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
                    ${(card.tags || []).length > 3 ? `<span class="tag">+${card.tags.length - 3}</span>` : ''}
                </div>
                <div class="card-footer">
                    <div class="card-rating">⭐ ${card.myRating || '—'}</div>
                    <div class="card-status status-${card.status || 'plan'}">${this.getStatusText(card.status)}</div>
                </div>
            </div>
        `;
        
        cardEl.onclick = () => this.openCardModal(card);
        return cardEl;
    }

    createListCard(card) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card-list';
        
        const coverUrl = card.coverUrls?.[0] || card.coverUrl || '';
        
        cardEl.innerHTML = `
            ${coverUrl ? 
                `<img class="card-list-cover" src="${coverUrl}" alt="${card.title}">` :
                `<div class="card-list-cover" style="background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; font-size: 24px; color: white;">${card.title?.charAt(0) || '?'}</div>`
            }
            <div class="card-list-body">
                <div>
                    <div class="card-title">${card.title || 'Без названия'}</div>
                    <div class="card-tags">
                        ${(card.tags || []).slice(0, 4).map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div class="card-rating">⭐ ${card.myRating || '—'}</div>
                    <div class="card-status status-${card.status || 'plan'}">${this.getStatusText(card.status)}</div>
                </div>
            </div>
        `;
        
        cardEl.onclick = () => this.openCardModal(card);
        return cardEl;
    }

    getStatusText(status) {
        const map = {
            'completed': '✓ Пройдено',
            'playing': '▶ В процессе',
            'plan-to-play': '📋 Запланировано',
            'dropped': '✕ Заброшено'
        };
        return map[status] || status;
    }

    showAddCardModal() {
        this.currentCard = null;
        this.currentCoverIndex = 0;
        document.getElementById('cardModal').classList.add('active');
        
        // Переключаемся в режим редактирования
        document.getElementById('viewMode').classList.add('hidden');
        document.getElementById('editMode').classList.add('active');
        
        // Очищаем форму
        document.getElementById('editTitle').value = '';
        document.getElementById('editDescription').value = '';
        document.getElementById('editPrimaryLink').value = '';
        document.getElementById('editTags').value = '';
        document.getElementById('editRating').value = '5';
        document.getElementById('editStatus').value = 'plan-to-play';
        document.getElementById('editNotes').value = '';
        
        // Очищаем URL обложек
        const container = document.getElementById('coverUrlsContainer');
        container.innerHTML = '<div class="cover-url-item"><input type="text" class="form-input" placeholder="URL обложки"></div>';
        
        // Скрываем обложку
        document.getElementById('modalCover').style.display = 'none';
        document.getElementById('coverDots').innerHTML = '';
    }

    openCardModal(card) {
        this.currentCard = card;
        this.currentCoverIndex = 0;
        
        const coverUrls = card.coverUrls || (card.coverUrl ? [card.coverUrl] : []);
        this.currentCoverUrls = coverUrls;
        
        document.getElementById('cardModal').classList.add('active');
        this.updateCoverDisplay();
        
        // Режим просмотра
        document.getElementById('viewMode').classList.remove('hidden');
        document.getElementById('editMode').classList.remove('active');
        
        document.getElementById('viewTitle').textContent = card.title;
        document.getElementById('viewDescription').textContent = card.description || 'Нет описания';
        document.getElementById('viewRating').innerHTML = `⭐ ${card.myRating || '—'}/10`;
        document.getElementById('viewStatus').textContent = this.getStatusText(card.status);
        document.getElementById('viewNotes').textContent = card.notes || 'Нет заметок';
        
        const sourceBtn = document.getElementById('viewSourceBtn');
        if (card.links?.primary) {
            sourceBtn.href = card.links.primary;
            sourceBtn.style.display = 'inline-block';
        } else {
            sourceBtn.style.display = 'none';
        }
        
        const tagsContainer = document.getElementById('viewTags');
        tagsContainer.innerHTML = (card.tags || []).map(tag => `<span class="tag">${tag}</span>`).join('');
        
        // Заполняем форму редактирования
        document.getElementById('editTitle').value = card.title || '';
        document.getElementById('editDescription').value = card.description || '';
        document.getElementById('editPrimaryLink').value = card.links?.primary || '';
        document.getElementById('editTags').value = (card.tags || []).join(', ');
        document.getElementById('editRating').value = card.myRating || 5;
        document.getElementById('editStatus').value = card.status || 'plan-to-play';
        document.getElementById('editNotes').value = card.notes || '';
        
        const coverContainer = document.getElementById('coverUrlsContainer');
        coverContainer.innerHTML = coverUrls.map(url => 
            `<div class="cover-url-item"><input type="text" class="form-input" value="${url}"></div>`
        ).join('') || '<div class="cover-url-item"><input type="text" class="form-input" placeholder="URL обложки"></div>';
    }

    updateCoverDisplay() {
        const coverUrls = this.currentCoverUrls || [];
        const coverImg = document.getElementById('modalCover');
        const dotsContainer = document.getElementById('coverDots');
        
        if (coverUrls.length > 0) {
            coverImg.src = coverUrls[this.currentCoverIndex];
            coverImg.style.display = 'block';
        } else {
            coverImg.style.display = 'none';
        }
        
        dotsContainer.innerHTML = coverUrls.map((_, i) => 
            `<div class="cover-dot ${i === this.currentCoverIndex ? 'active' : ''}" onclick="app.currentCoverIndex = ${i}; app.updateCoverDisplay();"></div>`
        ).join('');
    }

    navigateCover(direction) {
        const coverUrls = this.currentCoverUrls || [];
        if (coverUrls.length === 0) return;
        
        this.currentCoverIndex = (this.currentCoverIndex + direction + coverUrls.length) % coverUrls.length;
        this.updateCoverDisplay();
    }

    addCoverUrl() {
        const container = document.getElementById('coverUrlsContainer');
        const item = document.createElement('div');
        item.className = 'cover-url-item';
        item.innerHTML = '<input type="text" class="form-input" placeholder="URL обложки">';
        container.appendChild(item);
    }

    toggleEditMode(edit) {
        document.getElementById('viewMode').classList.toggle('hidden', edit);
        document.getElementById('editMode').classList.toggle('active', edit);
        
        if (!edit) {
            // Возвращаемся к просмотру - обновляем данные
            this.openCardModal(this.currentCard);
        }
    }

    saveCard() {
        if (!this.currentCategory && !this.currentCard) {
            this.showToast('Выберите категорию!', 'error');
            return;
        }
        
        const title = document.getElementById('editTitle').value;
        if (!title) {
            this.showToast('Введите название!', 'error');
            return;
        }
        
        const coverInputs = document.querySelectorAll('#coverUrlsContainer input');
        const coverUrls = Array.from(coverInputs).map(input => input.value).filter(url => url);
        
        const cardData = {
            id: this.currentCard?.id || 'card_' + Date.now(),
            title: title,
            coverUrl: coverUrls[0] || '',
            coverUrls: coverUrls,
            description: document.getElementById('editDescription').value,
            tags: document.getElementById('editTags').value.split(',').map(t => t.trim()).filter(t => t),
            myRating: parseInt(document.getElementById('editRating').value) || 5,
            status: document.getElementById('editStatus').value,
            links: {
                primary: document.getElementById('editPrimaryLink').value,
                others: this.currentCard?.links?.others || []
            },
            notes: document.getElementById('editNotes').value,
            dateAdded: this.currentCard?.dateAdded || new Date().toISOString()
        };
        
        const category = this.data.categories.find(c => c.id === (this.currentCategory || this.findCardCategory(this.currentCard?.id)));
        if (!category) return;
        
        if (this.currentCard) {
            const index = category.cards.findIndex(c => c.id === this.currentCard.id);
            if (index !== -1) category.cards[index] = cardData;
        } else {
            category.cards.push(cardData);
        }
        
        this.saveData();
        this.renderCards();
        this.renderCategories();
        this.closeCardModal();
        this.showToast('Карточка сохранена!');
    }

    deleteCard() {
        if (!this.currentCard) return;
        if (!confirm('Удалить эту карточку?')) return;
        
        const category = this.data.categories.find(c => c.id === this.findCardCategory(this.currentCard.id));
        if (category) {
            category.cards = category.cards.filter(c => c.id !== this.currentCard.id);
        }
        
        this.saveData();
        this.renderCards();
        this.renderCategories();
        this.closeCardModal();
        this.showToast('Карточка удалена');
    }

    findCardCategory(cardId) {
        for (const cat of this.data.categories) {
            if (cat.cards.find(c => c.id === cardId)) return cat.id;
        }
        return null;
    }

    closeCardModal() {
        document.getElementById('cardModal').classList.remove('active');
        this.currentCard = null;
    }

    // Авто-заполнение
    async autoFillFromUrl() {
        const url = document.getElementById('editPrimaryLink').value;
        if (!url) {
            this.showToast('Введите ссылку для авто-заполнения', 'error');
            return;
        }
        
        this.showToast('🤖 Заполняем данные...');
        
        try {
            const data = await this.fetchPageData(url);
            
            if (data.title && !document.getElementById('editTitle').value) {
                document.getElementById('editTitle').value = data.title;
            }
            if (data.description && !document.getElementById('editDescription').value) {
                document.getElementById('editDescription').value = data.description;
            }
            if (data.coverUrl) {
                const firstInput = document.querySelector('#coverUrlsContainer input');
                if (firstInput && !firstInput.value) {
                    firstInput.value = data.coverUrl;
                }
            }
            if (data.tags && !document.getElementById('editTags').value) {
                document.getElementById('editTags').value = data.tags.join(', ');
            }
            
            this.showToast('✅ Данные заполнены!');
        } catch (error) {
            console.error('Ошибка авто-заполнения:', error);
            this.showToast('❌ Не удалось заполнить данные', 'error');
        }
    }

    async fetchPageData(url) {
        // Симуляция парсинга для демонстрации
        if (url.includes('steampowered.com')) {
            return {
                title: 'The Elder Scrolls V: Skyrim Special Edition',
                description: 'Победитель более 200 наград «Игра года», Skyrim Special Edition оживляет эпическое фэнтези с потрясающей детализацией.',
                coverUrl: 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/489830/header.jpg',
                tags: ['Открытый мир', 'RPG', 'Фэнтези', 'Одиночная игра', 'Приключения']
            };
        } else if (url.includes('kinopoisk') || url.includes('imdb')) {
            return {
                title: 'Фильм',
                description: 'Описание фильма...',
                coverUrl: 'https://via.placeholder.com/460x215/1e293b/10b981?text=Movie',
                tags: ['фильм', 'драма']
            };
        } else if (url.includes('shikimori') || url.includes('anime')) {
            return {
                title: 'Аниме',
                description: 'Описание аниме...',
                coverUrl: 'https://via.placeholder.com/460x215/1e293b/f59e0b?text=Anime',
                tags: ['аниме', 'сёнен']
            };
        }
        
        // Пытаемся реально спарсить страницу
        try {
            const response = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            
            const title = doc.querySelector('title')?.textContent?.replace(' в Steam', '').replace(' - Steam', '') || 
                         doc.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
            const description = doc.querySelector('meta[name="description"]')?.getAttribute('content') || 
                               doc.querySelector('meta[property="og:description"]')?.getAttribute('content') || '';
            const coverUrl = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') || '';
            const tags = Array.from(doc.querySelectorAll('.app_tag')).map(tag => tag.textContent.trim());
            
            return { title, description, coverUrl, tags };
        } catch (e) {
            console.error('Ошибка парсинга:', e);
            return {};
        }
    }

    // Поиск
    setupEventListeners() {
        document.getElementById('globalSearch').addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            
            if (query.length >= 2) {
                let cardsToSearch = [];
                
                if (this.currentCategory) {
                    const category = this.data.categories.find(c => c.id === this.currentCategory);
                    if (category) cardsToSearch = category.cards;
                } else {
                    this.data.categories.forEach(cat => cardsToSearch = cardsToSearch.concat(cat.cards));
                }
                
                const results = cardsToSearch.filter(card => 
                    card.title?.toLowerCase().includes(query) ||
                    card.description?.toLowerCase().includes(query) ||
                    card.tags?.some(tag => tag.toLowerCase().includes(query)) ||
                    card.notes?.toLowerCase().includes(query)
                );
                
                this.renderCards(results);
            } else if (query.length === 0) {
                this.renderCards();
            }
        });
        
        document.getElementById('cardModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('cardModal')) this.closeCardModal();
        });
        
        document.getElementById('categoryModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('categoryModal')) this.closeCategoryModal();
        });
        
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('settingsModal')) this.closeSettings();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeCardModal();
                this.closeCategoryModal();
                this.closeSettings();
            }
        });
    }

    filterCards(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.chip').forEach(chip => {
            chip.classList.toggle('active', chip.dataset.filter === filter);
        });
        this.renderCards();
    }

    setView(view) {
        this.data.settings.view = view;
        this.saveData();
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', (view === 'grid' && btn.textContent === '⊞') || (view === 'list' && btn.textContent === '☰'));
        });
        this.renderCards();
    }

    // Настройки
    openSettings() {
        document.getElementById('settingsModal').classList.add('active');
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', 
                (this.data.settings.theme === 'dark' && btn.textContent.includes('Темная')) ||
                (this.data.settings.theme === 'light' && btn.textContent.includes('Светлая'))
            );
        });
        
        // Обновляем UI Google авторизации
        if (typeof googleAuth !== 'undefined') {
            googleAuth.updateUI(!!googleAuth.accessToken);
        }
    }

    closeSettings() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    // Google интеграция
    loginGoogle() {
        this.googleLoggedIn = true;
        this.updateGoogleStatus();
        this.showToast('✅ Вход выполнен (демо)');
        
        // В реальности здесь была бы OAuth авторизация
        localStorage.setItem('googleLoggedIn', 'true');
    }

    updateGoogleStatus() {
        const status = document.getElementById('googleStatus');
        if (this.googleLoggedIn || localStorage.getItem('googleLoggedIn')) {
            status.textContent = '✅ Подключено (демо)';
            status.style.color = 'var(--accent-green)';
        } else {
            status.textContent = 'Не подключено';
            status.style.color = 'var(--text-secondary)';
        }
    }

    syncToDrive() {
        if (typeof googleAuth !== 'undefined' && googleAuth.accessToken) {
            googleAuth.syncToDrive();
        } else {
            this.showToast('❌ Войдите в Google аккаунт', 'error');
        }
    }

    exportToDrive() {
        if (typeof googleAuth !== 'undefined' && googleAuth.accessToken) {
            googleAuth.exportToDrive();
        } else {
            this.showToast('❌ Войдите в Google аккаунт', 'error');
        }
    }

    importFromDrive() {
        if (typeof googleAuth !== 'undefined' && googleAuth.accessToken) {
            googleAuth.importFromDrive();
        } else {
            this.showToast('❌ Войдите в Google аккаунт', 'error');
        }
    }

    syncToCloud() {
        this.syncToDrive();
    }

    // Экспорт/Импорт на компьютер
    exportToComputer() {
        const json = JSON.stringify(this.data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `vault_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.showToast('📤 Файл сохранен на компьютер');
    }

    importFromComputer(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (imported.categories && Array.isArray(imported.categories)) {
                    if (confirm('Импортировать данные? Текущие данные будут заменены.')) {
                        this.data = imported;
                        this.saveData();
                        this.currentCategory = null;
                        this.renderCategories();
                        this.renderCards();
                        this.showToast('✅ Данные импортированы');
                    }
                } else {
                    this.showToast('❌ Неверный формат файла', 'error');
                }
            } catch (error) {
                this.showToast('❌ Ошибка чтения файла', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // Вспомогательные функции
    getTotalCards() {
        return this.data.categories.reduce((sum, cat) => sum + cat.cards.length, 0);
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        if (type === 'error') toast.style.background = 'rgba(239, 68, 68, 0.9)';
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Инициализация
const app = new VaultApp();