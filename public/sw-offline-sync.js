(function () {
  "use strict";

  var PAGE_CACHE_NAME = "cgstock-pages-v1";
  var DB_NAME = "EstokaLocalDB";
  var SYNC_TAG = "cgstock-offline-sync";
  var PERIODIC_SYNC_TAG = "cgstock-periodic-sync";

  var ENDPOINT_MAP = {
    CREATE_RECEIPT: "/api/sync/receipt",
    CONFIRM_RECEIPT: "/api/sync/receipt-confirm",
    CREATE_REQUEST: "/api/sync/request",
    CREATE_ADJUSTMENT: "/api/sync/adjustment",
    CREATE_TRANSFER: "/api/sync/transfer",
    CREATE_RETURN: "/api/sync/return",
    CREATE_QUICK_ISSUE: "/api/sync/quick-issue",
    FULFILL_REQUEST: "/api/sync/fulfill",
    REQUEST_STATUS: "/api/sync/request-status",
    CREATE_INVENTORY: "/api/sync/inventory",
    SUBMIT_COLLECTION: "/api/sync",
  };

  var OPERATION_PRIORITY = {
    CREATE_RECEIPT: 10,
    CONFIRM_RECEIPT: 15,
    CREATE_RETURN: 20,
    CREATE_INVENTORY: 25,
    CREATE_REQUEST: 30,
    REQUEST_STATUS: 40,
    CREATE_ADJUSTMENT: 50,
    CREATE_TRANSFER: 60,
    SUBMIT_COLLECTION: 70,
    FULFILL_REQUEST: 80,
    CREATE_QUICK_ISSUE: 90,
  };

  var swSyncing = false;

  function openIndexedDb() {
    return new Promise(function (resolve, reject) {
      if (!("indexedDB" in self)) {
        resolve(null);
        return;
      }
      var req = indexedDB.open(DB_NAME);
      req.onerror = function () {
        reject(req.error);
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
    });
  }

  function getAllSyncTasks(db) {
    return new Promise(function (resolve) {
      if (!db || !db.objectStoreNames.contains("syncQueue")) {
        resolve([]);
        return;
      }
      var tx = db.transaction("syncQueue", "readonly");
      var req = tx.objectStore("syncQueue").getAll();
      req.onsuccess = function () {
        resolve(req.result || []);
      };
      req.onerror = function () {
        resolve([]);
      };
    });
  }

  function putSyncTask(db, task) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction("syncQueue", "readwrite");
      tx.objectStore("syncQueue").put(task);
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  }

  function deleteSyncTask(db, id) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction("syncQueue", "readwrite");
      tx.objectStore("syncQueue").delete(id);
      tx.oncomplete = function () {
        resolve();
      };
      tx.onerror = function () {
        reject(tx.error);
      };
    });
  }

  function sortTasks(tasks) {
    return tasks.slice().sort(function (a, b) {
      if (a.clientTempId && b.dependsOnEntityId === a.clientTempId) return -1;
      if (b.clientTempId && a.dependsOnEntityId === b.clientTempId) return 1;
      if (a.entityId && b.dependsOnEntityId === a.entityId) return -1;
      if (b.entityId && a.dependsOnEntityId === b.entityId) return 1;

      var tA = new Date(a.createdAt || 0).getTime();
      var tB = new Date(b.createdAt || 0).getTime();
      if (Math.abs(tA - tB) <= 2000) {
        var pA = OPERATION_PRIORITY[a.operation] || 50;
        var pB = OPERATION_PRIORITY[b.operation] || 50;
        if (pA !== pB) return pA - pB;
      }
      if (tA !== tB) return tA - tB;
      return (a.id || 0) - (b.id || 0);
    });
  }

  function resolvePayloadDependencies(payload, idMappings) {
    if (!payload || typeof payload !== "object") return payload;
    var copy = JSON.parse(JSON.stringify(payload));
    ["inventoryId", "requestId", "receiptId"].forEach(function (key) {
      var val = copy[key];
      if (typeof val === "string" && idMappings[val]) {
        copy[key] = idMappings[val];
      }
    });
    return copy;
  }

  function notifyClients(message) {
    if (!self.clients || !self.clients.matchAll) return Promise.resolve();
    return self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(function (clients) {
        clients.forEach(function (client) {
          try {
            client.postMessage(message);
          } catch (_) {}
        });
      });
  }

  function runWorkerSyncInternal() {
    if (swSyncing) return Promise.resolve();
    swSyncing = true;

    return openIndexedDb()
      .then(function (db) {
        if (!db) return;
        return getAllSyncTasks(db)
          .then(function (allTasks) {
            var now = Date.now();
            var eligible = allTasks.filter(function (task) {
              if (!task || !task.userId) return false;
              if (task.status === "PENDING" || task.status === "ERROR") return true;
              if (task.status === "SYNCING") {
                var last = task.lastAttemptAt ? new Date(task.lastAttemptAt).getTime() : 0;
                return now - last > 30000;
              }
              return false;
            });

            var ordered = sortTasks(eligible);
            var idMappings = {};
            var blockedTempIds = {};
            var syncedCount = 0;

            var chain = Promise.resolve();
            ordered.forEach(function (task) {
              chain = chain.then(function () {
                if (task.dependsOnEntityId && blockedTempIds[task.dependsOnEntityId]) {
                  return;
                }
                var endpoint = ENDPOINT_MAP[task.operation];
                if (!endpoint) return;

                var resolvedPayload = resolvePayloadDependencies(task.payload, idMappings);
                var updatedTask = Object.assign({}, task, {
                  payload: resolvedPayload,
                  status: "SYNCING",
                  lastAttemptAt: new Date(),
                });

                return putSyncTask(db, updatedTask)
                  .then(function () {
                    var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
                    var timer = controller
                      ? setTimeout(function () {
                          controller.abort();
                        }, 25000)
                      : null;

                    return fetch(endpoint, {
                      method: "POST",
                      credentials: "same-origin",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        operation: task.operation,
                        payload: resolvedPayload,
                        idempotencyKey: task.entityId,
                        userId: task.userId,
                      }),
                      signal: controller ? controller.signal : undefined,
                    }).finally(function () {
                      if (timer) clearTimeout(timer);
                    });
                  })
                  .then(function (res) {
                    if (res.status === 401 || res.status === 403) {
                      var authErrTask = Object.assign({}, updatedTask, {
                        status: "ERROR",
                        attempts: (task.attempts || 0) + 1,
                        error: "Sessão ou permissão inválida.",
                        lastAttemptAt: new Date(),
                      });
                      if (task.clientTempId) blockedTempIds[task.clientTempId] = true;
                      return putSyncTask(db, authErrTask);
                    }
                    if (res.status === 409) {
                      return res
                        .json()
                        .catch(function () {
                          return {};
                        })
                        .then(function (body) {
                          var conflictTask = Object.assign({}, updatedTask, {
                            status: "CONFLICT",
                            attempts: (task.attempts || 0) + 1,
                            error: (body && body.error) || "Conflito detectado no servidor.",
                            lastAttemptAt: new Date(),
                          });
                          if (task.clientTempId) blockedTempIds[task.clientTempId] = true;
                          return putSyncTask(db, conflictTask);
                        });
                    }
                    if (!res.ok) {
                      return res
                        .json()
                        .catch(function () {
                          return {};
                        })
                        .then(function (body) {
                          throw new Error((body && body.error) || "Falha temporária na sincronização");
                        });
                    }
                    return res
                      .json()
                      .catch(function () {
                        return {};
                      })
                      .then(function (body) {
                        var realId = body.inventoryId || body.requestId || body.receiptId || body.issueId;
                        if (task.clientTempId && realId) {
                          idMappings[task.clientTempId] = realId;
                        }
                        syncedCount++;
                        return deleteSyncTask(db, task.id);
                      });
                  })
                  .catch(function (err) {
                    if (task.clientTempId) blockedTempIds[task.clientTempId] = true;
                    var retryTask = Object.assign({}, updatedTask, {
                      status: "ERROR",
                      attempts: (task.attempts || 0) + 1,
                      error: err && err.message ? err.message : "Sem conexão no momento da tentativa",
                      lastAttemptAt: new Date(),
                    });
                    return putSyncTask(db, retryTask).catch(function () {});
                  });
              });
            });

            return chain.then(function () {
              db.close();
              if (syncedCount > 0) {
                return notifyClients({
                  type: "CGSTOCK_SW_SYNC_COMPLETED",
                  syncedCount: syncedCount,
                });
              }
            });
          })
          .catch(function () {
            try {
              db.close();
            } catch (_) {}
          });
      })
      .catch(function () {})
      .finally(function () {
        swSyncing = false;
      });
  }

  function processSyncQueueInWorker() {
    if (self.navigator && self.navigator.locks && self.navigator.locks.request) {
      return self.navigator.locks.request(
        "cgstock-sync-lock",
        { ifAvailable: true },
        function (lock) {
          if (!lock) return Promise.resolve();
          return runWorkerSyncInternal();
        }
      );
    }
    return runWorkerSyncInternal();
  }

  // Intercepta navegações de documentos (HTML) para permitir abrir/reabrir o PWA 100% offline
  self.addEventListener("fetch", function (event) {
    var req = event.request;
    if (req.method !== "GET") return;

    var url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    var isDocument = req.mode === "navigate" || req.destination === "document";
    var isWarmup = req.headers.get("X-Offline-Warmup") === "1";

    if (!isDocument && !isWarmup) return;
    if (url.pathname.startsWith("/api/")) return;

    event.respondWith(
      (function () {
        var controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        var timer = controller
          ? setTimeout(function () {
              controller.abort();
            }, 4500)
          : null;

        return fetch(req, controller ? { signal: controller.signal } : undefined)
          .then(function (networkResponse) {
            if (timer) clearTimeout(timer);
            var contentType = networkResponse.headers.get("content-type") || "";
            var isHtml = contentType.indexOf("text/html") !== -1;
            var isLoginRedirect = networkResponse.url && networkResponse.url.indexOf("/login") !== -1;

            if (networkResponse.ok && isHtml && !isLoginRedirect && url.pathname !== "/login") {
              var clone = networkResponse.clone();
              caches
                .open(PAGE_CACHE_NAME)
                .then(function (cache) {
                  cache.put(url.pathname, clone);
                })
                .catch(function () {});
            }
            return networkResponse;
          })
          .catch(function () {
            if (timer) clearTimeout(timer);
            return caches.open(PAGE_CACHE_NAME).then(function (cache) {
              return cache
                .match(url.pathname)
                .then(function (exactMatch) {
                  if (exactMatch) return exactMatch;
                  return cache.match("/dashboard");
                })
                .then(function (shellMatch) {
                  if (shellMatch) return shellMatch;
                  return cache.match("/quick-issue");
                })
                .then(function (quickMatch) {
                  if (quickMatch) return quickMatch;
                  return cache.match("/collector");
                })
                .then(function (colMatch) {
                  if (colMatch) return colMatch;
                  return caches.match("/offline.html");
                })
                .then(function (fallback) {
                  return (
                    fallback ||
                    new Response("Offline", {
                      status: 503,
                      headers: { "Content-Type": "text/plain; charset=utf-8" },
                    })
                  );
                });
            });
          });
      })()
    );
  });

  // Background Sync API (executado pelo navegador mesmo com o PWA fechado quando suportado)
  self.addEventListener("sync", function (event) {
    if (event.tag === SYNC_TAG) {
      event.waitUntil(processSyncQueueInWorker());
    }
  });

  // Periodic Background Sync API
  self.addEventListener("periodicsync", function (event) {
    if (event.tag === PERIODIC_SYNC_TAG) {
      event.waitUntil(processSyncQueueInWorker());
    }
  });

  // Comunicação direta com a janela do PWA
  self.addEventListener("message", function (event) {
    var data = event.data || {};
    if (data.type === "CGSTOCK_TRIGGER_SW_SYNC") {
      event.waitUntil(processSyncQueueInWorker());
    } else if (data.type === "CGSTOCK_CLEAR_CACHES") {
      event.waitUntil(caches.delete(PAGE_CACHE_NAME));
    }
  });
})();
