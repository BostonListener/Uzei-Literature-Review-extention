/**
 * Uzei - Literature Review Extension
 * Content Script
 * 
 * Extracts webpage content including titles, authors, dates, and main text.
 * Handles both regular webpages and PDF documents with enhanced detection.
 */

// Content extraction configuration
const CONFIG = {
  // Performance settings
  EXTRACTION_CACHE_DURATION: 30000,
  MAX_CONCURRENT_EXTRACTIONS: 1,
  EXTRACTION_TIMEOUT: 15000,
  
  // Content selectors prioritized by quality
  CONTENT_SELECTORS: [
    'article',
    '[role="main"]',
    'main',
    '.content',
    '.article-content',
    '.post-content',
    '.entry-content',
    '#content',
    '.main-content',
    '.post-body',
    '.article-body'
  ],
  
  // Title selectors prioritized by accuracy
  TITLE_SELECTORS: [
    'h1',
    '.title',
    '.article-title',
    '.post-title',
    '.entry-title',
    '.headline'
  ],
  
  // Author selectors with academic publisher support
  AUTHOR_SELECTORS: [
    // Academic publisher specific selectors
    '.document-authors-banner .authors-info .blue-tooltip',
    '.document-authors-banner .authors-info a',
    '.stats-document-authors-banner .authors-info .blue-tooltip',
    '.authors-container .blue-tooltip',
    '.authors-info .blue-tooltip',
    '.authors-info a[href*="/author/"]',
    
    // ScienceDirect selectors
    '.author-group .author',
    '.author-group .given-name, .author-group .surname',
    '.authors-list .author',
    '.author .given-name, .author .surname',
    '#author-group .author',
    '.elsevierStyled_authorName__3V8bC',
    '.author-list .author-name',
    '.AuthorGroups .author',
    '.author-info .author-name',
    
    // ACM Digital Library selectors
    '.hlFld-ContribAuthor',
    '.loa__author-name',
    '.contrib-author',
    '.author-info .author',
    
    // arXiv selectors
    '.authors a',
    '.authors .author',
    '.submission-history .authors',
    
    // PubMed/NCBI selectors
    '.authors .author',
    '.auths a',
    '.authors-list .author',
    
    // Springer selectors
    '.c-article-author-list .c-article-author-list__item',
    '.authors__name',
    '.test-author-name',
    
    // Nature selectors
    '.c-article-author-list__item',
    '.author-list .author',
    
    // Structured data selectors
    '[itemprop="author"]',
    '[itemprop="author"] [itemprop="name"]',
    '[itemtype*="Person"] [itemprop="name"]',
    '[rel="author"]',
    
    // Common generic selectors
    '.author',
    '.author-name',
    '.byline',
    '.byline-author',
    '.article-author',
    '.post-author',
    '.entry-author'
  ],
  
  // Date selectors
  DATE_SELECTORS: [
    'time[datetime]',
    'time[pubdate]',
    'time',
    '.date',
    '.published',
    '.publish-date',
    '.publication-date',
    '.article-date',
    '.post-date',
    '.entry-date',
    '.timestamp',
    '.datetime',
    '.date-published',
    '.publish-time',
    '.meta-date'
  ],
  
  // Content length limits
  MIN_CONTENT_LENGTH: 200,
  MAX_CONTENT_LENGTH: 100000,
  
  // PDF detection selectors
  PDF_EMBED_SELECTORS: [
    'embed[type="application/pdf"]',
    'embed#pdf-embed',
    'iframe[src*=".pdf"]',
    'object[type="application/pdf"]',
    'embed[src*=".pdf"]',
    'iframe[title*="pdf"]',
    'iframe[title*="PDF"]',
    'object[data*=".pdf"]',
    '.pdf-viewer',
    '#pdf-viewer',
    '.document-viewer',
    '#pdfViewer'
  ],
  
  // PDF URL patterns for detection
  PDF_URL_PATTERNS: [
    '.pdf',
    '/pdf/',
    'pdf.',
    'pdf_',
    'document.pdf',
    'paper.pdf',
    'article.pdf',
    '/viewer?',
    '/document/',
    '/paper/',
    '/download/',
    'arxiv.org/pdf/',
    'researchgate.net',
    'academia.edu',
    'springer.com/pdf/',
    'ieee.org/pdf/',
    'acm.org/pdf/'
  ],
  
  // Academic publisher domains
  ACADEMIC_PUBLISHERS: [
    'sciencedirect.com',
    'ieeexplore.ieee.org',
    'dl.acm.org',
    'arxiv.org',
    'pubmed.ncbi.nlm.nih.gov',
    'link.springer.com',
    'nature.com',
    'tandfonline.com',
    'onlinelibrary.wiley.com',
    'researchgate.net',
    'scholar.google.com',
    'jstor.org',
    'cambridge.org',
    'oxford.org'
  ]
};

