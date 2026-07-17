export default {
  testEnvironment: 'node',
  verbose: true,
  testTimeout: 30000,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { useESM: true }]
  },
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};
