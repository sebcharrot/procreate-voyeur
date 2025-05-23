// jest.setup.js
// Global setup for Jest tests - keep this minimal.
// Per-test mocks using jest.doMock will provide most of the behavior.

// You might still want some very generic app properties globally mocked if many tests use them.
jest.mock('electron', () => {
  const originalElectron = jest.requireActual('electron'); // Fallback for unmocked parts
  return {
    ...originalElectron, // Keep other parts of electron like 'shell' if used without specific mocks
    app: {
      // Provide only truly global defaults or leave empty if all setup is per-test
      isPackaged: false,
      getPath: jest.fn(name => {
        if (name === 'userData') return '/mock/userData';
        return 'dummy-path';
      }),
      getName: jest.fn().mockReturnValue('MockedApp'),
      // requestSingleInstanceLock, quit, on, whenReady will be mocked per-test
    },
    ipcMain: {
      // handle, on will be mocked per-test
    },
    BrowserWindow: jest.fn(), // Basic constructor mock, will be detailed per-test
  };
}, { virtual: true }); // virtual: true is important for global mocks

// Clear any specific global instances if created by a previous setup
global.mockElectron = undefined; 
global.resetMockBrowserWindowInstance = undefined;
