import { appConfig } from "../config.js";

let databasePromise;

const REQUIRED_STORES = [
  "proyectos",
  "collars",
  "sync_queue",
  "surveys",
  "assays",
  "laboratorios",
  "guardado",
  "offline_tile_manifests",
];

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function ensureSchema(database) {
  if (!database.objectStoreNames.contains("proyectos")) {
    const store = database.createObjectStore("proyectos", {
      keyPath: "id_local",
      autoIncrement: true,
    });
    store.createIndex("uuid", "uuid", { unique: true });
    store.createIndex("activo", "activo", { unique: false });
    store.createIndex("estado_sync", "estado_sync", { unique: false });
  }

  if (!database.objectStoreNames.contains("collars")) {
    const store = database.createObjectStore("collars", {
      keyPath: "id_local",
      autoIncrement: true,
    });
    store.createIndex("uuid", "uuid", { unique: true });
    store.createIndex("proyecto_uuid", "proyecto_uuid", { unique: false });
    store.createIndex("estado_sync", "estado_sync", { unique: false });
  }

  if (!database.objectStoreNames.contains("sync_queue")) {
    const store = database.createObjectStore("sync_queue", {
      keyPath: "id",
      autoIncrement: true,
    });
    store.createIndex("entity_uuid", "entity_uuid", { unique: false });
    store.createIndex("entity_type", "entity_type", { unique: false });
    store.createIndex("status", "status", { unique: false });
  }

  if (!database.objectStoreNames.contains("surveys")) {
    const store = database.createObjectStore("surveys", {
      keyPath: "id_local",
      autoIncrement: true,
    });
    store.createIndex("uuid", "uuid", { unique: true });
    store.createIndex("collar_uuid", "collar_uuid", { unique: false });
    store.createIndex("estado_sync", "estado_sync", { unique: false });
  }

  if (!database.objectStoreNames.contains("assays")) {
    const store = database.createObjectStore("assays", {
      keyPath: "id_local",
      autoIncrement: true,
    });
    store.createIndex("uuid", "uuid", { unique: true });
    store.createIndex("collar_uuid", "collar_uuid", { unique: false });
    store.createIndex("estado_sync", "estado_sync", { unique: false });
  }

  if (!database.objectStoreNames.contains("laboratorios")) {
    const store = database.createObjectStore("laboratorios", {
      keyPath: "id_local",
      autoIncrement: true,
    });
    store.createIndex("uuid", "uuid", { unique: true });
    store.createIndex("assay_uuid", "assay_uuid", { unique: false });
    store.createIndex("estado_sync", "estado_sync", { unique: false });
  }

  if (!database.objectStoreNames.contains("guardado")) {
    const store = database.createObjectStore("guardado", { keyPath: "id" });
    store.createIndex("tipo", "tipo", { unique: false });
    store.createIndex("fecha", "fecha", { unique: false });
  }

  if (!database.objectStoreNames.contains("offline_tile_manifests")) {
    const store = database.createObjectStore("offline_tile_manifests", { keyPath: "id" });
    store.createIndex("created_at", "created_at", { unique: false });
    store.createIndex("project_uuid", "project_uuid", { unique: false });
  }
}

function hasRequiredStores(database) {
  return REQUIRED_STORES.every((storeName) => database.objectStoreNames.contains(storeName));
}

function openDatabase(version = appConfig.db.version, retryUpgrade = true) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(appConfig.db.name, version);

    request.onupgradeneeded = () => {
      const database = request.result;
      ensureSchema(database);
    };

    request.onsuccess = () => {
      const database = request.result;
      if (hasRequiredStores(database)) {
        resolve(database);
        return;
      }

      const nextVersion = Math.max(database.version + 1, appConfig.db.version + 1);
      database.close();

      if (!retryUpgrade) {
        reject(new Error("La estructura local de IndexedDB esta incompleta."));
        return;
      }

      openDatabase(nextVersion, false).then(resolve).catch(reject);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function initDB() {
  if (!databasePromise) {
    databasePromise = openDatabase();
  }

  return databasePromise;
}

async function withStore(storeName, mode, callback) {
  const database = await initDB();

  return new Promise((resolve, reject) => {
    if (!database.objectStoreNames.contains(storeName)) {
      database.close();
      databasePromise = openDatabase(Math.max(database.version + 1, appConfig.db.version + 1), false);
      databasePromise
        .then((upgradedDatabase) => {
          const transaction = upgradedDatabase.transaction(storeName, mode);
          const store = transaction.objectStore(storeName);
          const result = callback(store, transaction);

          transaction.oncomplete = async () => resolve(await result);
          transaction.onerror = () => reject(transaction.error);
          transaction.onabort = () => reject(transaction.error);
        })
        .catch(reject);
      return;
    }

    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = callback(store, transaction);

    transaction.oncomplete = async () => resolve(await result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export function getAllRecords(storeName) {
  return withStore(storeName, "readonly", (store) => requestToPromise(store.getAll()));
}

export function getRecordByKey(storeName, key) {
  return withStore(storeName, "readonly", (store) => requestToPromise(store.get(key)));
}

export function getRecordByIndex(storeName, indexName, value) {
  return withStore(storeName, "readonly", (store) => requestToPromise(store.index(indexName).get(value)));
}

export function getRecordsByIndex(storeName, indexName, value) {
  return withStore(storeName, "readonly", (store) => requestToPromise(store.index(indexName).getAll(value)));
}

export function addRecord(storeName, record) {
  return withStore(storeName, "readwrite", (store) => requestToPromise(store.add(record)));
}

export function putRecord(storeName, record) {
  return withStore(storeName, "readwrite", (store) => requestToPromise(store.put(record)));
}

export function deleteRecord(storeName, key) {
  return withStore(storeName, "readwrite", (store) => requestToPromise(store.delete(key)));
}

export function clearStore(storeName) {
  return withStore(storeName, "readwrite", (store) => requestToPromise(store.clear()));
}

export function bulkPutRecords(storeName, records) {
  return withStore(storeName, "readwrite", (store) =>
    Promise.all(records.map((record) => requestToPromise(store.put(record)))),
  );
}
