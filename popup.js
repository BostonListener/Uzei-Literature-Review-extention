/**
 * Uzei - Literature Review Extension
 * Popup Script
 * 
 * Handles popup UI interactions, content extraction,
 * project management, and batch processing with optional tab closure.
 */

// Popup configuration settings
const CONFIG = {
  // Web app configuration
  APP_BASE_URL: 'https://uzei.bostonlistener-career.org',
  API_TIMEOUT: 60000,  // 60 seconds
  
  // UI settings
  MAX_TITLE_LENGTH: 60,
  MAX_PREVIEW_LENGTH: 150,
  
  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,  // 1 second
  
  // Multi-tab settings
  MAX_CONCURRENT_TABS: 3,  // Process tabs simultaneously
  TAB_PROCESSING_DELAY: 500,  // Delay between tab processing (ms)
  
  // Tab filtering - exclude these from processing
  INVALID_PROTOCOLS: ['chrome:', 'chrome-extension:', 'moz-extension:', 'about:', 'data:', 'javascript:'],
  INVALID_HOSTS: ['uzei.bostonlistener-career.org'],  // Don't process our own app
};

// Global state management
let currentMode = 'single';  // 'single' or 'multi'
let currentPageData = null;
let projects = [];
let allTabs = [];
let validTabs = [];
let isProcessing = false;
let currentRequestId = null;
let batchProcessingActive = false;
let loginStatus = { isLoggedIn: false, username: null };
let extensionSettings = {
  showNotifications: true
};

/**
 * Load extension settings from storage
 */
async function loadExtensionSettings() {
  try {
    const settings = await new Promise((resolve) => {
      chrome.storage.sync.get([
        'showNotifications'
      ], resolve);
    });
    
    extensionSettings = {
      showNotifications: settings.showNotifications !== false
    };
    
    console.log('Extension settings loaded:', extensionSettings);
  } catch (error) {
    console.error('Error loading extension settings:', error);
    // Use defaults
    extensionSettings = {
      showNotifications: true
    };
  }
}

/**
 * Enhanced PDF URL detection with comprehensive patterns
 */
function isPDFUrl(url) {
  if (!url) return false;
  
  try {
    const urlLower = url.toLowerCase();
    console.log(`Checking URL for PDF patterns: ${url}`);
    
    // Direct PDF file URLs
    if (urlLower.endsWith('.pdf')) {
      console.log('PDF detected: URL ends with .pdf');
      return true;
    }
    
    // PDF with query parameters or fragments
    if (urlLower.includes('.pdf?') || urlLower.includes('.pdf#')) {
      console.log('PDF detected: URL contains .pdf with query/fragment');
      return true;
    }
    
    // Common PDF viewer patterns
    if (urlLower.includes('/pdf/') || 
        urlLower.includes('pdf.') ||
        urlLower.includes('pdf_') ||
        urlLower.includes('document.pdf') ||
        urlLower.includes('paper.pdf') ||
        urlLower.includes('article.pdf') ||
        urlLower.includes('file.pdf') ||
        urlLower.includes('doc.pdf')) {
      console.log('PDF detected: URL contains common PDF patterns');
      return true;
    }
    
    // PDF viewer applications
    if (urlLower.includes('pdfviewer') ||
        urlLower.includes('pdf-viewer') ||
        urlLower.includes('documentviewer') ||
        urlLower.includes('viewer.html') ||
        urlLower.includes('pdfjs')) {
      console.log('PDF detected: URL contains PDF viewer patterns');
      return true;
    }
    
    // Academic sites PDF patterns
    if ((urlLower.includes('arxiv.org') && urlLower.includes('/pdf/')) ||
        (urlLower.includes('researchgate.net') && urlLower.includes('.pdf')) ||
        (urlLower.includes('academia.edu') && urlLower.includes('.pdf')) ||
        (urlLower.includes('springer.com') && urlLower.includes('/pdf/')) ||
        (urlLower.includes('ieee.org') && urlLower.includes('/pdf/')) ||
        (urlLower.includes('acm.org') && urlLower.includes('/pdf/')) ||
        (urlLower.includes('sciencedirect.com') && urlLower.includes('/pdf/')) ||
        (urlLower.includes('nature.com') && urlLower.includes('.pdf')) ||
        (urlLower.includes('wiley.com') && urlLower.includes('.pdf'))) {
      console.log('PDF detected: Academic site PDF URL');
      return true;
    }
    
    // Repository and document hosting patterns
    if ((urlLower.includes('github.com') && urlLower.includes('.pdf')) ||
        (urlLower.includes('dropbox.com') && urlLower.includes('.pdf')) ||
        (urlLower.includes('drive.google.com') && urlLower.includes('pdf')) ||
        (urlLower.includes('onedrive.com') && urlLower.includes('.pdf')) ||
        (urlLower.includes('box.com') && urlLower.includes('.pdf'))) {
      console.log('PDF detected: Document hosting service');
      return true;
    }
    
    // Advanced URL object analysis
    const urlObj = new URL(url);
    const pathname = urlObj.pathname.toLowerCase();
    
    if (pathname.includes('.pdf') || 
        pathname.includes('/pdf/') ||
        pathname.includes('/document/') ||
        pathname.includes('/paper/') ||
        pathname.includes('/article/') ||
        pathname.includes('/download/') ||
        pathname.includes('/attachment/')) {
      
      // Additional verification for PDF-specific patterns
      if (urlObj.search.includes('pdf') || 
          urlObj.hash.includes('pdf') ||
          pathname.endsWith('/pdf') ||
          pathname.includes('pdf-') ||
          pathname.includes('_pdf') ||
          urlObj.search.includes('download') ||
          urlObj.search.includes('attachment')) {
        console.log('PDF detected: URL object analysis found PDF patterns');
        return true;
      }
    }
    
    // Check hostname for PDF service indicators
    const hostname = urlObj.hostname.toLowerCase();
    if (hostname.includes('pdf') || 
        hostname.includes('document') ||
        hostname.includes('paper') ||
        hostname.includes('docs') ||
        hostname.includes('viewer')) {
      
      if (pathname.includes('view') || 
          pathname.includes('download') ||
          pathname.includes('file') ||
          urlObj.search.includes('pdf') ||
          urlObj.search.includes('document')) {
        console.log('PDF detected: Hostname and path analysis');
        return true;
      }
    }
    
    console.log('No PDF patterns detected in URL');
    return false;
  } catch (error) {
    console.warn('Error checking PDF URL:', error);
    return false;
  }
}

/**
 * Enhanced PDF detection using tab properties
 */
