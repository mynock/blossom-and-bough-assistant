# iOS Remote Debugging Guide

## Overview
Remote debugging allows you to inspect and debug web content running on an iOS device from your computer. This is essential for troubleshooting the Notion embed issue.

## 🍎 Method 1: Safari Web Inspector (Recommended)

### Prerequisites
- **Mac computer** with Safari
- **iOS device** (iPhone/iPad) with Safari
- **USB cable** to connect device to Mac
- Both devices on **same Apple ID** (recommended)

### Setup Steps

#### 1. Enable Web Inspector on iOS Device
1. Open **Settings** app on iOS device
2. Go to **Safari** → **Advanced**
3. Turn on **Web Inspector**

#### 2. Enable Develop Menu on Mac Safari
1. Open **Safari** on Mac
2. Go to **Safari** → **Preferences** (or **Settings** on newer macOS)
3. Click **Advanced** tab
4. Check **"Show Develop menu in menu bar"**

#### 3. Connect and Debug
1. **Connect iOS device to Mac** via USB cable
2. **Trust the computer** when prompted on iOS device
3. Open **Safari on iOS** and navigate to your embed page:
   ```
   https://your-domain.com/notion-embed
   ```
4. On **Mac Safari**, go to **Develop** menu
5. You should see your iOS device listed (e.g., "John's iPhone")
6. Hover over device name → Select the webpage you want to debug
7. **Web Inspector opens** with full debugging capabilities

### What You Can Do
- ✅ **Console logs** - See all console.log output
- ✅ **Network requests** - Monitor API calls and responses
- ✅ **Element inspection** - Examine DOM and CSS
- ✅ **JavaScript debugging** - Set breakpoints, step through code
- ✅ **Error messages** - See detailed error information

## 📱 Method 2: Chrome DevTools (Alternative)

### For Android or if you don't have a Mac

#### Setup Chrome Remote Debugging
1. **Enable Developer Options** on mobile device:
   - Android: Settings → About Phone → Tap "Build Number" 7 times
   - Enable "USB Debugging" in Developer Options

2. **Connect via USB** and open Chrome on desktop
3. Go to `chrome://inspect/#devices`
4. Your device should appear - click **"Inspect"**

**Note**: This only works for Chrome browser, not Safari or Notion app WebView.

## 🔧 Method 3: Debugging in Notion App Context

### The Challenge
Notion's iOS app uses a WebView, which is harder to debug directly. Here are approaches:

#### A. Test in Safari First
1. Open **Safari on iOS**
2. Navigate directly to: `https://your-domain.com/notion-embed`
3. Use Safari Web Inspector as described above
4. This will show most issues that would also occur in Notion

#### B. Use Debugging Proxy (Advanced)
Tools like **Charles Proxy** or **Proxyman** can intercept network traffic:

1. Install proxy tool on Mac
2. Configure iOS device to use Mac as proxy
3. Monitor network requests from Notion app
4. See API calls, responses, and errors

#### C. Add Visual Debug Overlay
If remote debugging doesn't work, add visual debugging directly in the embed:

```typescript
// Add to NotionQuickEntry.tsx for visual debugging
const [debugInfo, setDebugInfo] = useState<string[]>([]);

const addDebugInfo = (message: string) => {
  setDebugInfo(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${message}`]);
};

// Use throughout component:
useEffect(() => {
  addDebugInfo('Component mounted');
  addDebugInfo(`iOS: ${/iPad|iPhone|iPod/.test(navigator.userAgent)}`);
  addDebugInfo(`In iframe: ${window.parent !== window}`);
}, []);

// In render:
{process.env.NODE_ENV === 'development' && (
  <Box sx={{ 
    position: 'fixed', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    backgroundColor: 'rgba(0,0,0,0.8)', 
    color: 'white', 
    fontSize: '10px', 
    padding: 1, 
    zIndex: 9999 
  }}>
    {debugInfo.map((info, i) => (
      <div key={i}>{info}</div>
    ))}
  </Box>
)}
```

## 🧪 Method 4: Alternative Testing Approaches

### A. weinre (Web Inspector Remote)
For older devices or complex setups:

1. Install weinre: `npm install -g weinre`
2. Start server: `weinre --boundHost 0.0.0.0`
3. Add script to your embed page:
   ```html
   <script src="http://your-computer-ip:8080/target/target-script-min.js#anonymous"></script>
   ```
4. Open debug client at: `http://your-computer-ip:8080/client/`

### B. Eruda (Mobile DevTools)
Add a mobile debugging console directly to your page:

```typescript
// Add to NotionEmbedPage.tsx for development
useEffect(() => {
  if (process.env.NODE_ENV === 'development') {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/eruda';
    script.onload = () => {
      (window as any).eruda.init();
    };
    document.head.appendChild(script);
  }
}, []);
```

This adds a mobile-friendly developer console directly on the page.

## 🎯 Quick Start for Your Issue

### Immediate Steps:
1. **If you have a Mac**: Use Safari Web Inspector (Method 1)
2. **If no Mac**: Add visual debug overlay (Method 3C) or use Eruda (Method 4B)
3. **Test in Safari first**, then Notion app

### What to Look For:
When debugging, specifically check for:

```javascript
// These debug messages should appear in console:
- "NotionQuickEntry mounted"
- "Is iOS: true/false"
- "NotionAPI: Making request to create smart entry"
- "NotionAPI: Response status: 200" (or error status)

// Common error patterns:
- CORS errors
- CSP violations
- Network request failures
- Navigation errors
```

### Report Back:
Once you get debugging working, share:
1. **Console error messages** (exact text)
2. **Network request status** (200, 404, 500, etc.)
3. **Any CSP or security warnings**
4. **Whether the issue is loading, API calls, or navigation**

## 🚨 Troubleshooting Remote Debugging

### Safari Web Inspector Not Working:
- Ensure both devices are **signed into same Apple ID**
- Try **restarting Safari** on both devices
- **Disconnect/reconnect** USB cable
- Check **"Trust This Computer"** was accepted on iOS

### Device Not Appearing:
- Enable **"Web Inspector"** in iOS Safari settings
- Check USB cable connection
- Try different USB port
- Restart both devices if needed

### WebView Content Not Debuggable:
- Test in **Safari browser first** instead of Notion app
- Use **visual debugging** or **Eruda** for in-app debugging
- Consider **network proxy** for API request monitoring

The Safari Web Inspector method is by far the most powerful and is what most iOS web developers use for debugging mobile issues.