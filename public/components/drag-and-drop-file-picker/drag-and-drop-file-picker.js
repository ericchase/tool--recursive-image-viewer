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
export { setupDragAndDropFilePicker };

//# debugId=992DE78A621A8BE164756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcRGVzaWduIFBhdHRlcm5cXE9ic2VydmVyXFxTdG9yZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxKb2JRdWV1ZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxSZWN1cnNpdmVBc3luY0l0ZXJhdG9yLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXERhdGFUcmFuc2Zlci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlU3lzdGVtLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXEhUTUxJbnB1dEVsZW1lbnQudHMiLCAic3JjXFxjb21wb25lbnRzXFxkcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyXFxkcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWwogICAgImV4cG9ydCB0eXBlIFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPiA9ICh2YWx1ZTogVmFsdWUsIHVuc3Vic2NyaWJlOiAoKSA9PiB2b2lkKSA9PiB2b2lkO1xuZXhwb3J0IHR5cGUgVXBkYXRlQ2FsbGJhY2s8VmFsdWU+ID0gKHZhbHVlOiBWYWx1ZSkgPT4gVmFsdWU7XG5cbmV4cG9ydCBjbGFzcyBDb25zdDxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9uU2V0ID0gbmV3IFNldDxTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4+KCk7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCB2YWx1ZT86IFZhbHVlKSB7fVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmFkZChjYWxsYmFjayk7XG4gICAgaWYgKHRoaXMudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY2FsbGJhY2sodGhpcy52YWx1ZSwgKCkgPT4ge1xuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgIH07XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWU+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWU+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLnZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5zdWJzY3JpcHRpb25TZXQpIHtcbiAgICAgICAgY2FsbGJhY2sodmFsdWUsICgpID0+IHtcbiAgICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0b3JlPFZhbHVlPiB7XG4gIHByb3RlY3RlZCBjdXJyZW50VmFsdWU6IFZhbHVlO1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9uU2V0ID0gbmV3IFNldDxTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4+KCk7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBpbml0aWFsVmFsdWU6IFZhbHVlLFxuICAgIHByb3RlY3RlZCBub3RpZnlPbkNoYW5nZU9ubHk6IGJvb2xlYW4gPSBmYWxzZSxcbiAgKSB7XG4gICAgdGhpcy5jdXJyZW50VmFsdWUgPSBpbml0aWFsVmFsdWU7XG4gIH1cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4pOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5hZGQoY2FsbGJhY2spO1xuICAgIGNvbnN0IHVuc3Vic2NyaWJlID0gKCkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICAgIGNhbGxiYWNrKHRoaXMuY3VycmVudFZhbHVlLCB1bnN1YnNjcmliZSk7XG4gICAgcmV0dXJuIHVuc3Vic2NyaWJlO1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5ub3RpZnlPbkNoYW5nZU9ubHkgJiYgdGhpcy5jdXJyZW50VmFsdWUgPT09IHZhbHVlKSByZXR1cm47XG4gICAgdGhpcy5jdXJyZW50VmFsdWUgPSB2YWx1ZTtcbiAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICBjYWxsYmFjayh2YWx1ZSwgKCkgPT4ge1xuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIHVwZGF0ZShjYWxsYmFjazogVXBkYXRlQ2FsbGJhY2s8VmFsdWU+KTogdm9pZCB7XG4gICAgdGhpcy5zZXQoY2FsbGJhY2sodGhpcy5jdXJyZW50VmFsdWUpKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgT3B0aW9uYWw8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIHN0b3JlOiBTdG9yZTxWYWx1ZSB8IHVuZGVmaW5lZD47XG4gIGNvbnN0cnVjdG9yKG5vdGlmeU9uQ2hhbmdlT25seSA9IGZhbHNlKSB7XG4gICAgdGhpcy5zdG9yZSA9IG5ldyBTdG9yZTxWYWx1ZSB8IHVuZGVmaW5lZD4odW5kZWZpbmVkLCBub3RpZnlPbkNoYW5nZU9ubHkpO1xuICB9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWUgfCB1bmRlZmluZWQ+KTogKCkgPT4gdm9pZCB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcmUuc3Vic2NyaWJlKGNhbGxiYWNrKTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZSB8IHVuZGVmaW5lZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZSB8IHVuZGVmaW5lZD4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlIHwgdW5kZWZpbmVkKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZXQodmFsdWUpO1xuICB9XG4gIHVwZGF0ZShjYWxsYmFjazogVXBkYXRlQ2FsbGJhY2s8VmFsdWUgfCB1bmRlZmluZWQ+KTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS51cGRhdGUoY2FsbGJhY2spO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBDb21wb3VuZFN1YnNjcmlwdGlvbjxUIGV4dGVuZHMgYW55W10+KHN0b3JlczogeyBbSyBpbiBrZXlvZiBUXTogU3RvcmU8VFtLXT4gfCBPcHRpb25hbDxUW0tdPiB9LCBjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8eyBbSyBpbiBrZXlvZiBUXTogVFtLXSB8IHVuZGVmaW5lZCB9Pik6ICgpID0+IHZvaWQge1xuICBjb25zdCB1bnN1YnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIGNvbnN0IHVuc3Vic2NyaWJlID0gKCkgPT4ge1xuICAgIGZvciAoY29uc3QgdW5zdWIgb2YgdW5zdWJzKSB7XG4gICAgICB1bnN1YigpO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgdmFsdWVzID0gW10gYXMgeyBbSyBpbiBrZXlvZiBUXTogVFtLXSB8IHVuZGVmaW5lZCB9O1xuICBjb25zdCBjYWxsYmFja19oYW5kbGVyID0gKCkgPT4ge1xuICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSBzdG9yZXMubGVuZ3RoKSB7XG4gICAgICBjYWxsYmFjayh2YWx1ZXMsIHVuc3Vic2NyaWJlKTtcbiAgICB9XG4gIH07XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3RvcmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgc3RvcmVzW2ldLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICB2YWx1ZXNbaV0gPSB2YWx1ZTtcbiAgICAgIHVuc3Vic1tpXSA9IHVuc3Vic2NyaWJlO1xuICAgICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IHN0b3Jlcy5sZW5ndGgpIHtcbiAgICAgICAgY2FsbGJhY2tfaGFuZGxlcigpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIHJldHVybiB1bnN1YnNjcmliZTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgU3RvcmUgfSBmcm9tICcuLi9EZXNpZ24gUGF0dGVybi9PYnNlcnZlci9TdG9yZS5qcyc7XG5cbmV4cG9ydCB0eXBlIFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPiA9IChyZXN1bHQ/OiBSZXN1bHQsIGVycm9yPzogRXJyb3IsIHRhZz86IFRhZykgPT4geyBhYm9ydDogYm9vbGVhbiB9IHwgdm9pZDtcblxuZXhwb3J0IGNsYXNzIEpvYlF1ZXVlPFJlc3VsdCA9IHZvaWQsIFRhZyA9IHZvaWQ+IHtcbiAgLyoqXG4gICAqIDA6IE5vIGRlbGF5LiAtMTogQ29uc2VjdXRpdmUuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZGVsYXlfbXM6IG51bWJlcikge31cbiAgcHVibGljIGFib3J0KCkge1xuICAgIHRoaXMuX2Fib3J0ZWQgPSB0cnVlO1xuICB9XG4gIHB1YmxpYyBnZXQgYWJvcnRlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fYWJvcnRlZDtcbiAgfVxuICBwdWJsaWMgYWRkKGZuOiAoKSA9PiBQcm9taXNlPFJlc3VsdD4sIHRhZz86IFRhZykge1xuICAgIGlmICh0aGlzLl9hYm9ydGVkID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5xdWV1ZS5wdXNoKHsgZm4sIHRhZyB9KTtcbiAgICAgIGlmICh0aGlzLnJ1bm5pbmcgPT09IGZhbHNlKSB7XG4gICAgICAgIHRoaXMucnVubmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMucnVuKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHB1YmxpYyBnZXQgZG9uZSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb21wbGV0aW9uQ291bnQgPT09IHRoaXMucXVldWUubGVuZ3RoID8gdHJ1ZSA6IGZhbHNlO1xuICB9XG4gIHB1YmxpYyByZXNldCgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMucnVubmluZ0NvdW50LnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgIHRoaXMuX2Fib3J0ZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5jb21wbGV0aW9uQ291bnQgPSAwO1xuICAgICAgICB0aGlzLnF1ZXVlID0gW107XG4gICAgICAgIHRoaXMucXVldWVJbmRleCA9IDA7XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IFtdO1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgcHVibGljIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiB0aGlzLnJlc3VsdHMpIHtcbiAgICAgIGlmIChjYWxsYmFjayhyZXN1bHQudmFsdWUsIHJlc3VsdC5lcnJvcik/LmFib3J0ID09PSB0cnVlKSB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiAoKSA9PiB7fTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgfVxuICBwcm90ZWN0ZWQgX2Fib3J0ZWQgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIGNvbXBsZXRpb25Db3VudCA9IDA7XG4gIHByb3RlY3RlZCBxdWV1ZTogeyBmbjogKCkgPT4gUHJvbWlzZTxSZXN1bHQ+OyB0YWc/OiBUYWcgfVtdID0gW107XG4gIHByb3RlY3RlZCBxdWV1ZUluZGV4ID0gMDtcbiAgcHJvdGVjdGVkIHJlc3VsdHM6IHsgdmFsdWU/OiBSZXN1bHQ7IGVycm9yPzogRXJyb3IgfVtdID0gW107XG4gIHByb3RlY3RlZCBydW5uaW5nID0gZmFsc2U7XG4gIHByb3RlY3RlZCBydW5uaW5nQ291bnQgPSBuZXcgU3RvcmUoMCk7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPj4oKTtcbiAgcHJvdGVjdGVkIHJ1bigpIHtcbiAgICBpZiAodGhpcy5fYWJvcnRlZCA9PT0gZmFsc2UgJiYgdGhpcy5xdWV1ZUluZGV4IDwgdGhpcy5xdWV1ZS5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHsgZm4sIHRhZyB9ID0gdGhpcy5xdWV1ZVt0aGlzLnF1ZXVlSW5kZXgrK107XG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICB0aGlzLnJ1bm5pbmdDb3VudC51cGRhdGUoKGNvdW50KSA9PiBjb3VudCArIDEpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgZm4oKTtcbiAgICAgICAgICB0aGlzLnNlbmQoeyB2YWx1ZSwgdGFnIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgdGhpcy5zZW5kKHsgZXJyb3IsIHRhZyB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJ1bm5pbmdDb3VudC51cGRhdGUoKGNvdW50KSA9PiBjb3VudCAtIDEpO1xuICAgICAgICBpZiAodGhpcy5kZWxheV9tcyA8IDApIHtcbiAgICAgICAgICB0aGlzLnJ1bigpO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuICAgICAgaWYgKHRoaXMuZGVsYXlfbXMgPj0gMCkge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMucnVuKCksIHRoaXMuZGVsYXlfbXMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcHJvdGVjdGVkIHNlbmQocmVzdWx0OiB7IHZhbHVlPzogUmVzdWx0OyBlcnJvcj86IEVycm9yOyB0YWc/OiBUYWcgfSkge1xuICAgIGlmICh0aGlzLl9hYm9ydGVkID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5jb21wbGV0aW9uQ291bnQrKztcbiAgICAgIHRoaXMucmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICAgIGlmIChjYWxsYmFjayhyZXN1bHQudmFsdWUsIHJlc3VsdC5lcnJvciwgcmVzdWx0LnRhZyk/LmFib3J0ID09PSB0cnVlKSB7XG4gICAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IFN5bmNBc3luY0l0ZXJhYmxlIH0gZnJvbSAnLi9UeXBlLmpzJztcblxuZXhwb3J0IGNsYXNzIFJlY3Vyc2l2ZUl0ZXJhdG9yPEluLCBPdXQ+IHtcbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIGZuOiAodmFsdWU6IFN5bmNBc3luY0l0ZXJhYmxlPEluPiwgcHVzaDogKHZhbHVlOiBTeW5jQXN5bmNJdGVyYWJsZTxJbj4pID0+IHZvaWQpID0+IFN5bmNBc3luY0l0ZXJhYmxlPE91dD4pIHt9XG4gIGFzeW5jICppdGVyYXRlKGluaXQ6IFN5bmNBc3luY0l0ZXJhYmxlPEluPik6IFN5bmNBc3luY0l0ZXJhYmxlPE91dD4ge1xuICAgIGNvbnN0IGxpc3Q6IFN5bmNBc3luY0l0ZXJhYmxlPEluPltdID0gW2luaXRdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBmU0VudHJ5IG9mIHRoaXMuZm4obGlzdFtpXSwgKHZhbHVlKSA9PiB7XG4gICAgICAgIGxpc3QucHVzaCh2YWx1ZSk7XG4gICAgICB9KSkge1xuICAgICAgICB5aWVsZCBmU0VudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IE4gfSBmcm9tICcuLi9VdGlsaXR5L1R5cGUuanMnO1xuXG5leHBvcnQgY2xhc3MgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIHtcbiAgbGlzdDogRGF0YVRyYW5zZmVySXRlbVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGl0ZW1zPzogTjxEYXRhVHJhbnNmZXJJdGVtPiB8IERhdGFUcmFuc2Zlckl0ZW1MaXN0IHwgbnVsbCkge1xuICAgIGlmIChpdGVtcyBpbnN0YW5jZW9mIERhdGFUcmFuc2Zlckl0ZW0pIHtcbiAgICAgIHRoaXMubGlzdCA9IFtpdGVtc107XG4gICAgfSBlbHNlIGlmIChpdGVtcyBpbnN0YW5jZW9mIERhdGFUcmFuc2Zlckl0ZW1MaXN0KSB7XG4gICAgICB0aGlzLmxpc3QgPSBBcnJheS5mcm9tKGl0ZW1zKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICB0aGlzLmxpc3QgPSBpdGVtcztcbiAgICB9XG4gIH1cbiAgKmdldEFzRW50cnkoKTogR2VuZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeT4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gKGl0ZW0gYXMgRGF0YVRyYW5zZmVySXRlbSAmIHsgZ2V0QXNFbnRyeT86IERhdGFUcmFuc2Zlckl0ZW1bJ3dlYmtpdEdldEFzRW50cnknXSB9KS5nZXRBc0VudHJ5Py4oKSA/PyBpdGVtLndlYmtpdEdldEFzRW50cnk/LigpO1xuICAgICAgaWYgKGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqZ2V0QXNGaWxlKCk6IEdlbmVyYXRvcjxGaWxlPiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgZmlsZSA9IGl0ZW0uZ2V0QXNGaWxlPy4oKTtcbiAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgRmlsZSkge1xuICAgICAgICB5aWVsZCBmaWxlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqZ2V0QXNTdHJpbmcoKTogQXN5bmNHZW5lcmF0b3I8c3RyaW5nPiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgeWllbGQgYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgaXRlbS5nZXRBc1N0cmluZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGl0ZW0uZ2V0QXNTdHJpbmcocmVzb2x2ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVqZWN0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIiwKICAgICJleHBvcnQgY2xhc3MgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3Ige1xuICBsaXN0OiBGaWxlU3lzdGVtRW50cnlbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzPzogRmlsZVN5c3RlbUVudHJ5IHwgRmlsZVN5c3RlbUVudHJ5W10gfCBudWxsKSB7XG4gICAgaWYgKGVudHJpZXMgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRW50cnkpIHtcbiAgICAgIHRoaXMubGlzdCA9IFtlbnRyaWVzXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGVudHJpZXM7XG4gICAgfVxuICB9XG4gICpnZXREaXJlY3RvcnlFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSAmJiBlbnRyeSBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldEZpbGVFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbUZpbGVFbnRyeT4ge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5saXN0KSB7XG4gICAgICBpZiAoZW50cnkuaXNGaWxlICYmIGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbUZpbGVFbnRyeSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yIHtcbiAgbGlzdDogRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5W10gPSBbXTtcbiAgY29uc3RydWN0b3IoZW50cmllcz86IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSB8IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeVtdIHwgbnVsbCkge1xuICAgIGlmIChlbnRyaWVzIGluc3RhbmNlb2YgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5KSB7XG4gICAgICB0aGlzLmxpc3QgPSBbZW50cmllc107XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGVudHJpZXMpKSB7XG4gICAgICB0aGlzLmxpc3QgPSBlbnRyaWVzO1xuICAgIH1cbiAgfVxuICBhc3luYyAqZ2V0RW50cnkoKTogQXN5bmNHZW5lcmF0b3I8RmlsZVN5c3RlbUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IHJlYWRlciA9IGVudHJ5LmNyZWF0ZVJlYWRlcigpO1xuICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBhd2FpdCBuZXcgUHJvbWlzZTxGaWxlU3lzdGVtRW50cnlbXT4oKHJlc29sdmUsIHJlamVjdCkgPT4gcmVhZGVyLnJlYWRFbnRyaWVzKHJlc29sdmUsIHJlamVjdCkpKSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICIvLyBXZWJraXQgR3VhcmRzXG5cbmV4cG9ydCBmdW5jdGlvbiBHZXRXZWJraXRFbnRyaWVzKGVsZW1lbnQ6IEhUTUxJbnB1dEVsZW1lbnQpOiByZWFkb25seSBGaWxlU3lzdGVtRW50cnlbXSB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBlbGVtZW50LndlYmtpdEVudHJpZXMgPz8gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gR2V0V2Via2l0UmVsYXRpdmVQYXRoKGZpbGU6IEZpbGUpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICByZXR1cm4gZmlsZS53ZWJraXRSZWxhdGl2ZVBhdGggPz8gdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gU3VwcG9ydHNXZWJraXREaXJlY3RvcnkoKTogYm9vbGVhbiB7XG4gIHJldHVybiAvYW5kcm9pZHxpcGhvbmV8bW9iaWxlL2kudGVzdCh3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudCkgPT09IHRydWUgPyBmYWxzZSA6IHRydWU7XG59XG4iLAogICAgImltcG9ydCB7IEpvYlF1ZXVlIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L0pvYlF1ZXVlLmpzJztcbmltcG9ydCB7IFJlY3Vyc2l2ZUl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L1JlY3Vyc2l2ZUFzeW5jSXRlcmF0b3IuanMnO1xuaW1wb3J0IHR5cGUgeyBTeW5jQXN5bmNJdGVyYWJsZSB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9UeXBlLmpzJztcbmltcG9ydCB7IERhdGFUcmFuc2Zlckl0ZW1JdGVyYXRvciB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvV2ViIEFQSS9EYXRhVHJhbnNmZXIuanMnO1xuaW1wb3J0IHsgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5SXRlcmF0b3IsIEZpbGVTeXN0ZW1FbnRyeUl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9XZWIgQVBJL0ZpbGVTeXN0ZW0uanMnO1xuaW1wb3J0IHsgR2V0V2Via2l0RW50cmllcywgR2V0V2Via2l0UmVsYXRpdmVQYXRoLCBTdXBwb3J0c1dlYmtpdERpcmVjdG9yeSB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvV2ViIEFQSS9IVE1MSW5wdXRFbGVtZW50LmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIHNldHVwRHJhZ0FuZERyb3BGaWxlUGlja2VyKFxuICBjb250YWluZXI6IEVsZW1lbnQsXG4gIGZuOiB7XG4gICAgb25EcmFnRW5kPzogKCkgPT4gdm9pZDtcbiAgICBvbkRyYWdFbnRlcj86ICgpID0+IHZvaWQ7XG4gICAgb25EcmFnTGVhdmU/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJvcD86ICgpID0+IHZvaWQ7XG4gICAgb25VcGxvYWRFbmQ/OiAoKSA9PiB2b2lkO1xuICAgIG9uVXBsb2FkTmV4dEZpbGU6IChmaWxlOiBGaWxlLCBkb25lOiAoKSA9PiB2b2lkKSA9PiBQcm9taXNlPHZvaWQ+IHwgdm9pZDtcbiAgICBvblVwbG9hZFN0YXJ0PzogKCkgPT4gdm9pZDtcbiAgfSxcbiAgb3B0aW9ucz86IHtcbiAgICBkaXJlY3Rvcnk6IGJvb2xlYW47XG4gICAgbXVsdGlwbGU6IGJvb2xlYW47XG4gIH0sXG4pIHtcbiAgY29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5xdWVyeVNlbGVjdG9yKCdpbnB1dCcpO1xuICBpZiAoIWVsZW1lbnQpIHtcbiAgICB0aHJvdyAnZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlciBpbnB1dCBlbGVtZW50IG1pc3NpbmcnO1xuICB9XG4gIGlmIChvcHRpb25zPy5kaXJlY3RvcnkgPT09IHRydWUgJiYgU3VwcG9ydHNXZWJraXREaXJlY3RvcnkoKSkge1xuICAgIGVsZW1lbnQudG9nZ2xlQXR0cmlidXRlKCd3ZWJraXRkaXJlY3RvcnknLCB0cnVlKTtcbiAgfVxuICBpZiAob3B0aW9ucz8ubXVsdGlwbGUgPT09IHRydWUpIHtcbiAgICBlbGVtZW50LnRvZ2dsZUF0dHJpYnV0ZSgnbXVsdGlwbGUnLCB0cnVlKTtcbiAgfVxuXG4gIGlmIChmbi5vbkRyYWdFbmQgfHwgZm4ub25EcmFnRW50ZXIgfHwgZm4ub25EcmFnTGVhdmUpIHtcbiAgICBjb25zdCByZW1vdmVMaXN0ZW5lcnMgPSAoKSA9PiB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdsZWF2ZUhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xuICAgIH07XG4gICAgY29uc3QgZHJhZ2VuZEhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICByZW1vdmVMaXN0ZW5lcnMoKTtcbiAgICAgIGZuLm9uRHJhZ0VuZD8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcmFnbGVhdmVIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgcmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICBmbi5vbkRyYWdMZWF2ZT8uKCk7XG4gICAgfTtcbiAgICBjb25zdCBkcm9wSGFuZGxlciA9ICgpID0+IHtcbiAgICAgIHJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgZm4ub25Ecm9wPy4oKTtcbiAgICB9O1xuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VudGVyJywgKCkgPT4ge1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCBkcmFnbGVhdmVIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIGRyYWdlbmRIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGRyb3BIYW5kbGVyKTtcbiAgICAgIGZuLm9uRHJhZ0VudGVyPy4oKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGZTRW50cnlTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgZlNFbnRyeUl0ZXJhdG9yID0gbmV3IFJlY3Vyc2l2ZUl0ZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeSwgRmlsZVN5c3RlbUZpbGVFbnRyeT4oYXN5bmMgZnVuY3Rpb24qIChmU0VudHJ5SXRlcmF0b3IsIHB1c2gpIHtcbiAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yKSB7XG4gICAgICBjb25zdCBwYXRoID0gZlNFbnRyeS5mdWxsUGF0aC5zbGljZSgxKTtcbiAgICAgIGlmICghZlNFbnRyeVNldC5oYXMocGF0aCkpIHtcbiAgICAgICAgZlNFbnRyeVNldC5hZGQocGF0aCk7XG4gICAgICAgIGNvbnN0IGZzRW50cmllcyA9IG5ldyBGaWxlU3lzdGVtRW50cnlJdGVyYXRvcihmU0VudHJ5KTtcbiAgICAgICAgZm9yIChjb25zdCBmU0ZpbGVFbnRyeSBvZiBmc0VudHJpZXMuZ2V0RmlsZUVudHJ5KCkpIHtcbiAgICAgICAgICB5aWVsZCBmU0ZpbGVFbnRyeTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGZTRGlyZWN0b3J5RW50cnkgb2YgZnNFbnRyaWVzLmdldERpcmVjdG9yeUVudHJ5KCkpIHtcbiAgICAgICAgICBwdXNoKG5ldyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvcihmU0RpcmVjdG9yeUVudHJ5KS5nZXRFbnRyeSgpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgY29uc3Qgam9iUXVldWUgPSBuZXcgSm9iUXVldWU8dm9pZCwgc3RyaW5nPigtMSk7XG4gIGxldCBzdGFydGVkID0gZmFsc2U7XG4gIGxldCBlbmRlZCA9IHRydWU7XG4gIGxldCBkb25lID0gdHJ1ZTtcbiAgY29uc3QgdXBsb2FkU3RhcnQgPSAoKSA9PiB7XG4gICAgaWYgKHN0YXJ0ZWQgPT09IGZhbHNlKSB7XG4gICAgICBzdGFydGVkID0gdHJ1ZTtcbiAgICAgIGVuZGVkID0gZmFsc2U7XG4gICAgICBkb25lID0gZmFsc2U7XG4gICAgICBmbi5vblVwbG9hZFN0YXJ0Py4oKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IHVwbG9hZEVuZCA9ICgpID0+IHtcbiAgICBpZiAoZW5kZWQgPT09IGZhbHNlKSB7XG4gICAgICBzdGFydGVkID0gZmFsc2U7XG4gICAgICBlbmRlZCA9IHRydWU7XG4gICAgICBqb2JRdWV1ZS5hYm9ydCgpO1xuICAgICAgam9iUXVldWUucmVzZXQoKTtcbiAgICAgIGZTRW50cnlTZXQuY2xlYXIoKTtcbiAgICAgIGZuLm9uVXBsb2FkRW5kPy4oKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IGl0ZXJhdGVGU0VudHJpZXMgPSBhc3luYyAoaW5pdEVudHJpZXM6IFN5bmNBc3luY0l0ZXJhYmxlPEZpbGVTeXN0ZW1FbnRyeT4sIGZpbGVzOiBGaWxlTGlzdCkgPT4ge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZlNGaWxlRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yLml0ZXJhdGUoaW5pdEVudHJpZXMpKSB7XG4gICAgICBhd2FpdCBmbi5vblVwbG9hZE5leHRGaWxlKGF3YWl0IG5ldyBQcm9taXNlPEZpbGU+KChyZXNvbHZlLCByZWplY3QpID0+IGZTRmlsZUVudHJ5LmZpbGUocmVzb2x2ZSwgcmVqZWN0KSksICgpID0+IChkb25lID0gdHJ1ZSkpO1xuICAgICAgaWYgKGRvbmUgPT09IHRydWUpIHJldHVybiB1cGxvYWRFbmQoKTtcbiAgICB9XG4gICAgZm9yIChjb25zdCBmaWxlIG9mIGZpbGVzKSB7XG4gICAgICBjb25zdCBwYXRoID0gR2V0V2Via2l0UmVsYXRpdmVQYXRoKGZpbGUpICsgZmlsZS5uYW1lO1xuICAgICAgaWYgKCFmU0VudHJ5U2V0LmhhcyhwYXRoKSkge1xuICAgICAgICBmU0VudHJ5U2V0LmFkZChwYXRoKTtcbiAgICAgICAgYXdhaXQgZm4ub25VcGxvYWROZXh0RmlsZShmaWxlLCAoKSA9PiAoZG9uZSA9IHRydWUpKTtcbiAgICAgICAgaWYgKGRvbmUgPT09IHRydWUpIHJldHVybiB1cGxvYWRFbmQoKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG4gIGNvbnN0IGNoYW5nZUhhbmRsZXIgPSAoKSA9PiB7XG4gICAgam9iUXVldWUuYWRkKGFzeW5jICgpID0+IHtcbiAgICAgIHVwbG9hZFN0YXJ0KCk7XG4gICAgICBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQgJiYgZWxlbWVudC5maWxlcykge1xuICAgICAgICBhd2FpdCBpdGVyYXRlRlNFbnRyaWVzKEdldFdlYmtpdEVudHJpZXMoZWxlbWVudCkgPz8gW10sIGVsZW1lbnQuZmlsZXMpO1xuICAgICAgfVxuICAgICAgdXBsb2FkRW5kKCk7XG4gICAgfSwgJ2NoYW5nZUhhbmRsZXInKTtcbiAgfTtcbiAgY29uc3QgZHJvcEhhbmRsZXIgPSAoZXZlbnQ6IERyYWdFdmVudCkgPT4ge1xuICAgIGpvYlF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICB1cGxvYWRTdGFydCgpO1xuICAgICAgaWYgKGV2ZW50LmRhdGFUcmFuc2Zlcikge1xuICAgICAgICBjb25zdCBkYXRhVHJhbnNmZXJJdGVtcyA9IG5ldyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3IoZXZlbnQuZGF0YVRyYW5zZmVyLml0ZW1zKTtcbiAgICAgICAgYXdhaXQgaXRlcmF0ZUZTRW50cmllcyhkYXRhVHJhbnNmZXJJdGVtcy5nZXRBc0VudHJ5KCksIGV2ZW50LmRhdGFUcmFuc2Zlci5maWxlcyk7XG4gICAgICB9XG4gICAgICB1cGxvYWRFbmQoKTtcbiAgICB9LCAnZHJvcEhhbmRsZXInKTtcbiAgfTtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBjaGFuZ2VIYW5kbGVyKTtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xufVxuIgogIF0sCiAgIm1hcHBpbmdzIjogIjtBQUdPLE1BQU0sTUFBYTtBQUFBLEVBRUY7QUFBQSxFQURaLGtCQUFrQixJQUFJO0FBQUEsRUFDaEMsV0FBVyxDQUFXLE9BQWU7QUFBZjtBQUFBO0FBQUEsRUFDdEIsU0FBUyxDQUFDLFVBQW1EO0FBQzNELFNBQUssZ0JBQWdCLElBQUksUUFBUTtBQUNqQyxRQUFJLEtBQUssVUFBVSxXQUFXO0FBQzVCLGVBQVMsS0FBSyxPQUFPLE1BQU07QUFDekIsYUFBSyxnQkFBZ0IsT0FBTyxRQUFRO0FBQUEsT0FDckM7QUFBQSxJQUNIO0FBQ0EsV0FBTyxNQUFNO0FBQ1gsV0FBSyxnQkFBZ0IsT0FBTyxRQUFRO0FBQUE7QUFBQTtBQUFBLEVBR3hDLEdBQUcsR0FBbUI7QUFDcEIsV0FBTyxJQUFJLFFBQWUsQ0FBQyxZQUFZO0FBQ3JDLFdBQUssVUFBVSxDQUFDLE9BQU8sZ0JBQWdCO0FBQ3JDLG9CQUFZO0FBQ1osZ0JBQVEsS0FBSztBQUFBLE9BQ2Q7QUFBQSxL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
