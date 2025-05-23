// __tests__/index.main.test.js

describe('App Singleton Behavior (Focused)', () => {

  beforeEach(() => {
    jest.resetModules(); // Ensure a clean slate for modules and mocks
  });

  test('should quit if lock is NOT acquired', () => {
    const mockApp = {
      requestSingleInstanceLock: jest.fn().mockReturnValue(false),
      quit: jest.fn(),
      // Mock whenReady to prevent its .then() block (containing createWindow) from executing
      whenReady: jest.fn(() => ({ 
        then: jest.fn(), // This effectively stops createWindow from being called
      })),
      // Minimal other app properties if src/index.js accesses them before quitting
      isPackaged: false, 
      getPath: jest.fn().mockReturnValue('dummy-path'),
      getName: jest.fn().mockReturnValue('TestApp'),
    };

    // We will also need to mock ipcMain if it's accessed before quit
    const mockIpcMain = { handle: jest.fn() };


    jest.doMock('electron', () => ({
      app: mockApp,
      ipcMain: mockIpcMain, 
      BrowserWindow: jest.fn(), // Should not be called
    }), { virtual: true });

    require('../src/index.js'); 

    expect(mockApp.requestSingleInstanceLock).toHaveBeenCalledTimes(1);
    expect(mockApp.quit).toHaveBeenCalledTimes(1);
    
    // Verify that whenReady was called, but its .then() callback (createWindow) was not.
    // Checking that BrowserWindow constructor was not called is a good proxy for this.
    const { BrowserWindow } = require('electron'); // Get the mocked constructor
    expect(BrowserWindow).not.toHaveBeenCalled();
  });

  test('should register second-instance handler if lock IS acquired (and not fully init window)', () => {
    let capturedSecondInstanceCallback;
    const mockApp = {
      requestSingleInstanceLock: jest.fn().mockReturnValue(true),
      quit: jest.fn(),
      on: jest.fn((event, callback) => { // Capture the callback
        if (event === 'second-instance') {
          capturedSecondInstanceCallback = callback;
        }
      }),
      whenReady: jest.fn(() => ({ // Mock .then() to prevent execution of createWindow
        then: jest.fn(), 
      })),
      isPackaged: false,
      getPath: jest.fn().mockReturnValue('dummy-path'),
      getName: jest.fn().mockReturnValue('TestApp'),
    };
    // ipcMain.handle is called when lock is acquired
    const mockIpcMain = { handle: jest.fn() };


    jest.doMock('electron', () => ({
      app: mockApp,
      ipcMain: mockIpcMain,
      BrowserWindow: jest.fn(), // Should not be called
    }), { virtual: true });

    require('../src/index.js');

    expect(mockApp.requestSingleInstanceLock).toHaveBeenCalledTimes(1);
    expect(mockApp.quit).not.toHaveBeenCalled();
    expect(mockApp.on).toHaveBeenCalledWith('second-instance', expect.any(Function));
    expect(capturedSecondInstanceCallback).toBeInstanceOf(Function); // Check it was captured
    
    const { BrowserWindow } = require('electron'); // Get the mocked constructor
    expect(BrowserWindow).not.toHaveBeenCalled(); // createWindow was not called
  });

  describe('Isolated second-instance Handler Logic', () => {
    
    // Helper function to set up the environment for testing the second-instance handler
    // It mocks Electron, requires src/index.js, and returns the captured handler.
    // The key is that it mocks BrowserWindow constructor to return mockInternalWindow.
    const setupAndGetHandler = async (mockInternalWindow) => {
      jest.resetModules(); // Isolate each call to this setup

      const mockAppSetup = {
        requestSingleInstanceLock: jest.fn().mockReturnValue(true),
        quit: jest.fn(),
        on: jest.fn(), // The handler will be captured here
        whenReady: jest.fn().mockResolvedValue(undefined), // Allows .then(createWindow) to run
        isPackaged: false,
        getPath: jest.fn().mockReturnValue('dummy-path'),
        getName: jest.fn().mockReturnValue('TestApp'),
      };
      const mockIpcMainSetup = { handle: jest.fn() };
      // This mock constructor will make src/index.js's 'mainWindow' be our 'mockInternalWindow'
      const mockBrowserWindowConstructorSetup = jest.fn(() => mockInternalWindow);

      jest.doMock('electron', () => ({
        app: mockAppSetup,
        ipcMain: mockIpcMainSetup,
        BrowserWindow: mockBrowserWindowConstructorSetup,
      }), { virtual: true });

      require('../src/index.js');
      await mockAppSetup.whenReady(); // Ensures createWindow is called and mainWindow is set

      const secondInstanceCall = mockAppSetup.on.mock.calls.find(call => call[0] === 'second-instance');
      if (!secondInstanceCall) {
        throw new Error("Second instance handler not registered by src/index.js");
      }
      return secondInstanceCall[1]; // Return the captured callback
    };

    test('Scenario A: should restore and focus window if minimized', async () => {
      const mockMainWindowForScenarioA = {
        isMinimized: jest.fn().mockReturnValue(true),
        restore: jest.fn(),
        focus: jest.fn(),
        // Include isDestroyed if the handler checks it, though the original doesn't explicitly.
        // It's good practice for a robust mock.
        isDestroyed: jest.fn().mockReturnValue(false), 
      };
      
      const handler = await setupAndGetHandler(mockMainWindowForScenarioA);
      handler(null, [], ''); // Invoke the captured handler

      expect(mockMainWindowForScenarioA.isMinimized).toHaveBeenCalledTimes(1);
      expect(mockMainWindowForScenarioA.restore).toHaveBeenCalledTimes(1);
      expect(mockMainWindowForScenarioA.focus).toHaveBeenCalledTimes(1);
    });

    test('Scenario B: should only focus window if not minimized', async () => {
      const mockMainWindowForScenarioB = {
        isMinimized: jest.fn().mockReturnValue(false),
        restore: jest.fn(),
        focus: jest.fn(),
        isDestroyed: jest.fn().mockReturnValue(false),
      };

      const handler = await setupAndGetHandler(mockMainWindowForScenarioB);
      handler(null, [], '');

      expect(mockMainWindowForScenarioB.isMinimized).toHaveBeenCalledTimes(1);
      expect(mockMainWindowForScenarioB.restore).not.toHaveBeenCalled();
      expect(mockMainWindowForScenarioB.focus).toHaveBeenCalledTimes(1);
    });

    test('Scenario C: should do nothing if mainWindow is null', async () => {
      // setupAndGetHandler will ensure BrowserWindow constructor returns null
      const handler = await setupAndGetHandler(null); 
      
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // The handler in src/index.js has 'if (mainWindow)'. This should prevent errors.
      expect(() => handler(null, [], '')).not.toThrow();
      // Also ensure no console errors were logged due to trying to access methods on null
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
