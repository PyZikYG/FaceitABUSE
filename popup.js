document.addEventListener('DOMContentLoaded', function() {
  const toggleBtn = document.getElementById('toggleBtn');
  const statusIndicator = document.getElementById('statusIndicator');
  const hotkeyInput = document.getElementById('hotkeyInput');
  const clearHotkey = document.getElementById('clearHotkey');
  const hotkeyInput2 = document.getElementById('hotkeyInput2');
  const clearHotkey2 = document.getElementById('clearHotkey2');
  const keyStatus = document.getElementById('keyStatus');
  
  let isRecording = false;
  let isRecording2 = false;
  let currentHotkey = null;
  let currentHotkey2 = null;
  
  function checkKeyState() {
    chrome.storage.sync.get(['keyPressedState'], function(result) {
      if (result.keyPressedState) {
        keyStatus.style.display = 'flex';
      } else {
        keyStatus.style.display = 'none';
      }
    });
  }
  
  const keyStateInterval = setInterval(checkKeyState, 500);
  
  window.addEventListener('beforeunload', function() {
    clearInterval(keyStateInterval);
  });
  
  checkKeyState();
  
  chrome.storage.sync.get(['autoClickEnabled', 'hotkey', 'hotkey2'], function(result) {
    const isEnabled = result.autoClickEnabled || false;
    const hotkey = result.hotkey || {key: 'KeyF', keyName: 'F'};
    const hotkey2 = result.hotkey2 || {key: 'KeyR', keyName: 'R'};
    
    currentHotkey = hotkey;
    currentHotkey2 = hotkey2;
    updateUI(isEnabled);
    updateHotkeyDisplay(hotkey);
    updateHotkeyDisplay2(hotkey2);
  });
  
  hotkeyInput.addEventListener('focus', function() {
    isRecording = true;
    hotkeyInput.value = 'Нажмите клавишу...';
    hotkeyInput.style.background = 'rgba(76, 175, 80, 0.3)';
  });
  
  hotkeyInput.addEventListener('blur', function() {
    isRecording = false;
    hotkeyInput.style.background = 'rgba(255, 255, 255, 0.2)';
    if (currentHotkey) {
      updateHotkeyDisplay(currentHotkey);
    }
  });
  
  hotkeyInput2.addEventListener('focus', function() {
    isRecording2 = true;
    hotkeyInput2.value = 'Нажмите клавишу...';
    hotkeyInput2.style.background = 'rgba(76, 175, 80, 0.3)';
  });
  
  hotkeyInput2.addEventListener('blur', function() {
    isRecording2 = false;
    hotkeyInput2.style.background = 'rgba(255, 255, 255, 0.2)';
    if (currentHotkey2) {
      updateHotkeyDisplay2(currentHotkey2);
    }
  });
  
  hotkeyInput.addEventListener('keydown', function(e) {
    if (!isRecording) return;
    
    e.preventDefault();
    
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      hotkeyInput.value = 'Нажмите обычную клавишу (A-Z, 0-9, F1-F12...)';
      return;
    }
    
    if (currentHotkey2 && e.code === currentHotkey2.key) {
      hotkeyInput.value = 'Эта клавиша уже используется для Бинда 2';
      return;
    }
    
    const hotkey = {
      key: e.code,
      keyName: e.key.toUpperCase()
    };
    
    currentHotkey = hotkey;
    updateHotkeyDisplay(hotkey);
    
    chrome.storage.sync.set({hotkey: hotkey}, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateHotkey',
          hotkey: hotkey
        });
      });
    });
    
    hotkeyInput.blur();
  });
  
  hotkeyInput2.addEventListener('keydown', function(e) {
    if (!isRecording2) return;
    
    e.preventDefault();
    
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
      hotkeyInput2.value = 'Нажмите обычную клавишу (A-Z, 0-9, F1-F12...)';
      return;
    }
    
    if (currentHotkey && e.code === currentHotkey.key) {
      hotkeyInput2.value = 'Эта клавиша уже используется для Бинда 1';
      return;
    }
    
    const hotkey2 = {
      key: e.code,
      keyName: e.key.toUpperCase()
    };
    
    currentHotkey2 = hotkey2;
    updateHotkeyDisplay2(hotkey2);
    
    chrome.storage.sync.set({hotkey2: hotkey2}, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateHotkey2',
          hotkey2: hotkey2
        });
      });
    });
    
    hotkeyInput2.blur();
  });
  
  clearHotkey.addEventListener('click', function() {
    const defaultHotkey = {key: 'KeyF', keyName: 'F'};
    currentHotkey = defaultHotkey;
    updateHotkeyDisplay(defaultHotkey);
    
    chrome.storage.sync.set({hotkey: defaultHotkey}, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateHotkey',
          hotkey: defaultHotkey
        });
      });
    });
  });
  
  clearHotkey2.addEventListener('click', function() {
    const defaultHotkey2 = {key: 'KeyR', keyName: 'R'};
    currentHotkey2 = defaultHotkey2;
    updateHotkeyDisplay2(defaultHotkey2);
    
    chrome.storage.sync.set({hotkey2: defaultHotkey2}, function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateHotkey2',
          hotkey2: defaultHotkey2
        });
      });
    });
  });
  
  toggleBtn.addEventListener('click', function() {
    chrome.storage.sync.get(['autoClickEnabled'], function(result) {
      const currentState = result.autoClickEnabled || false;
      const newState = !currentState;
      
      chrome.storage.sync.set({autoClickEnabled: newState}, function() {
        updateUI(newState);
        
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'toggleAutoClick',
            enabled: newState
          });
        });
      });
    });
  });
  
  function updateUI(isEnabled) {
    if (isEnabled) {
      toggleBtn.textContent = 'Отключить автонажатие';
      toggleBtn.classList.add('active');
      statusIndicator.classList.remove('inactive');
    } else {
      toggleBtn.textContent = 'Включить автонажатие';
      toggleBtn.classList.remove('active');
      statusIndicator.classList.add('inactive');
    }
  }
  
  function updateHotkeyDisplay(hotkey) {
    let keyName = hotkey.keyName || hotkey.key;
    
    if (hotkey.key && hotkey.key.startsWith('Key')) {
      keyName = hotkey.key.substring(3);
    } else if (hotkey.key && hotkey.key.startsWith('Digit')) {
      keyName = hotkey.key.substring(5);
    } else if (hotkey.key) {
      const keyMap = {
        'Space': 'Пробел',
        'Enter': 'Enter',
        'Escape': 'Esc',
        'Backspace': 'Backspace',
        'Tab': 'Tab',
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'ArrowLeft': '←',
        'ArrowRight': '→',
        'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4',
        'F5': 'F5', 'F6': 'F6', 'F7': 'F7', 'F8': 'F8',
        'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12'
      };
      keyName = keyMap[hotkey.key] || keyName;
    }
    
    hotkeyInput.value = keyName;
  }
  
  function updateHotkeyDisplay2(hotkey) {
    let keyName = hotkey.keyName || hotkey.key;
    
    if (hotkey.key && hotkey.key.startsWith('Key')) {
      keyName = hotkey.key.substring(3);
    } else if (hotkey.key && hotkey.key.startsWith('Digit')) {
      keyName = hotkey.key.substring(5);
    } else if (hotkey.key) {
      const keyMap = {
        'Space': 'Пробел',
        'Enter': 'Enter',
        'Escape': 'Esc',
        'Backspace': 'Backspace',
        'Tab': 'Tab',
        'ArrowUp': '↑',
        'ArrowDown': '↓',
        'ArrowLeft': '←',
        'ArrowRight': '→',
        'F1': 'F1', 'F2': 'F2', 'F3': 'F3', 'F4': 'F4',
        'F5': 'F5', 'F6': 'F6', 'F7': 'F7', 'F8': 'F8',
        'F9': 'F9', 'F10': 'F10', 'F11': 'F11', 'F12': 'F12'
      };
      keyName = keyMap[hotkey.key] || keyName;
    }
    
    hotkeyInput2.value = keyName;
  }
});