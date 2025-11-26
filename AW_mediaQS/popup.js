document.addEventListener('DOMContentLoaded', async function() {
    let currentLang = 'en';
    
    // 1. Сначала объявляем ВСЕ функции
    async function loadSettings() {
    try {
        // Загружаем актуальные комбинации из chrome.commands
        const commands = await new Promise(resolve => {
            chrome.commands.getAll(resolve);
        });

        const customShortcuts = {};
        commands.forEach(command => {
            if (command.name === 'open_media') {
                customShortcuts.openKey = command.shortcut || 'Ctrl+Shift+U';
            } else if (command.name === 'save_media') {
                customShortcuts.saveKey = command.shortcut || 'Ctrl+Shift+S';
            } else if (command.name === 'copy_media_url') {
                customShortcuts.copyKey = command.shortcut || 'Ctrl+Shift+C';
            }
        });

        // Загружаем остальные настройки
        const result = await chrome.storage.sync.get({
            customPathEnabled: false,
            customPath: '',
            renameEnabled: false,
            renameTemplate: 'media_{timestamp}_{counter}',
            openInCurrentTab: false,
            copyMediaFile: false
        });

        // Обновляем отображение комбинаций клавиш из chrome.commands
        if (openKeyDisplay) openKeyDisplay.textContent = customShortcuts.openKey;
        if (saveKeyDisplay) saveKeyDisplay.textContent = customShortcuts.saveKey;
        if (copyKeyDisplay) copyKeyDisplay.textContent = customShortcuts.copyKey;

        // Обновляем чекбоксы
        if (highlightCheckbox) highlightCheckbox.checked = result.highlightEnabled !== false;
        if (openInCurrentTabCheckbox) openInCurrentTabCheckbox.checked = result.openInCurrentTab;
        if (customPathCheckbox) customPathCheckbox.checked = result.customPathEnabled;
        if (renameCheckbox) renameCheckbox.checked = result.renameEnabled;
        if (copyMediaFileCheckbox) copyMediaFileCheckbox.checked = result.copyMediaFile;

        // Обновляем пути и шаблоны
        if (customPath) customPath.value = result.customPath || '';
        if (renameTemplate) renameTemplate.value = result.renameTemplate;

        // Показываем/скрываем дополнительные настройки
        if (pathSettings) {
            pathSettings.style.display = result.customPathEnabled ? 'block' : 'none';
        }
        if (renameSettings) {
            renameSettings.style.display = result.renameEnabled ? 'block' : 'none';
        }

        // Обновляем отображение пути
        if (folderNameSpan) {
            folderNameSpan.textContent = result.customPath || 'AW_Media';
        }

        // Обновляем пример имени файла
        updateRenameExample();

        console.log('AW_MediaQS: Настройки загружены, хоткеи:', customShortcuts);
    } catch (error) {
        console.error('AW_MediaQS: Ошибка загрузки настроек:', error);
        showStatus('Error loading settings: ' + error.message, 'error');
    }
}
    function extractFolderName(fullPath) {
        const normalizedPath = fullPath.replace(/[\\/]/g, '/');
        const pathParts = normalizedPath.split('/').filter(part => part.trim() !== '');
        return pathParts[pathParts.length - 1] || 'SavedMedia';
    }

    async function saveCustomPath(folderName) {
        await saveSetting('customPath', folderName);
        updatePathDisplay(folderName);
        showStatus(getTranslation('pathUpdated'), 'success');
    }

    function updatePathDisplay(folderName) {
        if (folderNameSpan) {
            folderNameSpan.textContent = folderName;
        }
    }

    function updateRenameExample() {
        if (renameExample && renameTemplate) {
            const example = generateFilename('example.jpg', renameTemplate.value, 1);
            renameExample.textContent = getTranslation('example') + example;
        }
    }

    function generateFilename(originalName, template, counter) {
        const now = new Date();
        const timestamp = now.getTime();
        const date = now.toISOString().split('T')[0];
        const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
        
        const originalNameWithoutExt = originalName.includes('.') 
            ? originalName.substring(0, originalName.lastIndexOf('.'))
            : originalName;
        
        const extension = originalName.includes('.') 
            ? originalName.substring(originalName.lastIndexOf('.') + 1)
            : 'jpg';
        
        let filename = template
            .replace(/{timestamp}/g, timestamp)
            .replace(/{counter}/g, counter)
            .replace(/{date}/g, date)
            .replace(/{time}/g, time)
            .replace(/{original}/g, originalNameWithoutExt);
        
        filename = filename.replace(/[<>:"/\\|?*]/g, '_');
        
        return filename + '.' + extension.toLowerCase();
    }

    async function saveSetting(key, value) {
        await chrome.storage.sync.set({ [key]: value });
    }

    function showStatus(message, type) {
        if (status) {
            status.textContent = message;
            status.className = `status ${type}`;
            status.style.display = 'block';
            setTimeout(() => {
                status.style.display = 'none';
            }, 3000);
        }
    }

    // Функции перевода
    function getTranslation(key) {
        return translations[currentLang]?.[key] || translations['en'][key];
    }	

    async function loadLocalization() {
        const browserLang = navigator.language || 
                           navigator.userLanguage || 
                           navigator.browserLanguage || 
                           navigator.systemLanguage || 
                           'en';
        
        console.log('Browser language detected:', browserLang);
        
        const lang = browserLang.toLowerCase();
        
        if (lang.startsWith('ru') || lang.includes('russian')) {
            currentLang = 'ru';
        } else {
            currentLang = 'en';
        }
        
        console.log('Extension language set to:', currentLang);
        applyTranslations();
    }

    function applyTranslations() {
        // Обновляем ВСЕ текстовые элементы интерфейса
        if (shortcutsBtn) {
            shortcutsBtn.textContent = getTranslation('shortcutsBtn');
        }

        // Описания комбинаций клавиш
        const keyDescriptions = document.querySelectorAll('.current-key');
        keyDescriptions.forEach(desc => {
            if (desc.textContent.includes('Наведите курсор') || desc.textContent.includes('Hover over')) {
                desc.textContent = getTranslation('keyDescription');
            }
        });

        // Заголовки секций
        const sectionTitles = document.querySelectorAll('.section-title');
        sectionTitles.forEach(title => {
            const originalText = title.textContent.trim();
            if (originalText === 'Комбинации клавиш' || originalText === 'Keyboard Shortcuts') {
                title.textContent = getTranslation('keyboardShortcuts');
            } else if (originalText === 'Поведение' || originalText === 'Behavior') {
                title.textContent = getTranslation('behavior');
            } else if (originalText === 'Сохранение файлов' || originalText === 'File Saving') {
                title.textContent = getTranslation('fileSaving');
            } else if (originalText === 'Переименование файлов' || originalText === 'File Renaming') {
                title.textContent = getTranslation('fileRenaming');
            } else if (originalText === 'Копирование медиа' || originalText === 'Media Copying') {
                title.textContent = getTranslation('mediaCopying');
            }
        });

        // Labels
        const labels = document.querySelectorAll('label');
        labels.forEach(label => {
            const originalText = label.textContent.trim();
            const translationMap = {
                'Команда для открытия медиа:': 'openMediaCommand',
                'Open media command:': 'openMediaCommand',
                'Команда для сохранения медиа:': 'saveMediaCommand',
                'Save media command:': 'saveMediaCommand', 
                'Команда для копирования ссылки:': 'copyUrlCommand',
                'Copy URL command:': 'copyUrlCommand',
                'Имя подпапки для сохранения:': 'subfolderName',
                'Subfolder name for saving:': 'subfolderName',
                'Шаблон имени файла:': 'filenameTemplate',
                'Filename template:': 'filenameTemplate'
            };
            
            if (translationMap[originalText]) {
                label.textContent = getTranslation(translationMap[originalText]);
            }
        });

        // Checkbox labels
        const checkboxLabels = document.querySelectorAll('.checkbox-label');
        checkboxLabels.forEach(label => {
            const originalText = label.textContent.trim();
            const translationMap = {
                'Включить выделение медиа при наведении': 'enableHighlighting',
                'Enable media highlighting on hover': 'enableHighlighting',
                'Открывать медиа в текущей вкладке (вместо новой)': 'openInCurrentTab',
                'Open media in current tab (instead of new)': 'openInCurrentTab',
                'Сохранять в подпапку внутри "Загрузки"': 'saveInSubfolder',
                'Save to subfolder inside "Downloads"': 'saveInSubfolder',
                'Включить переименование файлов': 'enableRenaming',
                'Enable file renaming': 'enableRenaming',
                'Копировать само медиа в буфер (вместо ссылки)': 'copyMediaFile',
                'Copy media file to clipboard (instead of link)': 'copyMediaFile'
            };
            
            if (translationMap[originalText]) {
                label.textContent = getTranslation(translationMap[originalText]);
            }
        });

        // Placeholders
        if (customPath) {
            customPath.placeholder = getTranslation('folderExample');
        }
        if (renameTemplate) {
            renameTemplate.placeholder = getTranslation('filenameExample');
        }

        // Обновляем примеры и подсказки
        const hintElements = document.querySelectorAll('.current-key');
        hintElements.forEach(el => {
            const text = el.textContent.trim();
            if (text.includes('Укажите имя папки') || text.includes('Specify folder name')) {
                el.textContent = getTranslation('folderHint');
            } else if (text.includes('Доступные переменные') || text.includes('Available variables')) {
                el.innerHTML = getTranslation('availableVariables');
            } else if (text.includes('При включении будет копироваться') || text.includes('When enabled, the actual file')) {
                el.textContent = getTranslation('copyMediaHint');
            }
        });

        // Обновляем пример имени файла
        updateRenameExample();
    }

    // 2. Объект переводов (только русский и английский)
    const translations = {
        'ru': {
            'shortcutsBtn': '⚡ Настроить комбинации клавиш',
            'settingsSaved': 'Настройки сохранены!',
            'pathUpdated': 'Путь сохранения обновлён!',
            'extensionActive': 'AW_MediaQS v3.1 активен!',
            'keyDescription': 'Наведите курсор на изображение/видео и нажмите эту комбинацию',
            'keyboardShortcuts': 'Комбинации клавиш',
            'behavior': 'Поведение',
            'fileSaving': 'Сохранение файлов',
            'fileRenaming': 'Переименование файлов',
            'mediaCopying': 'Копирование медиа',
            'openMediaCommand': 'Команда для открытия медиа:',
            'saveMediaCommand': 'Команда для сохранения медиа:',
            'copyUrlCommand': 'Команда для копирования ссылки:',
            'subfolderName': 'Имя подпапки для сохранения:',
            'filenameTemplate': 'Шаблон имени файла:',
            'enableHighlighting': 'Включить выделение медиа при наведении',
            'openInCurrentTab': 'Открывать медиа в текущей вкладке (вместо новой)',
            'saveInSubfolder': 'Сохранять в подпапку внутри "Загрузки"',
            'enableRenaming': 'Включить переименование файлов',
            'copyMediaFile': 'Копировать само медиа в буфер (вместо ссылки)',
            'folderExample': 'Например: MySavedImages',
            'filenameExample': 'media_{timestamp}_{counter}',
            'folderHint': '💡 Укажите имя папки, которая будет создана внутри папки "Загрузки"',
            'copyMediaHint': '💡 При включении будет копироваться сам файл, а не ссылка на него',
            'example': 'Пример: ',
			'pathCleared': 'Путь очищен!',
            'availableVariables': 'Доступные переменные:<br><code>{timestamp}</code> - текущее время<br><code>{counter}</code> - порядковый номер<br><code>{date}</code> - дата в формате ГГГГ-ММ-ДД<br><code>{time}</code> - время в формате ЧЧ-ММ-СС<br><code>{original}</code> - оригинальное имя файла'
        },
        'en': {
            'shortcutsBtn': '⚡ Configure Keyboard Shortcuts',
            'settingsSaved': 'Settings saved!',
            'pathUpdated': 'Save path updated!',
            'extensionActive': 'AW_MediaQS v3.1 active!',
            'keyDescription': 'Hover over image/video and press this combination',
            'keyboardShortcuts': 'Keyboard Shortcuts',
            'behavior': 'Behavior',
            'fileSaving': 'File Saving',
            'fileRenaming': 'File Renaming',
            'mediaCopying': 'Media Copying',
            'openMediaCommand': 'Open media command:',
            'saveMediaCommand': 'Save media command:',
            'copyUrlCommand': 'Copy URL command:',
            'subfolderName': 'Subfolder name for saving:',
            'filenameTemplate': 'Filename template:',
            'enableHighlighting': 'Enable media highlighting on hover',
            'openInCurrentTab': 'Open media in current tab (instead of new)',
            'saveInSubfolder': 'Save to subfolder inside "Downloads"',
            'enableRenaming': 'Enable file renaming',
            'copyMediaFile': 'Copy media file to clipboard (instead of link)',
            'folderExample': 'Example: MySavedImages',
            'filenameExample': 'media_{timestamp}_{counter}',
            'folderHint': '💡 Specify folder name that will be created inside "Downloads" folder',
            'copyMediaHint': '💡 When enabled, the actual file will be copied instead of the link',
            'example': 'Example: ',
			'pathCleared': 'Path cleared!',
            'availableVariables': 'Available variables:<br><code>{timestamp}</code> - current time<br><code>{counter}</code> - sequence number<br><code>{date}</code> - date in YYYY-MM-DD format<br><code>{time}</code> - time in HH-MM-SS format<br><code>{original}</code> - original filename'
        }
    };

    // 3. Получаем DOM элементы
    const openKeyDisplay = document.getElementById('openKeyDisplay');
    const saveKeyDisplay = document.getElementById('saveKeyDisplay');
    const copyKeyDisplay = document.getElementById('copyKeyDisplay');
    const highlightCheckbox = document.getElementById('highlightEnabled');
    const openInCurrentTabCheckbox = document.getElementById('openInCurrentTab');
    const customPathCheckbox = document.getElementById('customPathEnabled');
    const pathSettings = document.getElementById('pathSettings');
    const customPath = document.getElementById('customPath');
    const browseBtn = document.getElementById('browseBtn');
    const currentPathDisplay = document.getElementById('currentPathDisplay');
    const folderNameSpan = document.getElementById('folderName');
    const renameCheckbox = document.getElementById('renameEnabled');
    const renameSettings = document.getElementById('renameSettings');
    const renameTemplate = document.getElementById('renameTemplate');
    const renameExample = document.getElementById('renameExample');
    const copyMediaFileCheckbox = document.getElementById('copyMediaFile');
    const shortcutsBtn = document.getElementById('shortcutsBtn');
    const status = document.getElementById('status');

    // 4. Теперь можно вызывать функции
    await loadSettings();
    await loadLocalization();

    // 5. Обработчики событий
    if (shortcutsBtn) {
        shortcutsBtn.addEventListener('click', function() {
            chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
        });
    }

    // Обработчики для чекбоксов
    if (highlightCheckbox) {
        highlightCheckbox.addEventListener('change', function() {
            saveSetting('highlightEnabled', this.checked);
            showStatus(getTranslation('settingsSaved'), 'success');
        });
    }

    if (openInCurrentTabCheckbox) {
        openInCurrentTabCheckbox.addEventListener('change', function() {
            saveSetting('openInCurrentTab', this.checked);
            showStatus(getTranslation('settingsSaved'), 'success');
        });
    }

    if (customPathCheckbox) {
        customPathCheckbox.addEventListener('change', function() {
            saveSetting('customPathEnabled', this.checked);
            if (pathSettings) {
                pathSettings.style.display = this.checked ? 'block' : 'none';
            }
            showStatus(getTranslation('settingsSaved'), 'success');
        });
    }

    if (renameCheckbox) {
        renameCheckbox.addEventListener('change', function() {
            saveSetting('renameEnabled', this.checked);
            if (renameSettings) {
                renameSettings.style.display = this.checked ? 'block' : 'none';
            }
            showStatus(getTranslation('settingsSaved'), 'success');
        });
    }

    if (copyMediaFileCheckbox) {
        copyMediaFileCheckbox.addEventListener('change', function() {
            saveSetting('copyMediaFile', this.checked);
            showStatus(getTranslation('settingsSaved'), 'success');
        });
    }

    // Обработчики для полей ввода
    if (customPath) {
        customPath.addEventListener('change', function() {
            saveSetting('customPath', this.value.trim());
            updatePathDisplay(this.value.trim());
            showStatus(getTranslation('pathUpdated'), 'success');
        });
    }

    if (renameTemplate) {
        renameTemplate.addEventListener('input', function() {
            saveSetting('renameTemplate', this.value);
            updateRenameExample();
        });
    }

// Обработчик для кнопки очистки
if (browseBtn) {
    browseBtn.addEventListener('click', function() {
        if (customPath) {
            customPath.value = '';
            saveSetting('customPath', '');
            updatePathDisplay('');
            showStatus(getTranslation('pathCleared'), 'success');
        }
    });
}

    console.log('AW_MediaQS: Popup initialized');
});