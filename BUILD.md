# Building IDS Sentinel Executable

## Prerequisites
- Node.js installed
- All dependencies installed (`npm install`)

## Building the Executable

1. **Build the web app:**
   ```bash
   npm run build
   ```

2. **Create the executable:**
   ```bash
   npm run electron:build
   ```

The executable will be created in the `release` folder.

## Custom Icon

The app uses an icon located at `build/icon.ico`. To replace it with your custom icon:

1. Create or obtain a `.ico` file (Windows icon format)
2. Replace `build/icon.ico` with your custom icon file
3. Rebuild the executable

## Development Mode

To run the app in development mode with Electron:

```bash
npm run electron:dev
```

This will start the Vite dev server and launch Electron.

## Notes

- The `.env.local` file is not included in the build for security reasons
- For production builds, you may need to configure environment variables differently
- The executable is built for Windows x64 architecture



