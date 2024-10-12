// src/lib/ericchase/Design Pattern/Observer/Store.ts
class ConstantStore {
  value;
  subscriptionSet = new Set();
  constructor(value) {
    this.value = value;
  }
  subscribe(callback) {
    this.subscriptionSet.add(callback);
    if (this.value !== undefined) {
      callback(this.value, () => {
        this.subscriptionSet.delete(callback);
      });
    }
    return () => {
      this.subscriptionSet.delete(callback);
    };
  }
  get() {
    return new Promise((resolve) => {
      this.subscribe((value, unsubscribe) => {
        unsubscribe();
        resolve(value);
      });
    });
  }
  set(value) {
    if (this.value === undefined) {
      this.value = value;
      for (const callback of this.subscriptionSet) {
        callback(value, () => {
          this.subscriptionSet.delete(callback);
        });
      }
    }
  }
}
class Store {
  initialValue;
  notifyOnChangeOnly;
  currentValue;
  subscriptionSet = new Set();
  constructor(initialValue, notifyOnChangeOnly = false) {
    this.initialValue = initialValue;
    this.notifyOnChangeOnly = notifyOnChangeOnly;
    this.currentValue = initialValue;
  }
  subscribe(callback) {
    this.subscriptionSet.add(callback);
    const unsubscribe = () => {
      this.subscriptionSet.delete(callback);
    };
    callback(this.currentValue, unsubscribe);
    return unsubscribe;
  }
  get() {
    return new Promise((resolve) => {
      this.subscribe((value, unsubscribe) => {
        unsubscribe();
        resolve(value);
      });
    });
  }
  set(value) {
    if (this.notifyOnChangeOnly && this.currentValue === value) return;
    this.currentValue = value;
    for (const callback of this.subscriptionSet) {
      callback(value, () => {
        this.subscriptionSet.delete(callback);
      });
    }
  }
  update(callback) {
    this.set(callback(this.currentValue));
  }
}

// src/lib/ericchase/Utility/UpdateMarker.ts
class UpdateMarker {
  $manager;
  updated = false;
  constructor($manager) {
    this.$manager = $manager;
  }
  reset() {
    this.$manager.resetMarker(this);
  }
}

class UpdateMarkerManager {
  $marks = new Set();
  getNewMarker() {
    const marker = new UpdateMarker(this);
    this.$marks.add(marker);
    return marker;
  }
  resetMarker(mark) {
    mark.updated = false;
    this.$marks.add(mark);
  }
  updateMarkers() {
    for (const mark of this.$marks) {
      this.$marks.delete(mark);
      mark.updated = true;
    }
  }
}

class DataSetMarker {
  $manager;
  dataset = new Set();
  constructor($manager) {
    this.$manager = $manager;
  }
  reset() {
    this.$manager.resetMarker(this);
  }
}

class DataSetMarkerManager {
  $marks = new Set();
  getNewMarker() {
    const marker = new DataSetMarker(this);
    this.$marks.add(marker);
    return marker;
  }
  resetMarker(mark) {
    mark.dataset.clear();
    this.$marks.add(mark);
  }
  updateMarkers(data) {
    for (const mark of this.$marks) {
      mark.dataset.add(data);
    }
  }
}

// src/lib/ericchase/Utility/Console.ts
function ConsoleLog(...items) {
  console['log'](...items);
  newline_count = 0;
  marker_manager.updateMarkers();
}
var marker_manager = new UpdateMarkerManager();
var newline_count = 0;

