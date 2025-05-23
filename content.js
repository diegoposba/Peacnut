let isSelectionMode = false;
let overlay = null;
let highlightedElement = null;

if (window.imageSelectorLoaded) {
} else {
  window.imageSelectorLoaded = true;
  
  initializeImageSelector();
}

function initializeImageSelector() {

function createSelectionOverlay() {
  if (overlay) {
    return;
  }
  
  overlay = document.createElement('div');
  overlay.id = 'image-selector-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(255, 0, 0, 0.05);
    z-index: 999999;
    cursor: crosshair;
    pointer-events: auto;
  `;
  
  const highlight = document.createElement('div');
  highlight.id = 'selection-highlight';
  highlight.style.cssText = `
    position: absolute;
    background: rgba(29, 155, 209, 0.3);
    border: 2px solid #1d9bd1;
    pointer-events: none;
    border-radius: 2px;
    display: none;
    z-index: 1000000;
  `;
  
  const tooltip = document.createElement('div');
  tooltip.id = 'selection-tooltip';
  tooltip.style.cssText = `
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    font-size: 11px;
    font-family: monospace;
    border-radius: 3px;
    pointer-events: none;
    z-index: 1000001;
    display: none;
    max-width: 300px;
  `;
  
  document.body.appendChild(overlay);
  document.body.appendChild(highlight);
  document.body.appendChild(tooltip);
  
  overlay.addEventListener('mousemove', handleMouseMove);
  overlay.addEventListener('click', handleElementClick);
  document.addEventListener('keydown', handleKeyDown);
  
  document.body.style.overflow = 'hidden';
}

function removeSelectionOverlay() {
  if (overlay) {
    overlay.remove();
    overlay = null;
  }
  
  const highlight = document.getElementById('selection-highlight');
  if (highlight) {
    highlight.remove();
  }
  
  const tooltip = document.getElementById('selection-tooltip');
  if (tooltip) {
    tooltip.remove();
  }
  
  highlightedElement = null;
  document.body.style.overflow = '';
}

function handleMouseMove(e) {
  if (!overlay) return;
  
  overlay.style.pointerEvents = 'none';
  const elementBelow = document.elementFromPoint(e.clientX, e.clientY);
  overlay.style.pointerEvents = 'auto';
  
  if (!elementBelow || elementBelow === highlightedElement) return;
  
  highlightedElement = elementBelow;
  updateHighlight(elementBelow, e.clientX, e.clientY);
}

function updateHighlight(element, mouseX, mouseY) {
  const highlight = document.getElementById('selection-highlight');
  const tooltip = document.getElementById('selection-tooltip');
  
  if (!highlight || !tooltip) return;
  
  const rect = element.getBoundingClientRect();
  
  highlight.style.cssText += `
    display: block;
    left: ${rect.left + window.scrollX}px;
    top: ${rect.top + window.scrollY}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
  `;
  
  const tagName = element.tagName.toLowerCase();
  let hasImage = false;
  
  hasImage = element.querySelector('img') !== null ||
             element.tagName === 'IMG' || 
             window.getComputedStyle(element).backgroundImage !== 'none';
  
  const classList = element.className && typeof element.className === 'string' && element.className.trim()
  ? `.${element.className.trim().split(/\s+/).join('.')}`
  : '';
  const id = element.id ? `#${element.id}` : '';
  
  let tooltipText = `${tagName}${id}${classList}`;
  if (hasImage) {
    tooltipText += ' 📸';
  }
  
  tooltip.textContent = tooltipText;
  tooltip.style.cssText += `
    display: block;
    left: ${mouseX + 10}px;
    top: ${mouseY - 30}px;
  `;
  
  const tooltipRect = tooltip.getBoundingClientRect();
  if (tooltipRect.right > window.innerWidth) {
    tooltip.style.left = `${mouseX - tooltipRect.width - 10}px`;
  }
  if (tooltipRect.top < 0) {
    tooltip.style.top = `${mouseY + 20}px`;
  }
}

function handleElementClick(e) {
  e.preventDefault();
  e.stopPropagation();
  
  if (!highlightedElement) return;
  
  const imageData = extractImageFromElement(highlightedElement);
  
  if (imageData) {
    chrome.runtime.sendMessage({
      type: 'IMAGE_EXTRACTED',
      imageData: imageData
    });
    
  } else {
    showNotification('Aucune image trouvée dans cet élément');
  }
  
  toggleSelectionMode();
}

function extractImageFromElement(element) {
  let imageSrc = null;
  let dimensions = '';
  let targetElement = element;
  
  const imgChild = element.querySelector('img');
  if (imgChild) {
    targetElement = imgChild;
    imageSrc = imgChild.src || imgChild.getAttribute('data-src') || imgChild.getAttribute('srcset');
    dimensions = `${imgChild.naturalWidth || imgChild.width}×${imgChild.naturalHeight || imgChild.height}`;
  } else {
    let current = element;
    for (let i = 0; i < 3; i++) {
      const siblingImg = current.parentElement?.querySelector('img');
      if (siblingImg) {
        targetElement = siblingImg;
        imageSrc = siblingImg.src || siblingImg.getAttribute('data-src');
        dimensions = `${siblingImg.naturalWidth || siblingImg.width}×${siblingImg.naturalHeight || siblingImg.height}`;
        break;
      }
      current = current.parentElement;
      if (!current) break;
    }
  }
  
  if (!imageSrc) {
    if (targetElement.tagName === 'IMG') {
      imageSrc = targetElement.src || targetElement.getAttribute('data-src') || targetElement.getAttribute('srcset');
      dimensions = `${targetElement.naturalWidth || targetElement.width}×${targetElement.naturalHeight || targetElement.height}`;
    }
    else {
      const style = window.getComputedStyle(targetElement);
      const bgImage = style.backgroundImage;
      
      if (bgImage && bgImage !== 'none') {
        const matches = bgImage.match(/url\(["']?([^"']*?)["']?\)/);
        if (matches && matches[1]) {
          imageSrc = matches[1];
          dimensions = `${targetElement.offsetWidth}×${targetElement.offsetHeight}`;
        }
      }
    }
  }
  
  if (!imageSrc) {
    return null;
  }
  
  if (imageSrc.startsWith('//')) {
    imageSrc = 'https:' + imageSrc;
  } else if (imageSrc.startsWith('/')) {
    imageSrc = window.location.origin + imageSrc;
  }
  
  const format = imageSrc.includes('.png') ? 'png' : 
               imageSrc.includes('.jpg') ? 'jpg' :
               imageSrc.includes('.jpeg') ? 'jpeg' :
               imageSrc.includes('.gif') ? 'gif' :
               imageSrc.includes('.webp') ? 'webp' :
               imageSrc.includes('.svg') ? 'svg' : 'png';
  
  return {
    src: imageSrc,
    dimensions: dimensions,
    format: format,
    timestamp: Date.now(),
    url: window.location.href,
    elementType: targetElement.tagName.toLowerCase()
  };
}

function handleKeyDown(e) {
  if (e.key === 'Escape' && isSelectionMode) {
    toggleSelectionMode();
  }
}

function showNotification(message) {
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${message.includes('✅') ? '#28a745' : '#dc3545'};
    color: white;
    padding: 12px 20px;
    border-radius: 6px;
    z-index: 1000002;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    transition: all 0.3s ease;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }
  }, 2000);
}

