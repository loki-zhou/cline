/**
 * Setup Webview Integration Script
 *
 * This script copies the necessary integration files from the cline-desktop/src directory
 * to the webview-ui/src directory to enable Electron integration with the webview-ui React application.
 */

const fs = require("fs")
const path = require("path")

// Define paths
const DESKTOP_SRC_DIR = path.join(__dirname, "..", "src")
const WEBVIEW_UI_SRC_DIR = path.join(__dirname, "..", "..", "webview-ui", "src")
const ELECTRON_INTEGRATION_DIR = path.join(WEBVIEW_UI_SRC_DIR, "electron")

// Files to copy
const FILES_TO_COPY = [
	{
		source: "webview-bridge.ts",
		destination: path.join("electron", "webview-bridge.ts"),
	},
	{
		source: "webview-integration.ts",
		destination: path.join("electron", "webview-integration.ts"),
	},
]

// Create the electron directory in webview-ui/src if it doesn't exist
function createElectronDirectory() {
	if (!fs.existsSync(ELECTRON_INTEGRATION_DIR)) {
		console.log(`Creating directory: ${ELECTRON_INTEGRATION_DIR}`)
		fs.mkdirSync(ELECTRON_INTEGRATION_DIR, { recursive: true })
	}
}

// Copy the integration files
function copyIntegrationFiles() {
	FILES_TO_COPY.forEach((file) => {
		const sourcePath = path.join(DESKTOP_SRC_DIR, file.source)
		const destinationPath = path.join(WEBVIEW_UI_SRC_DIR, file.destination)

		console.log(`Copying ${sourcePath} to ${destinationPath}`)

		try {
			const content = fs.readFileSync(sourcePath, "utf8")
			fs.writeFileSync(destinationPath, content, "utf8")
			console.log(`Successfully copied ${file.source}`)
		} catch (error) {
			console.error(`Error copying ${file.source}:`, error)
		}
	})
}

// Create an index.ts file in the electron directory
function createIndexFile() {
	const indexPath = path.join(ELECTRON_INTEGRATION_DIR, "index.ts")
	const content = `/**
 * Electron Integration for Cline Desktop
 * 
 * This file exports the Electron integration API for use in the webview-ui React application.
 */

export * from './webview-integration';
`

	console.log(`Creating index file: ${indexPath}`)
	fs.writeFileSync(indexPath, content, "utf8")
}

// Create a README.md file in the electron directory
function createReadmeFile() {
	const readmePath = path.join(ELECTRON_INTEGRATION_DIR, "README.md")
	const content = `# Electron Integration for Cline Desktop

This directory contains the integration files for the Cline Desktop Electron application.

## Files

- \`index.ts\`: Exports the Electron integration API
- \`webview-integration.ts\`: Provides integration between the webview-ui React application and the Electron desktop environment
- \`webview-bridge.ts\`: Provides a bridge between the webview-ui React application and the Electron environment

## Usage

To use the Electron integration in your React components:

\`\`\`typescript
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
    console.log(\`Received message: \${command}\`, payload);
  });
  
  // Clean up when component unmounts
  return () => cleanup();
}
\`\`\`

## gRPC Communication

The integration also provides gRPC communication with the Cline Core service:

\`\`\`typescript
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
\`\`\`

## Note

These files are automatically copied from the \`cline-desktop/src\` directory by the \`setup-webview-integration.js\` script.
Do not modify these files directly, as your changes will be overwritten.
`

	console.log(`Creating README file: ${readmePath}`)
	fs.writeFileSync(readmePath, content, "utf8")
}

// Main function
function main() {
	console.log("Setting up webview integration...")

	createElectronDirectory()
	copyIntegrationFiles()
	createIndexFile()
	createReadmeFile()

	console.log("Webview integration setup complete!")
}

// Run the script
main()
