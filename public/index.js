// src/lib/ericchase/Algorithm/Sleep.ts
async function Sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

// src/lib/ericchase/Design Pattern/Observer/Store.ts
class Const {
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

// src/lib/ericchase/Utility/Console.ts
function ConsoleLog(...items) {
  console['log'](...items);
}

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

// src/components/drag-and-drop-file-picker/drag-and-drop-file-picker.ts
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
        await fn.onUploadNextFile(file, () => (done = true));
        if (done === true) return;
      }
      for (const file of files) {
        const path = Compat_File(file).webkitRelativePath + file.name;
        if (!fSEntrySet.has(path)) {
          fSEntrySet.add(path);
          if (file.size > 0) {
            await fn.onUploadNextFile(file, () => (done = true));
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

// src/index.ts
function addImage(file) {
  imageLoadQueue.add(
    () =>
      new Promise((resolve, reject) => {
        try {
          const img = document.createElement('img');
          const div = document.createElement('div');
          main?.append(div);
          img.src = URL.createObjectURL(file);
          img.addEventListener('load', () => {
            div.append(img);
            imageLoadCount++;
            resolve();
          });
          img.addEventListener('error', () => {
            div.remove();
            reject();
          });
        } catch (_) {
          reject();
        }
      }),
  );
}
document.documentElement.addEventListener('dragover', (event) => event.preventDefault());
var file_picker = document.querySelector('.drag-and-drop-file-picker');
var main = document.querySelector('main');
var imageLoadCount = 0;
var imageLoadQueue = new JobQueue(-1);
if (file_picker) {
  setupDragAndDropFilePicker(
    file_picker,
    {
      onUploadStart() {
        file_picker.classList.add('hidden');
        main?.replaceChildren();
      },
      onUploadNextFile: addImage,
      onUploadEnd() {
        imageLoadQueue.done.then(() => {
          if (imageLoadCount === 0) {
            file_picker.classList.remove('hidden');
            const div = document.createElement('div');
            div.style.color = 'red';
            div.textContent = 'No Images Found! Try another folder.';
            file_picker.querySelector('span')?.append(document.createElement('br'), document.createElement('br'), div);
          }
        });
      },
    },
    {
      directory: true,
      multiple: true,
    },
  );
}

//# debugId=1067EBF0E6A75B8F64756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcQWxnb3JpdGhtXFxTbGVlcC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxEZXNpZ24gUGF0dGVyblxcT2JzZXJ2ZXJcXFN0b3JlLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFV0aWxpdHlcXENvbnNvbGUudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcVXRpbGl0eVxcSm9iUXVldWUudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcVXRpbGl0eVxcUmVjdXJzaXZlQXN5bmNJdGVyYXRvci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxHdWFyZC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxEYXRhVHJhbnNmZXJJdGVtLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXERhdGFUcmFuc2Zlckl0ZW1fVXRpbGl0eS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlU3lzdGVtRW50cnkudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcV2ViIEFQSVxcRmlsZVN5c3RlbV9VdGlsaXR5LnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXERldmljZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxIVE1MSW5wdXRFbGVtZW50LnRzIiwgInNyY1xcY29tcG9uZW50c1xcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlclxcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci50cyIsICJzcmNcXGluZGV4LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWwogICAgImV4cG9ydCBhc3luYyBmdW5jdGlvbiBTbGVlcChtczogbnVtYmVyKSB7XG4gIGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiBzZXRUaW1lb3V0KHJlc29sdmUsIG1zKSk7XG59XG4iLAogICAgImV4cG9ydCB0eXBlIFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPiA9ICh2YWx1ZTogVmFsdWUsIHVuc3Vic2NyaWJlOiAoKSA9PiB2b2lkKSA9PiB2b2lkO1xuZXhwb3J0IHR5cGUgVXBkYXRlQ2FsbGJhY2s8VmFsdWU+ID0gKHZhbHVlOiBWYWx1ZSkgPT4gVmFsdWU7XG5cbmV4cG9ydCBjbGFzcyBDb25zdDxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9uU2V0ID0gbmV3IFNldDxTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4+KCk7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCB2YWx1ZT86IFZhbHVlKSB7fVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmFkZChjYWxsYmFjayk7XG4gICAgaWYgKHRoaXMudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY2FsbGJhY2sodGhpcy52YWx1ZSwgKCkgPT4ge1xuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgIH07XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWU+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWU+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLnZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5zdWJzY3JpcHRpb25TZXQpIHtcbiAgICAgICAgY2FsbGJhY2sodmFsdWUsICgpID0+IHtcbiAgICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0b3JlPFZhbHVlPiB7XG4gIHByb3RlY3RlZCBjdXJyZW50VmFsdWU6IFZhbHVlO1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9uU2V0ID0gbmV3IFNldDxTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4+KCk7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBpbml0aWFsVmFsdWU6IFZhbHVlLFxuICAgIHByb3RlY3RlZCBub3RpZnlPbkNoYW5nZU9ubHk6IGJvb2xlYW4gPSBmYWxzZSxcbiAgKSB7XG4gICAgdGhpcy5jdXJyZW50VmFsdWUgPSBpbml0aWFsVmFsdWU7XG4gIH1cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4pOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5hZGQoY2FsbGJhY2spO1xuICAgIGNvbnN0IHVuc3Vic2NyaWJlID0gKCkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICAgIGNhbGxiYWNrKHRoaXMuY3VycmVudFZhbHVlLCB1bnN1YnNjcmliZSk7XG4gICAgcmV0dXJuIHVuc3Vic2NyaWJlO1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5ub3RpZnlPbkNoYW5nZU9ubHkgJiYgdGhpcy5jdXJyZW50VmFsdWUgPT09IHZhbHVlKSByZXR1cm47XG4gICAgdGhpcy5jdXJyZW50VmFsdWUgPSB2YWx1ZTtcbiAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICBjYWxsYmFjayh2YWx1ZSwgKCkgPT4ge1xuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIHVwZGF0ZShjYWxsYmFjazogVXBkYXRlQ2FsbGJhY2s8VmFsdWU+KTogdm9pZCB7XG4gICAgdGhpcy5zZXQoY2FsbGJhY2sodGhpcy5jdXJyZW50VmFsdWUpKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgT3B0aW9uYWw8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIHN0b3JlOiBTdG9yZTxWYWx1ZSB8IHVuZGVmaW5lZD47XG4gIGNvbnN0cnVjdG9yKG5vdGlmeU9uQ2hhbmdlT25seSA9IGZhbHNlKSB7XG4gICAgdGhpcy5zdG9yZSA9IG5ldyBTdG9yZTxWYWx1ZSB8IHVuZGVmaW5lZD4odW5kZWZpbmVkLCBub3RpZnlPbkNoYW5nZU9ubHkpO1xuICB9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWUgfCB1bmRlZmluZWQ+KTogKCkgPT4gdm9pZCB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcmUuc3Vic2NyaWJlKGNhbGxiYWNrKTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZSB8IHVuZGVmaW5lZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZSB8IHVuZGVmaW5lZD4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlIHwgdW5kZWZpbmVkKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZXQodmFsdWUpO1xuICB9XG4gIHVwZGF0ZShjYWxsYmFjazogVXBkYXRlQ2FsbGJhY2s8VmFsdWUgfCB1bmRlZmluZWQ+KTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS51cGRhdGUoY2FsbGJhY2spO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBDb21wb3VuZFN1YnNjcmlwdGlvbjxUIGV4dGVuZHMgYW55W10+KHN0b3JlczogeyBbSyBpbiBrZXlvZiBUXTogU3RvcmU8VFtLXT4gfCBPcHRpb25hbDxUW0tdPiB9LCBjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8eyBbSyBpbiBrZXlvZiBUXTogVFtLXSB8IHVuZGVmaW5lZCB9Pik6ICgpID0+IHZvaWQge1xuICBjb25zdCB1bnN1YnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIGNvbnN0IHVuc3Vic2NyaWJlID0gKCkgPT4ge1xuICAgIGZvciAoY29uc3QgdW5zdWIgb2YgdW5zdWJzKSB7XG4gICAgICB1bnN1YigpO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgdmFsdWVzID0gW10gYXMgeyBbSyBpbiBrZXlvZiBUXTogVFtLXSB8IHVuZGVmaW5lZCB9O1xuICBjb25zdCBjYWxsYmFja19oYW5kbGVyID0gKCkgPT4ge1xuICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSBzdG9yZXMubGVuZ3RoKSB7XG4gICAgICBjYWxsYmFjayh2YWx1ZXMsIHVuc3Vic2NyaWJlKTtcbiAgICB9XG4gIH07XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3RvcmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgc3RvcmVzW2ldLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICB2YWx1ZXNbaV0gPSB2YWx1ZTtcbiAgICAgIHVuc3Vic1tpXSA9IHVuc3Vic2NyaWJlO1xuICAgICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IHN0b3Jlcy5sZW5ndGgpIHtcbiAgICAgICAgY2FsbGJhY2tfaGFuZGxlcigpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIHJldHVybiB1bnN1YnNjcmliZTtcbn1cbiIsCiAgICAiZXhwb3J0IGZ1bmN0aW9uIENvbnNvbGVMb2coLi4uaXRlbXM6IGFueVtdKSB7XG4gIGNvbnNvbGVbJ2xvZyddKC4uLml0ZW1zKTtcbn1cbmV4cG9ydCBmdW5jdGlvbiBDb25zb2xlRXJyb3IoLi4uaXRlbXM6IGFueVtdKSB7XG4gIGNvbnNvbGVbJ2Vycm9yJ10oLi4uaXRlbXMpO1xufVxuIiwKICAgICJpbXBvcnQgeyBTdG9yZSB9IGZyb20gJy4uL0Rlc2lnbiBQYXR0ZXJuL09ic2VydmVyL1N0b3JlLmpzJztcbmltcG9ydCB7IENvbnNvbGVMb2cgfSBmcm9tICcuL0NvbnNvbGUuanMnO1xuXG5leHBvcnQgdHlwZSBTdWJzY3JpcHRpb25DYWxsYmFjazxSZXN1bHQsIFRhZz4gPSAocmVzdWx0PzogUmVzdWx0LCBlcnJvcj86IEVycm9yLCB0YWc/OiBUYWcpID0+IHsgYWJvcnQ6IGJvb2xlYW4gfSB8IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBKb2JRdWV1ZTxSZXN1bHQgPSB2b2lkLCBUYWcgPSB2b2lkPiB7XG4gIC8qKlxuICAgKiAwOiBObyBkZWxheS4gLTE6IENvbnNlY3V0aXZlLlxuICAgKi9cbiAgY29uc3RydWN0b3IocHVibGljIGRlbGF5X21zOiBudW1iZXIpIHt9XG4gIC8qKlxuICAgKiAhIFdhdGNoIG91dCBmb3IgY2lyY3VsYXIgY2FsbHMgIVxuICAgKlxuICAgKiBTZXRzIHRoZSBgYWJvcnRlZGAgc3RhdGUgYW5kIHJlc29sdmVzIHdoZW4gY3VycmVudGx5IHJ1bm5pbmcgam9icyBmaW5pc2guXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgYWJvcnQoKSB7XG4gICAgdGhpcy5hYm9ydGVkID0gdHJ1ZTtcbiAgICBhd2FpdCB0aGlzLmRvbmU7XG4gIH1cbiAgcHVibGljIGFkZChmbjogKCkgPT4gUHJvbWlzZTxSZXN1bHQ+LCB0YWc/OiBUYWcpIHtcbiAgICBpZiAodGhpcy5hYm9ydGVkID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5xdWV1ZS5wdXNoKHsgZm4sIHRhZyB9KTtcbiAgICAgIGlmICh0aGlzLnJ1bm5pbmcgPT09IGZhbHNlKSB7XG4gICAgICAgIHRoaXMucnVubmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMucnVuKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gam9icyBmaW5pc2guXG4gICAqL1xuICBwdWJsaWMgZ2V0IGRvbmUoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnJ1bm5pbmdDb3VudC5zdWJzY3JpYmUoKGNvdW50KSA9PiB7XG4gICAgICAgIGlmIChjb3VudCA9PT0gMCkgcmVzb2x2ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFJlc2V0cyB0aGUgSm9iUXVldWUgdG8gYW4gaW5pdGlhbCBzdGF0ZSwga2VlcGluZyBzdWJzY3JpcHRpb25zIGFsaXZlLlxuICAgKlxuICAgKiBAdGhyb3dzIElmIGNhbGxlZCB3aGVuIGpvYnMgYXJlIGN1cnJlbnRseSBydW5uaW5nLlxuICAgKi9cbiAgcHVibGljIGFzeW5jIHJlc2V0KCkge1xuICAgIGlmICh0aGlzLnJ1bm5pbmcgPT09IHRydWUgfHwgKGF3YWl0IHRoaXMucnVubmluZ0NvdW50LmdldCgpKSA+IDApIHtcbiAgICAgIHRocm93ICdXYXJuaW5nOiBXYWl0IGZvciBydW5uaW5nIGpvYnMgdG8gZmluaXNoIGJlZm9yZSBjYWxsaW5nIHJlc2V0LiBgYXdhaXQgSm9iUXVldWUuZG9uZTtgJztcbiAgICB9XG4gICAgdGhpcy5hYm9ydGVkID0gZmFsc2U7XG4gICAgdGhpcy5jb21wbGV0aW9uQ291bnQgPSAwO1xuICAgIHRoaXMucXVldWUubGVuZ3RoID0gMDtcbiAgICB0aGlzLnF1ZXVlSW5kZXggPSAwO1xuICAgIHRoaXMucmVzdWx0cy5sZW5ndGggPSAwO1xuICB9XG4gIHB1YmxpYyBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmFkZChjYWxsYmFjayk7XG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgdGhpcy5yZXN1bHRzKSB7XG4gICAgICBpZiAoY2FsbGJhY2socmVzdWx0LnZhbHVlLCByZXN1bHQuZXJyb3IpPy5hYm9ydCA9PT0gdHJ1ZSkge1xuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gKCkgPT4ge307XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgIH07XG4gIH1cbiAgcHJvdGVjdGVkIGFib3J0ZWQgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIGNvbXBsZXRpb25Db3VudCA9IDA7XG4gIHByb3RlY3RlZCBxdWV1ZTogeyBmbjogKCkgPT4gUHJvbWlzZTxSZXN1bHQ+OyB0YWc/OiBUYWcgfVtdID0gW107XG4gIHByb3RlY3RlZCBxdWV1ZUluZGV4ID0gMDtcbiAgcHJvdGVjdGVkIHJlc3VsdHM6IHsgdmFsdWU/OiBSZXN1bHQ7IGVycm9yPzogRXJyb3IgfVtdID0gW107XG4gIHByb3RlY3RlZCBydW5uaW5nID0gZmFsc2U7XG4gIHByb3RlY3RlZCBydW5uaW5nQ291bnQgPSBuZXcgU3RvcmUoMCk7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPj4oKTtcbiAgcHJvdGVjdGVkIHJ1bigpIHtcbiAgICBpZiAodGhpcy5hYm9ydGVkID09PSBmYWxzZSAmJiB0aGlzLnF1ZXVlSW5kZXggPCB0aGlzLnF1ZXVlLmxlbmd0aCkge1xuICAgICAgY29uc3QgeyBmbiwgdGFnIH0gPSB0aGlzLnF1ZXVlW3RoaXMucXVldWVJbmRleCsrXTtcbiAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucnVubmluZ0NvdW50LnVwZGF0ZSgoY291bnQpID0+IHtcbiAgICAgICAgICByZXR1cm4gY291bnQgKyAxO1xuICAgICAgICB9KTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IGZuKCk7XG4gICAgICAgICAgdGhpcy5zZW5kKHsgdmFsdWUsIHRhZyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgIENvbnNvbGVMb2coZXJyb3IpO1xuICAgICAgICAgIHRoaXMuc2VuZCh7IGVycm9yLCB0YWcgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5ydW5uaW5nQ291bnQudXBkYXRlKChjb3VudCkgPT4ge1xuICAgICAgICAgIHJldHVybiBjb3VudCAtIDE7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5kZWxheV9tcyA8IDApIHtcbiAgICAgICAgICB0aGlzLnJ1bigpO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuICAgICAgaWYgKHRoaXMuZGVsYXlfbXMgPj0gMCkge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMucnVuKCksIHRoaXMuZGVsYXlfbXMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcHJvdGVjdGVkIHNlbmQocmVzdWx0OiB7IHZhbHVlPzogUmVzdWx0OyBlcnJvcj86IEVycm9yOyB0YWc/OiBUYWcgfSkge1xuICAgIGlmICh0aGlzLmFib3J0ZWQgPT09IGZhbHNlKSB7XG4gICAgICB0aGlzLmNvbXBsZXRpb25Db3VudCsrO1xuICAgICAgdGhpcy5yZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5zdWJzY3JpcHRpb25TZXQpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKHJlc3VsdC52YWx1ZSwgcmVzdWx0LmVycm9yLCByZXN1bHQudGFnKT8uYWJvcnQgPT09IHRydWUpIHtcbiAgICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgU3luY0FzeW5jSXRlcmFibGUgfSBmcm9tICcuL1R5cGVzLmpzJztcblxuZXhwb3J0IGNsYXNzIFJlY3Vyc2l2ZUl0ZXJhdG9yPEluLCBPdXQ+IHtcbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIGZuOiAodmFsdWU6IFN5bmNBc3luY0l0ZXJhYmxlPEluPiwgcHVzaDogKHZhbHVlOiBTeW5jQXN5bmNJdGVyYWJsZTxJbj4pID0+IHZvaWQpID0+IFN5bmNBc3luY0l0ZXJhYmxlPE91dD4pIHt9XG4gIGFzeW5jICppdGVyYXRlKGluaXQ6IFN5bmNBc3luY0l0ZXJhYmxlPEluPik6IFN5bmNBc3luY0l0ZXJhYmxlPE91dD4ge1xuICAgIGNvbnN0IGxpc3Q6IFN5bmNBc3luY0l0ZXJhYmxlPEluPltdID0gW2luaXRdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBpdGVtIG9mIHRoaXMuZm4obGlzdFtpXSwgKHZhbHVlKSA9PiB7XG4gICAgICAgIGxpc3QucHVzaCh2YWx1ZSk7XG4gICAgICB9KSkge1xuICAgICAgICB5aWVsZCBpdGVtO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICIvLyBJc3N1ZXMgd2l0aCBmYWxzZXkgYnJhbmNoLlxuLy8gZXhwb3J0IGZ1bmN0aW9uIEhhc01ldGhvZDxUIGV4dGVuZHMgb2JqZWN0ID0gb2JqZWN0PihpdGVtOiB1bmtub3duLCBrZXk6IGtleW9mIFQpOiBpdGVtIGlzIFQgJiBSZWNvcmQ8dHlwZW9mIGtleSwgKC4uLmFyZ3M6IGFueVtdKSA9PiBhbnk+IHtcbi8vICAgcmV0dXJuIHR5cGVvZiBpdGVtID09PSAnb2JqZWN0JyAmJiBpdGVtICE9PSBudWxsICYmIGtleSBpbiBpdGVtICYmIHR5cGVvZiAoaXRlbSBhcyBSZWNvcmQ8dHlwZW9mIGtleSwgdW5rbm93bj4pW2tleV0gPT09ICdmdW5jdGlvbic7XG4vLyB9XG5leHBvcnQgZnVuY3Rpb24gSGFzTWV0aG9kKGl0ZW06IHVua25vd24sIGtleTogc3RyaW5nKTogaXRlbSBpcyBSZWNvcmQ8c3RyaW5nLCAoLi4uYXJnczogYW55W10pID0+IGFueT4ge1xuICByZXR1cm4gdHlwZW9mIGl0ZW0gPT09ICdvYmplY3QnICYmIGl0ZW0gIT09IG51bGwgJiYga2V5IGluIGl0ZW0gJiYgdHlwZW9mIChpdGVtIGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KVtrZXldID09PSAnZnVuY3Rpb24nO1xufVxuXG4vLyBEb2VzIG5vdCBzZWVtIHRvIGhhdmUgdGhlIHNhbWUgaXNzdWVzIGFzIGFib3ZlXG5leHBvcnQgZnVuY3Rpb24gSGFzUHJvcGVydHk8VCBleHRlbmRzIG9iamVjdCA9IG9iamVjdD4oaXRlbTogdW5rbm93biwga2V5OiBrZXlvZiBUKTogaXRlbSBpcyBUICYgUmVjb3JkPHR5cGVvZiBrZXksICguLi5hcmdzOiBhbnlbXSkgPT4gYW55PiB7XG4gIHJldHVybiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgaXRlbSAhPT0gbnVsbCAmJiBrZXkgaW4gaXRlbSAmJiB0eXBlb2YgKGl0ZW0gYXMgUmVjb3JkPHR5cGVvZiBrZXksIHVua25vd24+KVtrZXldICE9PSAndW5kZWZpbmVkJztcbn1cbiIsCiAgICAiaW1wb3J0IHsgSGFzTWV0aG9kIH0gZnJvbSAnLi4vVXRpbGl0eS9HdWFyZC5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBDb21wYXRfRGF0YVRyYW5zZmVySXRlbShpdGVtPzogRGF0YVRyYW5zZmVySXRlbSkge1xuICByZXR1cm4ge1xuICAgIGdldEFzRW50cnkoKTogRXhjbHVkZTxSZXR1cm5UeXBlPERhdGFUcmFuc2Zlckl0ZW1bJ3dlYmtpdEdldEFzRW50cnknXT4sIG51bGw+IHwgdW5kZWZpbmVkIHtcbiAgICAgIGlmIChIYXNNZXRob2QoaXRlbSwgJ2dldEFzRW50cnknKSkge1xuICAgICAgICByZXR1cm4gaXRlbS5nZXRBc0VudHJ5KCkgPz8gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgICAgaWYgKEhhc01ldGhvZChpdGVtLCAnd2Via2l0R2V0QXNFbnRyeScpKSB7XG4gICAgICAgIHJldHVybiBpdGVtLndlYmtpdEdldEFzRW50cnkoKSA/PyB1bmRlZmluZWQ7XG4gICAgICB9XG4gICAgfSxcbiAgICBnZXRBc0ZpbGUoKTogRXhjbHVkZTxSZXR1cm5UeXBlPERhdGFUcmFuc2Zlckl0ZW1bJ2dldEFzRmlsZSddPiwgbnVsbD4gfCB1bmRlZmluZWQge1xuICAgICAgaWYgKEhhc01ldGhvZChpdGVtLCAnZ2V0QXNGaWxlJykpIHtcbiAgICAgICAgcmV0dXJuIGl0ZW0uZ2V0QXNGaWxlKCkgPz8gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgIH0sXG4gICAgZ2V0QXNTdHJpbmcoKTogUHJvbWlzZTxQYXJhbWV0ZXJzPEV4Y2x1ZGU8UGFyYW1ldGVyczxEYXRhVHJhbnNmZXJJdGVtWydnZXRBc1N0cmluZyddPlswXSwgbnVsbD4+WzBdIHwgdW5kZWZpbmVkPiB7XG4gICAgICBpZiAoSGFzTWV0aG9kKGl0ZW0sICdnZXRBc1N0cmluZycpKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGl0ZW0uZ2V0QXNTdHJpbmcocmVzb2x2ZSk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIHJlamVjdChlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcbiAgICB9LFxuICB9O1xufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IE4gfSBmcm9tICcuLi9VdGlsaXR5L1R5cGVzLmpzJztcbmltcG9ydCB7IENvbXBhdF9EYXRhVHJhbnNmZXJJdGVtIH0gZnJvbSAnLi9EYXRhVHJhbnNmZXJJdGVtLmpzJztcblxuZXhwb3J0IGNsYXNzIERhdGFUcmFuc2Zlckl0ZW1JdGVyYXRvciB7XG4gIGxpc3Q6IERhdGFUcmFuc2Zlckl0ZW1bXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihpdGVtcz86IE48RGF0YVRyYW5zZmVySXRlbT4gfCBEYXRhVHJhbnNmZXJJdGVtTGlzdCB8IG51bGwpIHtcbiAgICBpZiAoaXRlbXMpIHtcbiAgICAgIGlmIChBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgICB0aGlzLmxpc3QgPSBpdGVtcztcbiAgICAgIH0gZWxzZSBpZiAoJ2xlbmd0aCcgaW4gaXRlbXMpIHtcbiAgICAgICAgdGhpcy5saXN0ID0gQXJyYXkuZnJvbShpdGVtcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmxpc3QgPSBbaXRlbXNdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqZ2V0QXNFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgZW50cnk6IEZpbGVTeXN0ZW1FbnRyeSB8IHVuZGVmaW5lZCA9IENvbXBhdF9EYXRhVHJhbnNmZXJJdGVtKGl0ZW0pLmdldEFzRW50cnkoKTtcbiAgICAgIGlmIChlbnRyeSkgeWllbGQgZW50cnk7XG4gICAgfVxuICB9XG4gICpnZXRBc0ZpbGUoKTogR2VuZXJhdG9yPEZpbGU+IHtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5saXN0KSB7XG4gICAgICBjb25zdCBmaWxlOiBGaWxlIHwgdW5kZWZpbmVkID0gQ29tcGF0X0RhdGFUcmFuc2Zlckl0ZW0oaXRlbSkuZ2V0QXNGaWxlKCk7XG4gICAgICBpZiAoZmlsZSkgeWllbGQgZmlsZTtcbiAgICB9XG4gIH1cbiAgYXN5bmMgKmdldEFzU3RyaW5nKCk6IEFzeW5jR2VuZXJhdG9yPHN0cmluZz4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IHRhc2s6IHN0cmluZyB8IHVuZGVmaW5lZCA9IGF3YWl0IENvbXBhdF9EYXRhVHJhbnNmZXJJdGVtKGl0ZW0pLmdldEFzU3RyaW5nKCk7XG4gICAgICBpZiAodGFzaykgeWllbGQgdGFzaztcbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHsgSGFzUHJvcGVydHkgfSBmcm9tICcuLi9VdGlsaXR5L0d1YXJkLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIENvbXBhdF9GaWxlKGZpbGU/OiBGaWxlKSB7XG4gIHJldHVybiB7XG4gICAgZ2V0IGxhc3RNb2RpZmllZCgpOiBGaWxlWydsYXN0TW9kaWZpZWQnXSB8IHVuZGVmaW5lZCB7XG4gICAgICByZXR1cm4gSGFzUHJvcGVydHkoZmlsZSwgJ2xhc3RNb2RpZmllZCcpID8gZmlsZS5sYXN0TW9kaWZpZWQgOiB1bmRlZmluZWQ7XG4gICAgfSxcbiAgICBnZXQgbmFtZSgpOiBGaWxlWyduYW1lJ10gfCB1bmRlZmluZWQge1xuICAgICAgcmV0dXJuIEhhc1Byb3BlcnR5KGZpbGUsICduYW1lJykgPyBmaWxlLm5hbWUgOiB1bmRlZmluZWQ7XG4gICAgfSxcbiAgICBnZXQgd2Via2l0UmVsYXRpdmVQYXRoKCk6IEZpbGVbJ3dlYmtpdFJlbGF0aXZlUGF0aCddIHwgdW5kZWZpbmVkIHtcbiAgICAgIHJldHVybiBIYXNQcm9wZXJ0eShmaWxlLCAnd2Via2l0UmVsYXRpdmVQYXRoJykgPyBmaWxlLndlYmtpdFJlbGF0aXZlUGF0aCA6IHVuZGVmaW5lZDtcbiAgICB9LFxuICB9O1xufVxuIiwKICAgICJpbXBvcnQgeyBIYXNNZXRob2QgfSBmcm9tICcuLi9VdGlsaXR5L0d1YXJkLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIENvbXBhdF9GaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkoZW50cnk/OiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkpIHtcbiAgcmV0dXJuIHtcbiAgICBjcmVhdGVSZWFkZXIoKTogUmV0dXJuVHlwZTxGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbJ2NyZWF0ZVJlYWRlciddPiB8IHVuZGVmaW5lZCB7XG4gICAgICBpZiAoSGFzTWV0aG9kKGVudHJ5LCAnY3JlYXRlUmVhZGVyJykpIHtcbiAgICAgICAgcmV0dXJuIGVudHJ5LmNyZWF0ZVJlYWRlcigpID8/IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9LFxuICAgIGdldERpcmVjdG9yeShwYXRoOiBQYXJhbWV0ZXJzPEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeVsnZ2V0RGlyZWN0b3J5J10+WzBdLCBvcHRpb25zOiBQYXJhbWV0ZXJzPEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeVsnZ2V0RGlyZWN0b3J5J10+WzFdKTogUHJvbWlzZTxQYXJhbWV0ZXJzPEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeVsnZ2V0RGlyZWN0b3J5J10+WzJdIHwgdW5kZWZpbmVkPiB7XG4gICAgICBpZiAoSGFzTWV0aG9kKGVudHJ5LCAnZ2V0RGlyZWN0b3J5JykpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBlbnRyeS5nZXREaXJlY3RvcnkocGF0aCwgb3B0aW9ucywgKCkgPT4gcmVzb2x2ZSwgcmVqZWN0KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG4gICAgfSxcbiAgICBnZXRGaWxlKHBhdGg6IFBhcmFtZXRlcnM8RmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5WydnZXRGaWxlJ10+WzBdLCBvcHRpb25zOiBQYXJhbWV0ZXJzPEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeVsnZ2V0RmlsZSddPlsxXSk6IFByb21pc2U8UGFyYW1ldGVyczxGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbJ2dldEZpbGUnXT5bMF0gfCB1bmRlZmluZWQ+IHtcbiAgICAgIGlmIChIYXNNZXRob2QoZW50cnksICdnZXRGaWxlJykpIHtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBlbnRyeS5nZXRGaWxlKHBhdGgsIG9wdGlvbnMsICgpID0+IHJlc29sdmUsIHJlamVjdCk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuICAgIH0sXG4gIH07XG59XG4iLAogICAgImltcG9ydCB7IEhhc01ldGhvZCwgSGFzUHJvcGVydHkgfSBmcm9tICcuLi9VdGlsaXR5L0d1YXJkLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIENvbXBhdF9GaWxlU3lzdGVtRW50cnkoZW50cnk/OiBGaWxlU3lzdGVtRW50cnkpIHtcbiAgcmV0dXJuIHtcbiAgICBnZXQgZmlsZXN5c3RlbSgpOiBGaWxlU3lzdGVtRW50cnlbJ2ZpbGVzeXN0ZW0nXSB8IHVuZGVmaW5lZCB7XG4gICAgICByZXR1cm4gSGFzUHJvcGVydHkoZW50cnksICdmaWxlc3lzdGVtJykgPyBlbnRyeS5maWxlc3lzdGVtIDogdW5kZWZpbmVkO1xuICAgIH0sXG4gICAgZ2V0IGZ1bGxQYXRoKCk6IEZpbGVTeXN0ZW1FbnRyeVsnZnVsbFBhdGgnXSB8IHVuZGVmaW5lZCB7XG4gICAgICByZXR1cm4gSGFzUHJvcGVydHkoZW50cnksICdmdWxsUGF0aCcpID8gZW50cnkuZnVsbFBhdGggOiB1bmRlZmluZWQ7XG4gICAgfSxcbiAgICBnZXQgaXNEaXJlY3RvcnkoKTogRmlsZVN5c3RlbUVudHJ5Wydpc0RpcmVjdG9yeSddIHwgdW5kZWZpbmVkIHtcbiAgICAgIHJldHVybiBIYXNQcm9wZXJ0eShlbnRyeSwgJ2lzRGlyZWN0b3J5JykgPyBlbnRyeS5pc0RpcmVjdG9yeSA6IHVuZGVmaW5lZDtcbiAgICB9LFxuICAgIGdldCBpc0ZpbGUoKTogRmlsZVN5c3RlbUVudHJ5Wydpc0ZpbGUnXSB8IHVuZGVmaW5lZCB7XG4gICAgICByZXR1cm4gSGFzUHJvcGVydHkoZW50cnksICdpc0ZpbGUnKSA/IGVudHJ5LmlzRmlsZSA6IHVuZGVmaW5lZDtcbiAgICB9LFxuICAgIGdldCBuYW1lKCk6IEZpbGVTeXN0ZW1FbnRyeVsnbmFtZSddIHwgdW5kZWZpbmVkIHtcbiAgICAgIHJldHVybiBIYXNQcm9wZXJ0eShlbnRyeSwgJ25hbWUnKSA/IGVudHJ5Lm5hbWUgOiB1bmRlZmluZWQ7XG4gICAgfSxcbiAgICBnZXRQYXJlbnQoKTogUHJvbWlzZTxQYXJhbWV0ZXJzPEV4Y2x1ZGU8UGFyYW1ldGVyczxGaWxlU3lzdGVtRW50cnlbJ2dldFBhcmVudCddPlswXSwgdW5kZWZpbmVkPj5bMF0gfCB1bmRlZmluZWQ+IHtcbiAgICAgIGlmIChIYXNNZXRob2QoZW50cnksICdnZXRQYXJlbnQnKSkge1xuICAgICAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICAgIGVudHJ5LmdldFBhcmVudChyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcbiAgICB9LFxuICB9O1xufVxuIiwKICAgICJpbXBvcnQgeyBDb21wYXRfRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5IH0gZnJvbSAnLi9GaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkuanMnO1xuaW1wb3J0IHsgQ29tcGF0X0ZpbGVTeXN0ZW1FbnRyeSB9IGZyb20gJy4vRmlsZVN5c3RlbUVudHJ5LmpzJztcblxuZXhwb3J0IGNsYXNzIEZpbGVTeXN0ZW1FbnRyeUl0ZXJhdG9yIHtcbiAgbGlzdDogRmlsZVN5c3RlbUVudHJ5W10gPSBbXTtcbiAgY29uc3RydWN0b3IoZW50cmllcz86IEZpbGVTeXN0ZW1FbnRyeSB8IEZpbGVTeXN0ZW1FbnRyeVtdIHwgbnVsbCkge1xuICAgIGlmIChlbnRyaWVzKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShlbnRyaWVzKSkge1xuICAgICAgICB0aGlzLmxpc3QgPSBlbnRyaWVzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5saXN0ID0gW2VudHJpZXNdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqZ2V0RGlyZWN0b3J5RW50cnkoKTogR2VuZXJhdG9yPEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeT4ge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5saXN0KSB7XG4gICAgICBpZiAoQ29tcGF0X0ZpbGVTeXN0ZW1FbnRyeShlbnRyeSkuaXNEaXJlY3RvcnkpIHtcbiAgICAgICAgeWllbGQgZW50cnkgYXMgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqZ2V0RmlsZUVudHJ5KCk6IEdlbmVyYXRvcjxGaWxlU3lzdGVtRmlsZUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGlmIChDb21wYXRfRmlsZVN5c3RlbUVudHJ5KGVudHJ5KS5pc0ZpbGUpIHtcbiAgICAgICAgeWllbGQgZW50cnkgYXMgRmlsZVN5c3RlbUZpbGVFbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yIHtcbiAgbGlzdDogRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5W10gPSBbXTtcbiAgY29uc3RydWN0b3IoZW50cmllcz86IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSB8IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeVtdIHwgbnVsbCkge1xuICAgIGlmIChlbnRyaWVzKSB7XG4gICAgICBpZiAoQXJyYXkuaXNBcnJheShlbnRyaWVzKSkge1xuICAgICAgICB0aGlzLmxpc3QgPSBlbnRyaWVzO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5saXN0ID0gW2VudHJpZXNdO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqZ2V0RW50cnkoKTogQXN5bmNHZW5lcmF0b3I8RmlsZVN5c3RlbUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IHJlYWRlciA9IENvbXBhdF9GaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkoZW50cnkpLmNyZWF0ZVJlYWRlcigpO1xuICAgICAgaWYgKHJlYWRlcikge1xuICAgICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGF3YWl0IG5ldyBQcm9taXNlPEZpbGVTeXN0ZW1FbnRyeVtdPigocmVzb2x2ZSwgcmVqZWN0KSA9PiByZWFkZXIucmVhZEVudHJpZXMocmVzb2x2ZSwgcmVqZWN0KSkpIHtcbiAgICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICJleHBvcnQgZnVuY3Rpb24gSXNEZXZpY2VNb2JpbGUoKTogYm9vbGVhbiB7XG4gIHJldHVybiAvYW5kcm9pZHxpcGhvbmV8bW9iaWxlL2kudGVzdCh3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudCk7XG59XG4iLAogICAgImltcG9ydCB7IEhhc1Byb3BlcnR5IH0gZnJvbSAnLi4vVXRpbGl0eS9HdWFyZC5qcyc7XG5pbXBvcnQgeyBJc0RldmljZU1vYmlsZSB9IGZyb20gJy4vRGV2aWNlLmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIENvbXBhdF9IVE1MSW5wdXRFbGVtZW50KGlucHV0PzogSFRNTElucHV0RWxlbWVudCkge1xuICByZXR1cm4ge1xuICAgIGdldCB3ZWJraXRFbnRyaWVzKCk6IEhUTUxJbnB1dEVsZW1lbnRbJ3dlYmtpdEVudHJpZXMnXSB8IHVuZGVmaW5lZCB7XG4gICAgICByZXR1cm4gSGFzUHJvcGVydHkoaW5wdXQsICd3ZWJraXRFbnRyaWVzJykgPyBpbnB1dC53ZWJraXRFbnRyaWVzIDogdW5kZWZpbmVkO1xuICAgIH0sXG4gICAgZ2V0IHdlYmtpdGRpcmVjdG9yeSgpOiBIVE1MSW5wdXRFbGVtZW50Wyd3ZWJraXRkaXJlY3RvcnknXSB8IHVuZGVmaW5lZCB7XG4gICAgICByZXR1cm4gSGFzUHJvcGVydHkoaW5wdXQsICd3ZWJraXRkaXJlY3RvcnknKSA/IGlucHV0LndlYmtpdGRpcmVjdG9yeSA6IHVuZGVmaW5lZDtcbiAgICB9LFxuICB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gSXNXZWJraXREaXJlY3RvcnlTdXBwb3J0ZWQoKTogYm9vbGVhbiB7XG4gIHJldHVybiBJc0RldmljZU1vYmlsZSgpID8gZmFsc2UgOiB0cnVlO1xufVxuIiwKICAgICJpbXBvcnQgeyBTbGVlcCB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvQWxnb3JpdGhtL1NsZWVwLmpzJztcbmltcG9ydCB7IEpvYlF1ZXVlIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L0pvYlF1ZXVlLmpzJztcbmltcG9ydCB7IFJlY3Vyc2l2ZUl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L1JlY3Vyc2l2ZUFzeW5jSXRlcmF0b3IuanMnO1xuaW1wb3J0IHR5cGUgeyBTeW5jQXN5bmNJdGVyYWJsZSB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9UeXBlcy5qcyc7XG5pbXBvcnQgeyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRGF0YVRyYW5zZmVySXRlbV9VdGlsaXR5LmpzJztcbmltcG9ydCB7IENvbXBhdF9GaWxlIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0ZpbGUuanMnO1xuaW1wb3J0IHsgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5SXRlcmF0b3IsIEZpbGVTeXN0ZW1FbnRyeUl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0ZpbGVTeXN0ZW1fVXRpbGl0eS5qcyc7XG5pbXBvcnQgeyBDb21wYXRfSFRNTElucHV0RWxlbWVudCwgSXNXZWJraXREaXJlY3RvcnlTdXBwb3J0ZWQgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvSFRNTElucHV0RWxlbWVudC5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cERyYWdBbmREcm9wRmlsZVBpY2tlcihcbiAgY29udGFpbmVyOiBFbGVtZW50LFxuICBmbjoge1xuICAgIG9uRHJhZ0VuZD86ICgpID0+IHZvaWQ7XG4gICAgb25EcmFnRW50ZXI/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJhZ0xlYXZlPzogKCkgPT4gdm9pZDtcbiAgICBvbkRyb3A/OiAoKSA9PiB2b2lkO1xuICAgIG9uVXBsb2FkRW5kPzogKCkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG4gICAgb25VcGxvYWRFcnJvcj86IChlcnJvcjogYW55KSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbiAgICBvblVwbG9hZE5leHRGaWxlOiAoZmlsZTogRmlsZSwgZG9uZTogKCkgPT4gdm9pZCkgPT4gUHJvbWlzZTx2b2lkPiB8IHZvaWQ7XG4gICAgb25VcGxvYWRTdGFydD86ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuICB9LFxuICBvcHRpb25zPzoge1xuICAgIGFjY2VwdD86IHN0cmluZztcbiAgICBkaXJlY3Rvcnk/OiBib29sZWFuO1xuICAgIG11bHRpcGxlPzogYm9vbGVhbjtcbiAgfSxcbikge1xuICBjb25zdCBlbGVtZW50ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0Jyk7XG4gIGlmICghZWxlbWVudCkge1xuICAgIHRocm93ICdkcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyIGlucHV0IGVsZW1lbnQgbWlzc2luZyc7XG4gIH1cbiAgaWYgKG9wdGlvbnM/LmFjY2VwdCkge1xuICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdhY2NlcHQnLCBvcHRpb25zLmFjY2VwdCk7XG4gIH1cbiAgaWYgKG9wdGlvbnM/LmRpcmVjdG9yeSA9PT0gdHJ1ZSAmJiBJc1dlYmtpdERpcmVjdG9yeVN1cHBvcnRlZCgpKSB7XG4gICAgZWxlbWVudC50b2dnbGVBdHRyaWJ1dGUoJ3dlYmtpdGRpcmVjdG9yeScsIHRydWUpO1xuICB9XG4gIGlmIChvcHRpb25zPy5tdWx0aXBsZSA9PT0gdHJ1ZSkge1xuICAgIGVsZW1lbnQudG9nZ2xlQXR0cmlidXRlKCdtdWx0aXBsZScsIHRydWUpO1xuICB9XG5cbiAgaWYgKGZuLm9uRHJhZ0VuZCB8fCBmbi5vbkRyYWdFbnRlciB8fCBmbi5vbkRyYWdMZWF2ZSkge1xuICAgIGNvbnN0IHJlbW92ZUxpc3RlbmVycyA9ICgpID0+IHtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgZHJhZ2xlYXZlSGFuZGxlcik7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBkcmFnZW5kSGFuZGxlcik7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBkcm9wSGFuZGxlcik7XG4gICAgfTtcbiAgICBjb25zdCBkcmFnZW5kSGFuZGxlciA9ICgpID0+IHtcbiAgICAgIHJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgZm4ub25EcmFnRW5kPy4oKTtcbiAgICB9O1xuICAgIGNvbnN0IGRyYWdsZWF2ZUhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICByZW1vdmVMaXN0ZW5lcnMoKTtcbiAgICAgIGZuLm9uRHJhZ0xlYXZlPy4oKTtcbiAgICB9O1xuICAgIGNvbnN0IGRyb3BIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgcmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICBmbi5vbkRyb3A/LigpO1xuICAgIH07XG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW50ZXInLCAoKSA9PiB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdsZWF2ZUhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xuICAgICAgZm4ub25EcmFnRW50ZXI/LigpO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZlNFbnRyeVNldCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBmU0VudHJ5SXRlcmF0b3IgPSBuZXcgUmVjdXJzaXZlSXRlcmF0b3I8RmlsZVN5c3RlbUVudHJ5LCBGaWxlU3lzdGVtRmlsZUVudHJ5Pihhc3luYyBmdW5jdGlvbiogKGZTRW50cnlJdGVyYXRvciwgcHVzaCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZlNFbnRyeSBvZiBmU0VudHJ5SXRlcmF0b3IpIHtcbiAgICAgIGNvbnN0IHBhdGggPSBmU0VudHJ5LmZ1bGxQYXRoLnNsaWNlKDEpO1xuICAgICAgaWYgKCFmU0VudHJ5U2V0LmhhcyhwYXRoKSkge1xuICAgICAgICBmU0VudHJ5U2V0LmFkZChwYXRoKTtcbiAgICAgICAgY29uc3QgZnNFbnRyaWVzID0gbmV3IEZpbGVTeXN0ZW1FbnRyeUl0ZXJhdG9yKGZTRW50cnkpO1xuICAgICAgICBmb3IgKGNvbnN0IGZTRmlsZUVudHJ5IG9mIGZzRW50cmllcy5nZXRGaWxlRW50cnkoKSkge1xuICAgICAgICAgIHlpZWxkIGZTRmlsZUVudHJ5O1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZlNEaXJlY3RvcnlFbnRyeSBvZiBmc0VudHJpZXMuZ2V0RGlyZWN0b3J5RW50cnkoKSkge1xuICAgICAgICAgIHB1c2gobmV3IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yKGZTRGlyZWN0b3J5RW50cnkpLmdldEVudHJ5KCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBqb2JRdWV1ZSA9IG5ldyBKb2JRdWV1ZTx2b2lkLCBzdHJpbmc+KC0xKTtcbiAgam9iUXVldWUuc3Vic2NyaWJlKChfLCBlcnJvcikgPT4ge1xuICAgIGlmIChlcnJvcikge1xuICAgICAgZm4/Lm9uVXBsb2FkRXJyb3I/LihlcnJvcik7XG4gICAgfVxuICB9KTtcblxuICBsZXQgZG9uZSA9IHRydWU7XG4gIGxldCBydW5uaW5nID0gZmFsc2U7XG4gIGNvbnN0IHVwbG9hZFN0YXJ0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmIChydW5uaW5nID09PSBmYWxzZSkge1xuICAgICAgZG9uZSA9IGZhbHNlO1xuICAgICAgcnVubmluZyA9IHRydWU7XG4gICAgICBhd2FpdCBmbi5vblVwbG9hZFN0YXJ0Py4oKTtcbiAgICAgIC8vIGdpdmUgYnJvd3NlciBzb21lIHRpbWUgdG8gcXVldWUgYm90aCBldmVudHNcbiAgICAgIFNsZWVwKDUwMCkudGhlbihhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IGpvYlF1ZXVlLmRvbmU7XG4gICAgICAgIHVwbG9hZEVuZCgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuICBjb25zdCB1cGxvYWRFbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgZG9uZSA9IHRydWU7XG4gICAgcnVubmluZyA9IGZhbHNlO1xuICAgIGF3YWl0IGZuLm9uVXBsb2FkRW5kPy4oKTtcbiAgICBqb2JRdWV1ZS5yZXNldCgpO1xuICAgIGZTRW50cnlTZXQuY2xlYXIoKTtcbiAgfTtcbiAgY29uc3QgaXRlcmF0ZUZTRW50cmllcyA9IGFzeW5jIChlbnRyaWVzOiBTeW5jQXN5bmNJdGVyYWJsZTxGaWxlU3lzdGVtRW50cnk+LCBmaWxlczogRmlsZUxpc3QpID0+IHtcbiAgICBpZiAoZG9uZSA9PT0gZmFsc2UpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZlNGaWxlRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yLml0ZXJhdGUoZW50cmllcykpIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IG5ldyBQcm9taXNlPEZpbGU+KChyZXNvbHZlLCByZWplY3QpID0+IGZTRmlsZUVudHJ5LmZpbGUocmVzb2x2ZSwgcmVqZWN0KSk7XG4gICAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKCk7XG4gICAgICAgIHJlYWRlci5yZWFkQXNUZXh0KGZpbGUpO1xuICAgICAgICBhd2FpdCBmbi5vblVwbG9hZE5leHRGaWxlKGZpbGUsICgpID0+IChkb25lID0gdHJ1ZSkpO1xuICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgIGlmIChkb25lID09PSB0cnVlKSByZXR1cm47XG4gICAgICB9XG4gICAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgICAgY29uc3QgcGF0aCA9IENvbXBhdF9GaWxlKGZpbGUpLndlYmtpdFJlbGF0aXZlUGF0aCArIGZpbGUubmFtZTtcbiAgICAgICAgaWYgKCFmU0VudHJ5U2V0LmhhcyhwYXRoKSkge1xuICAgICAgICAgIGZTRW50cnlTZXQuYWRkKHBhdGgpO1xuICAgICAgICAgIGlmIChmaWxlLnNpemUgPiAwKSB7XG4gICAgICAgICAgICBhd2FpdCBmbi5vblVwbG9hZE5leHRGaWxlKGZpbGUsICgpID0+IChkb25lID0gdHJ1ZSkpO1xuICAgICAgICAgICAgLy8gQHRzLWlnbm9yZVxuICAgICAgICAgICAgaWYgKGRvbmUgPT09IHRydWUpIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH07XG4gIGNvbnN0IGNoYW5nZUhhbmRsZXIgPSAoKSA9PiB7XG4gICAgam9iUXVldWUuYWRkKGFzeW5jICgpID0+IHtcbiAgICAgIGF3YWl0IHVwbG9hZFN0YXJ0KCk7XG4gICAgICBpZiAoZG9uZSA9PT0gZmFsc2UgJiYgZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQgJiYgZWxlbWVudC5maWxlcykge1xuICAgICAgICBhd2FpdCBpdGVyYXRlRlNFbnRyaWVzKENvbXBhdF9IVE1MSW5wdXRFbGVtZW50KGVsZW1lbnQpLndlYmtpdEVudHJpZXMgPz8gW10sIGVsZW1lbnQuZmlsZXMpO1xuICAgICAgfVxuICAgIH0sICdjaGFuZ2VIYW5kbGVyJyk7XG4gIH07XG4gIGNvbnN0IGRyb3BIYW5kbGVyID0gKGV2ZW50OiBEcmFnRXZlbnQpID0+IHtcbiAgICBqb2JRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgdXBsb2FkU3RhcnQoKTtcbiAgICAgIGlmIChkb25lID09PSBmYWxzZSAmJiBldmVudC5kYXRhVHJhbnNmZXIpIHtcbiAgICAgICAgY29uc3QgZGF0YVRyYW5zZmVySXRlbXMgPSBuZXcgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yKGV2ZW50LmRhdGFUcmFuc2Zlci5pdGVtcyk7XG4gICAgICAgIGF3YWl0IGl0ZXJhdGVGU0VudHJpZXMoZGF0YVRyYW5zZmVySXRlbXMuZ2V0QXNFbnRyeSgpLCBldmVudC5kYXRhVHJhbnNmZXIuZmlsZXMpO1xuICAgICAgfVxuICAgIH0sICdkcm9wSGFuZGxlcicpO1xuICB9O1xuICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGNoYW5nZUhhbmRsZXIpO1xuICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBkcm9wSGFuZGxlcik7XG59XG4iLAogICAgImltcG9ydCB7IHNldHVwRHJhZ0FuZERyb3BGaWxlUGlja2VyIH0gZnJvbSAnLi9jb21wb25lbnRzL2RyYWctYW5kLWRyb3AtZmlsZS1waWNrZXIvZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci5qcyc7XG5pbXBvcnQgeyBKb2JRdWV1ZSB9IGZyb20gJy4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L0pvYlF1ZXVlLmpzJztcblxuLy8gISBvbmUgZGF5IHVzZSBFdmVudE1hbmFnZXJcbmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIChldmVudCkgPT4gZXZlbnQucHJldmVudERlZmF1bHQoKSk7XG5cbmNvbnN0IGZpbGVfcGlja2VyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmRyYWctYW5kLWRyb3AtZmlsZS1waWNrZXInKTtcbmNvbnN0IG1haW4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdtYWluJyk7XG5cbmxldCBpbWFnZUxvYWRDb3VudCA9IDA7XG5jb25zdCBpbWFnZUxvYWRRdWV1ZSA9IG5ldyBKb2JRdWV1ZSgtMSk7XG5pZiAoZmlsZV9waWNrZXIpIHtcbiAgc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIoXG4gICAgZmlsZV9waWNrZXIsXG4gICAge1xuICAgICAgb25VcGxvYWRTdGFydCgpIHtcbiAgICAgICAgZmlsZV9waWNrZXIuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG4gICAgICAgIG1haW4/LnJlcGxhY2VDaGlsZHJlbigpO1xuICAgICAgfSxcbiAgICAgIG9uVXBsb2FkTmV4dEZpbGU6IGFkZEltYWdlLFxuICAgICAgb25VcGxvYWRFbmQoKSB7XG4gICAgICAgIGltYWdlTG9hZFF1ZXVlLmRvbmUudGhlbigoKSA9PiB7XG4gICAgICAgICAgaWYgKGltYWdlTG9hZENvdW50ID09PSAwKSB7XG4gICAgICAgICAgICBmaWxlX3BpY2tlci5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcbiAgICAgICAgICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgZGl2LnN0eWxlLmNvbG9yID0gJ3JlZCc7XG4gICAgICAgICAgICBkaXYudGV4dENvbnRlbnQgPSAnTm8gSW1hZ2VzIEZvdW5kISBUcnkgYW5vdGhlciBmb2xkZXIuJztcbiAgICAgICAgICAgIGZpbGVfcGlja2VyLnF1ZXJ5U2VsZWN0b3IoJ3NwYW4nKT8uYXBwZW5kKFxuICAgICAgICAgICAgICBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdicicpLCAvL1xuICAgICAgICAgICAgICBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdicicpLFxuICAgICAgICAgICAgICBkaXYsXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgZGlyZWN0b3J5OiB0cnVlLFxuICAgICAgbXVsdGlwbGU6IHRydWUsXG4gICAgfSxcbiAgKTtcbn1cblxuZnVuY3Rpb24gYWRkSW1hZ2UoZmlsZTogRmlsZSkge1xuICBpbWFnZUxvYWRRdWV1ZS5hZGQoXG4gICAgKCkgPT5cbiAgICAgIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICAgICAgICBjb25zdCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICBtYWluPy5hcHBlbmQoZGl2KTtcbiAgICAgICAgICBpbWcuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChmaWxlKTtcbiAgICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGRpdi5hcHBlbmQoaW1nKTtcbiAgICAgICAgICAgIGltYWdlTG9hZENvdW50Kys7XG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgKCkgPT4ge1xuICAgICAgICAgICAgZGl2LnJlbW92ZSgpO1xuICAgICAgICAgICAgcmVqZWN0KCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgICAgICByZWplY3QoKTtcbiAg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QUFDdkIsWUFBTSxZQUFZO0FBQ2xCLFVBQUksU0FBUyxTQUFTLE1BQU0sY0FBYztBQUN4QyxjQUFNLG9CQUFvQixJQUFJLHlCQUF5QixNQUFNLGFBQWEsS0FBSztBQUMvRSxjQUFNLGlCQUFpQixrQkFBa0IsV0FBVyxHQUFHLE1BQU0sYUFBYSxLQUFLO0FBQUEsTUFDakY7QUFBQSxPQUNDLGFBQWE7QUFBQTtBQUVsQixVQUFRLGlCQUFpQixVQUFVLGFBQWE7QUFDaEQsVUFBUSxpQkFBaUIsUUFBUSxXQUFXO0FBQUE7OztBQzlHOUMsU0FBUyxRQUFRLENBQUMsTUFBWTtBQUM1QixpQkFBZSxJQUNiLE1BQ0UsSUFBSSxRQUFjLENBQUMsU0FBUyxXQUFXO0FBQ3JDLFFBQUk7QUFDRixZQUFNLE1BQU0sU0FBUyxjQUFjLEtBQUs7QUFDeEMsWUFBTSxNQUFNLFNBQVMsY0FBYyxLQUFLO0FBQ3hDLFlBQU0sT0FBTyxHQUFHO0FBQ2hCLFVBQUksTUFBTSxJQUFJLGdCQUFnQixJQUFJO0FBQ2xDLFVBQUksaUJBQWlCLFFBQVEsTUFBTTtBQUNqQyxZQUFJLE9BQU8sR0FBRztBQUNkO0FBQ0EsZ0JBQVE7QUFBQSxPQUNUO0FBQ0QsVUFBSSxpQkFBaUIsU0FBUyxNQUFNO0FBQ2xDLFlBQUksT0FBTztBQUNYLGVBQU87QUFBQSxPQUNSO0FBQUEsYUFDTSxHQUFQO0FBQ0EsYUFBTztBQUFBO0FBQUEsR0FFVixDQUNMO0FBQUE7QUE3REYsU0FBUyxnQkFBZ0IsaUJBQWlCLFlBQVksQ0FBQyxVQUFVLE1BQU0sZUFBZSxDQUFDO0FBRXZGLElBQU0sY0FBYyxTQUFTLGNBQWMsNEJBQTRCO0FBQ3ZFLElBQU0sT0FBTyxTQUFTLGNBQWMsTUFBTTtBQUUxQyxJQUFJLGlCQUFpQjtBQUNyQixJQUFNLGlCQUFpQixJQUFJLFNBQVMsRUFBRTtBQUN0QyxJQUFJLGFBQWE7QUFDZiw2QkFDRSxhQUNBO0FBQUEsSUFDRSxhQUFhLEdBQUc7QUFDZCxrQkFBWSxVQUFVLElBQUksUUFBUTtBQUNsQyxZQUFNLGdCQUFnQjtBQUFBO0FBQUEsSUFFeEIsa0JBQWtCO0FBQUEsSUFDbEIsV0FBVyxHQUFHO0FBQ1oscUJBQWUsS0FBSyxLQUFLLE1BQU07QUFDN0IsWUFBSSxtQkFBbUIsR0FBRztBQUN4QixzQkFBWSxVQUFVLE9BQU8sUUFBUTtBQUNyQyxnQkFBTSxNQUFNLFNBQVMsY0FBYyxLQUFLO0FBQ3hDLGNBQUksTUFBTSxRQUFRO0FBQ2xCLGNBQUksY0FBYztBQUNsQixzQkFBWSxjQUFjLE1BQU0sR0FBRyxPQUNqQyxTQUFTLGNBQWMsSUFBSSxHQUMzQixTQUFTLGNBQWMsSUFBSSxHQUMzQixHQUNGO0FBQUEsUUFDRjtBQUFBLE9BQ0Q7QUFBQTtBQUFBLEVBRUwsR0FDQTtBQUFBLElBQ0UsV0FBVztBQUFBLElBQ1gsVUFBVTtBQUFBLEVBQ1osQ0FDRjtBQUNGOyIsCiAgImRlYnVnSWQiOiAiMTA2N0VCRjBFNkE3NUI4RjY0NzU2RTIxNjQ3NTZFMjEiLAogICJuYW1lcyI6IFtdCn0=
