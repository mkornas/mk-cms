/** Jest config for the mk-cms API. Unit tests live next to the code as
 * `*.spec.ts`; ts-jest compiles them with `tsconfig.spec.json` (which adds the
 * jest ambient types) so decorators + metadata behave exactly as at runtime. */
module.exports = {
  testEnvironment: 'node',
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  setupFiles: ['<rootDir>/../jest.setup.js'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/../tsconfig.spec.json' }],
  },
  collectCoverageFrom: ['**/*.ts', '!**/*.spec.ts', '!main.ts', '!**/*.module.ts'],
  coverageDirectory: '../coverage',
};
