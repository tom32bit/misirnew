# Misir - Intelligent Web Content Capture Extension

A powerful Chrome extension that intelligently captures and organizes web content across multiple AI chat platforms. Misir helps you save, categorize, and retrieve web content efficiently while integrating seamlessly with your favorite AI assistants.

## Features

✨ **Multi-Platform AI Chat Integration**
- Support for 9+ AI chat platforms:
  - ChatGPT
  - Claude (Anthropic)
  - Perplexity
  - DeepSeek
  - Grok
  - Gemini (Google)
  - Copilot (Microsoft)
  - NotebookLM
  - Kimi

📝 **Intelligent Content Capture**
- Web content extraction and readability optimization
- Automatic URL normalization and duplicate detection
- Natural Language Processing (NLP) for content understanding
- Article readability using Mozilla's Readability library

🗂️ **Smart Organization**
- Organize content into Spaces and Subspaces
- Create flexible markers and tags for categorization
- Full-text search capabilities
- Hierarchical content structure

☁️ **Cloud Synchronization**
- Supabase integration for cloud storage
- Offline-first local caching with IndexedDB
- Automatic sync of pending artifacts
- Seamless multi-device support

🔐 **Privacy & Security**
- Local-first architecture with optional cloud sync
- Secure authentication handling
- Content blocklist management
- Extension-only data storage

## Tech Stack

### Frontend
- **React 18.3** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Vite** - Build tool & dev server
- **Radix UI** - Accessible UI components

### State Management & Data
- **Zustand** - Lightweight state management
- **TanStack React Query** - Data fetching & caching
- **Dexie** - IndexedDB wrapper
- **Supabase** - Backend-as-a-service

### Content Processing
- **wink-nlp** - Natural language processing
- **Mozilla Readability** - Article extraction
- **Sonner** - Toast notifications

### Development
- **Vitest** - Unit testing
- **CRXJS** - Chrome extension build plugin
- **PostCSS** - CSS processing

## Project Structure

```
src/
├── adapters/          # AI chat platform adapters
│   ├── chatgpt.ts
│   ├── claude.ts
│   ├── copilot.ts
│   ├── deepseek.ts
│   ├── gemini.ts
│   ├── grok.ts
│   ├── kimi.ts
│   ├── notebooklm.ts
│   ├── perplexity.ts
│   ├── types.ts
│   └── index.ts
├── background/        # Service worker
│   └── index.ts
├── components/        # React components
│   ├── login-form.tsx
│   └── ui/           # UI component library
├── content/          # Content scripts
│   ├── ai-chat.ts   # AI chat engagement
│   ├── engagement.ts
│   └── index.ts
├── hooks/            # Custom React hooks
│   ├── useAuth.ts
│   ├── useBlocklist.ts
│   ├── useDBStatus.ts
│   └── useLibraryStatus.ts
├── lib/              # Utilities & helpers
│   ├── db.ts        # IndexedDB setup (Dexie)
│   ├── supabase.ts  # Supabase client
│   ├── capture.ts   # Content capture logic
│   ├── matching.ts  # Content matching algorithm
│   ├── nlp.ts       # NLP utilities
│   ├── blocklist.ts # Blocklist management
│   └── utils.ts     # General utilities
├── types/            # TypeScript type definitions
│   ├── chat.ts
│   └── index.ts
├── options/         # Extension options page
│   ├── App.tsx
│   ├── main.tsx
│   └── index.html
├── popup/           # Extension popup
│   ├── App.tsx
│   ├── main.tsx
│   └── index.html
├── sidepanel/       # Extension side panel
│   ├── App.tsx
│   ├── main.tsx
│   └── index.html
└── styles/          # Global styles
    └── globals.css
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Chrome/Chromium browser

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Misir-extension
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

### Development

**Start development server:**
```bash
npm run dev
```

This will:
- Start Vite dev server for hot module reloading
- Watch for file changes
- Build the extension in development mode

**Load the extension in Chrome:**
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `dist/` directory

### Building for Production

```bash
npm run build
```

Creates an optimized production build in the `dist/` directory.

### Testing

```bash
npm run test          # Run tests
npm run coverage      # Run tests with coverage report
```

## Key Components

### Adapters
Each AI chat platform has a dedicated adapter that handles:
- URL pattern matching
- Authentication token extraction
- Conversation context retrieval
- Platform-specific interactions

### Content Capture
The capture system:
- Extracts main article content
- Normalizes URLs
- Detects duplicate content
- Queues artifacts for sync

### Matching Algorithm
Multi-stage matching for intelligent content organization:
1. **Stage 1**: Exact URL matching
2. **Stage 2**: Normalized URL matching
3. **Stage 3**: Content-based similarity matching

### Database Structure

**Local Database (IndexedDB via Dexie):**
- `spaces` - Top-level organization units
- `subspaces` - Sub-categories within spaces
- `markers` - Tags and markers
- `subspaceMarkers` - Marker associations
- `pendingArtifacts` - Unsynced captured content

**Cloud Database (Supabase):**
- Synchronized copies of all data structures
- User authentication
- Sync status tracking

## Content Scripts

### Main Content Script (`src/content/index.ts`)
- Runs on all websites
- Captures web content
- Handles page engagement
- Injects UI elements

### AI Chat Script (`src/content/ai-chat.ts`)
- Runs on supported AI chat platforms
- Extracts chat context
- Handles special authentication (e.g., ChatGPT auth tokens)
- Enables chat-specific features

## Environment Configuration

Create a `.env` file with:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Write or update tests
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style
- Use TypeScript for type safety
- Follow existing code patterns
- Write tests for new functionality
- Keep components small and focused

## Performance Considerations

- **Lazy Loading**: Content scripts load only on matching URLs
- **Local Caching**: IndexedDB for instant access to synced data
- **Batch Syncing**: Pending artifacts sync in batches
- **Efficient Matching**: Three-stage matching prevents unnecessary processing

## Troubleshooting

### Extension not loading?
1. Check Chrome version compatibility (Manifest v3)
2. Verify all dependencies are installed: `npm install`
3. Clear the extension cache: `chrome://extensions/` → Clear cache
4. Rebuild: `npm run build`

### Sync issues?
1. Verify Supabase credentials in `.env`
2. Check network connection
3. Review browser console for errors
4. Check `pendingArtifacts` queue status

### Content not capturing?
1. Verify the website isn't on the blocklist
2. Check content script matches in `manifest.json`
3. Review content readability settings
4. Test on different websites

## License

[Add your license here]

## Support

For issues, feature requests, or contributions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section above

## Changelog

### v0.1.0
- Initial release
- Support for 9 AI chat platforms
- Local and cloud storage
- Content capture and organization
- NLP-powered content understanding

---

**Made with ❤️ for intelligent content capture**
