let autoClickEnabled = false;
let isKeyPressed = false;
let observer = null;
let currentHotkey = {key: 'KeyF', keyName: 'F'};
let currentHotkey2 = {key: 'KeyR', keyName: 'R'};
let keyStateCheckInterval = null;
let isWaitingForButton = false;

init();

function safeStorageSet(data, callback) {
  try {
    if (chrome.runtime && chrome.runtime.id) {
      chrome.storage.sync.set(data, callback);
    }
  } catch (error) {
  }
}

function safeStorageGet(keys, callback) {
  try {
    if (chrome.runtime && chrome.runtime.id) {
      chrome.storage.sync.get(keys, callback);
    }
  } catch (error) {
    if (callback) callback({});
  }
}

function init() {
  safeStorageGet(['autoClickEnabled', 'hotkey', 'hotkey2', 'keyPressedState', 'waitingForButton'], function(result) {
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
  
  try {
    if (chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(function(request) {
        if (request.action === 'toggleAutoClick') {
          autoClickEnabled = request.enabled;
          if (autoClickEnabled) {
            startWatching();
          } else {
            stopWatching();
            safeStorageSet({keyPressedState: false});
          }
        } else if (request.action === 'updateHotkey') {
          currentHotkey = request.hotkey;
        } else if (request.action === 'updateHotkey2') {
          currentHotkey2 = request.hotkey2;
        }
      });
    }
  } catch (error) {
  }
  
  document.addEventListener('keydown', handleKeyDown, true);
  document.addEventListener('keyup', handleKeyUp, true);
  
  window.addEventListener('beforeunload', function() {
    safeStorageSet({keyPressedState: isKeyPressed});
  });
}

function handleKeyDown(event) {
  if (event.code === currentHotkey.key) {
    event.preventDefault();
    if (!isKeyPressed && autoClickEnabled) {
      isKeyPressed = true;
      safeStorageSet({keyPressedState: true});
      startAutoClicking();
      startKeyStateMonitoring();
    }
  }
  
  if (event.code === currentHotkey2.key && autoClickEnabled) {
    event.preventDefault();
    safeStorageSet({waitingForButton: true}, function() {
      location.reload();
    });
  }
}

function handleKeyUp(event) {
  if (event.code === currentHotkey.key) {
    if (isKeyPressed) {
      isKeyPressed = false;
      safeStorageSet({keyPressedState: false});
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
  
  try {
    if (observer) {
      observer.disconnect();
    }
    
    observer = new MutationObserver(function(mutations) {
      try {
        mutations.forEach(function(mutation) {
          if (mutation.type === 'childList') {
            checkForButton();
            
            if (isKeyPressed && window.matchButton) {
              checkButtonChanges();
            }
            
            if (isWaitingForButton && window.matchButton) {
              const button = window.matchButton;
              if (button.offsetParent !== null && !button.disabled) {
                setTimeout(() => {
                  if (isWaitingForButton) {
                    waitForButtonAndClick();
                  }
                }, 500);
              }
            }
          }
        });
      } catch (error) {
      }
    });
    
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
  } catch (error) {
  }
}

function stopWatching() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

function checkForButton() {
  try {
    const buttons = document.querySelectorAll('button');
    for (let button of buttons) {
      const textContent = button.textContent.trim();
      if (textContent === 'Найти матч') {
        window.matchButton = button;
        return button;
      }
    }
    
    const specificButton = document.querySelector('.styles__ButtonTextWrapper-sc-b58dd53c-7.ktzBTR');
    if (specificButton && specificButton.textContent.trim() === 'Найти матч') {
      const button = specificButton.closest('button');
      window.matchButton = button;
      return button;
    }
    
    if (window.matchButton) {
      window.matchButton = null;
    }
    
    return null;
  } catch (error) {
    return null;
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
  
  if (window.matchButton.offsetParent === null || window.matchButton.disabled) {
    stopAutoClickingDueToChange();
    return;
  }
}

function stopAutoClickingDueToChange() {
  isKeyPressed = false;
  safeStorageSet({keyPressedState: false});
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
    
    if (button && button.offsetParent !== null && !button.disabled) {
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
      
      button.dispatchEvent(clickEvent);
      
      try {
        button.click();
        clickCount++;
      } catch (e) {
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
    if (button && button.offsetParent !== null && !button.disabled) {
      performAutoClick(button);
    }
  }, 100);
  
  setTimeout(() => {
    if (isWaitingForButton) {
      isWaitingForButton = false;
      safeStorageSet({waitingForButton: false});
      clearInterval(checkInterval);
    }
  }, 10000);
}

function performAutoClick(button) {
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
  safeStorageSet({waitingForButton: false});
}

function initPageChangeObserver() {
  let currentUrl = location.href;
  
  try {
    new MutationObserver(() => {
      if (location.href !== currentUrl) {
        currentUrl = location.href;
        safeStorageSet({keyPressedState: isKeyPressed});
        setTimeout(() => {
          safeStorageGet(['keyPressedState'], function(result) {
            if (result.keyPressedState && autoClickEnabled) {
              isKeyPressed = true;
              startAutoClicking();
              startKeyStateMonitoring();
            }
          });
        }, 1000);
      }
    }).observe(document, {subtree: true, childList: true});
  } catch (error) {
  }
}

function initVisibilityHandlers() {
  try {
    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        safeStorageSet({keyPressedState: isKeyPressed});
      } else {
        safeStorageGet(['keyPressedState'], function(result) {
          if (result.keyPressedState && autoClickEnabled && !isKeyPressed) {
            isKeyPressed = true;
            startAutoClicking();
            startKeyStateMonitoring();
          }
        });
      }
    });

    window.addEventListener('blur', function() {
      safeStorageSet({keyPressedState: isKeyPressed});
    });

    window.addEventListener('focus', function() {
      setTimeout(() => {
        safeStorageGet(['keyPressedState'], function(result) {
          if (result.keyPressedState && autoClickEnabled && !isKeyPressed) {
            isKeyPressed = true;
            startAutoClicking();
            startKeyStateMonitoring();
          }
        });
      }, 100);
    });
  } catch (error) {
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    initPageChangeObserver();
    initVisibilityHandlers();
  });
} else {
  initPageChangeObserver();
  initVisibilityHandlers();
}