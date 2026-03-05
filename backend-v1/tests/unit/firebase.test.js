const path = require('path');

describe('firebase.js', () => {
  let originalEnv;
  beforeEach(() => {
    originalEnv = process.env.SERVICE_ACCOUNT_KEY;
    jest.resetModules();
  });
  afterEach(() => {
    process.env.SERVICE_ACCOUNT_KEY = originalEnv;
    jest.restoreAllMocks();
  });

  test('loads service account from env', () => {
    process.env.SERVICE_ACCOUNT_KEY = JSON.stringify({ project_id: 'test' });
    const admin = {
      credential: { cert: jest.fn() },
      initializeApp: jest.fn(),
      firestore: jest.fn(() => ({})),
      auth: jest.fn(() => ({})),
    };
    jest.doMock('firebase-admin', () => admin);
    jest.doMock('path', () => path);
    const mod = require('../../firebase');
    expect(admin.credential.cert).toHaveBeenCalledWith(expect.objectContaining({ project_id: expect.any(String) }));
  });

  test('throws if serviceAccountKey.json missing (real file error)', () => {
    process.env.SERVICE_ACCOUNT_KEY = '';
    jest.resetModules();
    // Mock path.resolve to return a known fake path
    jest.doMock('path', () => ({
      ...path,
      resolve: () => '/fake/path/serviceAccountKey.json'
    }));
    // Patch require to throw when that fake path is required
    const realRequire = module.constructor.prototype.require;
    module.constructor.prototype.require = function(mod) {
      if (mod === '/fake/path/serviceAccountKey.json') {
        throw new Error('File not found');
      }
      return realRequire.apply(this, arguments);
    };
    // Remove firebase from require cache
    const firebasePath = require.resolve('../../firebase');
    delete require.cache[firebasePath];
  expect(() => require('../../firebase')).toThrow();
    module.constructor.prototype.require = realRequire;
  });
});