// Prevent multiple script injections
if (window.uzeiLiteratureReviewExtensionLoaded) {
  console.log('Uzei - Literature Review Extension content script already loaded');
} else {
  window.uzeiLiteratureReviewExtensionLoaded = true;
  console.log('Uzei - Literature Review Extension content script initializing...');

/**
 * Check if current site is an academic publisher
 */
function isAcademicPublisher() {
  const hostname = window.location.hostname.toLowerCase();
  return CONFIG.ACADEMIC_PUBLISHERS.some(publisher => 
    hostname.includes(publisher.toLowerCase())
  );
}

/**
 * Enhanced PDF page detection
 */
function isPDFPage() {
  const url = window.location.href.toLowerCase();
  
  // Check URL patterns
  for (const pattern of CONFIG.PDF_URL_PATTERNS) {
    if (url.includes(pattern.toLowerCase())) {
      return true;
    }
  }
  
  // Check content type meta tags
  const contentType = document.querySelector('meta[http-equiv="content-type"]');
  if (contentType && contentType.content.toLowerCase().includes('application/pdf')) {
    return true;
  }
  
  // Check document title for PDF indicators
  const title = document.title.toLowerCase();
  if (title.includes('.pdf') || 
      title.includes('pdf document') ||
      title.includes('pdf viewer') ||
      title.includes('document viewer')) {
    return true;
  }
  
  // Check for PDF embed elements
  for (const selector of CONFIG.PDF_EMBED_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`PDF detected via selector: ${selector}`);
      return true;
    }
  }
  
  // Check for Chrome's PDF viewer
  const embedElements = document.querySelectorAll('embed');
  for (const embed of embedElements) {
    if (embed.type === 'application/pdf' || 
        (embed.src && embed.src.toLowerCase().includes('.pdf'))) {
      console.log('PDF detected via embed element');
      return true;
    }
  }
  
  // Check for iframe PDF viewers
  const iframeElements = document.querySelectorAll('iframe');
  for (const iframe of iframeElements) {
    if (iframe.src && iframe.src.toLowerCase().includes('.pdf')) {
      console.log('PDF detected via iframe element');
      return true;
    }
  }
  
  // Check body attributes for PDF indicators
  const body = document.body;
  if (body) {
    const bodyClass = body.className.toLowerCase();
    const bodyId = body.id.toLowerCase();
    
    if (bodyClass.includes('pdf') || 
        bodyClass.includes('document') ||
        bodyId.includes('pdf') ||
        bodyId.includes('document')) {
      console.log('PDF detected via body attributes');
      return true;
    }
  }
  
  // Check for minimal DOM structure (typical of PDF viewers)
  const bodyChildren = document.body ? document.body.children.length : 0;
  if (bodyChildren <= 5 && embedElements.length > 0) {
    console.log('PDF detected via minimal DOM structure');
    return true;
  }
  
  // Check for PDF viewer applications
  const viewerIndicators = [
    '#outerContainer', // PDF.js viewer
    '.pdfViewer',
    '.pdf-viewer',
    '#viewerContainer',
    '.documentViewer'
  ];
  
  for (const indicator of viewerIndicators) {
    if (document.querySelector(indicator)) {
      console.log(`PDF detected via viewer indicator: ${indicator}`);
      return true;
    }
  }
  
  return false;
}

/**
 * Extract PDF metadata from the page (no text extraction)
 */
function extractPDFMetadata() {
  const metadata = {
    title: '',
    authors: 'Unknown Authors',
    publicationYear: null
  };
  
  // Extract title from document
  if (document.title) {
    let title = document.title;
    // Clean up common PDF viewer title patterns
    title = title.replace(/\.pdf$/i, '');
    title = title.replace(/^PDF\.js viewer\s*-\s*/i, '');
    title = title.replace(/\s*[-–]\s*[^-–]*$/, ''); // Remove trailing site name
    
    if (title && title.length > 3) {
      metadata.title = title;
    }
  }
  
  // Fallback to filename from URL
  if (!metadata.title) {
    const url = window.location.href;
    const filename = url.split('/').pop().split('?')[0] || 'document.pdf';
    metadata.title = filename.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ');
  }
  
  return metadata;
}

/**
 * Extract clean text from element without modifying DOM
 */
function extractCleanTextNonDestructive(element) {
  if (!element) return '';
  
  // Create a TreeWalker to traverse text nodes only
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        
        const tagName = parent.tagName.toLowerCase();
        const unwantedTags = ['script', 'style', 'noscript'];
        
        if (unwantedTags.includes(tagName)) {
          return NodeFilter.FILTER_REJECT;
        }
        
        // Skip hidden elements
        const style = window.getComputedStyle(parent);
        if (style.display === 'none' || style.visibility === 'hidden') {
          return NodeFilter.FILTER_REJECT;
        }
        
        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );
  
  let text = '';
  let node;
  
  while (node = walker.nextNode()) {
    const nodeText = node.textContent.trim();
    if (nodeText) {
      text += nodeText + ' ';
    }
  }
  
  // Clean up whitespace
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extract clean text from cloned element (for content extraction)
 */
function extractCleanTextDestructive(elementHtml) {
  if (!elementHtml) return '';
  
  // Create a new document context for destructive operations
  const parser = new DOMParser();
  const doc = parser.parseFromString(elementHtml, 'text/html');
  
  // Remove unwanted elements in the cloned document
  const scripts = doc.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .navigation, .menu, .ads, .advertisement, .social, .social-share, .comments, .related');
  scripts.forEach(el => el.remove());
  
  // Get text content and clean it up
  let text = doc.body.innerText || doc.body.textContent || '';
  
  // Clean up whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

/**
 * Try multiple selectors to find content without modifying DOM
 */
function findBySelectorsNonDestructive(selectors, processor = extractCleanTextNonDestructive) {
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const result = processor(el);
        if (result && result.trim() && result.length >= CONFIG.MIN_CONTENT_LENGTH) {
          return result.substring(0, CONFIG.MAX_CONTENT_LENGTH);
        }
      }
    } catch (e) {
      console.warn(`Error with selector ${selector}:`, e);
    }
  }
  return '';
}