// src/lib/ericchase/Utility/JobQueue.ts
class JobQueue {
  delay_ms;
  constructor(delay_ms) {
    this.delay_ms = delay_ms;
  }
  async abort() {
    this.aborted = true;
    await this.done;
  }
  add(fn, tag) {
    if (this.aborted === false) {
      this.queue.push({ fn, tag });
      if (this.running === false) {
        this.running = true;
        this.run();
      }
    }
  }
  get done() {
    return new Promise((resolve) => {
      this.runningCount.subscribe((count) => {
        if (count === 0) resolve();
      });
    });
  }
  async reset() {
    if (this.running === true || (await this.runningCount.get()) > 0) {
      throw 'Warning: Wait for running jobs to finish before calling reset. `await JobQueue.done;`';
    }
    this.aborted = false;
    this.completionCount = 0;
    this.queue.length = 0;
    this.queueIndex = 0;
    this.results.length = 0;
  }
  subscribe(callback) {
    this.subscriptionSet.add(callback);
    for (const result of this.results) {
      if (callback(result.value, result.error)?.abort === true) {
        this.subscriptionSet.delete(callback);
        return () => {};
      }
    }
    return () => {
      this.subscriptionSet.delete(callback);
    };
  }
  aborted = false;
  completionCount = 0;
  queue = [];
  queueIndex = 0;
  results = [];
  running = false;
  runningCount = new Store(0);
  subscriptionSet = new Set();
  run() {
    if (this.aborted === false && this.queueIndex < this.queue.length) {
      const { fn, tag } = this.queue[this.queueIndex++];
      (async () => {
        this.runningCount.update((count) => {
          return count + 1;
        });
        try {
          const value = await fn();
          this.send({ value, tag });
        } catch (error) {
          ConsoleLog(error);
          this.send({ error, tag });
        }
        this.runningCount.update((count) => {
          return count - 1;
        });
        if (this.delay_ms < 0) {
          this.run();
        }
      })();
      if (this.delay_ms >= 0) {
        setTimeout(() => this.run(), this.delay_ms);
      }
    } else {
      this.running = false;
    }
  }
  send(result) {
    if (this.aborted === false) {
      this.completionCount++;
      this.results.push(result);
      for (const callback of this.subscriptionSet) {
        if (callback(result.value, result.error, result.tag)?.abort === true) {
          this.subscriptionSet.delete(callback);
        }
      }
    }
  }
}

// src/lib/ericchase/Utility/RecursiveAsyncIterator.ts
class RecursiveIterator {
  fn;
  constructor(fn) {
    this.fn = fn;
  }
  async *iterate(init) {
    const list = [init];
    for (let i = 0; i < list.length; i++) {
      for await (const item of this.fn(list[i], (value) => {
        list.push(value);
      })) {
        yield item;
      }
    }
  }
}

// src/lib/ericchase/Utility/Sleep.ts
async function Sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// src/lib/ericchase/Utility/Guard.ts
function HasMethod(item, key) {
  return typeof item === 'object' && item !== null && key in item && typeof item[key] === 'function';
}
function HasProperty(item, key) {
  return typeof item === 'object' && item !== null && key in item && typeof item[key] !== 'undefined';
}

// src/lib/ericchase/Web API/DataTransferItem.ts
function Compat_DataTransferItem(item) {
  return {
    getAsEntry() {
      if (HasMethod(item, 'getAsEntry')) {
        return item.getAsEntry() ?? undefined;
      }
      if (HasMethod(item, 'webkitGetAsEntry')) {
        return item.webkitGetAsEntry() ?? undefined;
      }
    },
    getAsFile() {
      if (HasMethod(item, 'getAsFile')) {
        return item.getAsFile() ?? undefined;
      }
    },
    getAsString() {
      if (HasMethod(item, 'getAsString')) {
        return new Promise((resolve, reject) => {
          try {
            item.getAsString(resolve);
          } catch (error) {
            reject(error);
          }
        });
      }
      return Promise.resolve(undefined);
    },
  };
}

// src/lib/ericchase/Web API/DataTransferItem_Utility.ts
class DataTransferItemIterator {
  list = [];
  constructor(items) {
    if (items) {
      if (Array.isArray(items)) {
        this.list = items;
      } else if ('length' in items) {
        this.list = Array.from(items);
      } else {
        this.list = [items];
      }
    }
  }
  *getAsEntry() {
    for (const item of this.list) {
      const entry = Compat_DataTransferItem(item).getAsEntry();
      if (entry) yield entry;
    }
  }
  *getAsFile() {
    for (const item of this.list) {
      const file = Compat_DataTransferItem(item).getAsFile();
      if (file) yield file;
    }
  }
  async *getAsString() {
    for (const item of this.list) {
      const task = await Compat_DataTransferItem(item).getAsString();
      if (task) yield task;
    }
  }
}

