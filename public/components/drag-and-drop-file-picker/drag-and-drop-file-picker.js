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
class RecursiveAsyncIterator {
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
    const dragendHandler = () => {
      element.removeEventListener('dragleave', dragendHandler);
      element.removeEventListener('dragend', dragendHandler);
      fn.onDragEnd?.();
    };
    const dragleaveHandler = () => {
      element.removeEventListener('dragleave', dragendHandler);
      element.removeEventListener('dragend', dragendHandler);
      fn.onDragLeave?.();
    };
    element.addEventListener('dragenter', () => {
      element.addEventListener('dragleave', dragleaveHandler);
      element.addEventListener('dragend', dragendHandler);
      fn.onDragEnter?.();
    });
  }
  const fSEntrySet = new Set();
  const fSEntryIterator = new RecursiveAsyncIterator(async function* (fSEntryIterator2, push) {
    for await (const fSEntry of fSEntryIterator2) {
      if (!fSEntrySet.has(fSEntry.fullPath.slice(1))) {
        fSEntrySet.add(fSEntry.fullPath.slice(1));
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
  const changeHandler = () => {
    jobQueue.add(async () => {
      uploadStart();
      if (element instanceof HTMLInputElement && element.files) {
        for await (const fSFileEntry of fSEntryIterator.iterate(element.webkitEntries)) {
          await fn.onUploadNextFile(await new Promise((resolve, reject) => fSFileEntry.file(resolve, reject)), () => (done = true));
          if (done === true) return uploadEnd();
        }
        for (const file of element.files) {
          if (!fSEntrySet.has(file.webkitRelativePath)) {
            fSEntrySet.add(file.webkitRelativePath);
            await fn.onUploadNextFile(file, () => (done = true));
            if (done === true) return uploadEnd();
          }
        }
      }
      uploadEnd();
    }, 'changeHandler');
  };
  const dropHandler = (event) => {
    jobQueue.add(async () => {
      uploadStart();
      if (event.dataTransfer) {
        const dataTransferItems = new DataTransferItemIterator(event.dataTransfer.items);
        for await (const fSFileEntry of fSEntryIterator.iterate(dataTransferItems.getAsEntry())) {
          await fn.onUploadNextFile(await new Promise((resolve, reject) => fSFileEntry.file(resolve, reject)), () => (done = true));
          if (done === true) return uploadEnd();
        }
        for (const file of event.dataTransfer.files) {
          if (!fSEntrySet.has(file.webkitRelativePath)) {
            fSEntrySet.add(file.webkitRelativePath);
            await fn.onUploadNextFile(file, () => (done = true));
            if (done === true) return uploadEnd();
          }
        }
      }
      uploadEnd();
    }, 'dropHandler');
  };
  element.addEventListener('change', changeHandler);
  element.addEventListener('drop', dropHandler);
}
var webkitdirectory_support = /android|iphone|mobile/i.test(window.navigator.userAgent) === true ? false : true;
export { setupDragAndDropFilePicker };

//# debugId=785BF83F7AD8702C64756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcRGVzaWduIFBhdHRlcm5cXE9ic2VydmVyXFxTdG9yZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxKb2JRdWV1ZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxSZWN1cnNpdmVBc3luY0l0ZXJhdG9yLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXERhdGFUcmFuc2Zlci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlU3lzdGVtLnRzIiwgInNyY1xcY29tcG9uZW50c1xcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlclxcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsKICAgICJleHBvcnQgdHlwZSBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4gPSAodmFsdWU6IFZhbHVlLCB1bnN1YnNjcmliZTogKCkgPT4gdm9pZCkgPT4gdm9pZDtcbmV4cG9ydCB0eXBlIFVwZGF0ZUNhbGxiYWNrPFZhbHVlPiA9ICh2YWx1ZTogVmFsdWUpID0+IFZhbHVlO1xuXG5leHBvcnQgY2xhc3MgQ29uc3Q8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+PigpO1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgdmFsdWU/OiBWYWx1ZSkge31cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4pOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5hZGQoY2FsbGJhY2spO1xuICAgIGlmICh0aGlzLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNhbGxiYWNrKHRoaXMudmFsdWUsICgpID0+IHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUpOiB2b2lkIHtcbiAgICBpZiAodGhpcy52YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICAgIGNhbGxiYWNrKHZhbHVlLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTdG9yZTxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgY3VycmVudFZhbHVlOiBWYWx1ZTtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+PigpO1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcm90ZWN0ZWQgaW5pdGlhbFZhbHVlOiBWYWx1ZSxcbiAgICBwcm90ZWN0ZWQgbm90aWZ5T25DaGFuZ2VPbmx5OiBib29sZWFuID0gZmFsc2UsXG4gICkge1xuICAgIHRoaXMuY3VycmVudFZhbHVlID0gaW5pdGlhbFZhbHVlO1xuICB9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBjb25zdCB1bnN1YnNjcmliZSA9ICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgICBjYWxsYmFjayh0aGlzLmN1cnJlbnRWYWx1ZSwgdW5zdWJzY3JpYmUpO1xuICAgIHJldHVybiB1bnN1YnNjcmliZTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZT4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubm90aWZ5T25DaGFuZ2VPbmx5ICYmIHRoaXMuY3VycmVudFZhbHVlID09PSB2YWx1ZSkgcmV0dXJuO1xuICAgIHRoaXMuY3VycmVudFZhbHVlID0gdmFsdWU7XG4gICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgY2FsbGJhY2sodmFsdWUsICgpID0+IHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICB1cGRhdGUoY2FsbGJhY2s6IFVwZGF0ZUNhbGxiYWNrPFZhbHVlPik6IHZvaWQge1xuICAgIHRoaXMuc2V0KGNhbGxiYWNrKHRoaXMuY3VycmVudFZhbHVlKSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wdGlvbmFsPFZhbHVlPiB7XG4gIHByb3RlY3RlZCBzdG9yZTogU3RvcmU8VmFsdWUgfCB1bmRlZmluZWQ+O1xuICBjb25zdHJ1Y3Rvcihub3RpZnlPbkNoYW5nZU9ubHkgPSBmYWxzZSkge1xuICAgIHRoaXMuc3RvcmUgPSBuZXcgU3RvcmU8VmFsdWUgfCB1bmRlZmluZWQ+KHVuZGVmaW5lZCwgbm90aWZ5T25DaGFuZ2VPbmx5KTtcbiAgfVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlIHwgdW5kZWZpbmVkPik6ICgpID0+IHZvaWQge1xuICAgIHJldHVybiB0aGlzLnN0b3JlLnN1YnNjcmliZShjYWxsYmFjayk7XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWUgfCB1bmRlZmluZWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWUgfCB1bmRlZmluZWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2V0KHZhbHVlKTtcbiAgfVxuICB1cGRhdGUoY2FsbGJhY2s6IFVwZGF0ZUNhbGxiYWNrPFZhbHVlIHwgdW5kZWZpbmVkPik6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUudXBkYXRlKGNhbGxiYWNrKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gQ29tcG91bmRTdWJzY3JpcHRpb248VCBleHRlbmRzIGFueVtdPihzdG9yZXM6IHsgW0sgaW4ga2V5b2YgVF06IFN0b3JlPFRbS10+IHwgT3B0aW9uYWw8VFtLXT4gfSwgY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPHsgW0sgaW4ga2V5b2YgVF06IFRbS10gfCB1bmRlZmluZWQgfT4pOiAoKSA9PiB2b2lkIHtcbiAgY29uc3QgdW5zdWJzOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICBjb25zdCB1bnN1YnNjcmliZSA9ICgpID0+IHtcbiAgICBmb3IgKGNvbnN0IHVuc3ViIG9mIHVuc3Vicykge1xuICAgICAgdW5zdWIoKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IHZhbHVlcyA9IFtdIGFzIHsgW0sgaW4ga2V5b2YgVF06IFRbS10gfCB1bmRlZmluZWQgfTtcbiAgY29uc3QgY2FsbGJhY2tfaGFuZGxlciA9ICgpID0+IHtcbiAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gc3RvcmVzLmxlbmd0aCkge1xuICAgICAgY2FsbGJhY2sodmFsdWVzLCB1bnN1YnNjcmliZSk7XG4gICAgfVxuICB9O1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHN0b3Jlcy5sZW5ndGg7IGkrKykge1xuICAgIHN0b3Jlc1tpXS5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgdmFsdWVzW2ldID0gdmFsdWU7XG4gICAgICB1bnN1YnNbaV0gPSB1bnN1YnNjcmliZTtcbiAgICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSBzdG9yZXMubGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrX2hhbmRsZXIoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICByZXR1cm4gdW5zdWJzY3JpYmU7XG59XG4iLAogICAgImltcG9ydCB7IFN0b3JlIH0gZnJvbSAnLi4vRGVzaWduIFBhdHRlcm4vT2JzZXJ2ZXIvU3RvcmUuanMnO1xuXG5leHBvcnQgdHlwZSBTdWJzY3JpcHRpb25DYWxsYmFjazxSZXN1bHQsIFRhZz4gPSAocmVzdWx0PzogUmVzdWx0LCBlcnJvcj86IEVycm9yLCB0YWc/OiBUYWcpID0+IHsgYWJvcnQ6IGJvb2xlYW4gfSB8IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBKb2JRdWV1ZTxSZXN1bHQgPSB2b2lkLCBUYWcgPSB2b2lkPiB7XG4gIC8qKlxuICAgKiAwOiBObyBkZWxheS4gLTE6IENvbnNlY3V0aXZlLlxuICAgKi9cbiAgY29uc3RydWN0b3IocHVibGljIGRlbGF5X21zOiBudW1iZXIpIHt9XG4gIHB1YmxpYyBhYm9ydCgpIHtcbiAgICB0aGlzLl9hYm9ydGVkID0gdHJ1ZTtcbiAgfVxuICBwdWJsaWMgZ2V0IGFib3J0ZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2Fib3J0ZWQ7XG4gIH1cbiAgcHVibGljIGFkZChmbjogKCkgPT4gUHJvbWlzZTxSZXN1bHQ+LCB0YWc/OiBUYWcpIHtcbiAgICBpZiAodGhpcy5fYWJvcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMucXVldWUucHVzaCh7IGZuLCB0YWcgfSk7XG4gICAgICBpZiAodGhpcy5ydW5uaW5nID09PSBmYWxzZSkge1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLnJ1bigpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBwdWJsaWMgZ2V0IGRvbmUoKSB7XG4gICAgcmV0dXJuIHRoaXMuY29tcGxldGlvbkNvdW50ID09PSB0aGlzLnF1ZXVlLmxlbmd0aCA/IHRydWUgOiBmYWxzZTtcbiAgfVxuICBwdWJsaWMgcmVzZXQoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnJ1bm5pbmdDb3VudC5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICB0aGlzLl9hYm9ydGVkID0gZmFsc2U7XG4gICAgICAgIHRoaXMuY29tcGxldGlvbkNvdW50ID0gMDtcbiAgICAgICAgdGhpcy5xdWV1ZSA9IFtdO1xuICAgICAgICB0aGlzLnF1ZXVlSW5kZXggPSAwO1xuICAgICAgICB0aGlzLnJlc3VsdHMgPSBbXTtcbiAgICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG4gICAgICAgIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHB1YmxpYyBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmFkZChjYWxsYmFjayk7XG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgdGhpcy5yZXN1bHRzKSB7XG4gICAgICBpZiAoY2FsbGJhY2socmVzdWx0LnZhbHVlLCByZXN1bHQuZXJyb3IpPy5hYm9ydCA9PT0gdHJ1ZSkge1xuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gKCkgPT4ge307XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgIH07XG4gIH1cbiAgcHJvdGVjdGVkIF9hYm9ydGVkID0gZmFsc2U7XG4gIHByb3RlY3RlZCBjb21wbGV0aW9uQ291bnQgPSAwO1xuICBwcm90ZWN0ZWQgcXVldWU6IHsgZm46ICgpID0+IFByb21pc2U8UmVzdWx0PjsgdGFnPzogVGFnIH1bXSA9IFtdO1xuICBwcm90ZWN0ZWQgcXVldWVJbmRleCA9IDA7XG4gIHByb3RlY3RlZCByZXN1bHRzOiB7IHZhbHVlPzogUmVzdWx0OyBlcnJvcj86IEVycm9yIH1bXSA9IFtdO1xuICBwcm90ZWN0ZWQgcnVubmluZyA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgcnVubmluZ0NvdW50ID0gbmV3IFN0b3JlKDApO1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9uU2V0ID0gbmV3IFNldDxTdWJzY3JpcHRpb25DYWxsYmFjazxSZXN1bHQsIFRhZz4+KCk7XG4gIHByb3RlY3RlZCBydW4oKSB7XG4gICAgaWYgKHRoaXMuX2Fib3J0ZWQgPT09IGZhbHNlICYmIHRoaXMucXVldWVJbmRleCA8IHRoaXMucXVldWUubGVuZ3RoKSB7XG4gICAgICBjb25zdCB7IGZuLCB0YWcgfSA9IHRoaXMucXVldWVbdGhpcy5xdWV1ZUluZGV4KytdO1xuICAgICAgKGFzeW5jICgpID0+IHtcbiAgICAgICAgdGhpcy5ydW5uaW5nQ291bnQudXBkYXRlKChjb3VudCkgPT4gY291bnQgKyAxKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IGZuKCk7XG4gICAgICAgICAgdGhpcy5zZW5kKHsgdmFsdWUsIHRhZyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgIHRoaXMuc2VuZCh7IGVycm9yLCB0YWcgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5ydW5uaW5nQ291bnQudXBkYXRlKChjb3VudCkgPT4gY291bnQgLSAxKTtcbiAgICAgICAgaWYgKHRoaXMuZGVsYXlfbXMgPCAwKSB7XG4gICAgICAgICAgdGhpcy5ydW4oKTtcbiAgICAgICAgfVxuICAgICAgfSkoKTtcbiAgICAgIGlmICh0aGlzLmRlbGF5X21zID49IDApIHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLnJ1bigpLCB0aGlzLmRlbGF5X21zKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG4gICAgfVxuICB9XG4gIHByb3RlY3RlZCBzZW5kKHJlc3VsdDogeyB2YWx1ZT86IFJlc3VsdDsgZXJyb3I/OiBFcnJvcjsgdGFnPzogVGFnIH0pIHtcbiAgICBpZiAodGhpcy5fYWJvcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMuY29tcGxldGlvbkNvdW50Kys7XG4gICAgICB0aGlzLnJlc3VsdHMucHVzaChyZXN1bHQpO1xuICAgICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgICBpZiAoY2FsbGJhY2socmVzdWx0LnZhbHVlLCByZXN1bHQuZXJyb3IsIHJlc3VsdC50YWcpPy5hYm9ydCA9PT0gdHJ1ZSkge1xuICAgICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiZXhwb3J0IGNsYXNzIFJlY3Vyc2l2ZUFzeW5jSXRlcmF0b3I8SW4sIE91dD4ge1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgZm46ICh2YWx1ZTogSXRlcmFibGU8SW4+IHwgQXN5bmNJdGVyYWJsZTxJbj4sIHB1c2g6ICh2YWx1ZTogSXRlcmFibGU8SW4+IHwgQXN5bmNJdGVyYWJsZTxJbj4pID0+IHZvaWQpID0+IEl0ZXJhYmxlPE91dD4gfCBBc3luY0l0ZXJhYmxlPE91dD4pIHt9XG4gIGFzeW5jICppdGVyYXRlKGluaXQ6IEl0ZXJhYmxlPEluPiB8IEFzeW5jSXRlcmFibGU8SW4+KTogSXRlcmFibGU8T3V0PiB8IEFzeW5jSXRlcmFibGU8T3V0PiB7XG4gICAgY29uc3QgbGlzdDogKEl0ZXJhYmxlPEluPiB8IEFzeW5jSXRlcmFibGU8SW4+KVtdID0gW2luaXRdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBmU0VudHJ5IG9mIHRoaXMuZm4obGlzdFtpXSwgKHZhbHVlKSA9PiB7XG4gICAgICAgIGxpc3QucHVzaCh2YWx1ZSk7XG4gICAgICB9KSkge1xuICAgICAgICB5aWVsZCBmU0VudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICJleHBvcnQgY2xhc3MgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIHtcbiAgbGlzdDogRGF0YVRyYW5zZmVySXRlbVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGl0ZW1zPzogRGF0YVRyYW5zZmVySXRlbSB8IERhdGFUcmFuc2Zlckl0ZW1bXSB8IERhdGFUcmFuc2Zlckl0ZW1MaXN0IHwgbnVsbCkge1xuICAgIGlmIChpdGVtcyBpbnN0YW5jZW9mIERhdGFUcmFuc2Zlckl0ZW0pIHtcbiAgICAgIHRoaXMubGlzdCA9IFtpdGVtc107XG4gICAgfSBlbHNlIGlmIChpdGVtcyBpbnN0YW5jZW9mIERhdGFUcmFuc2Zlckl0ZW1MaXN0KSB7XG4gICAgICB0aGlzLmxpc3QgPSBBcnJheS5mcm9tKGl0ZW1zKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICB0aGlzLmxpc3QgPSBpdGVtcztcbiAgICB9XG4gIH1cbiAgKmdldEFzRW50cnkoKTogR2VuZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeT4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gKGl0ZW0gYXMgRGF0YVRyYW5zZmVySXRlbSAmIHsgZ2V0QXNFbnRyeT86IERhdGFUcmFuc2Zlckl0ZW1bJ3dlYmtpdEdldEFzRW50cnknXSB9KS5nZXRBc0VudHJ5Py4oKSA/PyBpdGVtLndlYmtpdEdldEFzRW50cnk/LigpO1xuICAgICAgaWYgKGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqZ2V0QXNGaWxlKCk6IEdlbmVyYXRvcjxGaWxlPiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgZmlsZSA9IGl0ZW0uZ2V0QXNGaWxlPy4oKTtcbiAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgRmlsZSkge1xuICAgICAgICB5aWVsZCBmaWxlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqZ2V0QXNTdHJpbmcoKTogQXN5bmNHZW5lcmF0b3I8c3RyaW5nPiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgeWllbGQgYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgaXRlbS5nZXRBc1N0cmluZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGl0ZW0uZ2V0QXNTdHJpbmcocmVzb2x2ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVqZWN0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIiwKICAgICJleHBvcnQgY2xhc3MgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3Ige1xuICBsaXN0OiBGaWxlU3lzdGVtRW50cnlbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzPzogRmlsZVN5c3RlbUVudHJ5IHwgRmlsZVN5c3RlbUVudHJ5W10gfCBudWxsKSB7XG4gICAgaWYgKGVudHJpZXMgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRW50cnkpIHtcbiAgICAgIHRoaXMubGlzdCA9IFtlbnRyaWVzXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGVudHJpZXM7XG4gICAgfVxuICB9XG4gICpnZXREaXJlY3RvcnlFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSAmJiBlbnRyeSBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldEZpbGVFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbUZpbGVFbnRyeT4ge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5saXN0KSB7XG4gICAgICBpZiAoZW50cnkuaXNGaWxlICYmIGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbUZpbGVFbnRyeSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yIHtcbiAgbGlzdDogRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5W10gPSBbXTtcbiAgY29uc3RydWN0b3IoZW50cmllcz86IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSB8IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeVtdIHwgbnVsbCkge1xuICAgIGlmIChlbnRyaWVzIGluc3RhbmNlb2YgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5KSB7XG4gICAgICB0aGlzLmxpc3QgPSBbZW50cmllc107XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGVudHJpZXMpKSB7XG4gICAgICB0aGlzLmxpc3QgPSBlbnRyaWVzO1xuICAgIH1cbiAgfVxuICBhc3luYyAqZ2V0RW50cnkoKTogQXN5bmNHZW5lcmF0b3I8RmlsZVN5c3RlbUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IHJlYWRlciA9IGVudHJ5LmNyZWF0ZVJlYWRlcigpO1xuICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBhd2FpdCBuZXcgUHJvbWlzZTxGaWxlU3lzdGVtRW50cnlbXT4oKHJlc29sdmUsIHJlamVjdCkgPT4gcmVhZGVyLnJlYWRFbnRyaWVzKHJlc29sdmUsIHJlamVjdCkpKSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBKb2JRdWV1ZSB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9Kb2JRdWV1ZS5qcyc7XG5pbXBvcnQgeyBSZWN1cnNpdmVBc3luY0l0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L1JlY3Vyc2l2ZUFzeW5jSXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0RhdGFUcmFuc2Zlci5qcyc7XG5pbXBvcnQgeyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvciwgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRmlsZVN5c3RlbS5qcyc7XG5cbmNvbnN0IHdlYmtpdGRpcmVjdG9yeV9zdXBwb3J0ID0gL2FuZHJvaWR8aXBob25lfG1vYmlsZS9pLnRlc3Qod2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQpID09PSB0cnVlID8gZmFsc2UgOiB0cnVlO1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIoXG4gIGNvbnRhaW5lcjogRWxlbWVudCxcbiAgZm46IHtcbiAgICBvbkRyYWdFbmQ/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJhZ0VudGVyPzogKCkgPT4gdm9pZDtcbiAgICBvbkRyYWdMZWF2ZT86ICgpID0+IHZvaWQ7XG4gICAgb25VcGxvYWRFbmQ/OiAoKSA9PiB2b2lkO1xuICAgIG9uVXBsb2FkTmV4dEZpbGU6IChmaWxlOiBGaWxlLCBkb25lOiAoKSA9PiB2b2lkKSA9PiBQcm9taXNlPHZvaWQ+IHwgdm9pZDtcbiAgICBvblVwbG9hZFN0YXJ0PzogKCkgPT4gdm9pZDtcbiAgfSxcbiAgb3B0aW9ucz86IHtcbiAgICBkaXJlY3Rvcnk6IGJvb2xlYW47XG4gICAgbXVsdGlwbGU6IGJvb2xlYW47XG4gIH0sXG4pIHtcbiAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCdpbnB1dCcpO1xuICBpZiAoIWVsZW1lbnQpIHtcbiAgICB0aHJvdyAnZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlciBpbnB1dCBlbGVtZW50IG1pc3NpbmcnO1xuICB9XG4gIGlmIChvcHRpb25zPy5kaXJlY3RvcnkgPT09IHRydWUgJiYgd2Via2l0ZGlyZWN0b3J5X3N1cHBvcnQpIHtcbiAgICBlbGVtZW50LnRvZ2dsZUF0dHJpYnV0ZSgnd2Via2l0ZGlyZWN0b3J5JywgdHJ1ZSk7XG4gIH1cbiAgaWYgKG9wdGlvbnM/Lm11bHRpcGxlID09PSB0cnVlKSB7XG4gICAgZWxlbWVudC50b2dnbGVBdHRyaWJ1dGUoJ211bHRpcGxlJywgdHJ1ZSk7XG4gIH1cblxuICBpZiAoZm4ub25EcmFnRW5kIHx8IGZuLm9uRHJhZ0VudGVyIHx8IGZuLm9uRHJhZ0xlYXZlKSB7XG4gICAgY29uc3QgZHJhZ2VuZEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdlbmRIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIGRyYWdlbmRIYW5kbGVyKTtcbiAgICAgIGZuLm9uRHJhZ0VuZD8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcmFnbGVhdmVIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCBkcmFnZW5kSGFuZGxlcik7XG4gICAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBkcmFnZW5kSGFuZGxlcik7XG4gICAgICBmbi5vbkRyYWdMZWF2ZT8uKCk7XG4gICAgfTtcbiAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbnRlcicsICgpID0+IHtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgZHJhZ2xlYXZlSGFuZGxlcik7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBkcmFnZW5kSGFuZGxlcik7XG4gICAgICBmbi5vbkRyYWdFbnRlcj8uKCk7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBmU0VudHJ5U2V0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gIGNvbnN0IGZTRW50cnlJdGVyYXRvciA9IG5ldyBSZWN1cnNpdmVBc3luY0l0ZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeSwgRmlsZVN5c3RlbUZpbGVFbnRyeT4oYXN5bmMgZnVuY3Rpb24qIChmU0VudHJ5SXRlcmF0b3IsIHB1c2gpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yKSB7XG4gICAgICBpZiAoIWZTRW50cnlTZXQuaGFzKGZTRW50cnkuZnVsbFBhdGguc2xpY2UoMSkpKSB7XG4gICAgICAgIGZTRW50cnlTZXQuYWRkKGZTRW50cnkuZnVsbFBhdGguc2xpY2UoMSkpO1xuICAgICAgICBjb25zdCBmc0VudHJpZXMgPSBuZXcgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3IoZlNFbnRyeSk7XG4gICAgICAgIGZvciAoY29uc3QgZlNGaWxlRW50cnkgb2YgZnNFbnRyaWVzLmdldEZpbGVFbnRyeSgpKSB7XG4gICAgICAgICAgeWllbGQgZlNGaWxlRW50cnk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBmU0RpcmVjdG9yeUVudHJ5IG9mIGZzRW50cmllcy5nZXREaXJlY3RvcnlFbnRyeSgpKSB7XG4gICAgICAgICAgcHVzaChuZXcgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5SXRlcmF0b3IoZlNEaXJlY3RvcnlFbnRyeSkuZ2V0RW50cnkoKSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIGNvbnN0IGpvYlF1ZXVlID0gbmV3IEpvYlF1ZXVlPHZvaWQsIHN0cmluZz4oLTEpO1xuICBsZXQgc3RhcnRlZCA9IGZhbHNlO1xuICBsZXQgZW5kZWQgPSB0cnVlO1xuICBsZXQgZG9uZSA9IHRydWU7XG4gIGNvbnN0IHVwbG9hZFN0YXJ0ID0gKCkgPT4ge1xuICAgIGlmIChzdGFydGVkID09PSBmYWxzZSkge1xuICAgICAgc3RhcnRlZCA9IHRydWU7XG4gICAgICBlbmRlZCA9IGZhbHNlO1xuICAgICAgZG9uZSA9IGZhbHNlO1xuICAgICAgZm4ub25VcGxvYWRTdGFydD8uKCk7XG4gICAgfVxuICB9O1xuICBjb25zdCB1cGxvYWRFbmQgPSAoKSA9PiB7XG4gICAgaWYgKGVuZGVkID09PSBmYWxzZSkge1xuICAgICAgc3RhcnRlZCA9IGZhbHNlO1xuICAgICAgZW5kZWQgPSB0cnVlO1xuICAgICAgam9iUXVldWUuYWJvcnQoKTtcbiAgICAgIGpvYlF1ZXVlLnJlc2V0KCk7XG4gICAgICBmU0VudHJ5U2V0LmNsZWFyKCk7XG4gICAgICBmbi5vblVwbG9hZEVuZD8uKCk7XG4gICAgfVxuICB9O1xuICBjb25zdCBjaGFuZ2VIYW5kbGVyID0gKCkgPT4ge1xuICAgIGpvYlF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICB1cGxvYWRTdGFydCgpO1xuICAgICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50ICYmIGVsZW1lbnQuZmlsZXMpIHtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBmU0ZpbGVFbnRyeSBvZiBmU0VudHJ5SXRlcmF0b3IuaXRlcmF0ZShlbGVtZW50LndlYmtpdEVudHJpZXMpKSB7XG4gICAgICAgICAgYXdhaXQgZm4ub25VcGxvYWROZXh0RmlsZShhd2FpdCBuZXcgUHJvbWlzZTxGaWxlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiBmU0ZpbGVFbnRyeS5maWxlKHJlc29sdmUsIHJlamVjdCkpLCAoKSA9PiAoZG9uZSA9IHRydWUpKTtcbiAgICAgICAgICBpZiAoZG9uZSA9PT0gdHJ1ZSkgcmV0dXJuIHVwbG9hZEVuZCgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBlbGVtZW50LmZpbGVzKSB7XG4gICAgICAgICAgaWYgKCFmU0VudHJ5U2V0LmhhcyhmaWxlLndlYmtpdFJlbGF0aXZlUGF0aCkpIHtcbiAgICAgICAgICAgIGZTRW50cnlTZXQuYWRkKGZpbGUud2Via2l0UmVsYXRpdmVQYXRoKTtcbiAgICAgICAgICAgIGF3YWl0IGZuLm9uVXBsb2FkTmV4dEZpbGUoZmlsZSwgKCkgPT4gKGRvbmUgPSB0cnVlKSk7XG4gICAgICAgICAgICBpZiAoZG9uZSA9PT0gdHJ1ZSkgcmV0dXJuIHVwbG9hZEVuZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdXBsb2FkRW5kKCk7XG4gICAgfSwgJ2NoYW5nZUhhbmRsZXInKTtcbiAgfTtcbiAgY29uc3QgZHJvcEhhbmRsZXIgPSAoZXZlbnQ6IERyYWdFdmVudCkgPT4ge1xuICAgIGpvYlF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICB1cGxvYWRTdGFydCgpO1xuICAgICAgaWYgKGV2ZW50LmRhdGFUcmFuc2Zlcikge1xuICAgICAgICBjb25zdCBkYXRhVHJhbnNmZXJJdGVtcyA9IG5ldyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3IoZXZlbnQuZGF0YVRyYW5zZmVyLml0ZW1zKTtcbiAgICAgICAgZm9yIGF3YWl0IChjb25zdCBmU0ZpbGVFbnRyeSBvZiBmU0VudHJ5SXRlcmF0b3IuaXRlcmF0ZShkYXRhVHJhbnNmZXJJdGVtcy5nZXRBc0VudHJ5KCkpKSB7XG4gICAgICAgICAgYXdhaXQgZm4ub25VcGxvYWROZXh0RmlsZShhd2FpdCBuZXcgUHJvbWlzZTxGaWxlPigocmVzb2x2ZSwgcmVqZWN0KSA9PiBmU0ZpbGVFbnRyeS5maWxlKHJlc29sdmUsIHJlamVjdCkpLCAoKSA9PiAoZG9uZSA9IHRydWUpKTtcbiAgICAgICAgICBpZiAoZG9uZSA9PT0gdHJ1ZSkgcmV0dXJuIHVwbG9hZEVuZCgpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBldmVudC5kYXRhVHJhbnNmZXIuZmlsZXMpIHtcbiAgICAgICAgICBpZiAoIWZTRW50cnlTZXQuaGFzKGZpbGUud2Via2l0UmVsYXRpdmVQYXRoKSkge1xuICAgICAgICAgICAgZlNFbnRyeVNldC5hZGQoZmlsZS53ZWJraXRSZWxhdGl2ZVBhdGgpO1xuICAgICAgICAgICAgYXdhaXQgZm4ub25VcGxvYWROZXh0RmlsZShmaWxlLCAoKSA9PiAoZG9uZSA9IHRydWUpKTtcbiAgICAgICAgICAgIGlmIChkb25lID09PSB0cnVlKSByZXR1cm4gdXBsb2FkRW5kKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB1cGxvYWRFbmQoKTtcbiAgICB9LCAnZHJvcEhhbmRsZXInKTtcbiAgfTtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBjaGFuZ2VIYW5kbGVyKTtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdk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QUFBQTtBQUVGLFFBQU0sZ0JBQWdCLE1BQU07QUFDMUIsYUFBUyxJQUFJLFlBQVk7QUFDdkIsa0JBQVk7QUFDWixVQUFJLG1CQUFtQixvQkFBb0IsUUFBUSxPQUFPO0FBQ3hELHlCQUFpQixlQUFlLGdCQUFnQixRQUFRLFFBQVEsYUFBYSxHQUFHO0FBQzlFLGdCQUFNLEdBQUcsaUJBQWlCLE1BQU0sSUFBSSxRQUFjLENBQUMsU0FBUyxXQUFXLFlBQVksS0FBSyxTQUFTLE1BQU0sQ0FBQyxHQUFHLE1BQU8sT0FBTyxJQUFLO0FBQzlILGNBQUksU0FBUztBQUFNLG1CQUFPLFVBQVU7QUFBQSxRQUN0QztBQUNBLG1CQUFXLFFBQVEsUUFBUSxPQUFPO0FBQ2hDLGVBQUssV0FBVyxJQUFJLEtBQUssa0JBQWtCLEdBQUc7QUFDNUMsdUJBQVcsSUFBSSxLQUFLLGtCQUFrQjtBQUN0QyxrQkFBTSxHQUFHLGlCQUFpQixNQUFNLE1BQU8sT0FBTyxJQUFLO0FBQ25ELGdCQUFJLFNBQVM7QUFBTSxxQkFBTyxVQUFVO0FBQUEsVUFDdEM7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUNBLGdCQUFVO0FBQUEsT0FDVCxlQUFlO0FBQUE7QUFFcEIsUUFBTSxjQUFjLENBQUMsVUFBcUI7QUFDeEMsYUFBUyxJQUFJLFlBQVk7QUFDdkIsa0JBQVk7QUFDWixVQUFJLE1BQU0sY0FBYztBQUN0QixjQUFNLG9CQUFvQixJQUFJLHlCQUF5QixNQUFNLGFBQWEsS0FBSztBQUMvRSx5QkFBaUIsZUFBZSxnQkFBZ0IsUUFBUSxrQkFBa0IsV0FBVyxDQUFDLEdBQUc7QUFDdkYsZ0JBQU0sR0FBRyxpQkFBaUIsTUFBTSxJQUFJLFFBQWMsQ0FBQyxTQUFTLFdBQVcsWUFBWSxLQUFLLFNBQVMsTUFBTSxDQUFDLEdBQUcsTUFBTyxPQUFPLElBQUs7QUFDOUgsY0FBSSxTQUFTO0FBQU0sbUJBQU8sVUFBVTtBQUFBLFFBQ3RDO0FBQ0EsbUJBQVcsUUFBUSxNQUFNLGFBQWEsT0FBTztBQUMzQyxlQUFLLFdBQVcsSUFBSSxLQUFLLGtCQUFrQixHQUFHO0FBQzVDLHVCQUFXLElBQUksS0FBSyxrQkFBa0I7QUFDdEMsa0JBQU0sR0FBRyxpQkFBaUIsTUFBTSxNQUFPLE9BQU8sSUFBSztBQUNuRCxnQkFBSSxTQUFTO0FBQU0scUJBQU8sVUFBVTtBQUFBLFVBQ3RDO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFDQSxnQkFBVTtBQUFBLE9BQ1QsYUFBYTtBQUFBO0FBRWxCLFVBQVEsaUJBQWlCLFVBQVUsYUFBYTtBQUNoRCxVQUFRLGlCQUFpQixRQUFRLFdBQVc7QUFBQTtBQTVIOUMsSUFBTSwwQkFBMEIseUJBQXlCLEtBQUssT0FBTyxVQUFVLFNBQVMsTUFBTSxPQUFPLFFBQVE7IiwKICAiZGVidWdJZCI6ICI3ODVCRjgzRjdBRDg3MDJDNjQ3NTZFMjE2NDc1NkUyMSIsCiAgIm5hbWVzIjogW10KfQ==
