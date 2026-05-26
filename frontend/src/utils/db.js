const DB_NAME = 'TrackFlowDB';
const DB_VERSION = 2; // Incremented version to apply schema changes
const STORE_LOCATIONS = 'offline_locations';
const STORE_ATTENDANCE = 'offline_attendance';
const STORE_TASKS = 'offline_tasks';

export const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create locations store if not exists
      if (!db.objectStoreNames.contains(STORE_LOCATIONS)) {
        db.createObjectStore(STORE_LOCATIONS, { keyPath: 'id', autoIncrement: true });
      }
      
      // Create attendance store if not exists
      if (!db.objectStoreNames.contains(STORE_ATTENDANCE)) {
        db.createObjectStore(STORE_ATTENDANCE, { keyPath: 'id', autoIncrement: true });
      }
      
      // Create tasks store if not exists
      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        db.createObjectStore(STORE_TASKS, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
};

// Generic helper to save an item to a store
const saveItem = async (storeName, item) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.add({
        ...item,
        timestamp: new Date().toISOString(),
      });

      request.onsuccess = () => resolve(true);
      request.onerror = (err) => reject(err.target.error);
    });
  } catch (err) {
    console.error(`Failed to save item in IndexedDB store ${storeName}:`, err);
    return false;
  }
};

// Generic helper to get all items from a store
const getAllItems = async (storeName) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = (err) => reject(err.target.error);
    });
  } catch (err) {
    console.error(`Failed to retrieve items from IndexedDB store ${storeName}:`, err);
    return [];
  }
};

// Generic helper to clear all items in a store
const clearStore = async (storeName) => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve(true);
      request.onerror = (err) => reject(err.target.error);
    });
  } catch (err) {
    console.error(`Failed to clear IndexedDB store ${storeName}:`, err);
    return false;
  }
};

// 1. Locations Store API
export const saveOfflineLocation = (location) => saveItem(STORE_LOCATIONS, location);
export const getOfflineLocations = () => getAllItems(STORE_LOCATIONS);
export const clearOfflineLocations = () => clearStore(STORE_LOCATIONS);

// 2. Attendance Store API
export const saveOfflineAttendance = (attendanceEvent) => saveItem(STORE_ATTENDANCE, attendanceEvent);
export const getOfflineAttendance = () => getAllItems(STORE_ATTENDANCE);
export const clearOfflineAttendance = () => clearStore(STORE_ATTENDANCE);

// 3. Tasks Store API
export const saveOfflineTask = (taskUpdate) => saveItem(STORE_TASKS, taskUpdate);
export const getOfflineTasks = () => getAllItems(STORE_TASKS);
export const clearOfflineTasks = () => clearStore(STORE_TASKS);