function toggleSelectionMode() {
  isSelectionMode = !isSelectionMode;
  
  if (isSelectionMode) {
    createSelectionOverlay();
  } else {
    removeSelectionOverlay();
  }
  
  try {
    chrome.runtime.sendMessage({
      type: 'SELECTION_MODE_STATUS',
      active: isSelectionMode
    });
  } catch (err) {
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TOGGLE_SELECTION_MODE') {
    toggleSelectionMode();
    sendResponse({success: true});
  } else if (message.type === 'RESET_EXTENSION') {
    isSelectionMode = false;
    removeSelectionOverlay();
    sendResponse({success: true});
  } else if (message.type === 'CHECK_STATUS') {
    sendResponse({
      isSelectionMode: isSelectionMode,
      isLoaded: true
    });
  }
  
  return true;
});

window.addEventListener('beforeunload', () => {
  removeSelectionOverlay();
});

let currentUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== currentUrl) {
    currentUrl = window.location.href;
    if (isSelectionMode) {
      removeSelectionOverlay();
      setTimeout(() => {
        if (isSelectionMode) {
          createSelectionOverlay();
        }
      }, 100);
    }
  }
});

observer.observe(document, { subtree: true, childList: true });

window.addEventListener('beforeunload', () => {
  observer.disconnect();
});

}