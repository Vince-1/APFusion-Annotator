# APFusion Annotator

A web-based annotation tool for medical image analysis with dual-viewer pair editing and auto-pairing capabilities.

## Project Structure

```
apfusion/
├── src/
│   ├── config/              # Configuration management
│   ├── io/                  # Data loading and persistence
│   ├── pairing/             # Auto-pairing workflows and pair manipulation
│   ├── state/               # State management and analysis
│   ├── ui/                  # User interface state and components
│   ├── utils/               # Common utilities
│   ├── viewer/              # Canvas viewers and rendering
│   ├── main.js              # Application entry point and orchestrator
│   └── store.js             # Centralized state store
├── styles/                  # CSS styles
├── index.html               # Main HTML file
└── README.md               # This file
```

## Features

- **Dual Viewer**: Side-by-side image viewing and annotation
- **Auto-Pairing**: Intelligent image pairing based on similarity
- **Draft Mode**: Non-destructive editing with undo/redo support
- **Conflict Detection**: Identify and resolve annotation conflicts
- **Form Synchronization**: Automatic sync between image annotations and form data
- **Backend Integration**: Save annotations to server
- **Dataset Presets**: Load predefined dataset configurations

## Module Architecture

### Pairing Domain
- **autoPairWorkflows.js**: Auto-pairing operation orchestration
- **pairRecordUtils.js**: Pair record manipulation utilities

### Viewer Domain
- **renderOrchestrator.js**: High-level render coordination
- **viewerFlows.js**: Canvas rendering and interaction handling

### UI Domain
- **editorUiState.js**: Display mode and cursor state management
- **editSession.js**: Edit workflow orchestration and dirty tracking

### I/O Domain
- **datasetFlows.js**: Data loading and dataset management
- **persistenceActions.js**: Save operations and backend persistence

### State Domain
- **pairCoverage.js**: Coverage analysis and pair integrity

### Utils Domain
- **common.js**: Common utilities (JSON, HTML operations)

## Development

### Setup
```bash
# Open index.html in a web browser
# The tool loads datasets defined in the backend configuration
```

### Build & Run
- No build step required - runs in browser
- Backend API endpoints must be configured in the application

### Code Organization
- Dependency injection pattern for modularity
- State management via centralized store object
- Flow-based architecture for orchestration

## Recent Refactoring

**main.js Modularization (2026-04-14)**
- Reduced from 1324 to 1005 lines (-24%)
- Created 10 specialized domain modules
- Maintained zero syntax errors throughout
- Improved maintainability and testability

## License

[Your License Here]
