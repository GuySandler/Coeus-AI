# Coeus AI

A Chrome extension that provides AI-powered academic assistance integrated directly into Canvas LMS.

## Features

- **Automatic Canvas URL Detection**: Automatically detects your Canvas domain when opened on a Canvas page
- **Smart Setup Process**: Streamlined setup that only requires your Canvas API key
- **Schedule Integration**: Drag-and-drop interface to map your courses to class periods
- **AI Chat Assistant**: Powered by Google Gemini AI with context about your schedule and courses
- **Settings Management**: Easy data management with options to clear chat history or reset setup

## Setup

### API Setup
1. Create a `.env` file in the API folder with the following structure:
```
SupaBaseURL="https://<Your URL>"
SupaBaseKey="<Your Key>"
GeminiKey="<Your Gemini API Key>"
FireBaseKey="<Your Firebase API Key>"
```

2. Run the API server:
```bash
cd ./API
deno run --env --allow-read --allow-env --allow-net ./main.ts
```

### Extension Setup
1. Load the extension in Chrome by navigating to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `Web Page` folder
4. Navigate to any Canvas page
5. Click the "Coeus AI" button in the Canvas navigation menu
6. Follow the setup process:
   - Canvas URL will be automatically detected
   - Enter your Canvas API key (get it from Canvas Settings > Approved Integrations)
   - Arrange your courses in the period scheduler

## Usage

Once set up, you can:
- Ask questions about your schedule: "What's my 4th period class?"
- Get help with coursework and assignments
- Receive personalized academic assistance based on your Canvas data

## Notes

- The extension is restricted from running on quiz pages to maintain academic integrity
- All data is stored locally in your browser using Chrome's storage API
- The AI assistant respects Canvas terms of service and academic policies