// src/lib/ericchase/Web API/File.ts
function Compat_File(file) {
  return {
    get lastModified() {
      return HasProperty(file, 'lastModified') ? file.lastModified : undefined;
    },
    get name() {
      return HasProperty(file, 'name') ? file.name : undefined;
    },
    get webkitRelativePath() {
      return HasProperty(file, 'webkitRelativePath') ? file.webkitRelativePath : undefined;
    },
  };
}

// src/lib/ericchase/Web API/FileSystemDirectoryEntry.ts
function Compat_FileSystemDirectoryEntry(entry) {
  return {
    createReader() {
      if (HasMethod(entry, 'createReader')) {
        return entry.createReader() ?? undefined;
      }
    },
    getDirectory(path, options) {
      if (HasMethod(entry, 'getDirectory')) {
        return new Promise((resolve, reject) => {
          entry.getDirectory(path, options, () => resolve, reject);
        });
      }
      return Promise.resolve(undefined);
    },
    getFile(path, options) {
      if (HasMethod(entry, 'getFile')) {
        return new Promise((resolve, reject) => {
          entry.getFile(path, options, () => resolve, reject);
        });
      }
      return Promise.resolve(undefined);
    },
  };
}

// src/lib/ericchase/Web API/FileSystemEntry.ts
function Compat_FileSystemEntry(entry) {
  return {
    get filesystem() {
      return HasProperty(entry, 'filesystem') ? entry.filesystem : undefined;
    },
    get fullPath() {
      return HasProperty(entry, 'fullPath') ? entry.fullPath : undefined;
    },
    get isDirectory() {
      return HasProperty(entry, 'isDirectory') ? entry.isDirectory : undefined;
    },
    get isFile() {
      return HasProperty(entry, 'isFile') ? entry.isFile : undefined;
    },
    get name() {
      return HasProperty(entry, 'name') ? entry.name : undefined;
    },
    getParent() {
      if (HasMethod(entry, 'getParent')) {
        return new Promise((resolve, reject) => {
          entry.getParent(resolve, reject);
        });
      }
      return Promise.resolve(undefined);
    },
  };
}

// src/lib/ericchase/Web API/FileSystem_Utility.ts
class FileSystemEntryIterator {
  list = [];
  constructor(entries) {
    if (entries) {
      if (Array.isArray(entries)) {
        this.list = entries;
      } else {
        this.list = [entries];
      }
    }
  }
  *getDirectoryEntry() {
    for (const entry of this.list) {
      if (Compat_FileSystemEntry(entry).isDirectory) {
        yield entry;
      }
    }
  }
  *getFileEntry() {
    for (const entry of this.list) {
      if (Compat_FileSystemEntry(entry).isFile) {
        yield entry;
      }
    }
  }
}

class FileSystemDirectoryEntryIterator {
  list = [];
  constructor(entries) {
    if (entries) {
      if (Array.isArray(entries)) {
        this.list = entries;
      } else {
        this.list = [entries];
      }
    }
  }
  async *getEntry() {
    for (const entry of this.list) {
      const reader = Compat_FileSystemDirectoryEntry(entry).createReader();
      if (reader) {
        for (const entry2 of await new Promise((resolve, reject) => reader.readEntries(resolve, reject))) {
          yield entry2;
        }
      }
    }
  }
}

// src/lib/ericchase/Web API/Device.ts
function IsDeviceMobile() {
  return /android|iphone|mobile/i.test(window.navigator.userAgent);
}

// src/lib/ericchase/Web API/HTMLInputElement.ts
function Compat_HTMLInputElement(input) {
  return {
    get webkitEntries() {
      return HasProperty(input, 'webkitEntries') ? input.webkitEntries : undefined;
    },
    get webkitdirectory() {
      return HasProperty(input, 'webkitdirectory') ? input.webkitdirectory : undefined;
    },
  };
}
function IsWebkitDirectorySupported() {
  return IsDeviceMobile() ? false : true;
}

