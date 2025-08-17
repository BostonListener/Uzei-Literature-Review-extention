# Uzei - Literature Review Extension

A Chrome browser extension that automatically extracts and analyzes content from web pages and PDF documents, seamlessly integrating with your Uzei Literature Review web application for efficient research paper collection and management.

## Features

- 🔍 **Smart Content Extraction**: Automatically detects and extracts article content, metadata, authors, and publication dates
- 📄 **PDF Support**: Processes PDF documents opened in the browser with server-side text extraction
- 📊 **Multi-tab Processing**: Batch process multiple tabs simultaneously for efficient research workflows
- ✅ **Content Validation**: Smart badges indicate which tabs contain valid extractable content
- 🔄 **Session Management**: Automatically syncs with your web app login status
- 🎯 **Academic Publisher Support**: Enhanced extraction for major academic publishers (IEEE, ACM, Springer, etc.)
- 📱 **Context Menus**: Right-click integration for quick content addition

## Prerequisites

- Google Chrome browser
- Access to the Uzei Literature Review web application at `https://uzei.bostonlistener-career.org`
- Valid user account on the web application

## Installation (Developer Mode)

### Step 1: Download the Extension Files

Ensure you have all the following files in a single folder:

```
uzei-literature-review-extension/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── options.html
├── options.js
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Step 2: Enable Developer Mode in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Toggle **"Developer mode"** in the top-right corner
4. You should now see additional buttons: "Load unpacked", "Pack extension", "Update"

### Step 3: Load the Extension

1. Click **"Load unpacked"** button
2. Navigate to and select the folder containing the extension files
3. Click **"Select Folder"**
4. The extension should now appear in your extensions list with a green "On" toggle

### Step 4: Pin the Extension (Optional)

1. Click the extensions icon (puzzle piece) in Chrome's toolbar
2. Find "Uzei - Literature Review" in the dropdown
3. Click the pin icon to pin it to your toolbar for easy access

## Usage Instructions

### Initial Setup

1. **Log into the Web App**: Visit `https://uzei.bostonlistener-career.org` and log in with your credentials
2. **Create a Project**: Create or select a literature review project in the web app
3. **Verify Connection**: The extension icon should show a green checkmark when logged in

### Adding Single Pages

1. **Navigate** to any webpage or PDF document you want to add
2. **Click** the extension icon in your toolbar
3. **Select** your target project from the dropdown
4. **Choose** the appropriate source type (Research Paper, Web Article, etc.)
5. **Click** "Add to Project" to extract and save the content

### Batch Processing Multiple Tabs

1. **Open** multiple tabs with content you want to process
2. **Click** the extension icon
3. **Switch** to "Multiple Tabs" mode
4. **Select** the tabs you want to process (use "Valid Only" to auto-select)
5. **Choose** your project and default source type
6. **Click** "Process Selected Tabs"

### Using Context Menus

- **Right-click** on any webpage and select "Add page to Uzei Literature Review"
- **Select text** on a page, right-click, and choose "Add selected text to Uzei Literature Review"
- **Use batch options** from the context menu to process multiple tabs

## Status Indicators

The extension provides visual feedback through badge indicators:

- ✅ **Green Checkmark**: Valid content detected and logged in
- ❓ **Yellow Question Mark**: Valid content but not logged in
- ❗ **Red Exclamation**: Invalid content or processing error
- ⏳ **"..."**: Content validation in progress

## Supported Content Types

### Webpages
- Research articles and academic papers
- Blog posts and news articles
- Documentation and technical guides
- Any article-style content with sufficient text

### PDF Documents
- Academic papers and research documents
- Technical reports and whitepapers
- Any PDF opened in the browser
- Server-side text extraction and analysis

### Academic Publishers
Enhanced support for:
- IEEE Xplore
- ACM Digital Library
- ScienceDirect
- Springer
- arXiv
- PubMed
- And many more

## Troubleshooting

### Extension Not Working
- Ensure you're logged into the web app
- Check that Developer mode is enabled
- Try refreshing the page and clicking the extension icon again

### Content Not Detected
- Verify the page has sufficient text content (minimum 200 characters)
- Some dynamic content may require page refresh
- PDFs should be opened directly in Chrome's built-in viewer

### Login Issues
- Visit the web app directly and log in
- Click "Test Connection" in the extension settings
- Clear browser cookies if session issues persist

### Badge Not Updating
- The extension automatically checks content validity
- For faster updates, refresh the page or click the extension icon

## Extension Settings

Access settings by:
1. Right-clicking the extension icon and selecting "Options"
2. Or visiting `chrome://extensions/` and clicking "Details" → "Extension options"

Available settings:
- Auto-extract content on page load
- Show notifications for successful additions
- Enable context menus
- Content length limits
- Badge display preferences

## Development Notes

This extension is designed for internal testing and development. It connects to the production Uzei Literature Review web application and requires valid user authentication.

### File Structure
- `manifest.json`: Extension configuration and permissions
- `background.js`: Service worker for tab monitoring and session management
- `content.js`: Content extraction and PDF detection logic
- `popup.html/js`: Main extension interface
- `options.html/js`: Settings and configuration page

### Key Features for Developers
- Enhanced PDF URL detection and processing
- Academic publisher-specific content extraction
- Robust error handling for tab operations
- Session-based authentication with the web app
- Batch processing with concurrency controls

## Support

For issues or questions:
1. Check the browser console for error messages
2. Verify network connectivity to the web application
3. Ensure all extension files are present and properly loaded
4. Test with a simple webpage first before trying complex content

---

**Version**: 2.1  
**Compatibility**: Chrome (Manifest V3)  
**Web App**: https://uzei.bostonlistener-career.org