async function isPDFTab(tab) {
  if (!tab) return false;
  
  console.log(`Checking if tab is PDF: ${tab.url}`);
  
  // Check URL first
  if (isPDFUrl(tab.url)) {
    console.log('PDF detected via URL analysis');
    return true;
  }
  
  // Check tab title for PDF indicators
  if (tab.title) {
    const titleLower = tab.title.toLowerCase();
    if (titleLower.includes('.pdf') || 
        titleLower.includes('pdf document') ||
        titleLower.includes('pdf viewer') ||
        titleLower.includes('document viewer') ||
        titleLower.endsWith('.pdf')) {
      console.log('PDF detected via tab title');
      return true;
    }
  }
  
  // Check for additional PDF-like patterns
  const url = tab.url.toLowerCase();
  const additionalPDFPatterns = [
    'viewer?',
    'document/',
    'paper/',
    'download',
    'attachment',
    'file.pdf',
    'doc.pdf',
    'paper.pdf',
    'article.pdf'
  ];
  
  for (const pattern of additionalPDFPatterns) {
    if (url.includes(pattern) && (url.includes('pdf') || url.includes('document') || url.includes('paper'))) {
      console.log(`PDF detected via additional pattern: ${pattern}`);
      return true;
    }
  }
  
  // Try to detect from content script if available
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'isPDF' });
    if (response && response.isPDF) {
      console.log('PDF detected via content script');
      return true;
    }
  } catch (error) {
    // Content script not available - normal for PDFs
    console.log('Could not check PDF status via content script (normal for PDFs)');
  }
  
  console.log('Not detected as PDF');
  return false;
}

/**
 * Extract the real PDF URL from Chrome extension URLs
 */
function extractRealPDFUrl(url) {
  if (!url) return url;
  
  console.log(`Checking URL for extension wrapping: ${url}`);
  
  // Check if this is a Chrome PDF viewer URL
  if (url.includes('chrome-extension://') && url.includes('http')) {
    const match = url.match(/chrome-extension:\/\/[^\/]+\/(https?:\/\/.+)/);
    if (match && match[1]) {
      console.log(`✅ Extracted real PDF URL: ${match[1]} from Chrome extension URL`);
      return decodeURIComponent(match[1]);
    }
  }
  
  // Check for other PDF viewer patterns
  if (url.includes('moz-extension://') && url.includes('http')) {
    const match = url.match(/moz-extension:\/\/[^\/]+\/(https?:\/\/.+)/);
    if (match && match[1]) {
      console.log(`✅ Extracted real PDF URL: ${match[1]} from Firefox extension URL`);
      return decodeURIComponent(match[1]);
    }
  }
  
  // Check for Edge PDF viewer
  if (url.includes('ms-browser-extension://') && url.includes('http')) {
    const match = url.match(/ms-browser-extension:\/\/[^\/]+\/(https?:\/\/.+)/);
    if (match && match[1]) {
      console.log(`✅ Extracted real PDF URL: ${match[1]} from Edge extension URL`);
      return decodeURIComponent(match[1]);
    }
  }
  
  console.log(`No extension wrapping detected, using original URL: ${url}`);
  return url;
}

/**
 * Extract filename from PDF URL
 */
function extractPDFFilename(url) {
  try {
    // Extract the real URL if it's wrapped in an extension URL
    const realUrl = extractRealPDFUrl(url);
    const urlObj = new URL(realUrl);
    const pathname = urlObj.pathname;
    
    // Try to extract filename from path
    let filename = pathname.split('/').pop();
    
    // If filename has extension, use it
    if (filename && filename.includes('.')) {
      if (!filename.toLowerCase().endsWith('.pdf')) {
        filename += '.pdf';
      }
      return decodeURIComponent(filename);
    }
    
    // Try to extract from query parameters
    const urlParams = new URLSearchParams(urlObj.search);
    for (const [key, value] of urlParams) {
      if (key.toLowerCase().includes('file') || 
          key.toLowerCase().includes('doc') || 
          key.toLowerCase().includes('name')) {
        if (value && value.includes('.pdf')) {
          return decodeURIComponent(value);
        }
      }
    }
    
    // Generate descriptive name based on hostname and path
    const hostname = urlObj.hostname.replace('www.', '');
    const pathParts = pathname.split('/').filter(part => part && part.length > 0);
    
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      return `${hostname}_${lastPart}.pdf`;
    }
    
    // Fallback to hostname
    return `${hostname}_document.pdf`;
  } catch (e) {
    return `document_${Date.now()}.pdf`;
  }
}

/**
 * Safe wrapper for tab operations that might fail if tab is closed
 */
async function safeTabOperation(operation, fallbackValue = null) {
  try {
    return await operation();
  } catch (error) {
    if (error.message.includes('No tab with id') || 
        error.message.includes('Tab not found') ||
        error.message.includes('Could not establish connection')) {
      console.log('Tab operation failed - tab may have been closed:', error.message);
      return fallbackValue;
    }
    throw error;
  }
}

/**
 * Check if a tab exists before performing operations
 */
async function tabExists(tabId) {
  return await safeTabOperation(async () => {
    const tab = await chrome.tabs.get(tabId);
    return !!tab;
  }, false);
}

/**
 * Show confirmation dialog for closing successfully processed tabs
 */
async function showTabCloseConfirmation(successfulTabs) {
  if (successfulTabs.length === 0) return false;
  
  const tabText = successfulTabs.length === 1 ? 'tab' : 'tabs';
  const message = `Successfully processed ${successfulTabs.length} ${tabText}. Would you like to close the processed tabs to keep your workspace organized?`;
  
  return confirm(message);
}

/**
 * Close multiple tabs immediately
 */
async function closeProcessedTabs(tabIds) {
  if (tabIds.length === 0) return;
  
  try {
    // Filter out tabs that no longer exist
    const existingTabs = [];
    for (const tabId of tabIds) {
      if (await tabExists(tabId)) {
        existingTabs.push(tabId);
      }
    }
    
    if (existingTabs.length > 0) {
      await chrome.tabs.remove(existingTabs);
      console.log(`✅ Closed ${existingTabs.length} processed tabs`);
      
      // Show notification if enabled
      if (extensionSettings.showNotifications) {
        chrome.runtime.sendMessage({
          action: 'showNotification',
          title: 'Tabs Closed',
          message: `Closed ${existingTabs.length} successfully processed tabs`
        });
      }
    }
  } catch (error) {
    console.warn('Error closing processed tabs:', error.message);
  }
}

/**
 * Show status message to user
 */
function showStatus(message, type = 'loading') {
  const container = document.getElementById('status-container');
  const spinner = type === 'loading' ? '<div class="loading-spinner"></div>' : '';
  
  container.innerHTML = `
    <div class="status status-${type}">
      ${spinner}${message}
    </div>
  `;
  
  // Auto-hide success/error messages after 30 seconds
  if (type !== 'loading') {
    setTimeout(() => {
      container.innerHTML = '';
    }, 30000);
  }
}

