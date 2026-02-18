# Notion Embed iOS Fixes

## Overview

The Notion Quick Entry page had critical iOS compatibility issues preventing it from working in the Notion iOS app. The primary issue was `target="_parent"` navigation, which is blocked by iOS Safari security policies, especially in app WebView contexts like Notion's iOS app. Additional problems included touch handling, viewport sizing, Content Security Policy restrictions, and network request failures specific to iOS Safari and embedded contexts.

Most iOS embed issues fall into one of these categories:
- Content Security Policy restrictions
- Navigation/iframe limitations
- Touch event handling
- Network request failures

## Issues and Fixes

### 1. `target="_parent"` Navigation

**Problem**: The "Open Work Entry" button used `target="_parent"` which is blocked by iOS Safari's security policies in app WebView contexts.

**Fix**: Replaced with JavaScript-based navigation using `window.open()` with multiple fallbacks:
- Primary: `window.open(url, '_blank', 'noopener,noreferrer')`
- Fallback 1: Direct navigation via `window.location.href`
- Fallback 2: Copy URL to clipboard with user notification

```typescript
const handleOpenEntry = (url: string) => {
  try {
    // Primary: Open in new window/tab - works better on iOS
    const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
    if (!newWindow) {
      // Fallback: Direct navigation if popup blocked
      window.location.href = url;
    }
  } catch (error) {
    // Final fallback: Copy to clipboard with user notification
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        alert('Unable to open automatically. URL copied to clipboard - please paste in your browser.');
      }).catch(() => {
        alert('Unable to open automatically. Please navigate to: ' + url);
      });
    } else {
      alert('Unable to open automatically. Please navigate to: ' + url);
    }
  }
};
```

`window.open()` is more accepted by iOS Safari's security policies than iframe-based `target="_parent"` navigation. The multiple fallbacks ensure that if one method fails, the system gracefully degrades.

### 2. Alternative Navigation Approaches

#### A. PostMessage Communication

Use postMessage to communicate with the parent Notion window:

```typescript
const handleOpenEntry = (url: string) => {
  try {
    // First, try postMessage to parent
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'OPEN_URL',
        url: url
      }, '*');

      // Give it a moment, then try other methods
      setTimeout(() => {
        // Fallback to existing methods
        const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
        if (!newWindow) {
          window.location.href = url;
        }
      }, 500);
    } else {
      // Direct navigation if not in iframe
      window.location.href = url;
    }
  } catch (error) {
    // Existing clipboard fallback
    // ...
  }
};
```

#### B. Custom URL Scheme Approach

Use Notion's custom URL scheme:

```typescript
const handleOpenEntry = (url: string) => {
  try {
    // Extract the page ID from the Notion URL
    const pageId = url.split('/').pop()?.split('?')[0];

    if (pageId) {
      // Try Notion's custom URL scheme first
      const notionUrl = `notion://www.notion.so/${pageId}`;
      window.location.href = notionUrl;

      // Fallback to web URL after delay
      setTimeout(() => {
        window.location.href = url;
      }, 1000);
    } else {
      // Fallback to original URL
      window.location.href = url;
    }
  } catch (error) {
    // Existing fallback logic
    // ...
  }
};
```

### 3. iOS-Specific UI Optimizations

**Problem**: iOS has specific requirements for touch targets, viewport handling, and rendering in embedded contexts.

**Fixes applied in `NotionQuickEntry.tsx`:**
- Replaced `target="_parent"` button with `onClick` handler
- Added comprehensive navigation fallbacks
- Added iOS touch optimizations
- Enhanced button styling for iOS

**Fixes applied in `NotionEmbedPage.tsx`:**
- Added iOS detection and optimizations
- Implemented proper viewport height handling
- Added touch and scroll optimizations
- Enhanced CSS for iOS Safari compatibility

**iOS detection and dynamic viewport height handling:**

```typescript
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

