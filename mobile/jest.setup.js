/* eslint-disable no-undef */

// Global fetch mock
global.fetch = jest.fn();

// Mock console warnings/errors to keep test output clean while capturing actionable errors
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};

// 1. Mock React Native NativeModules & Platform
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter', () => {
  return jest.fn().mockImplementation(() => ({
    addListener: jest.fn(),
    removeListeners: jest.fn(),
  }));
});

// 2. Mock Expo Audio
jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: jest.fn().mockResolvedValue({ granted: true, status: 'granted' }),
  AudioRecorder: jest.fn().mockImplementation(() => ({
    prepareToRecordAsync: jest.fn().mockResolvedValue({}),
    recordAsync: jest.fn().mockResolvedValue({}),
    stopAsync: jest.fn().mockResolvedValue({}),
    getURI: jest.fn().mockReturnValue('file:///mock/audio/recording.m4a'),
    getStatusAsync: jest.fn().mockResolvedValue({ isRecording: true }),
  })),
  RecordingPresets: {
    HIGH_QUALITY: {},
    LOW_QUALITY: {},
  },
}));

// 3. Mock Expo Sensors (Accelerometer)
const mockAccelerometerListeners = new Set();
jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn().mockResolvedValue(true),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn((callback) => {
      mockAccelerometerListeners.add(callback);
      return {
        remove: () => mockAccelerometerListeners.delete(callback),
      };
    }),
    removeAllListeners: jest.fn(() => mockAccelerometerListeners.clear()),
    _emit: (x, y, z) => {
      mockAccelerometerListeners.forEach((cb) => cb({ x, y, z }));
    },
  },
}));

// 4. Mock Expo Location
const mockLocationListeners = new Set();
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  requestBackgroundPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted', granted: true }),
  hasServicesEnabledAsync: jest.fn().mockResolvedValue(true),
  enableNetworkProviderAsync: jest.fn().mockResolvedValue(true),
  getCurrentPositionAsync: jest.fn().mockResolvedValue({
    coords: {
      latitude: 40.7128,
      longitude: -74.0060,
      altitude: 10,
      accuracy: 5,
      speed: 1.2,
      heading: 90,
    },
    timestamp: Date.now(),
  }),
  getLastKnownPositionAsync: jest.fn().mockResolvedValue({
    coords: {
      latitude: 40.7128,
      longitude: -74.0060,
      altitude: 10,
      accuracy: 5,
      speed: 1.2,
      heading: 90,
    },
    timestamp: Date.now(),
  }),
  watchPositionAsync: jest.fn((options, callback) => {
    mockLocationListeners.add(callback);
    return Promise.resolve({
      remove: () => mockLocationListeners.delete(callback),
    });
  }),
  Accuracy: {
    High: 4,
    Balanced: 3,
    Lowest: 1,
  },
  _emitLocation: (lat, lng, accuracy, speed) => {
    mockLocationListeners.forEach((cb) =>
      cb({
        coords: { latitude: lat, longitude: lng, altitude: 0, accuracy: accuracy || 5, speed: speed || 1.0, heading: 0 },
        timestamp: Date.now(),
      })
    );
  },
}));

// 5. Mock Expo Battery
const mockBatteryListeners = new Set();
jest.mock('expo-battery', () => ({
  getBatteryLevelAsync: jest.fn().mockResolvedValue(0.85),
  getBatteryStateAsync: jest.fn().mockResolvedValue(1), // UNPLUGGED
  isLowPowerModeEnabledAsync: jest.fn().mockResolvedValue(false),
  addBatteryLevelListener: jest.fn((callback) => {
    mockBatteryListeners.add(callback);
    return { remove: () => mockBatteryListeners.delete(callback) };
  }),
  addBatteryStateListener: jest.fn(() => {
    return { remove: jest.fn() };
  }),
  BatteryState: {
    UNKNOWN: 0,
    UNPLUGGED: 1,
    CHARGING: 2,
    FULL: 3,
  },
  _emitBatteryLevel: (level) => {
    mockBatteryListeners.forEach((cb) => cb({ batteryLevel: level }));
  },
}));

// 6. Mock Custom Native Module: guardian-audio
jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn((moduleName) => {
    if (moduleName === 'GuardianAudio') {
      return {
        startSpotter: jest.fn().mockResolvedValue(true),
        stopSpotter: jest.fn().mockResolvedValue(true),
        isSpotterRunning: jest.fn().mockReturnValue(true),
        addListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
        removeListeners: jest.fn(),
      };
    }
    return {};
  }),
}));

// 7. Mock Socket.io-client
export class MockSocket {
  constructor() {
    this.id = 'mock-socket-id-123';
    this.connected = true;
    this.eventHandlers = new Map();
    this.emit = jest.fn((event, data, callback) => {
      if (callback) callback({ success: true });
      return this;
    });
    this.disconnect = jest.fn(() => {
      this.connected = false;
      this._trigger('disconnect', 'io client disconnect');
      return this;
    });
    this.connect = jest.fn(() => {
      this.connected = true;
      this._trigger('connect');
      return this;
    });
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
    return this;
  }

  off(event, handler) {
    if (!handler) {
      this.eventHandlers.delete(event);
    } else {
      const handlers = this.eventHandlers.get(event) || [];
      this.eventHandlers.set(
        event,
        handlers.filter((h) => h !== handler)
      );
    }
    return this;
  }

  // Helper for test assertions
  _trigger(event, ...args) {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach((h) => h(...args));
  }

  _clearAll() {
    this.eventHandlers.clear();
    this.emit.mockClear();
  }
}

export const mockSocketInstance = new MockSocket();

jest.mock('socket.io-client', () => {
  return jest.fn(() => mockSocketInstance);
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  if (global.fetch && typeof global.fetch.mockClear === 'function') {
    global.fetch.mockClear();
  }
});