/**
 * Simple text extraction for metadata
 */
function findMetadataBySelectorsNonDestructive(selectors) {
  for (const selector of selectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const text = (el.textContent || el.innerText || '').trim();
        if (text) {
          return text;
        }
      }
    } catch (e) {
      console.warn(`Error with metadata selector ${selector}:`, e);
    }
  }
  return '';
}

/**
 * Clean up author name text with academic publisher support
 */
function cleanAuthorName(name) {
  if (!name || typeof name !== 'string') return null;
  
  // Remove common navigation/index suffixes
  let cleaned = name
    .replace(/\s*\d+\s*na\d*/gi, '') // Remove patterns like "1 na1"
    .replace(/\s*na\d+/gi, '') // Remove patterns like "na1"
    .replace(/\s*\(\d+\)/g, '') // Remove patterns like "(1)"
    .replace(/\s*[\[\]]\d+[\[\]]/g, '') // Remove patterns like "[1]"
    .replace(/\s*\*+$/g, '') // Remove trailing asterisks
    .replace(/^\*+\s*/g, '') // Remove leading asterisks
    .replace(/\s+&\s*$/g, '') // Remove trailing ampersands
    .replace(/^\s*&\s+/g, '') // Remove leading ampersands
    .trim();
  
  // Remove duplicate names within the string
  const nameParts = cleaned.split(/[,;]\s*/);
  if (nameParts.length > 2) {
    const uniqueParts = [];
    const seen = new Set();
    
    for (const part of nameParts) {
      const normalizedPart = part.toLowerCase().trim();
      if (!seen.has(normalizedPart) && normalizedPart.length > 1) {
        let isDuplicate = false;
        for (const seenPart of seen) {
          if (seenPart.includes(normalizedPart) || normalizedPart.includes(seenPart)) {
            isDuplicate = true;
            break;
          }
        }
        if (!isDuplicate) {
          uniqueParts.push(part.trim());
          seen.add(normalizedPart);
        }
      }
    }
    
    if (uniqueParts.length > 0 && uniqueParts.length < nameParts.length) {
      cleaned = uniqueParts.join(' ');
    }
  }
  
  // Remove common prefixes and suffixes
  cleaned = cleaned
    .replace(/^(by|author|written by|posted by|created by)[:\s]*/gi, '')
    .replace(/\s*(writes|wrote|reports|says)$/gi, '')
    .replace(/^\s*[-–—]\s*/, '') // Remove leading dashes
    .replace(/\s*[-–—]\s*$/, '') // Remove trailing dashes
    .replace(/\s*[|,]\s*$/, '') // Remove trailing pipes or commas
    .replace(/^\s*[|,]\s*/, '') // Remove leading pipes or commas
    .trim();
  
  // Remove URLs, emails, dates, ORCID patterns, degree abbreviations
  cleaned = cleaned
    .replace(/https?:\/\/[^\s]+/g, '').trim()
    .replace(/[^\s]+@[^\s]+/g, '').trim()
    .replace(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g, '').trim()
    .replace(/orcid[:\s]*\d{4}-\d{4}-\d{4}-\d{4}/gi, '').trim()
    .replace(/\b(phd|md|dr|prof|professor)\b\.?/gi, '').trim();
  
  // Remove extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

/**
 * Validate author names for academic sources
 */
function isValidAuthorName(name) {
  if (!name || typeof name !== 'string') return false;
  
  const cleaned = name.trim();
  
  // Basic length and character checks
  if (cleaned.length < 2 || cleaned.length > 100) return false;
  if (!/[a-zA-Z]/.test(cleaned)) return false;
  if (/^\d+/.test(cleaned) || /\d{4,}/.test(cleaned)) return false;
  if (/\bna\d+/i.test(cleaned)) return false;
  if (/,\s*,/.test(cleaned)) return false;
  if (/^[A-Z]\d+$/.test(cleaned)) return false;
  
  // Reject common non-author terms
  const nonAuthorTerms = [
    'admin', 'administrator', 'staff', 'editor', 'editorial', 'team',
    'guest', 'user', 'member', 'subscriber', 'visitor', 'anonymous',
    'unknown', 'null', 'undefined', 'none', 'n/a', 'tbd', 'coming soon',
    'update', 'updated', 'edit', 'edited', 'post', 'posted', 'publish',
    'published', 'share', 'shared', 'comment', 'comments', 'reply',
    'home', 'about', 'contact', 'privacy', 'terms', 'copyright',
    'corresponding', 'affiliation', 'department', 'university', 'institute',
    'open access', 'full text', 'download', 'pdf', 'doi', 'pmid',
    'view all', 'show more', 'show less', 'see all', 'hide'
  ];
  
  const lowerName = cleaned.toLowerCase();
  if (nonAuthorTerms.some(term => lowerName === term || lowerName.startsWith(term + ' '))) {
    return false;
  }
  
  // Reject single letters or random ID patterns
  if (/^[a-z]$/i.test(cleaned)) return false;
  if (/^[a-z0-9]{2,4}$/i.test(cleaned)) return false;
  
  // Must look like a name with Unicode support for international names
  if (!/^[\w\s\-\.'\u00C0-\u017F\u0100-\u024F\u1E00-\u1EFF\u0400-\u04FF\u4E00-\u9FFF]+$/.test(cleaned)) {
    return false;
  }
  
  // Should have at least 2 letter characters
  const letterCount = (cleaned.match(/[a-zA-Z]/g) || []).length;
  if (letterCount < 2) return false;
  
  return true;
}

/**
 * Extract author information from the page
 */
function extractAuthorsNonDestructive() {
  const foundAuthors = [];
  const foundAuthorSet = new Set();
  const isAcademic = isAcademicPublisher();
  
  console.log(`Extracting authors from ${isAcademic ? 'academic' : 'general'} publisher site`);
  
  // Helper function to extract author names from container element
  function extractAuthorFromContainer(container) {
    // For academic publishers, author names are often split across child elements
    const nameElements = container.querySelectorAll('.given-name, .surname, .name, span');
    
    if (nameElements.length > 0) {
      let fullName = '';
      nameElements.forEach(el => {
        const text = (el.textContent || '').trim();
        if (text && !text.match(/^\d+$/) && !text.match(/^[a-z]$/i)) {
          fullName += (fullName ? ' ' : '') + text;
        }
      });
      return fullName.trim();
    }
    
    // Fallback to container text
    return (container.textContent || container.innerText || '').trim();
  }
  
  // Strategy 1: Check citation_author meta tags (most reliable for academic papers)
  try {
    const citationAuthors = document.querySelectorAll('meta[name="citation_author"], meta[name="DC.creator"], meta[name="dc.creator"]');
    citationAuthors.forEach(meta => {
      if (meta && meta.content) {
        const name = cleanAuthorName(meta.content.trim());
        if (name && isValidAuthorName(name) && !foundAuthorSet.has(name)) {
          foundAuthors.push(name);
          foundAuthorSet.add(name);
        }
      }
    });
    
    if (foundAuthors.length > 0) {
      console.log('Found authors from citation meta tags:', foundAuthors);
      return foundAuthors.slice(0, 10).join(', ') || 'Unknown Author';
    }
  } catch (e) {
    console.warn('Error extracting citation authors:', e);
  }
  
  // Strategy 2: Try structured data (JSON-LD)
  try {
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const data = JSON.parse(script.textContent);
        
        const extractFromStructuredData = (obj) => {
          if (obj.author) {
            if (Array.isArray(obj.author)) {
              obj.author.forEach(author => {
                const name = typeof author === 'object' ? author.name : author;
                if (name) {
                  const cleaned = cleanAuthorName(name);
                  if (cleaned && isValidAuthorName(cleaned) && !foundAuthorSet.has(cleaned)) {
                    foundAuthors.push(cleaned);
                    foundAuthorSet.add(cleaned);
                  }
                }
              });
            } else {
              const name = typeof obj.author === 'object' ? obj.author.name : obj.author;
              if (name) {
                const cleaned = cleanAuthorName(name);
                if (cleaned && isValidAuthorName(cleaned) && !foundAuthorSet.has(cleaned)) {
                  foundAuthors.push(cleaned);
                  foundAuthorSet.add(cleaned);
                }
              }
            }
          }
        };
        
        if (Array.isArray(data)) {
          data.forEach(extractFromStructuredData);
        } else {
          extractFromStructuredData(data);
        }
      } catch (e) {
        console.warn('Error parsing JSON-LD:', e);
      }
    }
    
    if (foundAuthors.length > 0) {
      console.log('Found authors from JSON-LD:', foundAuthors);
      return foundAuthors.slice(0, 10).join(', ') || 'Unknown Author';
    }
  } catch (e) {
    console.warn('Error processing JSON-LD scripts:', e);
  }
  
  // Strategy 3: Publisher-specific extraction patterns
  try {
    const hostname = window.location.hostname.toLowerCase();
    
    // Springer specific extraction
    if (hostname.includes('springer')) {
      const authorElements = document.querySelectorAll('.c-article-author-list__item, .authors__list .authors__item, .authors__name, .test-author-name, .authors-affiliations__author');
      authorElements.forEach(el => {
        const name = extractAuthorFromContainer(el);
        const cleaned = cleanAuthorName(name);
        if (cleaned && isValidAuthorName(cleaned) && !foundAuthorSet.has(cleaned)) {
          foundAuthors.push(cleaned);
          foundAuthorSet.add(cleaned);
        }
      });
    }
    // ScienceDirect specific extraction
    else if (hostname.includes('sciencedirect')) {
      const selectors = [
        '.author-group .author',
        '.AuthorGroups .author', 
        '.author .text',
        '.author-name',
        '.given-name, .surname'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // Handle given-name/surname pairs
          if (selector.includes('given-name')) {
            const givenNames = document.querySelectorAll('.given-name');
            const surnames = document.querySelectorAll('.surname');
            const minLength = Math.min(givenNames.length, surnames.length);
            
            for (let i = 0; i < minLength; i++) {
              const given = (givenNames[i].textContent || '').trim();
              const surname = (surnames[i].textContent || '').trim();
              if (given || surname) {
                const fullName = cleanAuthorName(`${given} ${surname}`.trim());
                if (fullName && isValidAuthorName(fullName) && !foundAuthorSet.has(fullName)) {
                  foundAuthors.push(fullName);
                  foundAuthorSet.add(fullName);
                }
              }
            }
            break;
          } else {
            elements.forEach(el => {
              const name = extractAuthorFromContainer(el);
              const cleaned = cleanAuthorName(name);
              if (cleaned && isValidAuthorName(cleaned) && !foundAuthorSet.has(cleaned)) {
                foundAuthors.push(cleaned);
                foundAuthorSet.add(cleaned);
              }
            });
            if (foundAuthors.length > 0) break;
          }
        }
      }
    }
    // IEEE specific extraction
    else if (hostname.includes('ieee')) {
      const authorElements = document.querySelectorAll(
        '.document-authors-banner .authors-info .blue-tooltip a span, ' +
        '.stats-document-authors-banner .authors-info .blue-tooltip a span, ' +
        '.authors-info .blue-tooltip a span, ' +
        '.authors-container .blue-tooltip a span, ' +
        '.authors-info a[href*="/author/"] span'
      );
      authorElements.forEach(el => {
        const name = extractAuthorFromContainer(el);
        const cleaned = cleanAuthorName(name);
        if (cleaned && isValidAuthorName(cleaned) && !foundAuthorSet.has(cleaned)) {
          foundAuthors.push(cleaned);
          foundAuthorSet.add(cleaned);
        }
      });
    }
    // ACM specific extraction
    else if (hostname.includes('acm.org')) {
      const authorElements = document.querySelectorAll('.hlFld-ContribAuthor, .loa__author-name, .contrib-author');
      authorElements.forEach(el => {
        const name = extractAuthorFromContainer(el);
        const cleaned = cleanAuthorName(name);
        if (cleaned && isValidAuthorName(cleaned) && !foundAuthorSet.has(cleaned)) {
          foundAuthors.push(cleaned);
          foundAuthorSet.add(cleaned);
        }
      });
    }
    
    if (foundAuthors.length > 0) {
      console.log('Found authors from publisher-specific extraction:', foundAuthors);
      return foundAuthors.slice(0, 10).join(', ') || 'Unknown Author';
    }
  } catch (e) {
    console.warn('Error with publisher-specific extraction:', e);
  }
  
  // Strategy 4: Generic CSS selectors as fallback
  try {
    const genericSelectors = [
      '.author-name',
      '.author',
      '.authors .author',
      '.byline',
      '.by-author',
      '[itemprop="author"]',
      '[rel="author"]'
    ];
    
    for (const selector of genericSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = extractAuthorFromContainer(element);
          const name = cleanAuthorName(text);
          
          // Strict validation for generic selectors
          if (name && isValidAuthorName(name) && 
              name.length > 3 && name.length < 60 && 
              !name.match(/\d{2,}/) && 
              !foundAuthorSet.has(name)) {
            foundAuthors.push(name);
            foundAuthorSet.add(name);
          }
          
          if (foundAuthors.length >= 10) break;
        }
        if (foundAuthors.length >= 3) break;
      } catch (e) {
        console.warn(`Error with selector ${selector}:`, e);
      }
    }
  } catch (e) {
    console.warn('Error with CSS selector author extraction:', e);
  }
  
  console.log(`Found ${foundAuthors.length} potential authors:`, foundAuthors);
  
  if (foundAuthors.length === 0) {
    return 'Unknown Author';
  }
  
  // Return up to 10 authors
  const result = foundAuthors.slice(0, 10).join(', ');
  console.log('Final extracted authors:', result);
  
  return result;
}