/**
 * Update login status indicator in header
 */
function updateLoginStatusIndicator() {
  const loginStatusEl = document.getElementById('login-status');
  if (!loginStatusEl) return;
  
  if (loginStatus.isLoggedIn) {
    loginStatusEl.textContent = `✓ ${loginStatus.username}`;
    loginStatusEl.className = 'login-status logged-in';
  } else {
    loginStatusEl.textContent = '! Not logged in';
    loginStatusEl.className = 'login-status logged-out';
  }
}

/**
 * Clear status message
 */
function clearStatus() {
  document.getElementById('status-container').innerHTML = '';
}

/**
 * Show login prompt UI
 */
function showLoginPrompt() {
  const container = document.getElementById('status-container');
  container.innerHTML = `
    <div class="status status-error">
      <strong>Please log in first</strong><br>
      You need to log in to the web app to use this extension.
      <div style="margin-top: 8px;">
        <button id="open-webapp-btn" style="padding: 6px 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
          Open Web App
        </button>
        <button id="refresh-login-btn" style="padding: 6px 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 8px;">
          Check Login
        </button>
      </div>
    </div>
  `;
  
  // Add event listeners for login prompt buttons
  document.getElementById('open-webapp-btn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openWebApp' });
  });
  
  document.getElementById('refresh-login-btn')?.addEventListener('click', () => {
    checkLoginStatus();
  });
}

/**
 * Check user login status with the web app
 */
async function checkLoginStatus() {
  try {
    showStatus('Checking login status...');
    
    const response = await chrome.runtime.sendMessage({ action: 'checkLoginStatus' });
    loginStatus = response;
    
    // Update header indicator
    updateLoginStatusIndicator();
    
    if (loginStatus.isLoggedIn) {
      clearStatus();
      // Show welcome message briefly
      showStatus(`Welcome back, ${loginStatus.username}!`, 'success');
      setTimeout(() => clearStatus(), 3000);
      
      // Enable UI and load data
      enableUI();
      await loadProjects();
      
      return true;
    } else {
      disableUI();
      showLoginPrompt();
      return false;
    }
    
  } catch (error) {
    console.error('Error checking login status:', error);
    disableUI();
    updateLoginStatusIndicator();
    
    // Provide specific error messages
    if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
      showStatus('Cannot connect to the web app. Please check if the web app is accessible and try again.', 'error');
    } else {
      showStatus('Unable to check login status. Please refresh and try again.', 'error');
    }
    return false;
  }
}

/**
 * Enable UI elements when user is logged in
 */
function enableUI() {
  // Enable form elements
  const formElements = document.querySelectorAll('select, button:not(#open-webapp-btn):not(#refresh-login-btn)');
  formElements.forEach(el => {
    el.disabled = false;
  });
  
  // Show main sections
  const sections = document.querySelectorAll('.single-tab-section, .tab-list-section');
  sections.forEach(section => {
    section.style.opacity = '1';
    section.style.pointerEvents = 'auto';
  });
}

/**
 * Disable UI elements when user is not logged in
 */
function disableUI() {
  // Disable form elements except login-related buttons
  const formElements = document.querySelectorAll('select, button:not(#open-webapp-btn):not(#refresh-login-btn):not(#open-settings)');
  formElements.forEach(el => {
    el.disabled = true;
  });
  
  // Fade main sections
  const sections = document.querySelectorAll('.single-tab-section, .tab-list-section');
  sections.forEach(section => {
    section.style.opacity = '0.5';
    section.style.pointerEvents = 'none';
  });
}

/**
 * Make API request with session cookies and error handling
 */
async function apiRequest(url, options = {}, retries = CONFIG.MAX_RETRIES) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      credentials: 'include',  // Include session cookies
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...options.headers
      }
    });
    
    clearTimeout(timeoutId);
    
    // Check if session expired
    if (response.status === 401) {
      loginStatus.isLoggedIn = false;
      disableUI();
      showLoginPrompt();
      throw new Error('Session expired. Please log in again.');
    }
    
    // Always try to parse JSON response
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
      const errorMessage = data.error || data.message || `HTTP ${response.status}: ${response.statusText}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.responseData = data;
      throw error;
    }
    
    return data;
  } catch (error) {
    // Only retry on network errors or timeouts
    if (retries > 0 && error.name === 'AbortError') {
      console.log(`Request timed out. Retrying... (${CONFIG.MAX_RETRIES - retries + 1}/${CONFIG.MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, CONFIG.RETRY_DELAY));
      return apiRequest(url, options, retries - 1);
    }
    throw error;
  }
}

/**
 * Load projects from the web app
 */
async function loadProjects() {
  if (!loginStatus.isLoggedIn) {
    showStatus('Please log in first to load projects', 'error');
    return false;
  }
  
  try {
    showStatus('Loading projects...');
    
    const response = await apiRequest(`${CONFIG.APP_BASE_URL}/api/projects`);
    projects = response.projects || [];
    
    // Update both project selectors
    const selectors = ['project-select', 'project-select-multi'];
    
    selectors.forEach(selectorId => {
      const select = document.getElementById(selectorId);
      if (!select) return;
      
      select.innerHTML = '';
      
      if (projects.length === 0) {
        select.innerHTML = '<option value="">No projects found - create one in the web app</option>';
        return;
      }
      
      // Add default option
      select.innerHTML = '<option value="">Select a project...</option>';
      
      // Add projects
      projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = `${project.name} (${project.papers_count} papers)`;
        select.appendChild(option);
      });
    });
    
    clearStatus();
    
    // Update UI states
    updateSingleTabUI();
    updateMultiTabUI();
    
    return true;
    
  } catch (error) {
    console.error('Error loading projects:', error);
    showStatus(`Failed to load projects: ${error.message}`, 'error');
    
    const selectors = ['project-select', 'project-select-multi'];
    selectors.forEach(selectorId => {
      const select = document.getElementById(selectorId);
      if (select) {
        select.innerHTML = '<option value="">Error loading projects</option>';
      }
    });
    
    return false;
  }
}

/**
 * Check if a tab is valid for content extraction
 */
