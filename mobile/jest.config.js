module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[jt]sx?$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|lucide-react-native|socket.io-client)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: [
    '<rootDir>/__tests__/**/*.test.[jt]s?(x)',
    '<rootDir>/src/**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^react-native/setup-env$': '<rootDir>/node_modules/react-native/src/private/setup/setUpDefaultReactNativeEnvironment.js',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^guardian-audio$': '<rootDir>/modules/guardian-audio',
  },
  collectCoverageFrom: [
    'src/services/audioRingBuffer.ts',
    'src/services/hardwareSnatchService.ts',
    'src/services/hardwareLocationService.ts',
    'src/services/hardwareBatteryService.ts',
    'src/services/emergencySmsService.ts',
    'src/services/authService.ts',
    'src/components/CitizenAuth.tsx',
    '!src/**/*.d.ts',
    '!src/types/**/*',
    '!src/utils/logger.ts',
    '!**/node_modules/**',
  ],
  coverageThreshold: {
    './src/services/audioRingBuffer.ts': {
      functions: 100,
      lines: 100,
      statements: 100,
    },
    './src/services/hardwareSnatchService.ts': {
      functions: 70,
      lines: 70,
      statements: 70,
    },
    './src/services/emergencySmsService.ts': {
      branches: 70,
      functions: 70,
      lines: 80,
      statements: 80,
    },
    './src/services/hardwareBatteryService.ts': {
      functions: 30,
      lines: 50,
      statements: 50,
    },
    './src/services/authService.ts': {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageReporters: ['json', 'lcov', 'text', 'text-summary', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/android/',
    '/ios/',
    '/.expo/',
    '/modules/guardian-audio/android/',
  ],
};
