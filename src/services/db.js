const DB_NAME = 'ScribeMindDB';
const DB_VERSION = 2;

export const initDb = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      
      // Store for uploaded resources
      if (!db.objectStoreNames.contains('resources')) {
        db.createObjectStore('resources', { keyPath: 'id' });
      }
      
      // Store for app session variables
      if (!db.objectStoreNames.contains('session')) {
        db.createObjectStore('session', { keyPath: 'key' });
      }
      
      // Store for completed quiz/assessment attempts
      if (!db.objectStoreNames.contains('quizHistory')) {
        db.createObjectStore('quizHistory', { keyPath: 'id' });
      }
    };
    
    request.onsuccess = (e) => {
      resolve(e.target.result);
    };
    
    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
};

export const saveResource = async (resource) => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('resources', 'readwrite');
    const store = transaction.objectStore('resources');
    
    // We strip off non-cloneable objects like pdfDoc proxy instance before saving to IndexedDB
    const cloneableResource = { ...resource };
    delete cloneableResource.pdfDoc;
    
    const request = store.put(cloneableResource);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllResources = async () => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('resources', 'readonly');
    const store = transaction.objectStore('resources');
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const deleteResource = async (id) => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('resources', 'readwrite');
    const store = transaction.objectStore('resources');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const saveSessionState = async (key, val) => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('session', 'readwrite');
    const store = transaction.objectStore('session');
    
    // Convert complex objects to plain values if needed, otherwise write directly
    const request = store.put({ key, val });
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getSessionState = async (key) => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('session', 'readonly');
    const store = transaction.objectStore('session');
    const request = store.get(key);
    
    request.onsuccess = () => resolve(request.result ? request.result.val : null);
    request.onerror = () => reject(request.error);
  });
};

export const clearSessionState = async () => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('session', 'readwrite');
    const store = transaction.objectStore('session');
    const request = store.clear();
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const resetDatabase = async () => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    db.close();
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const saveQuizAttempt = async (attempt) => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('quizHistory', 'readwrite');
    const store = transaction.objectStore('quizHistory');
    const request = store.put(attempt);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getQuizHistory = async () => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('quizHistory', 'readonly');
    const store = transaction.objectStore('quizHistory');
    const request = store.getAll();
    request.onsuccess = () => {
      const history = request.result || [];
      history.sort((a, b) => new Date(b.date) - new Date(a.date));
      resolve(history);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteQuizAttempt = async (id) => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('quizHistory', 'readwrite');
    const store = transaction.objectStore('quizHistory');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};
