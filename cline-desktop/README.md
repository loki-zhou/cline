# Cline Desktop

Cline Desktop is the desktop application version of the Cline project, built with Electron, fully reusing the webview-ui and core logic from the src/ directory.

## Architecture Overview

Cline Desktop is based on the following core components:

1. **Electron Main Process**: Responsible for creating windows, managing application lifecycle, and interacting with the operating system
2. **Cline Core Service**: Reuses standalone runtime code from src/standalone
3. **gRPC Communication Bridge**: Passes gRPC requests between the Electron renderer process and main process via IPC
4. **Webview UI**: Reuses the existing webview-ui React application as the renderer process interface

### Detailed Architecture Analysis

The Cline Desktop architecture follows a clear separation of concerns across different layers:

#### Backend Service Layer (`src/standalone/`)
- **`cline-core.ts`**: Core business logic and service orchestration
- **`protobus-service.ts`**: Protocol buffer service implementation
- **`vscode-context.ts`**: VSCode context adaptation for standalone mode
- **`utils.ts`**: Shared utility functions
- **`vscode-context-utils.ts`**: VSCode context utility functions

This layer provides the core Cline functionality independent of any UI framework.

#### Frontend Integration Layer (`webview-ui/src/electron/`)
- **`webview-integration.ts`**: Main integration API between React UI and Electron
- **`webview-bridge.ts`**: Communication bridge handling IPC between renderer and main process
- **`index.ts`**: Public API exports for the integration layer

This layer is essential for bridging the gap between the webview-ui React application and the Electron environment.

#### Communication Flow Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   webview-ui    │◄──►│ webview-bridge   │◄──►│ Electron Main   │
│  (React App)    │    │  (IPC Bridge)    │    │   Process       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                               ┌─────────────────┐
                                               │  src/standalone │
                                               │  (Core Service) │
                                               └─────────────────┘
```

#### Why Both Layers Are Necessary

1. **Different Responsibilities**:
   - `src/standalone` = Backend service layer (business logic, gRPC services)
   - `webview-ui/src/electron` = Frontend integration layer (UI ↔ Electron communication)

2. **Communication Bridge Requirements**:
   The webview-ui React application needs specialized interfaces to communicate with Electron:
   - Environment detection (`isElectron()`, `isStandalone()`)
   - Message passing (`sendMessage()`, `onMessage()`)
   - gRPC communication (`grpcUnaryCall()`, `grpcStreamingCall()`)

3. **Automated Integration**:
   The `setup-webview-integration.js` script automatically copies integration files from `cline-desktop/src/` to `webview-ui/src/electron/`, ensuring version synchronization and proper integration.

This layered architecture ensures clean separation between core business logic and UI integration concerns, making the codebase maintainable and extensible.
# Cline Desktop

Cline Desktop is the desktop application version of the Cline project, built with Electron, fully reusing the webview-ui and core logic from the src/ directory.


## Development Guide

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm 9+

### Installation

```bash
# Clone the repository if you haven't already
git clone https://github.com/cline/cline.git
cd cline

# Install dependencies for the main project
npm install

# Install dependencies for the desktop app
cd cline-desktop
npm install
```

### Development Mode

```bash
# From the cline-desktop directory
npm start
```

This will:
1. Run the setup-webview-integration script to copy necessary files to webview-ui
2. Start the Electron application in development mode

### Building the Application

```bash
# From the cline-desktop directory
npm run make
```

This will create platform-specific distributables in the `out` directory.

## Project Structure

- `src/index.ts`: Electron main process entry point
- `src/preload.ts`: Preload script that provides secure IPC communication bridge
- `src/renderer.ts`: Renderer process entry point
- `src/electron-adapter.ts`: Adapter for Electron-specific functionality
- `src/webview-bridge.ts`: Bridge between webview-ui and Electron
- `src/webview-integration.ts`: Integration layer for webview-ui
- `scripts/setup-webview-integration.js`: Script to copy integration files to webview-ui
- `forge.config.ts`: Electron Forge configuration file

## Communication Flow

1. Webview UI sends gRPC requests through the electron_bridge
2. Main process receives requests and forwards them to the locally running Cline Core service
3. Responses are returned to the renderer process via IPC

## Integration with webview-ui

The integration with webview-ui is handled by:

1. `setup-webview-integration.js`: Copies necessary files to webview-ui/src/electron
2. `webview-bridge.ts`: Provides a bridge between webview-ui and Electron
3. `webview-integration.ts`: Provides an API for webview-ui to interact with Electron

To use the Electron integration in webview-ui components:

```typescript
import { isElectron, isStandalone, grpcUnaryCall } from '../electron';

// Check if running in Electron
if (isElectron()) {
  console.log('Running in Electron');
  
  // Make a gRPC call
  const response = await grpcUnaryCall('cline.StateService', 'GetState', {});
}
```

## Building and Publishing

Electron Forge handles packaging and publishing of the application. It supports Windows, macOS, and Linux platforms.

### Packaging for Different Platforms

```bash
# Package for current platform
npm run package

# Make distributables for current platform
npm run make
```

## Troubleshooting

### Common Issues

1. **Missing dependencies**: Make sure you've run `npm install` in both the root directory and the cline-desktop directory.

2. **Integration issues with webview-ui**: Run `npm run setup-webview` to manually copy the integration files.

3. **gRPC communication errors**: Check that the Cline Core service is running properly and that the ports are not blocked.

### Debugging

To enable more detailed logging:

1. Set the environment variable `DEBUG=electron-forge:*` before running any commands.
2. Open DevTools in the running application with Ctrl+Shift+I (or Cmd+Option+I on macOS).