function isValidTab(tab) {
  if (!tab.url) {
    console.log('Invalid tab: No URL');
    return false;
  }
  
  console.log(`Checking tab validity for: ${tab.url}`);
  
  try {
    const url = new URL(tab.url);
    
    // Check for invalid protocols
    if (CONFIG.INVALID_PROTOCOLS.some(protocol => url.protocol.startsWith(protocol))) {
      console.log(`Invalid tab: Protocol ${url.protocol} not allowed`);
      return false;
    }
    
    // Check for invalid hosts (our own app)
    if (CONFIG.INVALID_HOSTS.includes(url.host)) {
      console.log(`Invalid tab: Host ${url.host} not allowed`);
      return false;
    }
    
    // Check for special browser pages
    if (tab.url.includes('chrome://') || 
        tab.url.includes('chrome-extension://') || 
        tab.url.includes('moz-extension://')) {
      console.log('Invalid tab: Browser special page');
      return false;
    }
    
    // Check for empty or placeholder pages
    if (url.hostname === 'newtab' || 
        url.hostname === 'chrome' ||
        tab.url === 'about:blank' ||
        tab.url === 'chrome://newtab/') {
      console.log('Invalid tab: Empty or placeholder page');
      return false;
    }
    
    console.log('Tab is valid for processing');
    return true;
  } catch (error) {
    console.log(`Invalid tab: Error parsing URL - ${error.message}`);
    return false;
  }
}

/**
 * Query all tabs and populate the tab list
 */
