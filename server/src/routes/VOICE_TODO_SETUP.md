# Voice Todo - Mobile Setup Guide

Capture voice notes on the go and automatically route them to Notion (client site tasks) or ClickUp (business/personal tasks).

## How It Works

1. You speak a voice note on your phone
2. The phone transcribes it to text
3. The text is sent to `POST /api/voice-todo`
4. Claude classifies each item and routes it to the right destination

## Server Environment Variables

Add these to your `.env` file:

```
VOICE_TODO_API_KEY=<generate a strong random string>
CLICKUP_API_TOKEN=<your ClickUp personal API token>
CLICKUP_BB_SPACE_ID=<Blossom and Bough space ID>
CLICKUP_PERSONAL_SPACE_ID=<your personal space ID>
```

**Finding your ClickUp Space IDs:** Open ClickUp in a browser, navigate to a space, and the URL will contain the space ID (e.g., `app.clickup.com/{team_id}/v/s/{space_id}`). Alternatively, use the ClickUp API: `GET https://api.clickup.com/api/v2/team/{team_id}/space`.

---

## iOS Setup (Shortcuts)

### Step 1: Create the Shortcut

1. Open the **Shortcuts** app
2. Tap **+** to create a new shortcut
3. Name it **"Voice Todo"**

### Step 2: Add Actions

Add these actions in order:

1. **Dictate Text**
   - Tap "Add Action", search for "Dictate Text"
   - Set language to English
   - Set "Stop Listening" to **After Pause** (stops when you stop talking)

2. **Get Contents of URL** (this sends the API request)
   - URL: `https://your-server-domain.com/api/voice-todo`
   - Method: **POST**
   - Headers:
     - `Authorization`: `Bearer YOUR_API_KEY_HERE`
     - `Content-Type`: `application/json`
   - Request Body (JSON):
     - `transcription`: select the **Dictated Text** variable from step 1

3. **Get Dictionary Value** (extract the results)
   - Get value for key `results` from **Contents of URL**

4. **Show Notification** (confirm what was created)
   - Title: "Voice Todo"
   - Body: Use a **Repeat with Each** on the results to show each item's title and destination, or simply show "Done - processed X items" using the `items_processed` key

### Step 3: Add to Home Screen / Back Tap

- In the shortcut settings, tap **Add to Home Screen** for quick access
- Or go to **Settings > Accessibility > Touch > Back Tap** and assign the shortcut to a double or triple back-tap

### Minimal iOS Shortcut (Quick Version)

If you prefer a simpler setup with less feedback:

1. **Dictate Text** (Stop Listening: After Pause)
2. **Get Contents of URL**
   - POST to your endpoint with the dictated text
3. **Show Notification**: "Todo captured"

---

## Android Setup (Tasker + AutoVoice)

### Option A: Tasker (most flexible)

#### Install Required Apps
- [Tasker](https://play.google.com/store/apps/details?id=net.dinglisch.android.taskerm) (paid)
- Or use [MacroDroid](https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid) (free alternative - see Option B)

#### Create the Task

1. Open Tasker, go to the **Tasks** tab
2. Tap **+**, name it **"Voice Todo"**
3. Add these actions:

**Action 1: Get Voice** (Input > Get Voice)
- Language: English

**Action 2: HTTP Request** (Net > HTTP Request)
- Method: POST
- URL: `https://your-server-domain.com/api/voice-todo`
- Headers:
  ```
  Authorization: Bearer YOUR_API_KEY_HERE
  Content-Type: application/json
  ```
- Body: `{"transcription": "%VOICE"}`

**Action 3: Flash** (Alert > Flash)
- Text: `Todo captured`

#### Create a Home Screen Widget
1. Long-press your home screen > Widgets
2. Find Tasker > Task Shortcut
3. Select the "Voice Todo" task

### Option B: MacroDroid (free)

1. Install [MacroDroid](https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid)
2. Create a new Macro:
   - **Trigger**: Widget Button (or Shortcut Tile)
   - **Action 1**: "Speech to Text" (under Device Actions)
   - **Action 2**: "HTTP Request" (under Connectivity)
     - URL: `https://your-server-domain.com/api/voice-todo`
     - Method: POST
     - Headers: `Authorization: Bearer YOUR_API_KEY_HERE`
     - Content Type: `application/json`
     - Body: `{"transcription": "{user_input}"}`
   - **Action 3**: "Display Notification" - "Todo captured"
3. Add the MacroDroid widget to your home screen

### Option C: HTTP Shortcuts App (simplest)

1. Install [HTTP Shortcuts](https://play.google.com/store/apps/details?id=ch.rmy.android.http_shortcuts)
2. Create a new shortcut:
   - Method: POST
   - URL: `https://your-server-domain.com/api/voice-todo`
   - Request Headers:
     - `Authorization`: `Bearer YOUR_API_KEY_HERE`
     - `Content-Type`: `application/json`
   - Request Body: `{"transcription": "{%voice_input}"}`
   - Under "Scripting" > "Before Execution", add a "Voice Input" prompt
3. Place the shortcut on your home screen

---

## API Reference

### `POST /api/voice-todo`

**Headers:**
```
Authorization: Bearer <VOICE_TODO_API_KEY>
Content-Type: application/json
```

**Body:**
```json
{
  "transcription": "prune the roses at Stoller and order more bark mulch",
  "classify_only": false
}
```

- `transcription` (required): The voice-transcribed text. Max 10,000 characters.
- `classify_only` (optional): Set to `true` to see how items are classified without actually creating tasks.

**Response:**
```json
{
  "success": true,
  "items_processed": 2,
  "results": [
    {
      "title": "Prune the roses",
      "destination": "notion",
      "success": true,
      "url": "https://notion.so/page-id",
      "client_name": "Stoller"
    },
    {
      "title": "Order bark mulch",
      "destination": "clickup",
      "success": true,
      "url": "https://app.clickup.com/task/123",
      "clickup_list": "supplies_errands"
    }
  ],
  "errors": []
}
```

---

## Tips

- **Speak naturally.** The AI handles conversational phrasing like "oh and also remember to..." or "next time I'm at Patterson check the drainage."
- **Multiple items in one go.** You can list several tasks in a single voice note and they'll be split and routed individually.
- **Test with classify_only first.** Set `classify_only: true` in the request body to see how your voice notes get parsed without creating any tasks. This is useful when dialing in your phrasing.
- **Keep it concise.** Short, clear notes classify more accurately than long rambling ones.
