chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'IMAGE_EXTRACTED' || message.type === 'SELECTION_MODE_STATUS') {
    chrome.runtime.sendMessage(message);
  }
});