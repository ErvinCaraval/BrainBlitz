// Mock database service for testing without Firebase
class MockDb {
  constructor() {
    this.data = {
      users: new Map(),
      games: new Map(),
      questions: new Map()
    };
  }

  // Mock collection reference
  collection(name) {
    return {
      doc: (id) => ({
        get: () => Promise.resolve({
          exists: this.data[name].has(id),
          data: () => this.data[name].get(id)
        }),
        set: (data) => {
          this.data[name].set(id, data);
          return Promise.resolve();
        },
        update: (data) => {
          const existing = this.data[name].get(id) || {};
          this.data[name].set(id, { ...existing, ...data });
          return Promise.resolve();
        },
        delete: () => {
          this.data[name].delete(id);
          return Promise.resolve();
        }
      }),
      add: (data) => {
        const id = 'doc-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        this.data[name].set(id, data);
        return Promise.resolve({ id });
      },
      get: () => Promise.resolve({
        docs: Array.from(this.data[name].entries()).map(([id, data]) => ({
          id,
          data: () => data
        }))
      })
    };
  }
}

// Create singleton instance
const mockDb = new MockDb();

export default mockDb;

