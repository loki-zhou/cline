# Electron Integration for Cline Desktop

This directory contains the integration files for the Cline Desktop Electron application.

## Files

- `index.ts`: Exports the Electron integration API
- `webview-integration.ts`: Provides integration between the webview-ui React application and the Electron desktop environment
- `webview-bridge.ts`: Provides a bridge between the webview-ui React application and the Electron environment

## Usage

To use the Electron integration in your React components:

```typescript
import { isElectron, isStandalone, sendMessage, onMessage } from '../electron';

// Check if running in Electron
if (isElectron()) {
  console.log('Running in Electron');
  
  // Check if running in standalone mode
  if (isStandalone()) {
    console.log('Running in standalone mode');
  }
  
  // Send a message to the Electron process
  sendMessage('my-command', { foo: 'bar' });
  
  // Register a message handler
  const cleanup = onMessage((command, payload) => {
    console.log(`Received message: ${command}`, payload);
  });
  
  // Clean up when component unmounts
  return () => cleanup();
}
```

## gRPC Communication

The integration also provides gRPC communication with the Cline Core service:

```typescript
import { grpcUnaryCall, grpcStreamingCall } from '../electron';

// Make a unary gRPC call
async function fetchData() {
  try {
    const response = await grpcUnaryCall('cline.StateService', 'GetState', {});
    console.log('State:', response);
  } catch (error) {
    console.error('Error fetching state:', error);
  }
}

// Make a streaming gRPC call
function streamData() {
  const { cancel } = grpcStreamingCall(
    'cline.TaskService',
    'StreamTaskEvents',
    {},
    {
      onMessage: (message) => {
        console.log('Task event:', message);
      },
      onError: (error) => {
        console.error('Stream error:', error);
      },
      onComplete: () => {
        console.log('Stream complete');
      }
    }
  );
  
  // Cancel the stream when done
  return () => cancel();
}
```

## Note

These files are automatically copied from the `cline-desktop/src` directory by the `setup-webview-integration.js` script.
Do not modify these files directly, as your changes will be overwritten.