/**
 * Extract publication date from the page
 */
function extractDateNonDestructive() {
  // Helper function to safely parse dates and return year
  function parseYear(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;
    
    try {
      const cleanDate = dateString.trim();
      
      // Try direct year extraction (4-digit year)
      const yearMatch = cleanDate.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        const year = parseInt(yearMatch[0]);
        if (year >= 1900 && year <= 2030) {
          return year;
        }
      }
      
      // Try parsing as a date
      const date = new Date(cleanDate);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        if (year >= 1900 && year <= 2030) {
          return year;
        }
      }
      
    } catch (e) {
      console.warn('Error parsing date:', cleanDate, e);
    }
    
    return null;
  }

  // Try structured data first (JSON-LD)
  try {
    const jsonLd = document.querySelector('script[type="application/ld+json"]');
    if (jsonLd) {
      const data = JSON.parse(jsonLd.textContent);
      if (data.datePublished) {
        const year = parseYear(data.datePublished);
        if (year) return year;
      }
      if (data.dateCreated) {
        const year = parseYear(data.dateCreated);
        if (year) return year;
      }
    }
  } catch (e) {
    console.warn('Error parsing JSON-LD for date:', e);
  }
  
  // Try meta tags
  const metaSelectors = [
    'meta[property="article:published_time"]',
    'meta[property="article:modified_time"]',
    'meta[name="publication_date"]',
    'meta[name="date"]',
    'meta[name="DC.date"]',
    'meta[name="dcterms.created"]',
    'meta[property="og:updated_time"]',
    'meta[name="pubdate"]',
    'meta[name="publish_date"]',
    'meta[name="citation_publication_date"]',
    'meta[name="citation_date"]',
    'meta[name="citation_year"]',
    'meta[name="prism.publicationDate"]',
    'meta[name="prism.coverDate"]'
  ];
  
  for (const selector of metaSelectors) {
    const metaTag = document.querySelector(selector);
    if (metaTag && metaTag.content) {
      const year = parseYear(metaTag.content);
      if (year) return year;
    }
  }
  
  // Check citation_year meta tag specifically
  const citationYear = document.querySelector('meta[name="citation_year"]');
  if (citationYear && citationYear.content) {
    const year = parseInt(citationYear.content);
    if (year >= 1900 && year <= 2030) {
      return year;
    }
  }
  
  // Publisher-specific extraction
  try {
    const hostname = window.location.hostname.toLowerCase();
    
    // ScienceDirect specific date extraction
    if (hostname.includes('sciencedirect')) {
      const yearElements = document.querySelectorAll(
        '.publication-year, .article-date, .coverDate, .publicationDate, ' +
        '.ArticleHistory time, .article-header time, .article-info time, ' +
        '.volIssue, .volume-issue'
      );
      
      for (const el of yearElements) {
        const text = (el.textContent || el.innerText || '').trim();
        const year = parseYear(text);
        if (year) return year;
      }
      
      // Check volume/issue text for year
      const volIssue = document.querySelector('.volIssue, .volume-issue, .article-volume');
      if (volIssue) {
        const text = volIssue.textContent || '';
        const yearMatch = text.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          const year = parseInt(yearMatch[0]);
          if (year >= 1900 && year <= 2030) {
            return year;
          }
        }
      }
    }
    // Springer specific date extraction
    else if (hostname.includes('springer')) {
      const yearElements = document.querySelectorAll(
        '.c-article-identifiers__item time, .article-dates time, ' +
        '.publication-history time, .copyright-year, #article-info-dates time'
      );
      
      for (const el of yearElements) {
        const datetime = el.getAttribute('datetime');
        if (datetime) {
          const year = parseYear(datetime);
          if (year) return year;
        }
        const text = (el.textContent || el.innerText || '').trim();
        const year = parseYear(text);
        if (year) return year;
      }
    }
    // IEEE specific date extraction
    else if (hostname.includes('ieee')) {
      const yearElements = document.querySelectorAll(
        '.publication-year, .stats-document-abstract-publishedDate, ' +
        '.u-pb-1 .stats-document-abstract-publishedDate'
      );
      
      for (const el of yearElements) {
        const text = (el.textContent || el.innerText || '').trim();
        const year = parseYear(text);
        if (year) return year;
      }
    }
  } catch (e) {
    console.warn('Error with publisher-specific date extraction:', e);
  }
  
  // Try CSS selectors
  const expandedDateSelectors = [
    ...CONFIG.DATE_SELECTORS,
    '.publication-year',
    '.article-year',
    '.pub-year',
    '.copyright-year',
    '.citation-year',
    '.year',
    '[class*="year"]',
    '[class*="date"]',
    'time'
  ];
  
  for (const selector of expandedDateSelectors) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Try datetime attribute first
        const datetime = el.getAttribute('datetime');
        if (datetime) {
          const year = parseYear(datetime);
          if (year) return year;
        }
        
        // Try pubdate attribute
        const pubdate = el.getAttribute('pubdate');
        if (pubdate) {
          const year = parseYear(pubdate);
          if (year) return year;
        }
        
        // Try element text content
        const text = (el.textContent || el.innerText || '').trim();
        if (text && text.length < 100) {
          const year = parseYear(text);
          if (year) return year;
        }
      }
    } catch (e) {
      console.warn(`Error with date selector ${selector}:`, e);
    }
  }
  
  // Last resort: scan for copyright notices
  try {
    const copyrightElements = document.querySelectorAll('[class*="copyright"], [id*="copyright"], footer');
    for (const el of copyrightElements) {
      const text = (el.textContent || '').substring(0, 200);
      const yearMatch = text.match(/©?\s*(19|20)\d{2}/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1] + yearMatch[0].slice(-2));
        if (year >= 1900 && year <= 2030) {
          console.log('Found year in copyright notice:', year);
          return year;
        }
      }
    }
  } catch (e) {
    console.warn('Error extracting year from copyright:', e);
  }
  
  console.log('No publication date found on page');
  return null;
}

