// Счётчик для переименования
let fileCounter = 1;

// Обработчик команд с клавиатуры
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      console.log('Активная вкладка не найдена');
      return;
    }

    if (command === 'open_media') {
      chrome.tabs.sendMessage(tab.id, { action: 'openMedia' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Ошибка отправки сообщения:', chrome.runtime.lastError.message);
          return;
        }
        if (!response || !response.success) {
          console.log('Медиа-элемент не найден под курсором');
        }
      });
    } else if (command === 'save_media') {
      chrome.tabs.sendMessage(tab.id, { action: 'saveMedia' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Ошибка отправки сообщения:', chrome.runtime.lastError.message);
          return;
        }
        if (!response || !response.success) {
          console.log('Медиа-элемент для сохранения не найден');
        }
      });
    } else if (command === 'copy_media_url') {
      chrome.tabs.sendMessage(tab.id, { action: 'copyMediaUrl' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Ошибка отправки сообщения:', chrome.runtime.lastError.message);
          return;
        }
        if (!response || !response.success) {
          console.log('Медиа-элемент для копирования не найден');
        }
      });
    }
  } catch (error) {
    console.log('Ошибка выполнения команды:', error);
  }
});

// Обработчик загрузки медиафайлов
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadMedia') {
    handleMediaDownload(request.url);
  }
  sendResponse({ received: true });
});

// Функция для обработки загрузки медиа
async function handleMediaDownload(url) {
  try {
    const settings = await chrome.storage.sync.get({
      customPathEnabled: false,
      customPath: '',
      renameEnabled: false,
      renameTemplate: 'media_{timestamp}_{counter}'
    });

    // Генерируем имя файла
    const originalFilename = extractFilenameFromUrl(url);
    let finalFilename = originalFilename;
    
    if (settings.renameEnabled) {
      finalFilename = generateFilename(originalFilename, settings.renameTemplate, fileCounter);
      fileCounter++;
    }

    let downloadOptions = {
      url: url,
      filename: finalFilename,
      conflictAction: 'uniquify'
    };

    // Если включено сохранение в подпапку
    if (settings.customPathEnabled && settings.customPath) {
      const folderName = cleanFolderName(settings.customPath);
      // Используем кроссплатформенный путь
      downloadOptions.filename = createCrossPlatformPath(folderName, finalFilename);
      downloadOptions.saveAs = false;
      console.log('AW_MediaQS: Сохранение в подпапку:', downloadOptions.filename);
    } else {
      // Используем папку загрузок по умолчанию для текущей ОС
      downloadOptions.saveAs = false;
      console.log('AW_MediaQS: Сохранение в папку загрузок по умолчанию');
    }

    // Выполняем загрузку
    chrome.downloads.download(downloadOptions, (downloadId) => {
      if (chrome.runtime.lastError) {
        const errorMsg = chrome.runtime.lastError.message;
        console.error('AW_MediaQS: Ошибка загрузки:', errorMsg);
        
        // Если ошибка с подпапкой, пробуем сохранить в корень загрузок
        if (settings.customPathEnabled) {
          console.log('AW_MediaQS: Пробуем сохранить в корень загрузок...');
          chrome.downloads.download({
            url: url,
            filename: finalFilename,
            saveAs: false,
            conflictAction: 'uniquify'
          });
        }
      } else {
        console.log('AW_MediaQS: Файл успешно сохранен. ID:', downloadId);
      }
    });

  } catch (error) {
    console.error('AW_MediaQS: Ошибка при обработке загрузки:', error);
    // Пробуем сохранить без подпапки
    const originalFilename = extractFilenameFromUrl(url);
    chrome.downloads.download({
      url: url,
      filename: originalFilename,
      saveAs: false,
      conflictAction: 'uniquify'
    });
  }
}

// Функция для создания кроссплатформенного пути
function createCrossPlatformPath(folderName, filename) {
  if (folderName && filename) {
    return `${folderName}/${filename}`;
  }
  return filename;
}

// Функция для очистки имени папки
function cleanFolderName(folderName) {
  return folderName
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\.+$/, '')
    .trim() || 'SavedMedia';
}

// Функция для извлечения имени файла из URL
function extractFilenameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    let filename = pathname.substring(pathname.lastIndexOf('/') + 1);
    
    // Декодируем URL-encoded символы
    filename = decodeURIComponent(filename);
    
    // Если имя файла пустое или не содержит расширения, генерируем случайное
    if (!filename || filename === '/' || !filename.includes('.')) {
      const extension = getFileExtensionFromUrl(url);
      return 'media_' + Date.now() + extension;
    }
    
    // Очищаем имя файла от недопустимых символов
    filename = filename.replace(/[<>:"/\\|?*]/g, '_');
    
    return filename;
  } catch (error) {
    return 'media_' + Date.now() + '.jpg';
  }
}

// Функция для определения расширения файла из URL
function getFileExtensionFromUrl(url) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
  const videoExtensions = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.wmv'];
  
  const lowerUrl = url.toLowerCase();
  
  // Проверяем изображения
  for (const ext of imageExtensions) {
    if (lowerUrl.includes(ext)) {
      return ext;
    }
  }
  
  // Проверяем видео
  for (const ext of videoExtensions) {
    if (lowerUrl.includes(ext)) {
      return ext;
    }
  }
  
  // Если расширение не найдено, проверяем путь
  const pathMatch = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
  if (pathMatch && pathMatch[1]) {
    return '.' + pathMatch[1].toLowerCase();
  }
  
  return '.jpg';
}

// Функция генерации имени файла по шаблону
function generateFilename(originalName, template, counter) {
  const now = new Date();
  const timestamp = now.getTime();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  
  // Извлекаем имя файла без расширения
  const originalNameWithoutExt = originalName.includes('.') 
    ? originalName.substring(0, originalName.lastIndexOf('.'))
    : originalName;
  
  // Извлекаем расширение
  const extension = originalName.includes('.') 
    ? originalName.substring(originalName.lastIndexOf('.') + 1)
    : 'jpg';
  
  let filename = template
    .replace(/{timestamp}/g, timestamp)
    .replace(/{counter}/g, counter)
    .replace(/{date}/g, date)
    .replace(/{time}/g, time)
    .replace(/{original}/g, originalNameWithoutExt);
  
  // Очищаем от недопустимых символов
  filename = filename.replace(/[<>:"/\\|?*]/g, '_');
  
  return filename + '.' + extension.toLowerCase();
}

// Инициализация настроек по умолчанию
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get(['openKey', 'saveKey', 'copyKey', 'customPathEnabled', 'customPath', 'renameEnabled', 'renameTemplate', 'openInCurrentTab', 'copyMediaFile'], (result) => {
    const defaults = {
      openKey: 'Ctrl+Shift+U',
      saveKey: 'Ctrl+Shift+S',
      copyKey: 'Ctrl+Shift+C',
      customPathEnabled: false,
      customPath: '',
      renameEnabled: false,
      renameTemplate: 'media_{timestamp}_{counter}',
      openInCurrentTab: false,
      copyMediaFile: false
    };
    
    const updates = {};
    for (const key in defaults) {
      if (result[key] === undefined) {
        updates[key] = defaults[key];
      }
    }
    
    if (Object.keys(updates).length > 0) {
      chrome.storage.sync.set(updates);
    }
  });
});