// src/components/drag-and-drop-file-picker/drag-and-drop-file-picker.module.ts
function setupDragAndDropFilePicker(container, fn, options) {
  const element = container.querySelector('input');
  if (!element) {
    throw 'drag-and-drop-file-picker input element missing';
  }
  if (options?.accept) {
    element.setAttribute('accept', options.accept);
  }
  if (options?.directory === true && IsWebkitDirectorySupported()) {
    element.toggleAttribute('webkitdirectory', true);
  }
  if (options?.multiple === true) {
    element.toggleAttribute('multiple', true);
  }
  if (fn.onDragEnd || fn.onDragEnter || fn.onDragLeave) {
    const removeListeners = () => {
      element.addEventListener('dragleave', dragleaveHandler);
      element.addEventListener('dragend', dragendHandler);
      element.addEventListener('drop', dropHandler2);
    };
    const dragendHandler = () => {
      removeListeners();
      fn.onDragEnd?.();
    };
    const dragleaveHandler = () => {
      removeListeners();
      fn.onDragLeave?.();
    };
    const dropHandler2 = () => {
      removeListeners();
      fn.onDrop?.();
    };
    element.addEventListener('dragenter', () => {
      element.addEventListener('dragleave', dragleaveHandler);
      element.addEventListener('dragend', dragendHandler);
      element.addEventListener('drop', dropHandler2);
      fn.onDragEnter?.();
    });
  }
  const fSEntrySet = new Set();
  const fSEntryIterator = new RecursiveIterator(async function* (fSEntryIterator2, push) {
    for await (const fSEntry of fSEntryIterator2) {
      const path = fSEntry.fullPath.slice(1);
      if (!fSEntrySet.has(path)) {
        fSEntrySet.add(path);
        const fsEntries = new FileSystemEntryIterator(fSEntry);
        for (const fSFileEntry of fsEntries.getFileEntry()) {
          yield fSFileEntry;
        }
        for (const fSDirectoryEntry of fsEntries.getDirectoryEntry()) {
          push(new FileSystemDirectoryEntryIterator(fSDirectoryEntry).getEntry());
        }
      }
    }
  });
  const jobQueue = new JobQueue(-1);
  jobQueue.subscribe((_, error) => {
    if (error) {
      fn?.onUploadError?.(error);
    }
  });
  let done = true;
  let running = false;
  const uploadStart = async () => {
    if (running === false) {
      done = false;
      running = true;
      await fn.onUploadStart?.();
      Sleep(500).then(async () => {
        await jobQueue.done;
        uploadEnd();
      });
    }
  };
  const uploadEnd = async () => {
    done = true;
    running = false;
    await fn.onUploadEnd?.();
    jobQueue.reset();
    fSEntrySet.clear();
  };
  const iterateFSEntries = async (entries, files) => {
    if (done === false) {
      for await (const fSFileEntry of fSEntryIterator.iterate(entries)) {
        const file = await new Promise((resolve, reject) => fSFileEntry.file(resolve, reject));
        const reader = new FileReader();
        reader.readAsText(file);
        await fn.onUploadNextFile(file, () => {
          done = true;
        });
        if (done === true) return;
      }
      for (const file of files) {
        const path = Compat_File(file).webkitRelativePath + file.name;
        if (!fSEntrySet.has(path)) {
          fSEntrySet.add(path);
          if (file.size > 0) {
            await fn.onUploadNextFile(file, () => {
              done = true;
            });
            if (done === true) return;
          }
        }
      }
    }
  };
  const changeHandler = () => {
    jobQueue.add(async () => {
      await uploadStart();
      if (done === false && element instanceof HTMLInputElement && element.files) {
        await iterateFSEntries(Compat_HTMLInputElement(element).webkitEntries ?? [], element.files);
      }
    }, 'changeHandler');
  };
  const dropHandler = (event) => {
    jobQueue.add(async () => {
      await uploadStart();
      if (done === false && event.dataTransfer) {
        const dataTransferItems = new DataTransferItemIterator(event.dataTransfer.items);
        await iterateFSEntries(dataTransferItems.getAsEntry(), event.dataTransfer.files);
      }
    }, 'dropHandler');
  };
  element.addEventListener('change', changeHandler);
  element.addEventListener('drop', dropHandler);
}
export { setupDragAndDropFilePicker };

//# debugId=FDA7D1C8F2B90EF764756E2164756E21
//# sourceMappingURL=drag-and-drop-file-picker.module.js.map