/**
 * Extract keywords from meta tags and content
 */
function extractKeywordsNonDestructive() {
  const keywords = [];
  
  // Try meta keywords
  const keywordsMeta = document.querySelector('meta[name="keywords"]');
  if (keywordsMeta) {
    keywords.push(...keywordsMeta.content.split(',').map(k => k.trim()));
  }
  
  // Try meta tags for article tags
  const tags = document.querySelectorAll('meta[property="article:tag"]');
  tags.forEach(tag => keywords.push(tag.content));
  
  // Try common tag selectors
  const tagElements = document.querySelectorAll('.tags a, .tag, .category, .keywords span');
  tagElements.forEach(el => {
    const text = (el.textContent || el.innerText || '').trim();
    if (text && text.length > 2 && text.length < 50) {
      keywords.push(text);
    }
  });
  
  // Remove duplicates and filter
  return [...new Set(keywords)]
    .filter(k => k && k.length > 2 && k.length < 50)
    .slice(0, 10);
}

/**
 * Extract title using prioritized selectors
 */
function extractTitleNonDestructive() {
  // Try content-specific title selectors first
  const titleText = findMetadataBySelectorsNonDestructive(CONFIG.TITLE_SELECTORS);
  if (titleText) {
    return titleText;
  }
  
  // Fallback to document title with cleanup
  if (document.title) {
    let title = document.title.trim();
    // Clean up common patterns
    title = title.replace(/\s*[-|–]\s*.*$/, '').trim(); // Remove site name
    if (title.length > 3) {
      return title;
    }
  }
  
  return 'Untitled';
}

