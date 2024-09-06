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

// src/components/drag-and-drop-file-picker/drag-and-drop-file-picker.ts
function setupDragAndDropFilePicker(container, fn, options) {
  const element = container.querySelector('input');
  if (!element) {
    throw 'drag-and-drop-file-picker input element missing';
  }
  if (options?.directory === true && webkitdirectory_support) {
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
      const path = file.webkitRelativePath + file.name;
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
        await iterateFSEntries(element.webkitEntries, element.files);
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
var webkitdirectory_support = /android|iphone|mobile/i.test(window.navigator.userAgent) === true ? false : true;
export { setupDragAndDropFilePicker };

//# debugId=B5EBBB7B6799AA9964756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcRGVzaWduIFBhdHRlcm5cXE9ic2VydmVyXFxTdG9yZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxKb2JRdWV1ZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxSZWN1cnNpdmVBc3luY0l0ZXJhdG9yLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXERhdGFUcmFuc2Zlci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlU3lzdGVtLnRzIiwgInNyY1xcY29tcG9uZW50c1xcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlclxcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsKICAgICJleHBvcnQgdHlwZSBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4gPSAodmFsdWU6IFZhbHVlLCB1bnN1YnNjcmliZTogKCkgPT4gdm9pZCkgPT4gdm9pZDtcbmV4cG9ydCB0eXBlIFVwZGF0ZUNhbGxiYWNrPFZhbHVlPiA9ICh2YWx1ZTogVmFsdWUpID0+IFZhbHVlO1xuXG5leHBvcnQgY2xhc3MgQ29uc3Q8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+PigpO1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgdmFsdWU/OiBWYWx1ZSkge31cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4pOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5hZGQoY2FsbGJhY2spO1xuICAgIGlmICh0aGlzLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNhbGxiYWNrKHRoaXMudmFsdWUsICgpID0+IHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUpOiB2b2lkIHtcbiAgICBpZiAodGhpcy52YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICAgIGNhbGxiYWNrKHZhbHVlLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTdG9yZTxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgY3VycmVudFZhbHVlOiBWYWx1ZTtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+PigpO1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcm90ZWN0ZWQgaW5pdGlhbFZhbHVlOiBWYWx1ZSxcbiAgICBwcm90ZWN0ZWQgbm90aWZ5T25DaGFuZ2VPbmx5OiBib29sZWFuID0gZmFsc2UsXG4gICkge1xuICAgIHRoaXMuY3VycmVudFZhbHVlID0gaW5pdGlhbFZhbHVlO1xuICB9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBjb25zdCB1bnN1YnNjcmliZSA9ICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgICBjYWxsYmFjayh0aGlzLmN1cnJlbnRWYWx1ZSwgdW5zdWJzY3JpYmUpO1xuICAgIHJldHVybiB1bnN1YnNjcmliZTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZT4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubm90aWZ5T25DaGFuZ2VPbmx5ICYmIHRoaXMuY3VycmVudFZhbHVlID09PSB2YWx1ZSkgcmV0dXJuO1xuICAgIHRoaXMuY3VycmVudFZhbHVlID0gdmFsdWU7XG4gICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgY2FsbGJhY2sodmFsdWUsICgpID0+IHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICB1cGRhdGUoY2FsbGJhY2s6IFVwZGF0ZUNhbGxiYWNrPFZhbHVlPik6IHZvaWQge1xuICAgIHRoaXMuc2V0KGNhbGxiYWNrKHRoaXMuY3VycmVudFZhbHVlKSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wdGlvbmFsPFZhbHVlPiB7XG4gIHByb3RlY3RlZCBzdG9yZTogU3RvcmU8VmFsdWUgfCB1bmRlZmluZWQ+O1xuICBjb25zdHJ1Y3Rvcihub3RpZnlPbkNoYW5nZU9ubHkgPSBmYWxzZSkge1xuICAgIHRoaXMuc3RvcmUgPSBuZXcgU3RvcmU8VmFsdWUgfCB1bmRlZmluZWQ+KHVuZGVmaW5lZCwgbm90aWZ5T25DaGFuZ2VPbmx5KTtcbiAgfVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlIHwgdW5kZWZpbmVkPik6ICgpID0+IHZvaWQge1xuICAgIHJldHVybiB0aGlzLnN0b3JlLnN1YnNjcmliZShjYWxsYmFjayk7XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWUgfCB1bmRlZmluZWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWUgfCB1bmRlZmluZWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2V0KHZhbHVlKTtcbiAgfVxuICB1cGRhdGUoY2FsbGJhY2s6IFVwZGF0ZUNhbGxiYWNrPFZhbHVlIHwgdW5kZWZpbmVkPik6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUudXBkYXRlKGNhbGxiYWNrKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gQ29tcG91bmRTdWJzY3JpcHRpb248VCBleHRlbmRzIGFueVtdPihzdG9yZXM6IHsgW0sgaW4ga2V5b2YgVF06IFN0b3JlPFRbS10+IHwgT3B0aW9uYWw8VFtLXT4gfSwgY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPHsgW0sgaW4ga2V5b2YgVF06IFRbS10gfCB1bmRlZmluZWQgfT4pOiAoKSA9PiB2b2lkIHtcbiAgY29uc3QgdW5zdWJzOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICBjb25zdCB1bnN1YnNjcmliZSA9ICgpID0+IHtcbiAgICBmb3IgKGNvbnN0IHVuc3ViIG9mIHVuc3Vicykge1xuICAgICAgdW5zdWIoKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IHZhbHVlcyA9IFtdIGFzIHsgW0sgaW4ga2V5b2YgVF06IFRbS10gfCB1bmRlZmluZWQgfTtcbiAgY29uc3QgY2FsbGJhY2tfaGFuZGxlciA9ICgpID0+IHtcbiAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gc3RvcmVzLmxlbmd0aCkge1xuICAgICAgY2FsbGJhY2sodmFsdWVzLCB1bnN1YnNjcmliZSk7XG4gICAgfVxuICB9O1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHN0b3Jlcy5sZW5ndGg7IGkrKykge1xuICAgIHN0b3Jlc1tpXS5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgdmFsdWVzW2ldID0gdmFsdWU7XG4gICAgICB1bnN1YnNbaV0gPSB1bnN1YnNjcmliZTtcbiAgICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSBzdG9yZXMubGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrX2hhbmRsZXIoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICByZXR1cm4gdW5zdWJzY3JpYmU7XG59XG4iLAogICAgImltcG9ydCB7IFN0b3JlIH0gZnJvbSAnLi4vRGVzaWduIFBhdHRlcm4vT2JzZXJ2ZXIvU3RvcmUuanMnO1xuXG5leHBvcnQgdHlwZSBTdWJzY3JpcHRpb25DYWxsYmFjazxSZXN1bHQsIFRhZz4gPSAocmVzdWx0PzogUmVzdWx0LCBlcnJvcj86IEVycm9yLCB0YWc/OiBUYWcpID0+IHsgYWJvcnQ6IGJvb2xlYW4gfSB8IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBKb2JRdWV1ZTxSZXN1bHQgPSB2b2lkLCBUYWcgPSB2b2lkPiB7XG4gIC8qKlxuICAgKiAwOiBObyBkZWxheS4gLTE6IENvbnNlY3V0aXZlLlxuICAgKi9cbiAgY29uc3RydWN0b3IocHVibGljIGRlbGF5X21zOiBudW1iZXIpIHt9XG4gIHB1YmxpYyBhYm9ydCgpIHtcbiAgICB0aGlzLl9hYm9ydGVkID0gdHJ1ZTtcbiAgfVxuICBwdWJsaWMgZ2V0IGFib3J0ZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Fib3J0ZWQ7XG4gIH1cbiAgcHVibGljIGFkZChmbjogKCkgPT4gUHJvbWlzZTxSZXN1bHQ+LCB0YWc/OiBUYWcpIHtcbiAgICBpZiAodGhpcy5fYWJvcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMucXVldWUucHVzaCh7IGZuLCB0YWcgfSk7XG4gICAgICBpZiAodGhpcy5ydW5uaW5nID09PSBmYWxzZSkge1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLnJ1bigpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBwdWJsaWMgZ2V0IGRvbmUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29tcGxldGlvbkNvdW50ID09PSB0aGlzLnF1ZXVlLmxlbmd0aCA/IHRydWUgOiBmYWxzZTtcbiAgfVxuICBwdWJsaWMgcmVzZXQoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnJ1bm5pbmdDb3VudC5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICB0aGlzLl9hYm9ydGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuY29tcGxldGlvbkNvdW50ID0gMDtcbiAgICAgICAgdGhpcy5xdWV1ZSA9IFtdO1xuICAgICAgICB0aGlzLnF1ZXVlSW5kZXggPSAwO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSBbXTtcbiAgICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHB1YmxpYyBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmFkZChjYWxsYmFjayk7XG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgdGhpcy5yZXN1bHRzKSB7XG4gICAgICBpZiAoY2FsbGJhY2socmVzdWx0LnZhbHVlLCByZXN1bHQuZXJyb3IpPy5hYm9ydCA9PT0gdHJ1ZSkge1xuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gKCkgPT4ge307XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgIH07XG4gIH1cbiAgcHJvdGVjdGVkIF9hYm9ydGVkID0gZmFsc2U7XG4gIHByb3RlY3RlZCBjb21wbGV0aW9uQ291bnQgPSAwO1xuICBwcm90ZWN0ZWQgcXVldWU6IHsgZm46ICgpID0+IFByb21pc2U8UmVzdWx0PjsgdGFnPzogVGFnIH1bXSA9IFtdO1xuICBwcm90ZWN0ZWQgcXVldWVJbmRleCA9IDA7XG4gIHByb3RlY3RlZCByZXN1bHRzOiB7IHZhbHVlPzogUmVzdWx0OyBlcnJvcj86IEVycm9yIH1bXSA9IFtdO1xuICBwcm90ZWN0ZWQgcnVubmluZyA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgcnVubmluZ0NvdW50ID0gbmV3IFN0b3JlKDApO1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9uU2V0ID0gbmV3IFNldDxTdWJzY3JpcHRpb25DYWxsYmFjazxSZXN1bHQsIFRhZz4+KCk7XG4gIHByb3RlY3RlZCBydW4oKSB7XG4gICAgaWYgKHRoaXMuX2Fib3J0ZWQgPT09IGZhbHNlICYmIHRoaXMucXVldWVJbmRleCA8IHRoaXMucXVldWUubGVuZ3RoKSB7XG4gICAgICBjb25zdCB7IGZuLCB0YWcgfSA9IHRoaXMucXVldWVbdGhpcy5xdWV1ZUluZGV4KytdO1xuICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgdGhpcy5ydW5uaW5nQ291bnQudXBkYXRlKChjb3VudCkgPT4gY291bnQgKyAxKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IGZuKCk7XG4gICAgICAgICAgdGhpcy5zZW5kKHsgdmFsdWUsIHRhZyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgIHRoaXMuc2VuZCh7IGVycm9yLCB0YWcgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5ydW5uaW5nQ291bnQudXBkYXRlKChjb3VudCkgPT4gY291bnQgLSAxKTtcbiAgICAgICAgaWYgKHRoaXMuZGVsYXlfbXMgPCAwKSB7XG4gICAgICAgICAgdGhpcy5ydW4oKTtcbiAgICAgICAgfVxuICAgICAgfSkoKTtcbiAgICAgIGlmICh0aGlzLmRlbGF5X21zID49IDApIHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLnJ1bigpLCB0aGlzLmRlbGF5X21zKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG4gICAgfVxuICB9XG4gIHByb3RlY3RlZCBzZW5kKHJlc3VsdDogeyB2YWx1ZT86IFJlc3VsdDsgZXJyb3I/OiBFcnJvcjsgdGFnPzogVGFnIH0pIHtcbiAgICBpZiAodGhpcy5fYWJvcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMuY29tcGxldGlvbkNvdW50Kys7XG4gICAgICB0aGlzLnJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgICBpZiAoY2FsbGJhY2socmVzdWx0LnZhbHVlLCByZXN1bHQuZXJyb3IsIHJlc3VsdC50YWcpPy5hYm9ydCA9PT0gdHJ1ZSkge1xuICAgICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBTeW5jQXN5bmNJdGVyYWJsZSB9IGZyb20gJy4vVHlwZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBSZWN1cnNpdmVJdGVyYXRvcjxJbiwgT3V0PiB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBmbjogKHZhbHVlOiBTeW5jQXN5bmNJdGVyYWJsZTxJbj4sIHB1c2g6ICh2YWx1ZTogU3luY0FzeW5jSXRlcmFibGU8SW4+KSA9PiB2b2lkKSA9PiBTeW5jQXN5bmNJdGVyYWJsZTxPdXQ+KSB7fVxuICBhc3luYyAqaXRlcmF0ZShpbml0OiBTeW5jQXN5bmNJdGVyYWJsZTxJbj4pOiBTeW5jQXN5bmNJdGVyYWJsZTxPdXQ+IHtcbiAgICBjb25zdCBsaXN0OiBTeW5jQXN5bmNJdGVyYWJsZTxJbj5bXSA9IFtpbml0XTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZlNFbnRyeSBvZiB0aGlzLmZuKGxpc3RbaV0sICh2YWx1ZSkgPT4ge1xuICAgICAgICBsaXN0LnB1c2godmFsdWUpO1xuICAgICAgfSkpIHtcbiAgICAgICAgeWllbGQgZlNFbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBOIH0gZnJvbSAnLi4vVXRpbGl0eS9UeXBlLmpzJztcblxuZXhwb3J0IGNsYXNzIERhdGFUcmFuc2Zlckl0ZW1JdGVyYXRvciB7XG4gIGxpc3Q6IERhdGFUcmFuc2Zlckl0ZW1bXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihpdGVtcz86IE48RGF0YVRyYW5zZmVySXRlbT4gfCBEYXRhVHJhbnNmZXJJdGVtTGlzdCB8IG51bGwpIHtcbiAgICBpZiAoaXRlbXMgaW5zdGFuY2VvZiBEYXRhVHJhbnNmZXJJdGVtKSB7XG4gICAgICB0aGlzLmxpc3QgPSBbaXRlbXNdO1xuICAgIH0gZWxzZSBpZiAoaXRlbXMgaW5zdGFuY2VvZiBEYXRhVHJhbnNmZXJJdGVtTGlzdCkge1xuICAgICAgdGhpcy5saXN0ID0gQXJyYXkuZnJvbShpdGVtcyk7XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuICAgICAgdGhpcy5saXN0ID0gaXRlbXM7XG4gICAgfVxuICB9XG4gICpnZXRBc0VudHJ5KCk6IEdlbmVyYXRvcjxGaWxlU3lzdGVtRW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5saXN0KSB7XG4gICAgICBjb25zdCBlbnRyeSA9IChpdGVtIGFzIERhdGFUcmFuc2Zlckl0ZW0gJiB7IGdldEFzRW50cnk/OiBEYXRhVHJhbnNmZXJJdGVtWyd3ZWJraXRHZXRBc0VudHJ5J10gfSkuZ2V0QXNFbnRyeT8uKCkgPz8gaXRlbS53ZWJraXRHZXRBc0VudHJ5Py4oKTtcbiAgICAgIGlmIChlbnRyeSBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1FbnRyeSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldEFzRmlsZSgpOiBHZW5lcmF0b3I8RmlsZT4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IGZpbGUgPSBpdGVtLmdldEFzRmlsZT8uKCk7XG4gICAgICBpZiAoZmlsZSBpbnN0YW5jZW9mIEZpbGUpIHtcbiAgICAgICAgeWllbGQgZmlsZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgYXN5bmMgKmdldEFzU3RyaW5nKCk6IEFzeW5jR2VuZXJhdG9yPHN0cmluZz4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIHlpZWxkIGF3YWl0IG5ldyBQcm9taXNlPHN0cmluZz4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICBpZiAodHlwZW9mIGl0ZW0uZ2V0QXNTdHJpbmcgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICBpdGVtLmdldEFzU3RyaW5nKHJlc29sdmUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJlamVjdCgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiZXhwb3J0IGNsYXNzIEZpbGVTeXN0ZW1FbnRyeUl0ZXJhdG9yIHtcbiAgbGlzdDogRmlsZVN5c3RlbUVudHJ5W10gPSBbXTtcbiAgY29uc3RydWN0b3IoZW50cmllcz86IEZpbGVTeXN0ZW1FbnRyeSB8IEZpbGVTeXN0ZW1FbnRyeVtdIHwgbnVsbCkge1xuICAgIGlmIChlbnRyaWVzIGluc3RhbmNlb2YgRmlsZVN5c3RlbUVudHJ5KSB7XG4gICAgICB0aGlzLmxpc3QgPSBbZW50cmllc107XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGVudHJpZXMpKSB7XG4gICAgICB0aGlzLmxpc3QgPSBlbnRyaWVzO1xuICAgIH1cbiAgfVxuICAqZ2V0RGlyZWN0b3J5RW50cnkoKTogR2VuZXJhdG9yPEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeT4ge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5saXN0KSB7XG4gICAgICBpZiAoZW50cnkuaXNEaXJlY3RvcnkgJiYgZW50cnkgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICpnZXRGaWxlRW50cnkoKTogR2VuZXJhdG9yPEZpbGVTeXN0ZW1GaWxlRW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubGlzdCkge1xuICAgICAgaWYgKGVudHJ5LmlzRmlsZSAmJiBlbnRyeSBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1GaWxlRW50cnkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvciB7XG4gIGxpc3Q6IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGVudHJpZXM/OiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkgfCBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbXSB8IG51bGwpIHtcbiAgICBpZiAoZW50cmllcyBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSkge1xuICAgICAgdGhpcy5saXN0ID0gW2VudHJpZXNdO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShlbnRyaWVzKSkge1xuICAgICAgdGhpcy5saXN0ID0gZW50cmllcztcbiAgICB9XG4gIH1cbiAgYXN5bmMgKmdldEVudHJ5KCk6IEFzeW5jR2VuZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeT4ge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5saXN0KSB7XG4gICAgICBjb25zdCByZWFkZXIgPSBlbnRyeS5jcmVhdGVSZWFkZXIoKTtcbiAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgYXdhaXQgbmV3IFByb21pc2U8RmlsZVN5c3RlbUVudHJ5W10+KChyZXNvbHZlLCByZWplY3QpID0+IHJlYWRlci5yZWFkRW50cmllcyhyZXNvbHZlLCByZWplY3QpKSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHsgSm9iUXVldWUgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvSm9iUXVldWUuanMnO1xuaW1wb3J0IHsgUmVjdXJzaXZlSXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvUmVjdXJzaXZlQXN5bmNJdGVyYXRvci5qcyc7XG5pbXBvcnQgdHlwZSB7IFN5bmNBc3luY0l0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L1R5cGUuanMnO1xuaW1wb3J0IHsgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0RhdGFUcmFuc2Zlci5qcyc7XG5pbXBvcnQgeyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvciwgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRmlsZVN5c3RlbS5qcyc7XG5cbmNvbnN0IHdlYmtpdGRpcmVjdG9yeV9zdXBwb3J0ID0gL2FuZHJvaWR8aXBob25lfG1vYmlsZS9pLnRlc3Qod2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQpID09PSB0cnVlID8gZmFsc2UgOiB0cnVlO1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIoXG4gIGNvbnRhaW5lcjogRWxlbWVudCxcbiAgZm46IHtcbiAgICBvbkRyYWdFbmQ/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJhZ0VudGVyPzogKCkgPT4gdm9pZDtcbiAgICBvbkRyYWdMZWF2ZT86ICgpID0+IHZvaWQ7XG4gICAgb25Ecm9wPzogKCkgPT4gdm9pZDtcbiAgICBvblVwbG9hZEVuZD86ICgpID0+IHZvaWQ7XG4gICAgb25VcGxvYWROZXh0RmlsZTogKGZpbGU6IEZpbGUsIGRvbmU6ICgpID0+IHZvaWQpID0+IFByb21pc2U8dm9pZD4gfCB2b2lkO1xuICAgIG9uVXBsb2FkU3RhcnQ/OiAoKSA9PiB2b2lkO1xuICB9LFxuICBvcHRpb25zPzoge1xuICAgIGRpcmVjdG9yeTogYm9vbGVhbjtcbiAgICBtdWx0aXBsZTogYm9vbGVhbjtcbiAgfSxcbikge1xuICBjb25zdCBlbGVtZW50ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0Jyk7XG4gIGlmICghZWxlbWVudCkge1xuICAgIHRocm93ICdkcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyIGlucHV0IGVsZW1lbnQgbWlzc2luZyc7XG4gIH1cbiAgaWYgKG9wdGlvbnM/LmRpcmVjdG9yeSA9PT0gdHJ1ZSAmJiB3ZWJraXRkaXJlY3Rvcnlfc3VwcG9ydCkge1xuICAgIGVsZW1lbnQudG9nZ2xlQXR0cmlidXRlKCd3ZWJraXRkaXJlY3RvcnknLCB0cnVlKTtcbiAgfVxuICBpZiAob3B0aW9ucz8ubXVsdGlwbGUgPT09IHRydWUpIHtcbiAgICBlbGVtZW50LnRvZ2dsZUF0dHJpYnV0ZSgnbXVsdGlwbGUnLCB0cnVlKTtcbiAgfVxuXG4gIGlmIChmbi5vbkRyYWdFbmQgfHwgZm4ub25EcmFnRW50ZXIgfHwgZm4ub25EcmFnTGVhdmUpIHtcbiAgICBjb25zdCByZW1vdmVMaXN0ZW5lcnMgPSAoKSA9PiB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdsZWF2ZUhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xuICAgIH07XG4gICAgY29uc3QgZHJhZ2VuZEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICByZW1vdmVMaXN0ZW5lcnMoKTtcbiAgICAgIGZuLm9uRHJhZ0VuZD8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcmFnbGVhdmVIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgcmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICBmbi5vbkRyYWdMZWF2ZT8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcm9wSGFuZGxlciA9ICgpID0+IHtcbiAgICAgIHJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgZm4ub25Ecm9wPy4oKTtcbiAgICB9O1xuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VudGVyJywgKCkgPT4ge1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCBkcmFnbGVhdmVIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIGRyYWdlbmRIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGRyb3BIYW5kbGVyKTtcbiAgICAgIGZuLm9uRHJhZ0VudGVyPy4oKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGZTRW50cnlTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgZlNFbnRyeUl0ZXJhdG9yID0gbmV3IFJlY3Vyc2l2ZUl0ZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeSwgRmlsZVN5c3RlbUZpbGVFbnRyeT4oYXN5bmMgZnVuY3Rpb24qIChmU0VudHJ5SXRlcmF0b3IsIHB1c2gpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yKSB7XG4gICAgICBjb25zdCBwYXRoID0gZlNFbnRyeS5mdWxsUGF0aC5zbGljZSgxKTtcbiAgICAgIGlmICghZlNFbnRyeVNldC5oYXMocGF0aCkpIHtcbiAgICAgICAgZlNFbnRyeVNldC5hZGQocGF0aCk7XG4gICAgICAgIGNvbnN0IGZzRW50cmllcyA9IG5ldyBGaWxlU3lzdGVtRW50cnlJdGVyYXRvcihmU0VudHJ5KTtcbiAgICAgICAgZm9yIChjb25zdCBmU0ZpbGVFbnRyeSBvZiBmc0VudHJpZXMuZ2V0RmlsZUVudHJ5KCkpIHtcbiAgICAgICAgICB5aWVsZCBmU0ZpbGVFbnRyeTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGZTRGlyZWN0b3J5RW50cnkgb2YgZnNFbnRyaWVzLmdldERpcmVjdG9yeUVudHJ5KCkpIHtcbiAgICAgICAgICBwdXNoKG5ldyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvcihmU0RpcmVjdG9yeUVudHJ5KS5nZXRFbnRyeSgpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgY29uc3Qgam9iUXVldWUgPSBuZXcgSm9iUXVldWU8dm9pZCwgc3RyaW5nPigtMSk7XG4gIGxldCBzdGFydGVkID0gZmFsc2U7XG4gIGxldCBlbmRlZCA9IHRydWU7XG4gIGxldCBkb25lID0gdHJ1ZTtcbiAgY29uc3QgdXBsb2FkU3RhcnQgPSAoKSA9PiB7XG4gICAgaWYgKHN0YXJ0ZWQgPT09IGZhbHNlKSB7XG4gICAgICBzdGFydGVkID0gdHJ1ZTtcbiAgICAgIGVuZGVkID0gZmFsc2U7XG4gICAgICBkb25lID0gZmFsc2U7XG4gICAgICBmbi5vblVwbG9hZFN0YXJ0Py4oKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IHVwbG9hZEVuZCA9ICgpID0+IHtcbiAgICBpZiAoZW5kZWQgPT09IGZhbHNlKSB7XG4gICAgICBzdGFydGVkID0gZmFsc2U7XG4gICAgICBlbmRlZCA9IHRydWU7XG4gICAgICBqb2JRdWV1ZS5hYm9ydCgpO1xuICAgICAgam9iUXVldWUucmVzZXQoKTtcbiAgICAgIGZTRW50cnlTZXQuY2xlYXIoKTtcbiAgICAgIGZuLm9uVXBsb2FkRW5kPy4oKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IGl0ZXJhdGVGU0VudHJpZXMgPSBhc3luYyAoaW5pdEVudHJpZXM6IFN5bmNBc3luY0l0ZXJhYmxlPEZpbGVTeXN0ZW1FbnRyeT4sIGZpbGVzOiBGaWxlTGlzdCkgPT4ge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZlNGaWxlRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yLml0ZXJhdGUoaW5pdEVudHJpZXMpKSB7XG4gICAgICBhd2FpdCBmbi5vblVwbG9hZE5leHRGaWxlKGF3YWl0IG5ldyBQcm9taXNlPEZpbGU+KChyZXNvbHZlLCByZWplY3QpID0+IGZTRmlsZUVudHJ5LmZpbGUocmVzb2x2ZSwgcmVqZWN0KSksICgpID0+IChkb25lID0gdHJ1ZSkpO1xuICAgICAgaWYgKGRvbmUgPT09IHRydWUpIHJldHVybiB1cGxvYWRFbmQoKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBwYXRoID0gZmlsZS53ZWJraXRSZWxhdGl2ZVBhdGggKyBmaWxlLm5hbWU7XG4gICAgICBpZiAoIWZTRW50cnlTZXQuaGFzKHBhdGgpKSB7XG4gICAgICAgIGZTRW50cnlTZXQuYWRkKHBhdGgpO1xuICAgICAgICBhd2FpdCBmbi5vblVwbG9hZE5leHRGaWxlKGZpbGUsICgpID0+IChkb25lID0gdHJ1ZSkpO1xuICAgICAgICBpZiAoZG9uZSA9PT0gdHJ1ZSkgcmV0dXJuIHVwbG9hZEVuZCgpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgY29uc3QgY2hhbmdlSGFuZGxlciA9ICgpID0+IHtcbiAgICBqb2JRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgdXBsb2FkU3RhcnQoKTtcbiAgICAgIGlmIChlbGVtZW50IGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCAmJiBlbGVtZW50LmZpbGVzKSB7XG4gICAgICAgIGF3YWl0IGl0ZXJhdGVGU0VudHJpZXMoZWxlbWVudC53ZWJraXRFbnRyaWVzLCBlbGVtZW50LmZpbGVzKTtcbiAgICAgIH1cbiAgICAgIHVwbG9hZEVuZCgpO1xuICAgIH0sICdjaGFuZ2VIYW5kbGVyJyk7XG4gIH07XG4gIGNvbnN0IGRyb3BIYW5kbGVyID0gKGV2ZW50OiBEcmFnRXZlbnQpID0+IHtcbiAgICBqb2JRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgdXBsb2FkU3RhcnQoKTtcbiAgICAgIGlmIChldmVudC5kYXRhVHJhbnNmZXIpIHtcbiAgICAgICAgY29uc3QgZGF0YVRyYW5zZmVySXRlbXMgPSBuZXcgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yKGV2ZW50LmRhdGFUcmFuc2Zlci5pdGVtcyk7XG4gICAgICAgIGF3YWl0IGl0ZXJhdGVGU0VudHJpZXMoZGF0YVRyYW5zZmVySXRlbXMuZ2V0QXNFbnRyeSgpLCBldmVudC5kYXRhVHJhbnNmZXIuZmlsZXMpO1xuICAgICAgfVxuICAgICAgdXBsb2FkRW5kKCk7XG4gICAgfSwgJ2Ryb3BIYW5kbGVyJyk7XG4gIH07XG4gIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgY2hhbmdlSGFuZGxlcik7XG4gIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGRyb3BIYW5kbGVyKTtcbn1cbiIKICBdLAogICJtYXBwaW5ncyI6ICI7QUFHTyxNQUFNLE1BQWE7QUFBQSxFQUVGO0FBQUEsRUFEWixrQkFBa0IsSUFBSTtBQUFBLEVBQ2hDLFdBQVcs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
