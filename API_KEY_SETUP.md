# API Key Setup Guide

## Development Mode

1. Create a `.env.local` file in the project root (if it doesn't exist)
2. Add your Gemini API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
3. The app will automatically load this file when running in development mode

## Packaged App (Executable)

For the packaged Electron app, you have two options:

### Option 1: Build with API Key (Recommended for personal use)

The API key will be baked into the executable during build. Make sure your `.env.local` file exists before building:
```bash
npm run electron:build
```

### Option 2: Runtime Configuration (Recommended for distribution)

Create a config file that the app can read at runtime:

1. Navigate to your user data directory:
   - **Windows**: `%APPDATA%\ids-sentinel\`
   - **macOS**: `~/Library/Application Support/ids-sentinel/`
   - **Linux**: `~/.config/ids-sentinel/`

2. Create a file named `config.env` in that directory

3. Add your API key:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

The app will automatically read from this file when it runs.

## Getting Your API Key

Get your Gemini API key from: https://aistudio.google.com/apikey

## Security Notes

- Never commit `.env.local` or `config.env` to version control
- The `.env.local` file is already in `.gitignore`
- For distributed apps, consider using Option 2 (runtime config) to avoid embedding the key