/**
 * Extract main content using hybrid method (destructive on cloned HTML)
 */
function extractMainContentHybrid() {
  // Try to find main content area
  for (const selector of CONFIG.CONTENT_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        // Get the HTML of the element
        const elementHtml = el.outerHTML;
        
        // Use destructive extraction on the HTML string
        const content = extractCleanTextDestructive(elementHtml);
        
        if (content && content.length >= CONFIG.MIN_CONTENT_LENGTH) {
          return content.substring(0, CONFIG.MAX_CONTENT_LENGTH);
        }
      }
    } catch (e) {
      console.warn(`Error with selector ${selector}:`, e);
    }
  }
  
  // Fallback: try to get body content
  if (document.body) {
    const bodyHtml = document.body.outerHTML;
    const bodyText = extractCleanTextDestructive(bodyHtml);
    
    if (bodyText.length >= CONFIG.MIN_CONTENT_LENGTH) {
      return bodyText.substring(0, CONFIG.MAX_CONTENT_LENGTH);
    }
  }
  
  return '';
}

/**
 * Extract all relevant information from the current webpage
 */
async function extractPageContent() {
  // Check if this is a PDF page and skip extraction entirely
  if (isPDFPage()) {
    console.log('PDF page detected - skipping content extraction entirely');
    
    const metadata = extractPDFMetadata();
    const url = window.location.href;
    const filename = url.split('/').pop().split('?')[0] || 'document.pdf';
    
    // Return PDF metadata without content extraction
    return {
      url: url,
      domain: window.location.hostname,
      title: metadata.title || filename,
      authors: metadata.authors,
      content: '', // Always empty for server processing
      abstract: '',
      keywords: [],
      publicationYear: metadata.publicationYear,
      extractedAt: new Date().toISOString(),
      contentLength: 0,
      isValidContent: true, // Trust server to validate
      isPDF: true,
      filename: filename,
      contentType: 'pdf',
      requiresBackendProcessing: true
    };
  }
  
  // Regular webpage extraction using non-destructive methods
  const url = window.location.href;
  const domain = window.location.hostname;
  
  // Extract metadata using non-destructive methods
  const title = extractTitleNonDestructive();
  const authors = extractAuthorsNonDestructive();
  const publicationYear = extractDateNonDestructive();
  const keywords = extractKeywordsNonDestructive();
  
  // Extract content using hybrid method
  const content = extractMainContentHybrid();
  
  // Try to extract abstract/description
  let abstract = '';
  const descMeta = document.querySelector('meta[name="description"]') ||
                  document.querySelector('meta[property="og:description"]');
  if (descMeta) {
    abstract = descMeta.content;
  } else {
    // Use first paragraph as abstract
    const firstP = document.querySelector('article p, .content p, main p, p');
    if (firstP) {
      abstract = extractCleanTextNonDestructive(firstP).substring(0, 500);
    }
  }
  
  // If abstract is still empty, use beginning of content
  if (!abstract && content) {
    abstract = content.substring(0, 500);
  }
  
  return {
    url,
    domain,
    title: title || 'Untitled',
    authors,
    content,
    abstract: abstract || content.substring(0, 500),
    keywords,
    publicationYear,
    extractedAt: new Date().toISOString(),
    contentLength: content.length,
    isValidContent: content.length >= CONFIG.MIN_CONTENT_LENGTH,
    contentType: 'web'
  };
}

