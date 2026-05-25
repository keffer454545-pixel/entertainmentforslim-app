// app.js - Основное приложение
class VaultApp {
    constructor() {
        this.data = {
            categories: [],
            settings: { theme: 'dark' }
        };
        
        this.currentCategory = null;
        this.currentFilter = 'all';
        this.currentCard = null;
        
        this.init();
    }

    init() {
        console.log('Vault app initializing...');
        this.loadData();
        this.applyTheme();
        this.renderCategories();
        this.renderCards();
        this.setupEventListeners();
        console.log('Vault app initialized!', this.data);
    }

    loadData() {
        try {
            const saved = localStorage.getItem('vaultData');
            if (saved) {
                this.data = JSON.parse(saved);
                console.log('Data loaded from localStorage');
            }
        } catch (e) {
            console.error('Error loading data:', e);
        }
    }

    saveData() {
        try {
            localStorage.setItem('vaultData', JSON.stringify(this.data));
            console.log('Data saved to localStorage');
        } catch (e) {
            console.error('Error saving data:', e);
        }
    }

    applyTheme() {
        document.body.className = this.data.settings.theme === 'light' ? 'light-theme' : '';
    }

    setTheme(theme) {
        this.data.settings.theme = theme;
        this.saveData();
        this.applyTheme();
        this.showToast(`Тема изменена на ${theme === 'dark' ? 'темную' : 'светлую'}`);
        this.closeSettings();
    }

    // Категории
    renderCategories() {
        const container = document.getElementById('categoriesList');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Кнопка "Все карточки"
        const allItem = document.createElement('div');
        allItem.className = `category-item ${!this.currentCategory ? 'active' : ''}`;
        allItem.innerHTML = `
            <span class="category-color" style="background: linear-gradient(135deg, #667eea, #764ba2);"></span>
            <span>📚 Все карточки</span>
        `;
        allItem.onclick = () => this.selectCategory(null);
        container.appendChild(allItem);
        
        // Остальные категории
        this.data.categories.forEach(cat => {
            const item = document.createElement('div');
            item.className = `category-item ${this.currentCategory === cat.id ? 'active' : ''}`;
            item.innerHTML = `
                <span class="category-color" style="background: ${cat.color};"></span>
                <span>${cat.icon} ${cat.name}</span>
            `;
            item.onclick = () => this.selectCategory(cat.id);
            container.appendChild(item);
        });
    }

    selectCategory(categoryId) {
        this.currentCategory = categoryId;
        document.getElementById('categoryTitle').textContent = 
            categoryId ? this.data.categories.find(c => c.id === categoryId)?.name || 'Категория' : 'Все карточки';
        this.renderCategories();
        this.renderCards();
    }

    showAddCategoryModal() {
        document.getElementById('modalCategoryName').value = '';
        document.getElementById('modalCategoryIcon').value = '📁';
        document.getElementById('modalCategoryColor').value = '#8b5cf6';
        document.getElementById('categoryModal').classList.add('active');
    }

    saveCategory() {
        const name = document.getElementById('modalCategoryName').value;
        if (!name) {
            this.showToast('Введите название категории!');
            return;
        }
        
        const category = {
            id: 'cat_' + Date.now(),
            name: name,
            icon: document.getElementById('modalCategoryIcon').value,
            color: document.getElementById('modalCategoryColor').value,
            cards: []
        };
        
        this.data.categories.push(category);
        this.saveData();
        this.renderCategories();
        this.closeCategoryModal();
        this.showToast('Категория создана!');
    }

    closeCategoryModal() {
        document.getElementById('categoryModal').classList.remove('active');
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

    renderCards() {
        const container = document.getElementById('cardsContainer');
        if (!container) return;
        
        const cards = this.getCardsToDisplay();
        container.innerHTML = '';
        
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            
            const coverUrl = card.coverUrl || '';
            
            cardEl.innerHTML = `
                <div class="card-cover-container">
                    ${coverUrl ? 
                        `<img class="card-cover" src="${coverUrl}" alt="${card.title}" onerror="this.style.display='none'; this.parentElement.querySelector('.card-cover-placeholder').style.display='flex';">` +
                        `<div class="card-cover-placeholder" style="display: none;">${card.title?.charAt(0) || '?'}</div>` :
                        `<div class="card-cover-placeholder">${card.title?.charAt(0) || '?'}</div>`
                    }
                </div>
                <div class="card-body">
                    <div class="card-title">${card.title || 'Без названия'}</div>
                    <div class="card-tags">
                        ${(card.tags || []).slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                    <div class="card-footer">
                        <div class="card-rating">⭐ ${card.myRating || '—'}</div>
                        <div style="font-size: 12px;">${card.status || 'plan-to-play'}</div>
                    </div>
                </div>
            `;
            
            cardEl.onclick = () => {
                alert(`Карточка: ${card.title}\nОписание: ${card.description}\nСтатус: ${card.status}`);
            };
            
            container.appendChild(cardEl);
        });
        