// Dynamic viewport height handling for iOS
const setVH = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
};
```

**Touch handling:**
- Minimum touch target size: 44px height for all buttons
- Proper viewport height handling for iOS Safari
- Disabled tap highlighting (`WebkitTapHighlightColor: 'transparent'`)
- Optimized touch actions (`touchAction: 'manipulation'`)
- Prevented zoom on double-tap
- Fixed scroll bounce issues

**More aggressive touch handling for persistent issues:**

```typescript
// In NotionEmbedPage.tsx
useEffect(() => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

  if (isIOS) {
    // Prevent all default touch behaviors
    const preventDefaultTouch = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };

    // Add passive: false to ensure preventDefault works
    document.addEventListener('touchstart', preventDefaultTouch, { passive: false });
    document.addEventListener('touchmove', preventDefaultTouch, { passive: false });

    // Force hardware acceleration
    document.body.style.transform = 'translateZ(0)';
    document.body.style.WebkitTransform = 'translateZ(0)';

    return () => {
      document.removeEventListener('touchstart', preventDefaultTouch);
      document.removeEventListener('touchmove', preventDefaultTouch);
    };
  }
}, []);
```

**iOS-specific CSS enhancements:**

```css
/* Add to your CSS or styled components */
.ios-optimized {
  /* Force hardware acceleration */
  -webkit-transform: translateZ(0);
  transform: translateZ(0);

  /* Improve scrolling performance */
  -webkit-overflow-scrolling: touch;

  /* Prevent callout */
  -webkit-touch-callout: none;

  /* Prevent selection */
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;

  /* Prevent tap highlighting */
  -webkit-tap-highlight-color: transparent;

  /* Optimize for touch */
  touch-action: manipulation;
}

/* Specific button optimizations */
.ios-button {
  /* Ensure minimum touch target */
  min-height: 44px;
  min-width: 44px;

  /* Prevent default button styling */
  -webkit-appearance: none;
  appearance: none;

  /* Ensure proper cursor */
  cursor: pointer;

  /* Force repaint on touch */
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
}
```

### 4. Server-Side Headers

**Problem**: iOS Safari has stricter CSP and embedding requirements.

**Fixes applied in `server/src/server.ts`:**
- Added `'unsafe-inline'` to script-src for iOS compatibility
- iOS-specific security headers
- Proper User-Agent variance handling
- Enhanced cache-busting for Notion's embedding system

**iOS-specific headers in embed route middleware:**

```typescript
// In server.ts, enhance the embed route middleware
app.use('/notion-embed', (req, res, next) => {
  const userAgent = req.headers['user-agent'] || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  // Remove X-Frame-Options to allow embedding
  res.removeHeader('X-Frame-Options');

  if (isIOS) {
    // iOS-specific CSP
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " + // More permissive for iOS
      "img-src 'self' data: https:; " +
      "connect-src 'self' https:; " + // Allow HTTPS connections
      "font-src 'self' data:; " +
      "frame-ancestors 'self' https://*.notion.so https://notion.so app://*; " + // Allow app protocols
      "worker-src 'self' blob:; " +
      "child-src 'self' blob:;"
    );

    // iOS-specific headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  }

  // Enhanced cache busting
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Last-Modified', new Date().toUTCString());
  res.setHeader('ETag', Date.now().toString());

  next();
});
```

**API endpoint iOS optimizations:**

```typescript
// In notion.ts route
router.post('/create-smart-entry', async (req: Request, res: Response) => {
  const userAgent = req.headers['user-agent'] || '';
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);

  try {
    // Add iOS-specific logging
    if (isIOS) {
      debugLog.info('iOS request detected for create-smart-entry');
    }

    // ... existing logic ...

    // Enhanced response for iOS
    if (isIOS) {
      res.set({
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json; charset=utf-8'
      });
    }

    res.json({
      success: true,
      page_url: response.url,
      carryover_tasks: carryoverTasks,
      debug_info: process.env.NODE_ENV === 'development' ? {
        user_agent: userAgent,
        is_ios: isIOS,
        timestamp: new Date().toISOString()
      } : undefined
    });
  } catch (error) {
    // ... error handling
  }
});
```

### 5. Progressive Enhancement / Fallback

Create a simpler, more iOS-compatible fallback interface that can be used when the main version fails:

```typescript
const NotionQuickEntryIOSFallback: React.FC = () => {
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const clients = ['Stoller', 'Nadler', 'Thomas', 'Kurzweil', 'Feigum', 'Campbell'];

  const handleCreateEntry = async (clientName: string) => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/notion/create-smart-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ client_name: clientName }),
      });

      const data = await response.json();

      if (data.success) {
        // Simple alert for iOS
        alert(`Entry created successfully! ${data.carryover_tasks.length} tasks carried over. URL: ${data.page_url}`);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      alert('Failed to create entry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui' }}>
      <h2>Quick Work Entry</h2>
      {clients.map(client => (
        <button
          key={client}
          onClick={() => handleCreateEntry(client)}
          disabled={isLoading}
          style={{
            display: 'block',
            width: '100%',
            padding: '15px',
            margin: '10px 0',
            fontSize: '16px',
            backgroundColor: '#2ea44f',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          {isLoading ? 'Creating...' : `Start ${client} Visit`}
        </button>
      ))}
    </div>
  );
};