// Content extraction state management
let extractionInProgress = false;
let lastExtractionTime = 0;
let extractionCache = {
  data: null,
  timestamp: 0
};

// Message listener for popup and background script communication
if (!window.uzeiLiteratureReviewMessageListener) {
  window.uzeiLiteratureReviewMessageListener = true;
  
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Handle PDF detection requests
    if (request.action === 'isPDF') {
      const isPDF = isPDFPage();
      console.log(`PDF detection request: ${isPDF ? 'YES' : 'NO'} - URL: ${window.location.href}`);
      sendResponse({ isPDF: isPDF });
      return true;
    }
    
    // Handle content extraction requests
    if (request.action === 'extractContent') {
      const now = Date.now();
      
      // Check for valid cached data
      if (extractionCache.data && 
          (now - extractionCache.timestamp) < CONFIG.EXTRACTION_CACHE_DURATION) {
        console.log('Using cached extraction data');
        sendResponse({ success: true, data: extractionCache.data });
        return true;
      }
      
      // Prevent multiple simultaneous extractions
      if (extractionInProgress) {
        console.log('Content extraction already in progress, waiting...');
        const checkCompletion = setInterval(() => {
          if (!extractionInProgress) {
            clearInterval(checkCompletion);
            if (extractionCache.data) {
              sendResponse({ success: true, data: extractionCache.data });
            } else {
              sendResponse({ success: false, error: 'Extraction failed' });
            }
          }
        }, 100);
        
        // Timeout after 10 seconds
        setTimeout(() => {
          clearInterval(checkCompletion);
          if (extractionInProgress) {
            sendResponse({ success: false, error: 'Extraction timeout' });
          }
        }, 10000);
        
        return true;
      }
      
      // Start new extraction
      extractionInProgress = true;
      lastExtractionTime = now;
      
      // Set timeout for extraction
      const extractionTimeout = setTimeout(() => {
        if (extractionInProgress) {
          extractionInProgress = false;
          sendResponse({ success: false, error: 'Extraction timed out' });
        }
      }, CONFIG.EXTRACTION_TIMEOUT);
      
      extractPageContent().then(pageData => {
        clearTimeout(extractionTimeout);
        
        // Cache the data
        extractionCache = {
          data: pageData,
          timestamp: now
        };
        window.pageContentData = pageData; // Keep backward compatibility
        
        sendResponse({ success: true, data: pageData });
        extractionInProgress = false;
      }).catch(error => {
        clearTimeout(extractionTimeout);
        console.error('Error extracting content:', error);
        sendResponse({ success: false, error: error.message });
        extractionInProgress = false;
      });
      
      return true; // Keep message channel open for async response
    }
    
    // Handle cache clearing requests
    if (request.action === 'clearCache') {
      extractionCache = { data: null, timestamp: 0 };
      delete window.pageContentData;
      sendResponse({ success: true });
      return true;
    }
    
    // Handle extraction status requests
    if (request.action === 'getExtractionStatus') {
      sendResponse({ 
        inProgress: extractionInProgress,
        hasCachedData: !!extractionCache.data,
        cacheAge: extractionCache.data ? (Date.now() - extractionCache.timestamp) : null
      });
      return true;
    }
  });
}