        if (cards.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 60px; grid-column: 1 / -1; color: var(--text-secondary);">
                    <div style="font-size: 48px;">📭</div>
                    <h3>Нет карточек</h3>
                    <p>Создайте категорию и добавьте первую карточку</p>
                </div>
            `;
        }
    }

    showAddCardModal() {
        if (!this.currentCategory) {
            this.showToast('Сначала выберите или создайте категорию!');
            return;
        }
        
        document.getElementById('editTitle').value = '';
        document.getElementById('editCoverUrl').value = '';
        document.getElementById('editDescription').value = '';
        document.getElementById('editPrimaryLink').value = '';
        document.getElementById('editTags').value = '';
        document.getElementById('editRating').value = '5';
        document.getElementById('editStatus').value = 'plan-to-play';
        document.getElementById('editNotes').value = '';
        
        document.getElementById('modalTitle').textContent = 'Добавить карточку';
        document.getElementById('cardModal').classList.add('active');
    }

    saveCard() {
        const title = document.getElementById('editTitle').value;
        if (!title) {
            this.showToast('Введите название!');
            return;
        }
        
        const category = this.data.categories.find(c => c.id === this.currentCategory);
        if (!category) return;
        
        const card = {
            id: 'card_' + Date.now(),
            title: title,
            coverUrl: document.getElementById('editCoverUrl').value,
            description: document.getElementById('editDescription').value,
            tags: document.getElementById('editTags').value.split(',').map(t => t.trim()).filter(t => t),
            myRating: parseInt(document.getElementById('editRating').value) || 5,
            status: document.getElementById('editStatus').value,
            links: {
                primary: document.getElementById('editPrimaryLink').value
            },
            notes: document.getElementById('editNotes').value,
            dateAdded: new Date().toISOString()
        };
        
        category.cards.push(card);
        this.saveData();
        this.renderCards();
        this.renderCategories();
        this.closeCardModal();
        this.showToast('Карточка добавлена!');
    }

    closeCardModal() {
        document.getElementById('cardModal').classList.remove('active');
    }

    // Фильтрация
    filterCards(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.chip').forEach(chip => {
            chip.classList.toggle('active', chip.textContent.includes(
                filter === 'all' ? 'Все' :
                filter === 'completed' ? 'Пройдено' :
                filter === 'playing' ? 'В процессе' :
                filter === 'plan-to-play' ? 'Запланировано' : 'Заброшено'
            ));
        });
        this.renderCards();
    }

    // Настройки
    openSettings() {
        document.getElementById('settingsModal').classList.add('active');
    }

    closeSettings() {
        document.getElementById('settingsModal').classList.remove('active');
    }

    // Экспорт/Импорт
    exportToComputer() {
        const json = JSON.stringify(this.data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `vault_backup_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        this.showToast('Файл сохранен!');
        this.closeSettings();
    }

    importFromComputer(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (imported.categories) {
                    this.data = imported;
                    this.saveData();
                    this.renderCategories();
                    this.renderCards();
                    this.showToast('Данные импортированы!');
                    this.closeSettings();
                }
            } catch (error) {
                this.showToast('Ошибка чтения файла!');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    syncToCloud() {
        if (googleAuth && googleAuth.accessToken) {
            googleAuth.syncToDrive();
        } else {
            this.showToast('❌ Сначала войдите через Google');
        }
    }

    // Поиск
    setupEventListeners() {
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                if (query.length >= 2) {
                    let cards = [];
                    if (this.currentCategory) {
                        const cat = this.data.categories.find(c => c.id === this.currentCategory);
                        if (cat) cards = cat.cards;
                    } else {
                        this.data.categories.forEach(cat => cards = cards.concat(cat.cards));
                    }
                    
                    const filtered = cards.filter(card => 
                        card.title?.toLowerCase().includes(query) ||
                        card.description?.toLowerCase().includes(query) ||
                        card.tags?.some(tag => tag.toLowerCase().includes(query))
                    );
                    
                    this.renderFilteredCards(filtered);
                } else if (query.length === 0) {
                    this.renderCards();
                }
            });
        }
        
        // Закрытие модальных окон по клику вне их
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        // Escape для закрытия
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
            }
        });
    }

    renderFilteredCards(cards) {
        const container = document.getElementById('cardsContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        cards.forEach(card => {
            const cardEl = document.createElement('div');
            cardEl.className = 'card';
            
            cardEl.innerHTML = `
                <div class="card-cover-container">
                    ${card.coverUrl ? 
                        `<img class="card-cover" src="${card.coverUrl}" alt="${card.title}">` :
                        `<div class="card-cover-placeholder">${card.title?.charAt(0) || '?'}</div>`
                    }
                </div>
                <div class="card-body">
                    <div class="card-title">${card.title || 'Без названия'}</div>
                    <div class="card-tags">
                        ${(card.tags || []).slice(0, 3).map(tag => `<span class="tag">${tag}</span>`).join('')}
                    </div>
                    <div class="card-footer">
                        <div class="card-rating">⭐ ${card.myRating || '—'}</div>
                        <div style="font-size: 12px;">${card.status || ''}</div>
                    </div>
                </div>
            `;
            
            container.appendChild(cardEl);
        });
    }

    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Инициализация при загрузке страницы
let app;
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, creating VaultApp...');
    app = new VaultApp();
    window.app = app; // Делаем доступным глобально
});
