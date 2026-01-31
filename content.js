let autoClickEnabled = false;
let isKeyPressed = false;
let observer = null;
let currentHotkey = {key: 'KeyF', keyName: 'F'};
let currentHotkey2 = {key: 'KeyR', keyName: 'R'};
let keyStateCheckInterval = null;
let isWaitingForButton = false;

init();

function init() {
  chrome.storage.sync.get(['autoClickEnabled', 'hotkey', 'hotkey2', 'keyPressedState', 'waitingForButton'], function(result) {
    autoClickEnabled = result.autoClickEnabled || false;
    currentHotkey = result.hotkey || {key: 'KeyF', keyName: 'F'};
    currentHotkey2 = result.hotkey2 || {key: 'KeyR', keyName: 'R'};
    isWaitingForButton = result.waitingForButton || false;
    
    if (result.keyPressedState && autoClickEnabled) {
      isKeyPressed = true;
      startWatching();
      startAutoClicking();
      startKeyStateMonitoring();
    } else if (autoClickEnabled) {
      startWatching();
    }
    
    if (isWaitingForButton && autoClickEnabled) {
      startWatching();
      waitForButtonAndClick();
    }
  });
  
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === 'toggleAutoClick') {
      autoClickEnabled = request.enabled;
      if (autoClickEnabled) {
        startWatching();
      } else {
        stopWatching();
        chrome.storage.sync.set({keyPressedState: false});
      }
    } else if (request.action === 'updateHotkey') {
      currentHotkey = request.hotkey;
    } else if (request.action === 'updateHotkey2') {
      currentHotkey2 = request.hotkey2;
    }
  });
  
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keyup', handleKeyUp, true);
  
  window.addEventListener('beforeunload', function() {
    chrome.storage.sync.set({keyPressedState: isKeyPressed});
  });
}

function handleKeyDown(event) {
  if (event.code === currentHotkey.key) {
    event.preventDefault();
    if (!isKeyPressed && autoClickEnabled) {
      isKeyPressed = true;
      chrome.storage.sync.set({keyPressedState: true});
      startAutoClicking();
      startKeyStateMonitoring();
    }
  }
  
  if (event.code === currentHotkey2.key && autoClickEnabled) {
    event.preventDefault();
    chrome.storage.sync.set({waitingForButton: true}, function() {
      location.reload();
    });
  }
}

function handleKeyUp(event) {
  if (event.code === currentHotkey.key) {
    if (isKeyPressed) {
      isKeyPressed = false;
      chrome.storage.sync.set({keyPressedState: false});
      stopAutoClicking();
      stopKeyStateMonitoring();
    }
  }
}

function startKeyStateMonitoring() {
  if (keyStateCheckInterval) return;
  
  keyStateCheckInterval = setInterval(() => {
    if (!isKeyPressed) {
      clearInterval(keyStateCheckInterval);
      keyStateCheckInterval = null;
      return;
    }
    
    document.addEventListener('keydown', function checkKey(e) {
      if (e.code === currentHotkey.key) {
        document.removeEventListener('keydown', checkKey);
      }
    }, {once: true});
    
  }, 100);
}

function stopKeyStateMonitoring() {
  if (keyStateCheckInterval) {
    clearInterval(keyStateCheckInterval);
    keyStateCheckInterval = null;
  }
}

function startWatching() {
  checkForButton();
  
  observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList') {
        checkForButton();
        
        if (isKeyPressed && window.matchButton) {
          checkButtonChanges();
        }
        
        if (isWaitingForButton && window.matchButton) {
          const button = window.matchButton;
          if (button.offsetParent !== null) {
            setTimeout(() => {
              if (isWaitingForButton) {
                waitForButtonAndClick();
              }
            }, 500);
          }
        }
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true
  });
}

function stopWatching() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function checkForButton() {
  const buttons = document.querySelectorAll('button');
  for (let button of buttons) {
    const textContent = button.textContent.trim();
    if (textContent === 'Найти матч') {
      if (button.disabled) {
        tryToEnableButton(button);
      }
      window.matchButton = button;
      return button;
    }
  }
  
  const specificButton = document.querySelector('.styles__ButtonTextWrapper-sc-b58dd53c-7.ktzBTR');
  if (specificButton && specificButton.textContent.trim() === 'Найти матч') {
    const button = specificButton.closest('button');
    if (button && button.disabled) {
      tryToEnableButton(button);
    }
    window.matchButton = button;
    return button;
  }
  
  if (window.matchButton) {
    window.matchButton = null;
  }
  
  return null;
}

function tryToEnableButton(button) {
  try {
    button.removeAttribute('disabled');
    button.disabled = false;
    
    const disabledClasses = ['disabled', 'inactive', 'blocked', 'loading'];
    disabledClasses.forEach(className => {
      button.classList.remove(className);
    });
    
    let parent = button.parentElement;
    while (parent && parent !== document.body) {
      parent.classList.remove('disabled', 'inactive', 'blocked');
      if (parent.style.pointerEvents === 'none') {
        parent.style.pointerEvents = 'auto';
      }
      parent = parent.parentElement;
    }
    
    if (button.style.pointerEvents === 'none') {
      button.style.pointerEvents = 'auto';
    }
    
    button.setAttribute('aria-disabled', 'false');
    
    const events = ['focus', 'mouseenter', 'mouseover'];
    events.forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      button.dispatchEvent(event);
    });
  } catch (error) {
  }
}