async function loadAllTabs() {
  if (!loginStatus.isLoggedIn) {
    return false;
  }
  
  try {
    // Query all tabs
    allTabs = await chrome.tabs.query({});
    
    // Filter valid tabs and verify they still exist
    const validTabCandidates = allTabs.filter(isValidTab);
    validTabs = [];
    
    // Double-check that tabs still exist
    for (const tab of validTabCandidates) {
      if (await tabExists(tab.id)) {
        validTabs.push(tab);
      }
    }
    
    // Update tab count display
    const tabCount = document.getElementById('tab-count');
    if (tabCount) {
      tabCount.textContent = `${validTabs.length} valid tabs of ${allTabs.length} total`;
    }
    
    // Populate tab list UI
    await populateTabList();
    
    return true;
  } catch (error) {
    console.error('Error loading tabs:', error);
    showStatus(`Failed to load tabs: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Populate the tab list in the UI
 */
async function populateTabList() {
  const tabList = document.getElementById('tab-list');
  if (!tabList) return;
  
  tabList.innerHTML = '';
  
  if (validTabs.length === 0) {
    tabList.innerHTML = '<div style="padding: 20px; text-align: center; color: #6c757d;">No valid tabs found for content extraction.</div>';
    return;
  }
  
  // Create tab items
  for (const tab of validTabs) {
    // Verify tab still exists before creating UI element
    if (!(await tabExists(tab.id))) {
      continue;
    }
    
    const tabItem = document.createElement('div');
    tabItem.className = 'tab-item';
    tabItem.dataset.tabId = tab.id;
    
    // Get favicon URL with fallback
    const faviconUrl = tab.favIconUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMEMzLjU4IDAgMCAzLjU4IDAgOHMzLjU4IDggOCA4IDgtMy41OCA4LTgtMy41OC04LTgtOHptMCAxNGMtMy4zMSAwLTYtMi42OS02LTZzMi42OS02IDYtNiA2IDIuNjkgNiA2LTIuNjkgNi02IDZ6IiBmaWxsPSIjNzU3NTc1Ii8+Cjwvc3ZnPgo=';
    
    const currentTab = await getCurrentTab();
    const isCurrentTab = currentTab && tab.id === currentTab.id;
    
    // Check if this is a PDF
    const isPDF = await isPDFTab(tab);
    
    tabItem.innerHTML = `
      <input type="checkbox" class="tab-checkbox" ${isCurrentTab ? 'checked' : ''}>
      <img src="${faviconUrl}" class="tab-favicon" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTggMEMzLjU4IDAgMCAzLjU4IDAgOHMzLjU4IDggOCA4IDgtMy41OCA4LTgtMy41OC04LTgtOHptMCAxNGMtMy4zMSAwLTYtMi42OS02LTZzMi42OS02IDYtNiA2IDIuNjkgNiA2LTIuNjkgNi02IDZ6IiBmaWxsPSIjNzU3NTc1Ii8+Cjwvc3ZnPgo=';">
      <div class="tab-info">
        <div class="tab-title">${tab.title || 'Untitled'} ${isPDF ? '(PDF)' : ''}</div>
        <div class="tab-url">${tab.url}</div>
      </div>
      <div class="tab-status status-${isPDF ? 'valid' : 'unknown'}">${isPDF ? '✓' : '?'}</div>
    `;
    
    // Add click handler for the tab item (excluding checkbox)
    tabItem.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        const checkbox = tabItem.querySelector('.tab-checkbox');
        checkbox.checked = !checkbox.checked;
        updateMultiTabUI();
      }
    });
    
    // Add change handler for checkbox
    const checkbox = tabItem.querySelector('.tab-checkbox');
    checkbox.addEventListener('change', () => {
      updateMultiTabUI();
    });
    
    tabList.appendChild(tabItem);
  }
  
  // Check content validity for non-PDF tabs
  checkTabContentValidity();
}

/**
 * Check content validity for non-PDF tabs only
 */
async function checkTabContentValidity() {
  const tabItems = document.querySelectorAll('.tab-item');
  
  for (let i = 0; i < tabItems.length; i++) {
    const tabItem = tabItems[i];
    const tabId = parseInt(tabItem.dataset.tabId);
    const statusEl = tabItem.querySelector('.tab-status');
    
    // Skip if already marked as PDF (valid)
    if (statusEl.textContent === '✓') {
      continue;
    }
    
    // Add delay between tabs to avoid overwhelming the browser
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Check if tab still exists
    if (!(await tabExists(tabId))) {
      statusEl.textContent = '✗';
      statusEl.className = 'tab-status status-invalid';
      tabItem.classList.add('invalid');
      const checkbox = tabItem.querySelector('.tab-checkbox');
      checkbox.disabled = true;
      checkbox.checked = false;
      continue;
    }
    
    try {
      // Try to extract content from this tab
      const response = await safeTabOperation(async () => {
        try {
          return await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
        } catch (connectionError) {
          // Check if tab still exists before injection
          if (!(await tabExists(tabId))) {
            throw new Error('Tab no longer exists');
          }
          
          // Content script not available, try to inject it
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          });
          
          // Give content script time to initialize
          await new Promise(resolve => setTimeout(resolve, 400));
          
          // Check if tab still exists after delay
          if (!(await tabExists(tabId))) {
            throw new Error('Tab was closed during content script initialization');
          }
          
          // Try again
          return await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
        }
      });
      
      if (response && response.success && response.data.isValidContent) {
        statusEl.textContent = '✓';
        statusEl.className = 'tab-status status-valid';
      } else {
        statusEl.textContent = '!';
        statusEl.className = 'tab-status status-invalid';
        tabItem.classList.add('invalid');
        // Disable checkbox for invalid tabs
        const checkbox = tabItem.querySelector('.tab-checkbox');
        checkbox.disabled = true;
        checkbox.checked = false;
      }
    } catch (error) {
      // Content script error or tab closed
      statusEl.textContent = '?';
      statusEl.className = 'tab-status status-unknown';
      
      // Mark as invalid if connection error or tab doesn't exist
      if (error.message.includes('Could not establish connection') || 
          error.message.includes('Tab no longer exists') ||
          error.message.includes('Tab was closed')) {
        tabItem.classList.add('invalid');
        const checkbox = tabItem.querySelector('.tab-checkbox');
        checkbox.disabled = true;
        checkbox.checked = false;
      }
    }
  }
  
  updateMultiTabUI();
}

/**
 * Get current active tab
 */
async function getCurrentTab() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      if (await tabExists(tab.id)) {
        return tab;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting current tab:', error);
    return null;
  }
}

/**
 * Extract content from current page (single tab mode)
 */
async function extractPageContent() {
  if (!loginStatus.isLoggedIn) {
    showStatus('Please log in first', 'error');
    return;
  }
  
  try {
    showStatus('Analyzing page...');
    
    // Clear any pending selection data
    await chrome.storage.local.remove('pendingSelection');
    
    const tab = await getCurrentTab();
    if (!tab) {
      throw new Error('No active tab found or tab was closed');
    }
    
    console.log('Extracting content from tab:', tab.url);
    
    // Check if tab still exists
    const exists = await tabExists(tab.id);
    if (!exists) {
      throw new Error('Tab no longer exists. Please try again.');
    }
    
    // Enhanced PDF detection - check this FIRST
    const isPDF = await isPDFTab(tab);
    
    // If not PDF, check if it's a valid tab for content extraction
    if (!isPDF && !isValidTab(tab)) {
      throw new Error('This page cannot be processed. Please try a different page with article content.');
    }
    
    if (isPDF) {
      console.log('PDF detected - preparing for server processing');
      
      // Extract the real URL from Chrome extension URL
      const realUrl = extractRealPDFUrl(tab.url);
      const filename = extractPDFFilename(realUrl);
      const domain = new URL(realUrl).hostname;
      
      currentPageData = {
        url: realUrl, // Use the real URL, not the chrome-extension URL
        domain: domain,
        title: tab.title || filename,
        authors: 'Unknown Authors',
        content: '', // Empty - will be processed by server
        abstract: '',
        keywords: [],
        publicationYear: null,
        extractedAt: new Date().toISOString(),
        contentLength: 0,
        isValidContent: true, // Trust server to validate
        isPDF: true,
        filename: filename,
        contentType: 'pdf',
        requiresBackendProcessing: true
      };
      
      displayContentPreview();
      clearStatus();
      updateSingleTabUI();
      return;
    }
    
    // For non-PDF pages, extract content normally
    console.log('Non-PDF page detected - extracting content');
    const response = await safeTabOperation(async () => {
      try {
        return await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
      } catch (connectionError) {
        // Content script not available, inject it
        console.log('Content script not available, injecting...');
        
        // Check tab exists before injection
        if (!(await tabExists(tab.id))) {
          throw new Error('Tab was closed during content script injection');
        }
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        // Give content script time to initialize
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Check tab still exists after delay
        if (!(await tabExists(tab.id))) {
          throw new Error('Tab was closed during content script initialization');
        }
        
        // Try again
        return await chrome.tabs.sendMessage(tab.id, { action: 'extractContent' });
      }
    });
    
    if (!response || !response.success) {
      throw new Error(response?.error || 'Failed to extract content from this page');
    }
    
    currentPageData = response.data;
    displayContentPreview();
    clearStatus();
    
    // Reset button state when content is re-extracted
    const addButton = document.getElementById('add-to-project');
    if (addButton && addButton.textContent === 'Added ✓') {
      addButton.disabled = false;
      updateSingleTabUI();
    }
    isProcessing = false;
    
    updateSingleTabUI();
    
  } catch (error) {
    console.error('Error extracting content:', error);
    
    // Provide specific error messages
    let errorMessage = error.message;
    if (errorMessage.includes('Could not establish connection')) {
      errorMessage = 'Cannot analyze this page. Please try refreshing the page or use a different webpage with article content.';
    } else if (errorMessage.includes('Cannot access')) {
      errorMessage = 'This page cannot be accessed. Please try a different webpage.';
    } else if (errorMessage.includes('Tab no longer exists') || errorMessage.includes('Tab was closed')) {
      errorMessage = 'The tab was closed. Please try again.';
    }
    
    showStatus(`Failed to extract content: ${errorMessage}`, 'error');
    currentPageData = null;
    isProcessing = false;
    updateSingleTabUI();
  }
}

/**
 * Display content preview in popup (single tab mode)
 */
function displayContentPreview() {
  if (!currentPageData) return;
  
  const preview = document.getElementById('content-preview');
  const title = document.getElementById('content-title');
  const meta = document.getElementById('content-meta');
  const text = document.getElementById('content-text');
  
  if (!preview || !title || !meta || !text) return;
  
  // Truncate title if too long
  let displayTitle = currentPageData.title;
  if (displayTitle.length > CONFIG.MAX_TITLE_LENGTH) {
    displayTitle = displayTitle.substring(0, CONFIG.MAX_TITLE_LENGTH) + '...';
  }
  
  title.textContent = displayTitle;
  
  // Show metadata
  if (currentPageData.isPDF || currentPageData.contentType === 'pdf') {
    meta.innerHTML = `
      <strong>Type:</strong> PDF Document | 
      <strong>Filename:</strong> ${currentPageData.filename || 'document.pdf'} | 
      <strong>Domain:</strong> ${currentPageData.domain}
    `;
  } else {
    meta.innerHTML = `
      <strong>Author:</strong> ${currentPageData.authors} | 
      <strong>Domain:</strong> ${currentPageData.domain} | 
      <strong>Year:</strong> ${currentPageData.publicationYear}
    `;
  }
  
  // Show content preview
  if (currentPageData.requiresBackendProcessing) {
    text.innerHTML = '<em>PDF content will be extracted and analyzed by the server.</em>';
  } else {
    let previewText = currentPageData.abstract || currentPageData.content || '';
    if (previewText.length > CONFIG.MAX_PREVIEW_LENGTH) {
      previewText = previewText.substring(0, CONFIG.MAX_PREVIEW_LENGTH) + '...';
    }
    text.textContent = previewText;
  }
  
  // Add validity indicator
  if (!currentPageData.isValidContent && !currentPageData.isPDF) {
    text.innerHTML += '<div class="invalid-content">⚠️ Content may be too short for meaningful analysis</div>';
  }
  
  preview.style.display = 'block';
}

/**
 * Update single tab UI state
 */
function updateSingleTabUI() {
  const addButton = document.getElementById('add-to-project');
  const projectSelect = document.getElementById('project-select');
  
  if (!addButton || !projectSelect) return;
  
  if (!loginStatus.isLoggedIn) {
    addButton.disabled = true;
    addButton.textContent = 'Please Log In First';
    return;
  }
  
  const hasValidProject = projectSelect.value && projectSelect.value !== '';
  const hasValidContent = currentPageData && (currentPageData.isValidContent || currentPageData.isPDF);
  
  // Don't change button if processing or already added
  if (isProcessing || addButton.textContent === 'Added ✓') {
    return;
  }
  
  addButton.disabled = !hasValidProject || !hasValidContent;
  
  if (!hasValidContent && currentPageData && !currentPageData.isPDF) {
    addButton.textContent = 'Content Too Short';
  } else if (!hasValidProject) {
    addButton.textContent = 'Select Project First';
  } else {
    addButton.textContent = 'Add to Project';
  }
}

/**
 * Update multi-tab UI state
 */
function updateMultiTabUI() {
  const processButton = document.getElementById('process-selected-tabs');
  const projectSelect = document.getElementById('project-select-multi');
  
  if (!processButton || !projectSelect) return;
  
  if (!loginStatus.isLoggedIn) {
    processButton.disabled = true;
    processButton.textContent = 'Please Log In First';
    return;
  }
  
  const selectedTabs = getSelectedTabs();
  const hasValidProject = projectSelect.value && projectSelect.value !== '';
  
  // Don't change button if batch processing is active
  if (batchProcessingActive) {
    return;
  }
  
  processButton.disabled = selectedTabs.length === 0 || !hasValidProject;
  
  if (selectedTabs.length === 0) {
    processButton.textContent = 'Select Tabs First';
  } else if (!hasValidProject) {
    processButton.textContent = 'Select Project First';
  } else {
    processButton.textContent = `Process ${selectedTabs.length} Selected Tab${selectedTabs.length > 1 ? 's' : ''}`;
  }
}

/**
 * Get selected tab IDs from the multi-tab interface
 */
function getSelectedTabs() {
  const checkboxes = document.querySelectorAll('.tab-checkbox:checked:not(:disabled)');
  return Array.from(checkboxes).map(cb => {
    const tabItem = cb.closest('.tab-item');
    return parseInt(tabItem.dataset.tabId);
  });
}

/**
 * Select/deselect tabs based on mode
 */
function selectTabs(mode) {
  const checkboxes = document.querySelectorAll('.tab-checkbox:not(:disabled)');
  
  checkboxes.forEach(checkbox => {
    switch (mode) {
      case 'all':
        checkbox.checked = true;
        break;
      case 'none':
        checkbox.checked = false;
        break;
      case 'valid':
        const tabItem = checkbox.closest('.tab-item');
        const isValid = !tabItem.classList.contains('invalid');
        checkbox.checked = isValid;
        break;
    }
  });
  
  updateMultiTabUI();
}

/**
 * Process selected tabs in batch - FIXED VERSION with proper progress bar completion
 */
async function processSelectedTabs() {
  if (!loginStatus.isLoggedIn) {
    showStatus('Please log in first', 'error');
    return;
  }
  
  const selectedTabIds = getSelectedTabs();
  const projectSelect = document.getElementById('project-select-multi');
  const sourceTypeSelect = document.getElementById('source-type-multi');
  
  if (selectedTabIds.length === 0 || !projectSelect.value) {
    showStatus('Please select tabs and project', 'error');
    return;
  }
  
  batchProcessingActive = true;
  
  // Show progress UI
  const progressSection = document.getElementById('batch-progress');
  const resultsSection = document.getElementById('batch-results');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  
  progressSection.style.display = 'block';
  resultsSection.style.display = 'block';
  resultsSection.innerHTML = '';
  
  const processButton = document.getElementById('process-selected-tabs');
  processButton.disabled = true;
  processButton.textContent = 'Processing...';
  
  let completed = 0;
  let successful = 0;
  let failed = 0;
  const successfulTabs = []; // Track successfully processed tabs for potential closure
  
  const total = selectedTabIds.length;
  const projectId = projectSelect.value;
  const sourceType = sourceTypeSelect.value;
  
  // Function to update progress bar
  const updateProgress = () => {
    const percentage = (completed / total) * 100;
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `Completed ${completed} of ${total} tabs`;
  };
  
  // Process tabs with limited concurrency
  const semaphore = new Semaphore(CONFIG.MAX_CONCURRENT_TABS);
  
  const processingPromises = selectedTabIds.map(async (tabId, index) => {
    return semaphore.acquire().then(async (release) => {
      try {
        // Add delay between requests
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, CONFIG.TAB_PROCESSING_DELAY));
        }
        
        const result = await processTabContent(tabId, projectId, sourceType);
        
        if (result.success) {
          successful++;
          successfulTabs.push({ tabId, title: result.title });
          addBatchResult(`✅ ${result.title}`, 'success');
        } else {
          failed++;
          addBatchResult(`❌ ${result.error}`, 'error');
        }
        
      } catch (error) {
        failed++;
        addBatchResult(`❌ Tab ${tabId}: ${error.message}`, 'error');
      } finally {
        completed++;
        
        // Update progress immediately
        updateProgress();
        
        release();
      }
    });
  });
  
  // Wait for all processing to complete
  await Promise.all(processingPromises);
  
  // IMPORTANT: Ensure progress bar reaches 100% and UI is updated before showing dialogs
  updateProgress(); // Final update to ensure 100%
  
  // Add a small delay to ensure UI rendering is complete
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Ensure progress bar shows 100% visually
  progressFill.style.width = '100%';
  progressText.textContent = `Completed ${total} of ${total} tabs`;
  
  // Add another small delay to let the 100% progress bar render
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Show final results
  const statusMessage = `Batch processing complete: ${successful} successful, ${failed} failed`;
  showStatus(statusMessage, successful > 0 ? 'success' : 'error');
  
  // Reset UI
  batchProcessingActive = false;
  processButton.disabled = false;
  updateMultiTabUI();
  
  // Update project count if successful
  if (successful > 0) {
    const option = projectSelect.querySelector(`option[value="${projectId}"]`);
    if (option) {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        project.papers_count += successful;
        option.textContent = `${project.name} (${project.papers_count} papers)`;
      }
    }
  }
  
  // Show confirmation dialog for closing successfully processed tabs AFTER progress is complete
  if (successfulTabs.length > 0) {
    // Additional small delay to ensure all UI updates are visually complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const shouldClose = await showTabCloseConfirmation(successfulTabs);
    if (shouldClose) {
      const tabIdsToClose = successfulTabs.map(t => t.tabId);
      await closeProcessedTabs(tabIdsToClose);
      
      // Refresh tab list after closing tabs
      setTimeout(() => {
        loadAllTabs();
      }, 1000);
    }
  }
}

/**
 * Process content from a single tab with enhanced PDF handling
 */
async function processTabContent(tabId, projectId, sourceType) {
  try {
    // Check if tab still exists
    const exists = await tabExists(tabId);
    if (!exists) {
      throw new Error('Tab no longer exists');
    }
    
    // Get tab info
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      throw new Error('Could not get tab information');
    }
    
    let pageData;
    
    // Enhanced PDF detection
    const isPDF = await isPDFTab(tab);
    
    if (isPDF) {
      console.log(`Processing PDF tab: ${tab.url}`);
      
      // Extract the real URL from Chrome extension URL
      const realUrl = extractRealPDFUrl(tab.url);
      const filename = extractPDFFilename(realUrl);
      const domain = new URL(realUrl).hostname;
      
      pageData = {
        url: realUrl, // Use the real URL
        domain: domain,
        title: tab.title || filename,
        authors: 'Unknown Authors',
        content: '', // Empty - will be processed by server
        abstract: '',
        keywords: [],
        publicationYear: null,
        extractedAt: new Date().toISOString(),
        contentLength: 0,
        isValidContent: true, // Trust server to validate
        isPDF: true,
        filename: filename,
        contentType: 'pdf',
        requiresBackendProcessing: true
      };
    } else {
      // For non-PDF pages, extract content normally
      const response = await safeTabOperation(async () => {
        try {
          return await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
        } catch (connectionError) {
          // Check if tab still exists before injection
          if (!(await tabExists(tabId))) {
            throw new Error('Tab was closed during processing');
          }
          
          // Content script not available, inject it
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          });
          
          // Give content script time to initialize
          await new Promise(resolve => setTimeout(resolve, 600));
          
          // Check tab still exists after delay
          if (!(await tabExists(tabId))) {
            throw new Error('Tab was closed during content script initialization');
          }
          
          // Try again
          return await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
        }
      });
      
      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to extract content');
      }
      
      pageData = response.data;
      
      if (!pageData.isValidContent && !pageData.isPDF) {
        throw new Error('Content too short or invalid');
      }
    }
    
    // Prepare data for the web app API
    const payload = {
      url: pageData.url,
      title: pageData.title,
      authors: pageData.authors,
      content: pageData.content || '',
      abstract: pageData.abstract,
      keywords: pageData.keywords,
      publication_year: pageData.publicationYear,
      source_type: sourceType,
      domain: pageData.domain,
      extracted_at: pageData.extractedAt,
      contentType: pageData.contentType || 'web',
      filename: pageData.filename
    };
    
    // For PDFs that require backend processing
    if (pageData.requiresBackendProcessing) {
      payload.requiresBackendProcessing = true;
    }
    
    // Make API request with session authentication
    const apiResponse = await apiRequest(`${CONFIG.APP_BASE_URL}/api/project/${projectId}/add_web_content`, {
      method: 'POST',
      headers: {
        'X-Request-ID': `batch_${Date.now()}_${tabId}`
      },
      body: JSON.stringify(payload)
    }, 0); // No retries for batch processing
    
    if (apiResponse.success) {
      return {
        success: true,
        title: pageData.title,
        relevance_score: apiResponse.relevance_score
      };
    } else {
      throw new Error(apiResponse.error || 'Unknown error occurred');
    }
    
  } catch (error) {
    // Provide specific error messages
    let errorMessage = error.message;
    if (errorMessage.includes('Could not establish connection')) {
      errorMessage = 'Cannot access page content';
    } else if (errorMessage.includes('Tab no longer exists') || errorMessage.includes('Tab was closed')) {
      errorMessage = 'Tab was closed during processing';
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Add result to batch results display
 */
function addBatchResult(message, type) {
  const resultsSection = document.getElementById('batch-results');
  if (!resultsSection) return;
  
  const resultItem = document.createElement('div');
  resultItem.className = `result-item result-${type}`;
  resultItem.textContent = message;
  
  resultsSection.appendChild(resultItem);
  resultsSection.scrollTop = resultsSection.scrollHeight;
}

/**
 * Simple semaphore for controlling concurrency
 */
class Semaphore {
  constructor(permits) {
    this.permits = permits;
    this.waiting = [];
  }
  
  acquire() {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waiting.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }
  
  release() {
    this.permits++;
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      next();
    }
  }
}

/**
 * Add current page to selected project (single tab mode)
 */
async function addToProject() {
  if (!loginStatus.isLoggedIn) {
    showStatus('Please log in first', 'error');
    return;
  }
  
  // Generate unique request ID to prevent duplicates
  const requestId = Date.now() + '_' + Math.random();
  
  // Prevent multiple simultaneous requests
  if (isProcessing || currentRequestId === requestId) {
    console.log('Request already in progress, skipping duplicate...');
    return;
  }
  
  if (!currentPageData || (!currentPageData.isValidContent && !currentPageData.isPDF)) {
    showStatus('Cannot add: content is too short or invalid', 'error');
    return;
  }
  
  const projectSelect = document.getElementById('project-select');
  const sourceTypeSelect = document.getElementById('source-type');
  const addButton = document.getElementById('add-to-project');
  
  const projectId = projectSelect.value;
  const sourceType = sourceTypeSelect.value;
  
  if (!projectId) {
    showStatus('Please select a project first', 'error');
    return;
  }
  
  // Set processing state
  isProcessing = true;
  currentRequestId = requestId;
  addButton.disabled = true;
  const originalButtonText = addButton.textContent;
  addButton.textContent = 'Adding...';
  
  try {
    if (currentPageData.isPDF || currentPageData.contentType === 'pdf') {
      showStatus('Processing PDF document...', 'loading');
    } else {
      showStatus('Adding to project...', 'loading');
    }
    
    const currentTab = await getCurrentTab();
    if (!currentTab) {
      throw new Error('Tab no longer exists');
    }
    
    // Prepare data for the web app API
    const payload = {
      url: currentPageData.url,
      title: currentPageData.title,
      authors: currentPageData.authors,
      content: currentPageData.content || '',
      abstract: currentPageData.abstract,
      keywords: currentPageData.keywords,
      publication_year: currentPageData.publicationYear,
      source_type: sourceType,
      domain: currentPageData.domain,
      extracted_at: currentPageData.extractedAt,
      contentType: currentPageData.contentType || 'web',
      filename: currentPageData.filename
    };
    
    // For PDFs that require backend processing
    if (currentPageData.requiresBackendProcessing) {
      payload.requiresBackendProcessing = true;
    }
    
    // Make API request with session authentication
    const response = await apiRequest(`${CONFIG.APP_BASE_URL}/api/project/${projectId}/add_web_content`, {
      method: 'POST',
      headers: {
        'X-Request-ID': requestId
      },
      body: JSON.stringify(payload)
    });
    
    if (response.success) {
      showStatus('✅ Successfully added to project!', 'success');
      
      // Update project count in dropdown
      const option = projectSelect.querySelector(`option[value="${projectId}"]`);
      if (option) {
        const project = projects.find(p => p.id === projectId);
        if (project) {
          project.papers_count += 1;
          option.textContent = `${project.name} (${project.papers_count} papers)`;
        }
      }
      
      // Keep button disabled to prevent double-adding
      addButton.textContent = 'Added ✓';
      
      // Note: No auto-close for single tab mode - user manually controls tabs
    } else {
      throw new Error(response.error || 'Unknown error occurred');
    }
    
  } catch (error) {
    console.error('Error adding to project:', error);
    
    // Handle specific error types
    let errorMessage = error.message;
    
    if (error.status === 409) {
      if (errorMessage.includes('already exists') || errorMessage.includes('duplicate')) {
        errorMessage = 'This content has already been added to the project';
      } else if (errorMessage.includes('DOI')) {
        errorMessage = 'A paper with the same DOI already exists in this project';
      } else if (errorMessage.includes('URL') || errorMessage.includes('url')) {
        errorMessage = 'Content from this URL has already been added to the project';
      } else {
        errorMessage = 'This content appears to already exist in the project';
      }
    } else if (error.status === 400) {
      errorMessage = error.message || 'Invalid request. Please check your input.';
    } else if (error.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    } else if (error.name === 'AbortError') {
      errorMessage = 'Request timed out. Please check your connection and try again.';
    } else if (errorMessage.includes('Tab no longer exists') || errorMessage.includes('Tab was closed')) {
      errorMessage = 'The tab was closed. Please try again.';
    }
    
    showStatus(`Failed to add: ${errorMessage}`, 'error');
    
    // Re-enable button on error
    addButton.disabled = false;  
    addButton.textContent = originalButtonText;
    
  } finally {
    // Always reset processing state
    isProcessing = false;
    currentRequestId = null;
  }
}

/**
 * Switch between single and multi-tab modes
 */
function switchMode(newMode) {
  if (currentMode === newMode) return;
  
  currentMode = newMode;
  
  // Update mode buttons
  const singleBtn = document.getElementById('single-mode-btn');
  const multiBtn = document.getElementById('multi-mode-btn');
  const singleSection = document.getElementById('single-tab-section');
  const multiSection = document.getElementById('multi-tab-section');
  
  if (newMode === 'single') {
    singleBtn.classList.add('active');
    multiBtn.classList.remove('active');
    singleSection.classList.add('active');
    multiSection.classList.remove('active');
    singleSection.style.display = 'block';
    multiSection.style.display = 'none';
  } else {
    singleBtn.classList.remove('active');
    multiBtn.classList.add('active');
    singleSection.classList.remove('active');
    multiSection.classList.add('active');
    singleSection.style.display = 'none';
    multiSection.style.display = 'block';
    
    // Load tabs when switching to multi-tab mode
    if (loginStatus.isLoggedIn) {
      loadAllTabs();
    }
  }
}

/**
 * Open extension settings page
 */
function openSettings() {
  chrome.runtime.openOptionsPage();
}

/**
 * Check for pending selection data from context menu
 */
async function checkPendingSelection() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['pendingSelection'], async (result) => {
      if (result.pendingSelection) {
        // Use pending selection data
        currentPageData = result.pendingSelection;
        displayContentPreview();
        updateSingleTabUI();
        
        // Clear pending selection after using it
        await chrome.storage.local.remove('pendingSelection');
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Initialize popup interface
 */
async function initialize() {
  // Prevent multiple initializations
  if (window.popupInitialized) {
    console.log('Uzei - Literature Review popup already initialized, skipping...');
    return;
  }
  window.popupInitialized = true;
  
  // Load extension settings first
  await loadExtensionSettings();
  
  // Set initial login status indicator
  const loginStatusEl = document.getElementById('login-status');
  if (loginStatusEl) {
    loginStatusEl.textContent = 'Checking...';
    loginStatusEl.className = 'login-status logged-out';
  }
  
  // Set up event listeners
  setupEventListeners();
  
  // Check login status first
  const isLoggedIn = await checkLoginStatus();
  
  if (isLoggedIn) {
    // Load data
    try {
      // Check for pending selection (for single tab mode)
      const hasPendingSelection = await checkPendingSelection();
      
      // Only extract page content if no pending selection and in single mode
      if (!hasPendingSelection && currentMode === 'single') {
        await extractPageContent();
      }
    } catch (error) {
      console.error('Error during initialization:', error);
      showStatus('Failed to initialize. Please refresh.', 'error');
    }
  }
}

/**
 * Set up all event listeners for the popup
 */
function setupEventListeners() {
  // Mode switching
  document.getElementById('single-mode-btn')?.addEventListener('click', () => switchMode('single'));
  document.getElementById('multi-mode-btn')?.addEventListener('click', () => switchMode('multi'));
  
  // Single tab mode events
  document.getElementById('add-to-project')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing && e.target.textContent !== 'Added ✓') {
      addToProject();
    }
  });
  
  document.getElementById('refresh-content')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) {
      extractPageContent();
    }
  });
  
  document.getElementById('project-select')?.addEventListener('change', updateSingleTabUI);
  
  // Multi-tab mode events
  document.getElementById('select-all-tabs')?.addEventListener('click', () => selectTabs('all'));
  document.getElementById('select-none-tabs')?.addEventListener('click', () => selectTabs('none'));
  document.getElementById('select-valid-tabs')?.addEventListener('click', () => selectTabs('valid'));
  
  document.getElementById('process-selected-tabs')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!batchProcessingActive) {
      processSelectedTabs();
    }
  });
  
  document.getElementById('project-select-multi')?.addEventListener('change', updateMultiTabUI);
  
  // Settings
  document.getElementById('open-settings')?.addEventListener('click', (e) => {
    e.preventDefault();
    openSettings();
  });
}

// Initialize when popup opens
document.addEventListener('DOMContentLoaded', function() {
  if (!window.popupInitialized) {
    initialize();
  }
}, { once: true });

// Handle extension messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'contentExtracted') {
    currentPageData = request.data;
    displayContentPreview();
    updateSingleTabUI();
  }
  
  if (request.action === 'loginStatusChanged') {
    loginStatus = request.status;
    updateLoginStatusIndicator();
    if (loginStatus.isLoggedIn) {
      enableUI();
      loadProjects();
    } else {
      disableUI();
      showLoginPrompt();
    }
  }
  
  if (request.action === 'settingsUpdated') {
    // Reload extension settings when updated
    loadExtensionSettings().then(() => {
      updateMultiTabUI(); // Update UI to reflect new settings
    });
  }
});