// Auto-extract content when page loads
let pageLoadExtractionDone = false;
let autoExtractionTimeout = null;

function extractAndCacheContent() {
  // Prevent multiple auto-extractions
  if (pageLoadExtractionDone) return;
  
  // Skip auto-extraction on PDF pages
  if (isPDFPage()) {
    console.log('PDF page detected - skipping auto-extraction entirely');
    pageLoadExtractionDone = true;
    return;
  }
  
  pageLoadExtractionDone = true;
  
  // Clear any existing timeout
  if (autoExtractionTimeout) {
    clearTimeout(autoExtractionTimeout);
  }
  
  // Add small delay to let page stabilize
  autoExtractionTimeout = setTimeout(() => {
    const now = Date.now();
    if (!extractionInProgress && 
        (!extractionCache.data || (now - extractionCache.timestamp) > CONFIG.EXTRACTION_CACHE_DURATION / 2)) {
      
      extractPageContent().then(pageData => {
        extractionCache = {
          data: pageData,
          timestamp: now
        };
        window.pageContentData = pageData;
        
        // Notify background script
        chrome.runtime.sendMessage({
          action: 'contentCached',
          tabId: chrome.runtime.id,
          isValid: pageData.isValidContent
        }).catch(() => {
          // Background script might not be ready, ignore error
        });
      }).catch(error => {
        console.warn('Auto-extraction failed:', error.message);
      });
    }
  }, 1000);
}

// Initialize based on document state
if (document.readyState === 'complete') {
  extractAndCacheContent();
} else if (document.readyState === 'interactive') {
  if (!window.uzeiLiteratureReviewContentLoadListener) {
    window.uzeiLiteratureReviewContentLoadListener = true;
    window.addEventListener('load', extractAndCacheContent, { once: true });
  }
} else {
  if (!window.uzeiLiteratureReviewContentDOMListener) {
    window.uzeiLiteratureReviewContentDOMListener = true;
    document.addEventListener('DOMContentLoaded', () => {
      window.addEventListener('load', extractAndCacheContent, { once: true });
    }, { once: true });
  }
}

// Handle page visibility changes for tab switching
if (!window.uzeiLiteratureReviewVisibilityListener) {
  window.uzeiLiteratureReviewVisibilityListener = true;
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && extractionCache.data) {
      // Tab became visible - check if cached data is still valid
      const now = Date.now();
      if ((now - extractionCache.timestamp) > CONFIG.EXTRACTION_CACHE_DURATION) {
        // Cache is stale, clear it
        extractionCache = { data: null, timestamp: 0 };
        delete window.pageContentData;
      }
    }
  });
}

// Handle beforeunload to clear cache
if (!window.uzeiLiteratureReviewUnloadListener) {
  window.uzeiLiteratureReviewUnloadListener = true;
  window.addEventListener('beforeunload', () => {
    extractionCache = { data: null, timestamp: 0 };
    delete window.pageContentData;
  });
}

// Debug helper function
if (typeof window.debugUzeiLiteratureReviewExtension === 'undefined') {
  window.debugUzeiLiteratureReviewExtension = () => {
    console.log('Uzei - Literature Review Extension Debug Info:', {
      extractionInProgress,
      hasCachedData: !!extractionCache.data,
      cacheAge: extractionCache.data ? (Date.now() - extractionCache.timestamp) : null,
      pageLoadExtractionDone,
      url: window.location.href,
      title: document.title,
      scriptLoaded: window.uzeiLiteratureReviewExtensionLoaded,
      isAcademicSite: isAcademicPublisher(),
      isPDFPage: isPDFPage()
    });
  };
}

console.log('Uzei - Literature Review Extension content script loaded successfully - ENHANCED PDF DETECTION');

}