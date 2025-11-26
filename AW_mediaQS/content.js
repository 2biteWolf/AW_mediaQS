(function() {
  let currentMediaElement = null;
  let customShortcuts = {};
  let highlightEnabled = true;
  let openInCurrentTab = false;
  let copyMediaFile = false;

  // Функция для загрузки актуальных комбинаций
  function loadShortcuts() {
    chrome.commands.getAll((commands) => {
      commands.forEach(command => {
        if (command.name === 'open_media') {
          customShortcuts.openKey = command.shortcut || 'Ctrl+Shift+U';
        } else if (command.name === 'save_media') {
          customShortcuts.saveKey = command.shortcut || 'Ctrl+Shift+S';
        } else if (command.name === 'copy_media_url') {
          customShortcuts.copyKey = command.shortcut || 'Ctrl+Shift+C';
        }
      });
      console.log('AW_MediaQS: Комбинации загружены:', customShortcuts);
    });
  }

  // Загружаем настройки
  chrome.storage.sync.get({
    highlightEnabled: true,
    openInCurrentTab: false,
    copyMediaFile: false
  }, function(settings) {
    highlightEnabled = settings.highlightEnabled;
    openInCurrentTab = settings.openInCurrentTab;
    copyMediaFile = settings.copyMediaFile;
    loadShortcuts();
  });

  // Отслеживаем движение мыши для определения текущего медиа-элемента
  document.addEventListener('mouseover', function(e) {
    const target = e.target;
    if (isMediaElement(target)) {
      currentMediaElement = target;
      if (highlightEnabled) {
        target.style.outline = '3px solid #00ff00';
        target.style.outlineOffset = '2px';
        target.style.boxShadow = '0 0 10px #00ff00';
      }
    }
  });

  document.addEventListener('mouseout', function(e) {
    if (currentMediaElement === e.target) {
      if (highlightEnabled) {
        currentMediaElement.style.outline = '';
        currentMediaElement.style.outlineOffset = '';
        currentMediaElement.style.boxShadow = '';
      }
      currentMediaElement = null;
    }
  });

  // Глобальный обработчик клавиш
  document.addEventListener('keydown', function(e) {
    if (!currentMediaElement) return;

    const keyCombination = getKeyCombination(e);
    
    if (keyCombination === customShortcuts.openKey) {
      e.preventDefault();
      e.stopPropagation();
      openMedia();
    } else if (keyCombination === customShortcuts.saveKey) {
      e.preventDefault();
      e.stopPropagation();
      saveMedia();
    } else if (keyCombination === customShortcuts.copyKey) {
      e.preventDefault();
      e.stopPropagation();
      copyMediaUrl();
    }
  });

  function getKeyCombination(e) {
    const keys = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.metaKey) keys.push('Cmd');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    
    if (!['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      if (e.key.length === 1) {
        keys.push(e.key.toUpperCase());
      } else {
        const key = e.key.replace('Arrow', '');
        keys.push(key);
      }
    }

    return keys.join('+');
  }

  function isMediaElement(element) {
    return (element.tagName === 'IMG' && element.src) ||
           (element.tagName === 'VIDEO' && element.src) ||
           (element.tagName === 'A' && isMediaFile(element.href)) ||
           (element.tagName === 'SOURCE' && element.src);
  }

  function isMediaFile(url) {
    if (!url) return false;
    const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', 
                           '.mp4', '.webm', '.avi', '.mov', '.mkv', '.svg'];
    return mediaExtensions.some(ext => url.toLowerCase().includes(ext));
  }

  function getMediaUrl(element) {
    if (element.tagName === 'IMG' || element.tagName === 'VIDEO') {
      return element.src;
    } else if (element.tagName === 'A') {
      return element.href;
    } else if (element.tagName === 'SOURCE') {
      return element.src;
    }
    return null;
  }

  function openMedia() {
    if (currentMediaElement) {
      const mediaUrl = getMediaUrl(currentMediaElement);
      if (mediaUrl) {
        if (openInCurrentTab) {
          window.location.href = mediaUrl;
        } else {
          window.open(mediaUrl, '_blank');
        }
        return true;
      }
    }
    return false;
  }

  function saveMedia() {
    if (currentMediaElement) {
      const mediaUrl = getMediaUrl(currentMediaElement);
      if (mediaUrl) {
        chrome.runtime.sendMessage({
          action: 'downloadMedia',
          url: mediaUrl
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('Ошибка отправки сообщения:', chrome.runtime.lastError.message);
          }
        });
        return true;
      }
    }
    return false;
  }

  function copyMediaUrl() {
    if (currentMediaElement) {
      const mediaUrl = getMediaUrl(currentMediaElement);
      if (mediaUrl) {
        if (copyMediaFile) {
          copyMediaFileToClipboard(mediaUrl);
        } else {
          copyMediaLinkToClipboard(mediaUrl);
        }
        return true;
      }
    }
    return false;
  }

  async function copyMediaFileToClipboard(mediaUrl) {
    try {
      const response = await fetch(mediaUrl);
      const blob = await response.blob();
      
      const clipboardItem = new ClipboardItem({
        [blob.type]: blob
      });
      
      await navigator.clipboard.write([clipboardItem]);
      
      console.log('AW_MediaQS: Медиафайл скопирован в буфер:', mediaUrl);
      showCopyNotification('✓ Медиафайл скопирован');
      return true;
    } catch (error) {
      console.error('AW_MediaQS: Ошибка копирования файла:', error);
      return copyMediaLinkToClipboard(mediaUrl);
    }
  }

  function copyMediaLinkToClipboard(mediaUrl) {
    navigator.clipboard.writeText(mediaUrl).then(() => {
      console.log('AW_MediaQS: Ссылка скопирована в буфер:', mediaUrl);
      showCopyNotification('✓ Ссылка скопирована');
    }).catch(err => {
      console.error('AW_MediaQS: Ошибка копирования:', err);
      fallbackCopyToClipboard(mediaUrl);
    });
  }

  function showCopyNotification(message) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #00ff00;
      color: #2d2d2d;
      padding: 10px 15px;
      border-radius: 6px;
      font-family: Arial, sans-serif;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 0 10px rgba(0,255,0,0.5);
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 2000);
  }

  function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.cssText = 'position: fixed; left: -9999px; opacity: 0;';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showCopyNotification('✓ Скопировано');
    } catch (err) {
      console.error('AW_MediaQS: Fallback copy failed:', err);
    }
    document.body.removeChild(textArea);
  }

  // Слушаем сообщения от background script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'openMedia') {
      const success = openMedia();
      sendResponse({ success: success });
    } else if (request.action === 'saveMedia') {
      const success = saveMedia();
      sendResponse({ success: success });
    } else if (request.action === 'copyMediaUrl') {
      const success = copyMediaUrl();
      sendResponse({ success: success });
    }
    return true;
  });

  // Обновляем настройки при их изменении
  chrome.storage.onChanged.addListener(function(changes, namespace) {
    if (namespace === 'sync') {
      if (changes.highlightEnabled) {
        highlightEnabled = changes.highlightEnabled.newValue;
        if (!highlightEnabled) {
          document.querySelectorAll('*').forEach(el => {
            el.style.outline = '';
            el.style.outlineOffset = '';
            el.style.boxShadow = '';
          });
        }
      }
      if (changes.openInCurrentTab) {
        openInCurrentTab = changes.openInCurrentTab.newValue;
      }
      if (changes.copyMediaFile) {
        copyMediaFile = changes.copyMediaFile.newValue;
      }
    }
  });

  // Слушаем сообщения для обновления комбинаций
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'updateShortcuts') {
      loadShortcuts();
      sendResponse({ success: true });
    }
    return true;
  });
})();