function checkButtonChanges() {
  if (!window.matchButton || !document.contains(window.matchButton)) {
    stopAutoClickingDueToChange();
    return;
  }
  
  const currentText = window.matchButton.textContent.trim();
  
  if (!currentText.includes('Найти матч')) {
    stopAutoClickingDueToChange();
    return;
  }
  
  if (window.matchButton.offsetParent === null) {
    stopAutoClickingDueToChange();
    return;
  }
}

function stopAutoClickingDueToChange() {
  isKeyPressed = false;
  chrome.storage.sync.set({keyPressedState: false});
  stopKeyStateMonitoring();
}

function startAutoClicking() {
  if (!autoClickEnabled) return;
  
  let lastButtonState = null;
  let clickCount = 0;
  
  const clickInterval = setInterval(() => {
    if (!isKeyPressed || !autoClickEnabled) {
      clearInterval(clickInterval);
      return;
    }
    
    let button = window.matchButton;
    if (!button || !document.contains(button)) {
      button = checkForButton();
    }
    
    if (button && button.offsetParent !== null) {
      if (button.disabled) {
        tryToEnableButton(button);
        setTimeout(() => {
          if (!button.disabled) {
          }
        }, 50);
      }
      
      const currentButtonText = button.textContent.trim();
      
      if (lastButtonState === null) {
        lastButtonState = currentButtonText;
      } else if (lastButtonState !== currentButtonText) {
        stopAutoClickingDueToChange();
        clearInterval(clickInterval);
        return;
      }
      
      if (!currentButtonText.includes('Найти матч')) {
        stopAutoClickingDueToChange();
        clearInterval(clickInterval);
        return;
      }
      
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      
      if (button.disabled) {
        const wasDisabled = button.disabled;
        button.disabled = false;
        button.removeAttribute('disabled');
        
        button.dispatchEvent(clickEvent);
        
        try {
          button.click();
          clickCount++;
        } catch (e) {
        }
      } else {
        button.dispatchEvent(clickEvent);
        
        try {
          button.click();
          clickCount++;
        } catch (e) {
        }
      }
      
      button.style.transform = 'scale(0.95)';
      setTimeout(() => {
        if (button.style) {
          button.style.transform = '';
        }
      }, 100);
    } else {
      if (lastButtonState !== null) {
        stopAutoClickingDueToChange();
        clearInterval(clickInterval);
        return;
      }
    }
  }, 50);
}

function stopAutoClicking() {
}

function waitForButtonAndClick() {
  const checkInterval = setInterval(() => {
    if (!isWaitingForButton || !autoClickEnabled) {
      clearInterval(checkInterval);
      return;
    }
    
    const button = checkForButton();
    if (button && button.offsetParent !== null) {
      if (button.disabled) {
        tryToEnableButton(button);
        
        setTimeout(() => {
          if (!button.disabled || true) {
            performAutoClick(button);
          }
        }, 200);
      } else {
        performAutoClick(button);
      }
    }
  }, 100);
  
  setTimeout(() => {
    if (isWaitingForButton) {
      isWaitingForButton = false;
      chrome.storage.sync.set({waitingForButton: false});
      clearInterval(checkInterval);
    }
  }, 10000);
}

function performAutoClick(button) {
  if (button.disabled) {
    button.disabled = false;
    button.removeAttribute('disabled');
  }
  
  const clickEvent = new MouseEvent('click', {
    bubbles: true,
    cancelable: true,
    view: window
  });
  
  button.dispatchEvent(clickEvent);
  
  try {
    button.click();
  } catch (e) {
  }
  
  button.style.transform = 'scale(0.95)';
  setTimeout(() => {
    if (button.style) {
      button.style.transform = '';
    }
  }, 100);
  
  isWaitingForButton = false;
  chrome.storage.sync.set({waitingForButton: false});
}

let currentUrl = location.href;
new MutationObserver(() => {
  if (location.href !== currentUrl) {
    currentUrl = location.href;
    chrome.storage.sync.set({keyPressedState: isKeyPressed});
    setTimeout(() => {
      chrome.storage.sync.get(['keyPressedState'], function(result) {
        if (result.keyPressedState && autoClickEnabled) {
          isKeyPressed = true;
          startAutoClicking();
          startKeyStateMonitoring();
        }
      });
    }, 1000);
  }
}).observe(document, {subtree: true, childList: true});

document.addEventListener('visibilitychange', function() {
  if (document.hidden) {
    chrome.storage.sync.set({keyPressedState: isKeyPressed});
  } else {
    chrome.storage.sync.get(['keyPressedState'], function(result) {
      if (result.keyPressedState && autoClickEnabled && !isKeyPressed) {
        isKeyPressed = true;
        startAutoClicking();
        startKeyStateMonitoring();
      }
    });
  }
});

window.addEventListener('blur', function() {
  chrome.storage.sync.set({keyPressedState: isKeyPressed});
});

window.addEventListener('focus', function() {
  setTimeout(() => {
    chrome.storage.sync.get(['keyPressedState'], function(result) {
      if (result.keyPressedState && autoClickEnabled && !isKeyPressed) {
        isKeyPressed = true;
        startAutoClicking();
        startKeyStateMonitoring();
      }
    });
  }, 100);
});