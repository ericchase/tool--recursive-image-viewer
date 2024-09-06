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

// src/lib/ericchase/Utility/JobQueue.ts
class JobQueue {
  delay_ms;
  constructor(delay_ms) {
    this.delay_ms = delay_ms;
  }
  abort() {
    this._aborted = true;
  }
  get aborted() {
    return this._aborted;
  }
  add(fn, tag) {
    if (this._aborted === false) {
      this.queue.push({ fn, tag });
      if (this.running === false) {
        this.running = true;
        this.run();
      }
    }
  }
  get done() {
    return this.completionCount === this.queue.length ? true : false;
  }
  reset() {
    return new Promise((resolve) => {
      this.runningCount.subscribe(() => {
        this._aborted = false;
        this.completionCount = 0;
        this.queue = [];
        this.queueIndex = 0;
        this.results = [];
        this.running = false;
        resolve();
      });
    });
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
  _aborted = false;
  completionCount = 0;
  queue = [];
  queueIndex = 0;
  results = [];
  running = false;
  runningCount = new Store(0);
  subscriptionSet = new Set();
  run() {
    if (this._aborted === false && this.queueIndex < this.queue.length) {
      const { fn, tag } = this.queue[this.queueIndex++];
      (async () => {
        this.runningCount.update((count) => count + 1);
        try {
          const value = await fn();
          this.send({ value, tag });
        } catch (error) {
          this.send({ error, tag });
        }
        this.runningCount.update((count) => count - 1);
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
    if (this._aborted === false) {
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
      for await (const fSEntry of this.fn(list[i], (value) => {
        list.push(value);
      })) {
        yield fSEntry;
      }
    }
  }
}

// src/lib/ericchase/Web API/DataTransfer.ts
class DataTransferItemIterator {
  list = [];
  constructor(items) {
    if (items instanceof DataTransferItem) {
      this.list = [items];
    } else if (items instanceof DataTransferItemList) {
      this.list = Array.from(items);
    } else if (Array.isArray(items)) {
      this.list = items;
    }
  }
  *getAsEntry() {
    for (const item of this.list) {
      const entry = item.getAsEntry?.() ?? item.webkitGetAsEntry?.();
      if (entry instanceof FileSystemEntry) {
        yield entry;
      }
    }
  }
  *getAsFile() {
    for (const item of this.list) {
      const file = item.getAsFile?.();
      if (file instanceof File) {
        yield file;
      }
    }
  }
  async *getAsString() {
    for (const item of this.list) {
      yield await new Promise((resolve, reject) => {
        if (typeof item.getAsString === 'function') {
          item.getAsString(resolve);
        } else {
          reject();
        }
      });
    }
  }
}

// src/lib/ericchase/Web API/FileSystem.ts
class FileSystemEntryIterator {
  list = [];
  constructor(entries) {
    if (entries instanceof FileSystemEntry) {
      this.list = [entries];
    } else if (Array.isArray(entries)) {
      this.list = entries;
    }
  }
  *getDirectoryEntry() {
    for (const entry of this.list) {
      if (entry.isDirectory && entry instanceof FileSystemDirectoryEntry) {
        yield entry;
      }
    }
  }
  *getFileEntry() {
    for (const entry of this.list) {
      if (entry.isFile && entry instanceof FileSystemFileEntry) {
        yield entry;
      }
    }
  }
}

class FileSystemDirectoryEntryIterator {
  list = [];
  constructor(entries) {
    if (entries instanceof FileSystemDirectoryEntry) {
      this.list = [entries];
    } else if (Array.isArray(entries)) {
      this.list = entries;
    }
  }
  async *getEntry() {
    for (const entry of this.list) {
      const reader = entry.createReader();
      for (const entry2 of await new Promise((resolve, reject) => reader.readEntries(resolve, reject))) {
        yield entry2;
      }
    }
  }
}

// src/lib/ericchase/Web API/HTMLInputElement.ts
function GetWebkitEntries(element) {
  return element.webkitEntries ?? undefined;
}
function GetWebkitRelativePath(file) {
  return file.webkitRelativePath ?? undefined;
}
function SupportsWebkitDirectory() {
  return /android|iphone|mobile/i.test(window.navigator.userAgent) === true ? false : true;
}

// src/components/drag-and-drop-file-picker/drag-and-drop-file-picker.ts
function setupDragAndDropFilePicker(container, fn, options) {
  const element = container.querySelector('input');
  if (!element) {
    throw 'drag-and-drop-file-picker input element missing';
  }
  if (options?.directory === true && SupportsWebkitDirectory()) {
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
      console.log({ path });
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
  let started = false;
  let ended = true;
  let done = true;
  const uploadStart = () => {
    if (started === false) {
      started = true;
      ended = false;
      done = false;
      fn.onUploadStart?.();
    }
  };
  const uploadEnd = () => {
    if (ended === false) {
      started = false;
      ended = true;
      jobQueue.abort();
      jobQueue.reset();
      fSEntrySet.clear();
      fn.onUploadEnd?.();
    }
  };
  const iterateFSEntries = async (initEntries, files) => {
    for await (const fSFileEntry of fSEntryIterator.iterate(initEntries)) {
      await fn.onUploadNextFile(await new Promise((resolve, reject) => fSFileEntry.file(resolve, reject)), () => (done = true));
      if (done === true) return uploadEnd();
    }
    for (const file of files) {
      const path = GetWebkitRelativePath(file) + file.name;
      console.log({ path });
      if (!fSEntrySet.has(path)) {
        fSEntrySet.add(path);
        await fn.onUploadNextFile(file, () => (done = true));
        if (done === true) return uploadEnd();
      }
    }
  };
  const changeHandler = () => {
    jobQueue.add(async () => {
      uploadStart();
      if (element instanceof HTMLInputElement && element.files) {
        await iterateFSEntries(GetWebkitEntries(element) ?? [], element.files);
      }
      uploadEnd();
    }, 'changeHandler');
  };
  const dropHandler = (event) => {
    jobQueue.add(async () => {
      uploadStart();
      if (event.dataTransfer) {
        const dataTransferItems = new DataTransferItemIterator(event.dataTransfer.items);
        await iterateFSEntries(dataTransferItems.getAsEntry(), event.dataTransfer.files);
      }
      uploadEnd();
    }, 'dropHandler');
  };
  element.addEventListener('change', changeHandler);
  element.addEventListener('drop', dropHandler);
}

// src/index.ts
function showImage(file) {
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
      onUploadNextFile: showImage,
      onUploadEnd() {
        imageLoadQueue.subscribe(() => {
          if (imageLoadQueue.done) {
            if (imageLoadCount === 0) {
              file_picker.classList.remove('hidden');
              const div = document.createElement('div');
              div.style.color = 'red';
              div.textContent = 'No Images Found! Try another folder.';
              file_picker.querySelector('span')?.append(document.createElement('br'), document.createElement('br'), div);
            }
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

//# debugId=DA23C0DF7239035564756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcRGVzaWduIFBhdHRlcm5cXE9ic2VydmVyXFxTdG9yZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxKb2JRdWV1ZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxSZWN1cnNpdmVBc3luY0l0ZXJhdG9yLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXERhdGFUcmFuc2Zlci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlU3lzdGVtLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXEhUTUxJbnB1dEVsZW1lbnQudHMiLCAic3JjXFxjb21wb25lbnRzXFxkcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyXFxkcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyLnRzIiwgInNyY1xcaW5kZXgudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbCiAgICAiZXhwb3J0IHR5cGUgU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+ID0gKHZhbHVlOiBWYWx1ZSwgdW5zdWJzY3JpYmU6ICgpID0+IHZvaWQpID0+IHZvaWQ7XG5leHBvcnQgdHlwZSBVcGRhdGVDYWxsYmFjazxWYWx1ZT4gPSAodmFsdWU6IFZhbHVlKSA9PiBWYWx1ZTtcblxuZXhwb3J0IGNsYXNzIENvbnN0PFZhbHVlPiB7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPj4oKTtcbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIHZhbHVlPzogVmFsdWUpIHt9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBpZiAodGhpcy52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBjYWxsYmFjayh0aGlzLnZhbHVlLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZT4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMudmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgICBjYWxsYmFjayh2YWx1ZSwgKCkgPT4ge1xuICAgICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgU3RvcmU8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIGN1cnJlbnRWYWx1ZTogVmFsdWU7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPj4oKTtcbiAgY29uc3RydWN0b3IoXG4gICAgcHJvdGVjdGVkIGluaXRpYWxWYWx1ZTogVmFsdWUsXG4gICAgcHJvdGVjdGVkIG5vdGlmeU9uQ2hhbmdlT25seTogYm9vbGVhbiA9IGZhbHNlLFxuICApIHtcbiAgICB0aGlzLmN1cnJlbnRWYWx1ZSA9IGluaXRpYWxWYWx1ZTtcbiAgfVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmFkZChjYWxsYmFjayk7XG4gICAgY29uc3QgdW5zdWJzY3JpYmUgPSAoKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgIH07XG4gICAgY2FsbGJhY2sodGhpcy5jdXJyZW50VmFsdWUsIHVuc3Vic2NyaWJlKTtcbiAgICByZXR1cm4gdW5zdWJzY3JpYmU7XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWU+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWU+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLm5vdGlmeU9uQ2hhbmdlT25seSAmJiB0aGlzLmN1cnJlbnRWYWx1ZSA9PT0gdmFsdWUpIHJldHVybjtcbiAgICB0aGlzLmN1cnJlbnRWYWx1ZSA9IHZhbHVlO1xuICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5zdWJzY3JpcHRpb25TZXQpIHtcbiAgICAgIGNhbGxiYWNrKHZhbHVlLCAoKSA9PiB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbiAgdXBkYXRlKGNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjazxWYWx1ZT4pOiB2b2lkIHtcbiAgICB0aGlzLnNldChjYWxsYmFjayh0aGlzLmN1cnJlbnRWYWx1ZSkpO1xuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBPcHRpb25hbDxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgc3RvcmU6IFN0b3JlPFZhbHVlIHwgdW5kZWZpbmVkPjtcbiAgY29uc3RydWN0b3Iobm90aWZ5T25DaGFuZ2VPbmx5ID0gZmFsc2UpIHtcbiAgICB0aGlzLnN0b3JlID0gbmV3IFN0b3JlPFZhbHVlIHwgdW5kZWZpbmVkPih1bmRlZmluZWQsIG5vdGlmeU9uQ2hhbmdlT25seSk7XG4gIH1cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZSB8IHVuZGVmaW5lZD4pOiAoKSA9PiB2b2lkIHtcbiAgICByZXR1cm4gdGhpcy5zdG9yZS5zdWJzY3JpYmUoY2FsbGJhY2spO1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlIHwgdW5kZWZpbmVkPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlIHwgdW5kZWZpbmVkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUgfCB1bmRlZmluZWQpOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLnNldCh2YWx1ZSk7XG4gIH1cbiAgdXBkYXRlKGNhbGxiYWNrOiBVcGRhdGVDYWxsYmFjazxWYWx1ZSB8IHVuZGVmaW5lZD4pOiB2b2lkIHtcbiAgICB0aGlzLnN0b3JlLnVwZGF0ZShjYWxsYmFjayk7XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIENvbXBvdW5kU3Vic2NyaXB0aW9uPFQgZXh0ZW5kcyBhbnlbXT4oc3RvcmVzOiB7IFtLIGluIGtleW9mIFRdOiBTdG9yZTxUW0tdPiB8IE9wdGlvbmFsPFRbS10+IH0sIGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazx7IFtLIGluIGtleW9mIFRdOiBUW0tdIHwgdW5kZWZpbmVkIH0+KTogKCkgPT4gdm9pZCB7XG4gIGNvbnN0IHVuc3ViczogKCgpID0+IHZvaWQpW10gPSBbXTtcbiAgY29uc3QgdW5zdWJzY3JpYmUgPSAoKSA9PiB7XG4gICAgZm9yIChjb25zdCB1bnN1YiBvZiB1bnN1YnMpIHtcbiAgICAgIHVuc3ViKCk7XG4gICAgfVxuICB9O1xuICBjb25zdCB2YWx1ZXMgPSBbXSBhcyB7IFtLIGluIGtleW9mIFRdOiBUW0tdIHwgdW5kZWZpbmVkIH07XG4gIGNvbnN0IGNhbGxiYWNrX2hhbmRsZXIgPSAoKSA9PiB7XG4gICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IHN0b3Jlcy5sZW5ndGgpIHtcbiAgICAgIGNhbGxiYWNrKHZhbHVlcywgdW5zdWJzY3JpYmUpO1xuICAgIH1cbiAgfTtcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBzdG9yZXMubGVuZ3RoOyBpKyspIHtcbiAgICBzdG9yZXNbaV0uc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgIHZhbHVlc1tpXSA9IHZhbHVlO1xuICAgICAgdW5zdWJzW2ldID0gdW5zdWJzY3JpYmU7XG4gICAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gc3RvcmVzLmxlbmd0aCkge1xuICAgICAgICBjYWxsYmFja19oYW5kbGVyKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbiAgcmV0dXJuIHVuc3Vic2NyaWJlO1xufVxuIiwKICAgICJpbXBvcnQgeyBTdG9yZSB9IGZyb20gJy4uL0Rlc2lnbiBQYXR0ZXJuL09ic2VydmVyL1N0b3JlLmpzJztcblxuZXhwb3J0IHR5cGUgU3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+ID0gKHJlc3VsdD86IFJlc3VsdCwgZXJyb3I/OiBFcnJvciwgdGFnPzogVGFnKSA9PiB7IGFib3J0OiBib29sZWFuIH0gfCB2b2lkO1xuXG5leHBvcnQgY2xhc3MgSm9iUXVldWU8UmVzdWx0ID0gdm9pZCwgVGFnID0gdm9pZD4ge1xuICAvKipcbiAgICogMDogTm8gZGVsYXkuIC0xOiBDb25zZWN1dGl2ZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBkZWxheV9tczogbnVtYmVyKSB7fVxuICBwdWJsaWMgYWJvcnQoKSB7XG4gICAgdGhpcy5fYWJvcnRlZCA9IHRydWU7XG4gIH1cbiAgcHVibGljIGdldCBhYm9ydGVkKCkge1xuICAgIHJldHVybiB0aGlzLl9hYm9ydGVkO1xuICB9XG4gIHB1YmxpYyBhZGQoZm46ICgpID0+IFByb21pc2U8UmVzdWx0PiwgdGFnPzogVGFnKSB7XG4gICAgaWYgKHRoaXMuX2Fib3J0ZWQgPT09IGZhbHNlKSB7XG4gICAgICB0aGlzLnF1ZXVlLnB1c2goeyBmbiwgdGFnIH0pO1xuICAgICAgaWYgKHRoaXMucnVubmluZyA9PT0gZmFsc2UpIHtcbiAgICAgICAgdGhpcy5ydW5uaW5nID0gdHJ1ZTtcbiAgICAgICAgdGhpcy5ydW4oKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgcHVibGljIGdldCBkb25lKCkge1xuICAgIHJldHVybiB0aGlzLmNvbXBsZXRpb25Db3VudCA9PT0gdGhpcy5xdWV1ZS5sZW5ndGggPyB0cnVlIDogZmFsc2U7XG4gIH1cbiAgcHVibGljIHJlc2V0KCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5ydW5uaW5nQ291bnQuc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgICAgdGhpcy5fYWJvcnRlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLmNvbXBsZXRpb25Db3VudCA9IDA7XG4gICAgICAgIHRoaXMucXVldWUgPSBbXTtcbiAgICAgICAgdGhpcy5xdWV1ZUluZGV4ID0gMDtcbiAgICAgICAgdGhpcy5yZXN1bHRzID0gW107XG4gICAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgICAgICByZXNvbHZlKCk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBwdWJsaWMgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxSZXN1bHQsIFRhZz4pOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5hZGQoY2FsbGJhY2spO1xuICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIHRoaXMucmVzdWx0cykge1xuICAgICAgaWYgKGNhbGxiYWNrKHJlc3VsdC52YWx1ZSwgcmVzdWx0LmVycm9yKT8uYWJvcnQgPT09IHRydWUpIHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuICgpID0+IHt9O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICB9XG4gIHByb3RlY3RlZCBfYWJvcnRlZCA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgY29tcGxldGlvbkNvdW50ID0gMDtcbiAgcHJvdGVjdGVkIHF1ZXVlOiB7IGZuOiAoKSA9PiBQcm9taXNlPFJlc3VsdD47IHRhZz86IFRhZyB9W10gPSBbXTtcbiAgcHJvdGVjdGVkIHF1ZXVlSW5kZXggPSAwO1xuICBwcm90ZWN0ZWQgcmVzdWx0czogeyB2YWx1ZT86IFJlc3VsdDsgZXJyb3I/OiBFcnJvciB9W10gPSBbXTtcbiAgcHJvdGVjdGVkIHJ1bm5pbmcgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIHJ1bm5pbmdDb3VudCA9IG5ldyBTdG9yZSgwKTtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+PigpO1xuICBwcm90ZWN0ZWQgcnVuKCkge1xuICAgIGlmICh0aGlzLl9hYm9ydGVkID09PSBmYWxzZSAmJiB0aGlzLnF1ZXVlSW5kZXggPCB0aGlzLnF1ZXVlLmxlbmd0aCkge1xuICAgICAgY29uc3QgeyBmbiwgdGFnIH0gPSB0aGlzLnF1ZXVlW3RoaXMucXVldWVJbmRleCsrXTtcbiAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucnVubmluZ0NvdW50LnVwZGF0ZSgoY291bnQpID0+IGNvdW50ICsgMSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCBmbigpO1xuICAgICAgICAgIHRoaXMuc2VuZCh7IHZhbHVlLCB0YWcgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICB0aGlzLnNlbmQoeyBlcnJvciwgdGFnIH0pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucnVubmluZ0NvdW50LnVwZGF0ZSgoY291bnQpID0+IGNvdW50IC0gMSk7XG4gICAgICAgIGlmICh0aGlzLmRlbGF5X21zIDwgMCkge1xuICAgICAgICAgIHRoaXMucnVuKCk7XG4gICAgICAgIH1cbiAgICAgIH0pKCk7XG4gICAgICBpZiAodGhpcy5kZWxheV9tcyA+PSAwKSB7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5ydW4oKSwgdGhpcy5kZWxheV9tcyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucnVubmluZyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuICBwcm90ZWN0ZWQgc2VuZChyZXN1bHQ6IHsgdmFsdWU/OiBSZXN1bHQ7IGVycm9yPzogRXJyb3I7IHRhZz86IFRhZyB9KSB7XG4gICAgaWYgKHRoaXMuX2Fib3J0ZWQgPT09IGZhbHNlKSB7XG4gICAgICB0aGlzLmNvbXBsZXRpb25Db3VudCsrO1xuICAgICAgdGhpcy5yZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5zdWJzY3JpcHRpb25TZXQpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKHJlc3VsdC52YWx1ZSwgcmVzdWx0LmVycm9yLCByZXN1bHQudGFnKT8uYWJvcnQgPT09IHRydWUpIHtcbiAgICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgU3luY0FzeW5jSXRlcmFibGUgfSBmcm9tICcuL1R5cGUuanMnO1xuXG5leHBvcnQgY2xhc3MgUmVjdXJzaXZlSXRlcmF0b3I8SW4sIE91dD4ge1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgZm46ICh2YWx1ZTogU3luY0FzeW5jSXRlcmFibGU8SW4+LCBwdXNoOiAodmFsdWU6IFN5bmNBc3luY0l0ZXJhYmxlPEluPikgPT4gdm9pZCkgPT4gU3luY0FzeW5jSXRlcmFibGU8T3V0Pikge31cbiAgYXN5bmMgKml0ZXJhdGUoaW5pdDogU3luY0FzeW5jSXRlcmFibGU8SW4+KTogU3luY0FzeW5jSXRlcmFibGU8T3V0PiB7XG4gICAgY29uc3QgbGlzdDogU3luY0FzeW5jSXRlcmFibGU8SW4+W10gPSBbaW5pdF07XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgdGhpcy5mbihsaXN0W2ldLCAodmFsdWUpID0+IHtcbiAgICAgICAgbGlzdC5wdXNoKHZhbHVlKTtcbiAgICAgIH0pKSB7XG4gICAgICAgIHlpZWxkIGZTRW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgTiB9IGZyb20gJy4uL1V0aWxpdHkvVHlwZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3Ige1xuICBsaXN0OiBEYXRhVHJhbnNmZXJJdGVtW10gPSBbXTtcbiAgY29uc3RydWN0b3IoaXRlbXM/OiBOPERhdGFUcmFuc2Zlckl0ZW0+IHwgRGF0YVRyYW5zZmVySXRlbUxpc3QgfCBudWxsKSB7XG4gICAgaWYgKGl0ZW1zIGluc3RhbmNlb2YgRGF0YVRyYW5zZmVySXRlbSkge1xuICAgICAgdGhpcy5saXN0ID0gW2l0ZW1zXTtcbiAgICB9IGVsc2UgaWYgKGl0ZW1zIGluc3RhbmNlb2YgRGF0YVRyYW5zZmVySXRlbUxpc3QpIHtcbiAgICAgIHRoaXMubGlzdCA9IEFycmF5LmZyb20oaXRlbXMpO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShpdGVtcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGl0ZW1zO1xuICAgIH1cbiAgfVxuICAqZ2V0QXNFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgZW50cnkgPSAoaXRlbSBhcyBEYXRhVHJhbnNmZXJJdGVtICYgeyBnZXRBc0VudHJ5PzogRGF0YVRyYW5zZmVySXRlbVsnd2Via2l0R2V0QXNFbnRyeSddIH0pLmdldEFzRW50cnk/LigpID8/IGl0ZW0ud2Via2l0R2V0QXNFbnRyeT8uKCk7XG4gICAgICBpZiAoZW50cnkgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRW50cnkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICpnZXRBc0ZpbGUoKTogR2VuZXJhdG9yPEZpbGU+IHtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5saXN0KSB7XG4gICAgICBjb25zdCBmaWxlID0gaXRlbS5nZXRBc0ZpbGU/LigpO1xuICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBGaWxlKSB7XG4gICAgICAgIHlpZWxkIGZpbGU7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jICpnZXRBc1N0cmluZygpOiBBc3luY0dlbmVyYXRvcjxzdHJpbmc+IHtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5saXN0KSB7XG4gICAgICB5aWVsZCBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBpdGVtLmdldEFzU3RyaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgaXRlbS5nZXRBc1N0cmluZyhyZXNvbHZlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZWplY3QoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG4iLAogICAgImV4cG9ydCBjbGFzcyBGaWxlU3lzdGVtRW50cnlJdGVyYXRvciB7XG4gIGxpc3Q6IEZpbGVTeXN0ZW1FbnRyeVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGVudHJpZXM/OiBGaWxlU3lzdGVtRW50cnkgfCBGaWxlU3lzdGVtRW50cnlbXSB8IG51bGwpIHtcbiAgICBpZiAoZW50cmllcyBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1FbnRyeSkge1xuICAgICAgdGhpcy5saXN0ID0gW2VudHJpZXNdO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShlbnRyaWVzKSkge1xuICAgICAgdGhpcy5saXN0ID0gZW50cmllcztcbiAgICB9XG4gIH1cbiAgKmdldERpcmVjdG9yeUVudHJ5KCk6IEdlbmVyYXRvcjxGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubGlzdCkge1xuICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5ICYmIGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqZ2V0RmlsZUVudHJ5KCk6IEdlbmVyYXRvcjxGaWxlU3lzdGVtRmlsZUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGlmIChlbnRyeS5pc0ZpbGUgJiYgZW50cnkgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRmlsZUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5SXRlcmF0b3Ige1xuICBsaXN0OiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzPzogRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5IHwgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5W10gfCBudWxsKSB7XG4gICAgaWYgKGVudHJpZXMgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkpIHtcbiAgICAgIHRoaXMubGlzdCA9IFtlbnRyaWVzXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGVudHJpZXM7XG4gICAgfVxuICB9XG4gIGFzeW5jICpnZXRFbnRyeSgpOiBBc3luY0dlbmVyYXRvcjxGaWxlU3lzdGVtRW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgcmVhZGVyID0gZW50cnkuY3JlYXRlUmVhZGVyKCk7XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGF3YWl0IG5ldyBQcm9taXNlPEZpbGVTeXN0ZW1FbnRyeVtdPigocmVzb2x2ZSwgcmVqZWN0KSA9PiByZWFkZXIucmVhZEVudHJpZXMocmVzb2x2ZSwgcmVqZWN0KSkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgIi8vIFdlYmtpdCBHdWFyZHNcblxuZXhwb3J0IGZ1bmN0aW9uIEdldFdlYmtpdEVudHJpZXMoZWxlbWVudDogSFRNTElucHV0RWxlbWVudCk6IHJlYWRvbmx5IEZpbGVTeXN0ZW1FbnRyeVtdIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIGVsZW1lbnQud2Via2l0RW50cmllcyA/PyB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBHZXRXZWJraXRSZWxhdGl2ZVBhdGgoZmlsZTogRmlsZSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBmaWxlLndlYmtpdFJlbGF0aXZlUGF0aCA/PyB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBTdXBwb3J0c1dlYmtpdERpcmVjdG9yeSgpOiBib29sZWFuIHtcbiAgcmV0dXJuIC9hbmRyb2lkfGlwaG9uZXxtb2JpbGUvaS50ZXN0KHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50KSA9PT0gdHJ1ZSA/IGZhbHNlIDogdHJ1ZTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgSm9iUXVldWUgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvSm9iUXVldWUuanMnO1xuaW1wb3J0IHsgUmVjdXJzaXZlSXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvUmVjdXJzaXZlQXN5bmNJdGVyYXRvci5qcyc7XG5pbXBvcnQgdHlwZSB7IFN5bmNBc3luY0l0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L1R5cGUuanMnO1xuaW1wb3J0IHsgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0RhdGFUcmFuc2Zlci5qcyc7XG5pbXBvcnQgeyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvciwgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRmlsZVN5c3RlbS5qcyc7XG5pbXBvcnQgeyBHZXRXZWJraXRFbnRyaWVzLCBHZXRXZWJraXRSZWxhdGl2ZVBhdGgsIFN1cHBvcnRzV2Via2l0RGlyZWN0b3J5IH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0hUTUxJbnB1dEVsZW1lbnQuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIoXG4gIGNvbnRhaW5lcjogRWxlbWVudCxcbiAgZm46IHtcbiAgICBvbkRyYWdFbmQ/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJhZ0VudGVyPzogKCkgPT4gdm9pZDtcbiAgICBvbkRyYWdMZWF2ZT86ICgpID0+IHZvaWQ7XG4gICAgb25Ecm9wPzogKCkgPT4gdm9pZDtcbiAgICBvblVwbG9hZEVuZD86ICgpID0+IHZvaWQ7XG4gICAgb25VcGxvYWROZXh0RmlsZTogKGZpbGU6IEZpbGUsIGRvbmU6ICgpID0+IHZvaWQpID0+IFByb21pc2U8dm9pZD4gfCB2b2lkO1xuICAgIG9uVXBsb2FkU3RhcnQ/OiAoKSA9PiB2b2lkO1xuICB9LFxuICBvcHRpb25zPzoge1xuICAgIGRpcmVjdG9yeTogYm9vbGVhbjtcbiAgICBtdWx0aXBsZTogYm9vbGVhbjtcbiAgfSxcbikge1xuICBjb25zdCBlbGVtZW50ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0Jyk7XG4gIGlmICghZWxlbWVudCkge1xuICAgIHRocm93ICdkcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyIGlucHV0IGVsZW1lbnQgbWlzc2luZyc7XG4gIH1cbiAgaWYgKG9wdGlvbnM/LmRpcmVjdG9yeSA9PT0gdHJ1ZSAmJiBTdXBwb3J0c1dlYmtpdERpcmVjdG9yeSgpKSB7XG4gICAgZWxlbWVudC50b2dnbGVBdHRyaWJ1dGUoJ3dlYmtpdGRpcmVjdG9yeScsIHRydWUpO1xuICB9XG4gIGlmIChvcHRpb25zPy5tdWx0aXBsZSA9PT0gdHJ1ZSkge1xuICAgIGVsZW1lbnQudG9nZ2xlQXR0cmlidXRlKCdtdWx0aXBsZScsIHRydWUpO1xuICB9XG5cbiAgaWYgKGZuLm9uRHJhZ0VuZCB8fCBmbi5vbkRyYWdFbnRlciB8fCBmbi5vbkRyYWdMZWF2ZSkge1xuICAgIGNvbnN0IHJlbW92ZUxpc3RlbmVycyA9ICgpID0+IHtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgZHJhZ2xlYXZlSGFuZGxlcik7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBkcmFnZW5kSGFuZGxlcik7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBkcm9wSGFuZGxlcik7XG4gICAgfTtcbiAgICBjb25zdCBkcmFnZW5kSGFuZGxlciA9ICgpID0+IHtcbiAgICAgIHJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgZm4ub25EcmFnRW5kPy4oKTtcbiAgICB9O1xuICAgIGNvbnN0IGRyYWdsZWF2ZUhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICByZW1vdmVMaXN0ZW5lcnMoKTtcbiAgICAgIGZuLm9uRHJhZ0xlYXZlPy4oKTtcbiAgICB9O1xuICAgIGNvbnN0IGRyb3BIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgcmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICBmbi5vbkRyb3A/LigpO1xuICAgIH07XG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW50ZXInLCAoKSA9PiB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdsZWF2ZUhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xuICAgICAgZm4ub25EcmFnRW50ZXI/LigpO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZlNFbnRyeVNldCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBmU0VudHJ5SXRlcmF0b3IgPSBuZXcgUmVjdXJzaXZlSXRlcmF0b3I8RmlsZVN5c3RlbUVudHJ5LCBGaWxlU3lzdGVtRmlsZUVudHJ5Pihhc3luYyBmdW5jdGlvbiogKGZTRW50cnlJdGVyYXRvciwgcHVzaCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZlNFbnRyeSBvZiBmU0VudHJ5SXRlcmF0b3IpIHtcbiAgICAgIGNvbnN0IHBhdGggPSBmU0VudHJ5LmZ1bGxQYXRoLnNsaWNlKDEpO1xuICAgICAgY29uc29sZS5sb2coeyBwYXRoIH0pO1xuICAgICAgaWYgKCFmU0VudHJ5U2V0LmhhcyhwYXRoKSkge1xuICAgICAgICBmU0VudHJ5U2V0LmFkZChwYXRoKTtcbiAgICAgICAgY29uc3QgZnNFbnRyaWVzID0gbmV3IEZpbGVTeXN0ZW1FbnRyeUl0ZXJhdG9yKGZTRW50cnkpO1xuICAgICAgICBmb3IgKGNvbnN0IGZTRmlsZUVudHJ5IG9mIGZzRW50cmllcy5nZXRGaWxlRW50cnkoKSkge1xuICAgICAgICAgIHlpZWxkIGZTRmlsZUVudHJ5O1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZlNEaXJlY3RvcnlFbnRyeSBvZiBmc0VudHJpZXMuZ2V0RGlyZWN0b3J5RW50cnkoKSkge1xuICAgICAgICAgIHB1c2gobmV3IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yKGZTRGlyZWN0b3J5RW50cnkpLmdldEVudHJ5KCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBqb2JRdWV1ZSA9IG5ldyBKb2JRdWV1ZTx2b2lkLCBzdHJpbmc+KC0xKTtcbiAgbGV0IHN0YXJ0ZWQgPSBmYWxzZTtcbiAgbGV0IGVuZGVkID0gdHJ1ZTtcbiAgbGV0IGRvbmUgPSB0cnVlO1xuICBjb25zdCB1cGxvYWRTdGFydCA9ICgpID0+IHtcbiAgICBpZiAoc3RhcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHN0YXJ0ZWQgPSB0cnVlO1xuICAgICAgZW5kZWQgPSBmYWxzZTtcbiAgICAgIGRvbmUgPSBmYWxzZTtcbiAgICAgIGZuLm9uVXBsb2FkU3RhcnQ/LigpO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgdXBsb2FkRW5kID0gKCkgPT4ge1xuICAgIGlmIChlbmRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHN0YXJ0ZWQgPSBmYWxzZTtcbiAgICAgIGVuZGVkID0gdHJ1ZTtcbiAgICAgIGpvYlF1ZXVlLmFib3J0KCk7XG4gICAgICBqb2JRdWV1ZS5yZXNldCgpO1xuICAgICAgZlNFbnRyeVNldC5jbGVhcigpO1xuICAgICAgZm4ub25VcGxvYWRFbmQ/LigpO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgaXRlcmF0ZUZTRW50cmllcyA9IGFzeW5jIChpbml0RW50cmllczogU3luY0FzeW5jSXRlcmFibGU8RmlsZVN5c3RlbUVudHJ5PiwgZmlsZXM6IEZpbGVMaXN0KSA9PiB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBmU0ZpbGVFbnRyeSBvZiBmU0VudHJ5SXRlcmF0b3IuaXRlcmF0ZShpbml0RW50cmllcykpIHtcbiAgICAgIGF3YWl0IGZuLm9uVXBsb2FkTmV4dEZpbGUoYXdhaXQgbmV3IFByb21pc2U8RmlsZT4oKHJlc29sdmUsIHJlamVjdCkgPT4gZlNGaWxlRW50cnkuZmlsZShyZXNvbHZlLCByZWplY3QpKSwgKCkgPT4gKGRvbmUgPSB0cnVlKSk7XG4gICAgICBpZiAoZG9uZSA9PT0gdHJ1ZSkgcmV0dXJuIHVwbG9hZEVuZCgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIGNvbnN0IHBhdGggPSBHZXRXZWJraXRSZWxhdGl2ZVBhdGgoZmlsZSkgKyBmaWxlLm5hbWU7XG4gICAgICBjb25zb2xlLmxvZyh7IHBhdGggfSk7XG4gICAgICBpZiAoIWZTRW50cnlTZXQuaGFzKHBhdGgpKSB7XG4gICAgICAgIGZTRW50cnlTZXQuYWRkKHBhdGgpO1xuICAgICAgICBhd2FpdCBmbi5vblVwbG9hZE5leHRGaWxlKGZpbGUsICgpID0+IChkb25lID0gdHJ1ZSkpO1xuICAgICAgICBpZiAoZG9uZSA9PT0gdHJ1ZSkgcmV0dXJuIHVwbG9hZEVuZCgpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgY29uc3QgY2hhbmdlSGFuZGxlciA9ICgpID0+IHtcbiAgICBqb2JRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgdXBsb2FkU3RhcnQoKTtcbiAgICAgIGlmIChlbGVtZW50IGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCAmJiBlbGVtZW50LmZpbGVzKSB7XG4gICAgICAgIGF3YWl0IGl0ZXJhdGVGU0VudHJpZXMoR2V0V2Via2l0RW50cmllcyhlbGVtZW50KSA/PyBbXSwgZWxlbWVudC5maWxlcyk7XG4gICAgICB9XG4gICAgICB1cGxvYWRFbmQoKTtcbiAgICB9LCAnY2hhbmdlSGFuZGxlcicpO1xuICB9O1xuICBjb25zdCBkcm9wSGFuZGxlciA9IChldmVudDogRHJhZ0V2ZW50KSA9PiB7XG4gICAgam9iUXVldWUuYWRkKGFzeW5jICgpID0+IHtcbiAgICAgIHVwbG9hZFN0YXJ0KCk7XG4gICAgICBpZiAoZXZlbnQuZGF0YVRyYW5zZmVyKSB7XG4gICAgICAgIGNvbnN0IGRhdGFUcmFuc2Zlckl0ZW1zID0gbmV3IERhdGFUcmFuc2Zlckl0ZW1JdGVyYXRvcihldmVudC5kYXRhVHJhbnNmZXIuaXRlbXMpO1xuICAgICAgICBhd2FpdCBpdGVyYXRlRlNFbnRyaWVzKGRhdGFUcmFuc2Zlckl0ZW1zLmdldEFzRW50cnkoKSwgZXZlbnQuZGF0YVRyYW5zZmVyLmZpbGVzKTtcbiAgICAgIH1cbiAgICAgIHVwbG9hZEVuZCgpO1xuICAgIH0sICdkcm9wSGFuZGxlcicpO1xuICB9O1xuICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGNoYW5nZUhhbmRsZXIpO1xuICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBkcm9wSGFuZGxlcik7XG59XG4iLAogICAgImltcG9ydCB7IHNldHVwRHJhZ0FuZERyb3BGaWxlUGlja2VyIH0gZnJvbSAnLi9jb21wb25lbnRzL2RyYWctYW5kLWRyb3AtZmlsZS1waWNrZXIvZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci5qcyc7XG5pbXBvcnQgeyBKb2JRdWV1ZSB9IGZyb20gJy4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L0pvYlF1ZXVlLmpzJztcblxuLy8gISBvbmUgZGF5IHVzZSBFdmVudE1hbmFnZXJcbmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIChldmVudCkgPT4gZXZlbnQucHJldmVudERlZmF1bHQoKSk7XG5cbmNvbnN0IGZpbGVfcGlja2VyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmRyYWctYW5kLWRyb3AtZmlsZS1waWNrZXInKTtcbmNvbnN0IG1haW4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdtYWluJyk7XG5cbmxldCBpbWFnZUxvYWRDb3VudCA9IDA7XG5jb25zdCBpbWFnZUxvYWRRdWV1ZSA9IG5ldyBKb2JRdWV1ZSgtMSk7XG5pZiAoZmlsZV9waWNrZXIpIHtcbiAgc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIoXG4gICAgZmlsZV9waWNrZXIsXG4gICAge1xuICAgICAgb25VcGxvYWRTdGFydCgpIHtcbiAgICAgICAgZmlsZV9waWNrZXIuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG4gICAgICAgIG1haW4/LnJlcGxhY2VDaGlsZHJlbigpO1xuICAgICAgfSxcbiAgICAgIG9uVXBsb2FkTmV4dEZpbGU6IHNob3dJbWFnZSxcbiAgICAgIG9uVXBsb2FkRW5kKCkge1xuICAgICAgICBpbWFnZUxvYWRRdWV1ZS5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICAgIGlmIChpbWFnZUxvYWRRdWV1ZS5kb25lKSB7XG4gICAgICAgICAgICBpZiAoaW1hZ2VMb2FkQ291bnQgPT09IDApIHtcbiAgICAgICAgICAgICAgZmlsZV9waWNrZXIuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XG4gICAgICAgICAgICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICBkaXYuc3R5bGUuY29sb3IgPSAncmVkJztcbiAgICAgICAgICAgICAgZGl2LnRleHRDb250ZW50ID0gJ05vIEltYWdlcyBGb3VuZCEgVHJ5IGFub3RoZXIgZm9sZGVyLic7XG4gICAgICAgICAgICAgIGZpbGVfcGlja2VyLnF1ZXJ5U2VsZWN0b3IoJ3NwYW4nKT8uYXBwZW5kKFxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JyJyksIC8vXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnInKSxcbiAgICAgICAgICAgICAgICBkaXYsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBkaXJlY3Rvcnk6IHRydWUsXG4gICAgICBtdWx0aXBsZTogdHJ1ZSxcbiAgICB9LFxuICApO1xufVxuXG5mdW5jdGlvbiBzaG93SW1hZ2UoZmlsZTogRmlsZSkge1xuICBpbWFnZUxvYWRRdWV1ZS5hZGQoXG4gICAgKCkgPT5cbiAgICAgIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICAgICAgICBjb25zdCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICBtYWluPy5hcHBlbmQoZGl2KTtcbiAgICAgICAgICBpbWcuc3JjID0gVVJMLmNyZWF0ZU9iamVjdFVSTChmaWxlKTtcbiAgICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsICgpID0+IHtcbiAgICAgICAgICAgIGRpdi5hcHBlbmQoaW1nKTtcbiAgICAgICAgICAgIGltYWdlTG9hZENvdW50Kys7XG4gICAgICAgICAgICByZXNvbHZlKCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoJ2Vycm9yJywgKCkgPT4ge1xuICAgICAgICAgICAgZGl2LnJlbW92ZSgpO1xuICAgICAgICAgICAgcmVqZWN0KCk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gY2F0Y2ggKF8pIHtcbiAgICAgICAgICByZWplY3QoKTtcbiAgICAgICAgfVxuICAgICAgfSksXG4gICk7XG59XG4iCiAgXSwKICAibWFwcGluZ3MiOiAiO0FBR08sTUFBTSxNQUFhO0FBQUEsRUFFRjtBQUFBLEVBRFosa0JBQWtCLElBQUk7QUFBQSxFQUNoQyxXQUFX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WUFBTSxnQkFBZ0I7QUFBQTtBQUFBLElBRXhCLGtCQUFrQjtBQUFBLElBQ2xCLFdBQVcsR0FBRztBQUNaLHFCQUFlLFVBQVUsTUFBTTtBQUM3QixZQUFJLGVBQWUsTUFBTTtBQUN2QixjQUFJLG1CQUFtQixHQUFHO0FBQ3hCLHdCQUFZLFVBQVUsT0FBTyxRQUFRO0FBQ3JDLGtCQUFNLE1BQU0sU0FBUyxjQUFjLEtBQUs7QUFDeEMsZ0JBQUksTUFBTSxRQUFRO0FBQ2xCLGdCQUFJLGNBQWM7QUFDbEIsd0JBQVksY0FBYyxNQUFNLEdBQUcsT0FDakMsU0FBUyxjQUFjLElBQUksR0FDM0IsU0FBUyxjQUFjLElBQUksR0FDM0IsR0FDRjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsT0FDRDtBQUFBO0FBQUEsRUFFTCxHQUNBO0FBQUEsSUFDRSxXQUFXO0FBQUEsSUFDWCxVQUFVO0FBQUEsRUFDWixDQUNGO0FBQ0Y7IiwKICAiZGVidWdJZCI6ICJEQTIzQzBERjcyMzkwMzU1NjQ3NTZFMjE2NDc1NkUyMSIsCiAgIm5hbWVzIjogW10KfQ==