// Use conditional rendering in main component
const NotionQuickEntry: React.FC = () => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const [useIOSFallback, setUseIOSFallback] = useState(false);

  // Auto-fallback to iOS version if main version fails
  useEffect(() => {
    if (isIOS) {
      // Could add logic to detect if the main version is failing
      // and automatically switch to fallback
    }
  }, [isIOS]);

  if (isIOS && useIOSFallback) {
    return <NotionQuickEntryIOSFallback />;
  }

  // Main component logic...
};
```

## Debugging Approaches

### Console Logging

Add comprehensive logging to identify where exactly the failure occurs:

```typescript
// In NotionQuickEntry.tsx, add debug logging
const NotionQuickEntry: React.FunctionComponent = () => {
  useEffect(() => {
    console.log('NotionQuickEntry mounted');
    console.log('User Agent:', navigator.userAgent);
    console.log('Is iOS:', /iPad|iPhone|iPod/.test(navigator.userAgent));
    console.log('Window dimensions:', window.innerWidth, 'x', window.innerHeight);
  }, []);

  const createEntry = async () => {
    console.log('Creating entry for:', clientName);
    console.log('API endpoint:', '/api/notion/create-smart-entry');

    try {
      const response = await notionApi.createSmartEntry(clientName);
      console.log('Success response:', response);
      setResult(response);
    } catch (error) {
      console.error('API call failed:', error);
      console.error('Error details:', error.response?.data);
      // ... rest of error handling
    }
  };
};
```

### Visual Error Display

Show detailed error information to users for debugging:

```typescript
// Enhanced error state display
{result && !result.success && (
  <Box>
    <Typography variant="h6" sx={{ color: '#d32f2f', marginBottom: 2 }}>
      Error Details
    </Typography>
    <Typography variant="body2" sx={{ marginBottom: 1 }}>
      {result.error}
    </Typography>
    {process.env.NODE_ENV === 'development' && (
      <Typography variant="caption" sx={{
        display: 'block',
        marginBottom: 3,
        fontFamily: 'monospace',
        backgroundColor: '#f5f5f5',
        padding: 1,
        borderRadius: 1
      }}>
        Debug: Check browser console for detailed logs
      </Typography>
    )}
  </Box>
)}
```

### Network and CORS Debugging

Add network-level debugging to the API service:

```typescript
// Add to your API service
const notionApi = {
  async createSmartEntry(clientName: string): Promise<CreateEntryResponse> {
    console.log('Making API request to:', '/api/notion/create-smart-entry');
    console.log('Request payload:', { client_name: clientName });

    try {
      const response = await fetch('/api/notion/create-smart-entry', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': navigator.userAgent, // Help server identify iOS
        },
        body: JSON.stringify({ client_name: clientName }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Response error:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Response data:', data);

      return data;
    } catch (error) {
      console.error('Network error:', error);
      throw error;
    }
  }
};
```

### Debugging Tools for iOS

- Use Safari's Web Inspector to debug iOS WebView
- Enable developer mode on iOS device
- Test in both Safari browser and Notion app
- Check console logs for detailed error information

## Testing

### iOS Testing Checklist

- [ ] Page loads without JavaScript errors
- [ ] Network requests succeed (check developer tools)
- [ ] Client selection dropdown works
- [ ] Buttons respond to touch
- [ ] "Create Work Entry" button responds to touch
- [ ] Loading state displays properly
- [ ] Success screen appears after entry creation
- [ ] Navigation works (opens Notion pages) -- this was the main fix
- [ ] Touch targets are appropriately sized (minimum 44px)
- [ ] No unwanted zooming or scrolling

### Cross-Platform Verification

Ensure fixes do not break existing functionality:
- **Android Notion app** -- should continue working
- **Web browsers** (Chrome, Safari, Firefox) -- should continue working
- **Desktop Notion app** -- should continue working

### Testing Strategy

1. **Start with debugging** -- Add console logs and see what is failing
2. **Try the simplest fix first** -- Often it is a simple CSP or navigation issue
3. **Test each fix individually** -- Do not apply all fixes at once
4. **Cross-platform verification** -- Ensure fixes do not break other platforms

### Files Modified

**Frontend:**
- `src/components/NotionQuickEntry.tsx`
- `src/components/NotionEmbedPage.tsx`

**Backend:**
- `server/src/server.ts`

### Monitoring

After deployment, monitor for:
- iOS user engagement rates with the embed
- Error reports from iOS users
- Success rates of work entry creation on iOS vs other platforms

### Future Considerations

- Consider implementing iOS-specific analytics to track embed performance
- Monitor for iOS Safari updates that might affect embedded content policies
- Test with future Notion iOS app updates
