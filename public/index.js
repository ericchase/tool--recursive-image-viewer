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

// src/index.ts
function showImage(file) {
  try {
    imageLoadQueue.add(
      () =>
        new Promise((resolve, reject) => {
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
        }),
    );
  } catch (_) {}
}
document.documentElement.addEventListener('dragover', (event) => event.preventDefault());
var main = document.querySelector('main');
var picker = document.querySelector('.drag-and-drop-file-picker');
var imageLoadCount = 0;
var imageLoadQueue = new JobQueue(-1);
if (picker) {
  setupDragAndDropFilePicker(
    picker,
    {
      onUploadStart() {
        picker.classList.add('hidden');
        main?.replaceChildren();
      },
      onUploadNextFile: showImage,
      onUploadEnd() {
        imageLoadQueue.subscribe(() => {
          if (imageLoadQueue.done) {
            if (imageLoadCount === 0) {
              picker.classList.remove('hidden');
              const div = document.createElement('div');
              div.style.color = 'red';
              div.textContent = 'No Images Found! Try another folder.';
              picker.querySelector('span')?.append(document.createElement('br'), document.createElement('br'), div);
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

//# debugId=31ECC8120DFF8B4264756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcRGVzaWduIFBhdHRlcm5cXE9ic2VydmVyXFxTdG9yZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxKb2JRdWV1ZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxSZWN1cnNpdmVBc3luY0l0ZXJhdG9yLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXERhdGFUcmFuc2Zlci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlU3lzdGVtLnRzIiwgInNyY1xcY29tcG9uZW50c1xcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlclxcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci50cyIsICJzcmNcXGluZGV4LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWwogICAgImV4cG9ydCB0eXBlIFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPiA9ICh2YWx1ZTogVmFsdWUsIHVuc3Vic2NyaWJlOiAoKSA9PiB2b2lkKSA9PiB2b2lkO1xuZXhwb3J0IHR5cGUgVXBkYXRlQ2FsbGJhY2s8VmFsdWU+ID0gKHZhbHVlOiBWYWx1ZSkgPT4gVmFsdWU7XG5cbmV4cG9ydCBjbGFzcyBDb25zdDxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9uU2V0ID0gbmV3IFNldDxTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4+KCk7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCB2YWx1ZT86IFZhbHVlKSB7fVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmFkZChjYWxsYmFjayk7XG4gICAgaWYgKHRoaXMudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY2FsbGJhY2sodGhpcy52YWx1ZSwgKCkgPT4ge1xuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgIH07XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWU+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWU+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLnZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5zdWJzY3JpcHRpb25TZXQpIHtcbiAgICAgICAgY2FsbGJhY2sodmFsdWUsICgpID0+IHtcbiAgICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0b3JlPFZhbHVlPiB7XG4gIHByb3RlY3RlZCBjdXJyZW50VmFsdWU6IFZhbHVlO1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9uU2V0ID0gbmV3IFNldDxTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4+KCk7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBpbml0aWFsVmFsdWU6IFZhbHVlLFxuICAgIHByb3RlY3RlZCBub3RpZnlPbkNoYW5nZU9ubHk6IGJvb2xlYW4gPSBmYWxzZSxcbiAgKSB7XG4gICAgdGhpcy5jdXJyZW50VmFsdWUgPSBpbml0aWFsVmFsdWU7XG4gIH1cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4pOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5hZGQoY2FsbGJhY2spO1xuICAgIGNvbnN0IHVuc3Vic2NyaWJlID0gKCkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICAgIGNhbGxiYWNrKHRoaXMuY3VycmVudFZhbHVlLCB1bnN1YnNjcmliZSk7XG4gICAgcmV0dXJuIHVuc3Vic2NyaWJlO1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5ub3RpZnlPbkNoYW5nZU9ubHkgJiYgdGhpcy5jdXJyZW50VmFsdWUgPT09IHZhbHVlKSByZXR1cm47XG4gICAgdGhpcy5jdXJyZW50VmFsdWUgPSB2YWx1ZTtcbiAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICBjYWxsYmFjayh2YWx1ZSwgKCkgPT4ge1xuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIHVwZGF0ZShjYWxsYmFjazogVXBkYXRlQ2FsbGJhY2s8VmFsdWU+KTogdm9pZCB7XG4gICAgdGhpcy5zZXQoY2FsbGJhY2sodGhpcy5jdXJyZW50VmFsdWUpKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgT3B0aW9uYWw8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIHN0b3JlOiBTdG9yZTxWYWx1ZSB8IHVuZGVmaW5lZD47XG4gIGNvbnN0cnVjdG9yKG5vdGlmeU9uQ2hhbmdlT25seSA9IGZhbHNlKSB7XG4gICAgdGhpcy5zdG9yZSA9IG5ldyBTdG9yZTxWYWx1ZSB8IHVuZGVmaW5lZD4odW5kZWZpbmVkLCBub3RpZnlPbkNoYW5nZU9ubHkpO1xuICB9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWUgfCB1bmRlZmluZWQ+KTogKCkgPT4gdm9pZCB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcmUuc3Vic2NyaWJlKGNhbGxiYWNrKTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZSB8IHVuZGVmaW5lZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZSB8IHVuZGVmaW5lZD4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlIHwgdW5kZWZpbmVkKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZXQodmFsdWUpO1xuICB9XG4gIHVwZGF0ZShjYWxsYmFjazogVXBkYXRlQ2FsbGJhY2s8VmFsdWUgfCB1bmRlZmluZWQ+KTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS51cGRhdGUoY2FsbGJhY2spO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBDb21wb3VuZFN1YnNjcmlwdGlvbjxUIGV4dGVuZHMgYW55W10+KHN0b3JlczogeyBbSyBpbiBrZXlvZiBUXTogU3RvcmU8VFtLXT4gfCBPcHRpb25hbDxUW0tdPiB9LCBjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8eyBbSyBpbiBrZXlvZiBUXTogVFtLXSB8IHVuZGVmaW5lZCB9Pik6ICgpID0+IHZvaWQge1xuICBjb25zdCB1bnN1YnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIGNvbnN0IHVuc3Vic2NyaWJlID0gKCkgPT4ge1xuICAgIGZvciAoY29uc3QgdW5zdWIgb2YgdW5zdWJzKSB7XG4gICAgICB1bnN1YigpO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgdmFsdWVzID0gW10gYXMgeyBbSyBpbiBrZXlvZiBUXTogVFtLXSB8IHVuZGVmaW5lZCB9O1xuICBjb25zdCBjYWxsYmFja19oYW5kbGVyID0gKCkgPT4ge1xuICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSBzdG9yZXMubGVuZ3RoKSB7XG4gICAgICBjYWxsYmFjayh2YWx1ZXMsIHVuc3Vic2NyaWJlKTtcbiAgICB9XG4gIH07XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3RvcmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgc3RvcmVzW2ldLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICB2YWx1ZXNbaV0gPSB2YWx1ZTtcbiAgICAgIHVuc3Vic1tpXSA9IHVuc3Vic2NyaWJlO1xuICAgICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IHN0b3Jlcy5sZW5ndGgpIHtcbiAgICAgICAgY2FsbGJhY2tfaGFuZGxlcigpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIHJldHVybiB1bnN1YnNjcmliZTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgU3RvcmUgfSBmcm9tICcuLi9EZXNpZ24gUGF0dGVybi9PYnNlcnZlci9TdG9yZS5qcyc7XG5cbmV4cG9ydCB0eXBlIFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPiA9IChyZXN1bHQ/OiBSZXN1bHQsIGVycm9yPzogRXJyb3IsIHRhZz86IFRhZykgPT4geyBhYm9ydDogYm9vbGVhbiB9IHwgdm9pZDtcblxuZXhwb3J0IGNsYXNzIEpvYlF1ZXVlPFJlc3VsdCA9IHZvaWQsIFRhZyA9IHZvaWQ+IHtcbiAgLyoqXG4gICAqIDA6IE5vIGRlbGF5LiAtMTogQ29uc2VjdXRpdmUuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZGVsYXlfbXM6IG51bWJlcikge31cbiAgcHVibGljIGFib3J0KCkge1xuICAgIHRoaXMuX2Fib3J0ZWQgPSB0cnVlO1xuICB9XG4gIHB1YmxpYyBnZXQgYWJvcnRlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fYWJvcnRlZDtcbiAgfVxuICBwdWJsaWMgYWRkKGZuOiAoKSA9PiBQcm9taXNlPFJlc3VsdD4sIHRhZz86IFRhZykge1xuICAgIGlmICh0aGlzLl9hYm9ydGVkID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5xdWV1ZS5wdXNoKHsgZm4sIHRhZyB9KTtcbiAgICAgIGlmICh0aGlzLnJ1bm5pbmcgPT09IGZhbHNlKSB7XG4gICAgICAgIHRoaXMucnVubmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMucnVuKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHB1YmxpYyBnZXQgZG9uZSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb21wbGV0aW9uQ291bnQgPT09IHRoaXMucXVldWUubGVuZ3RoID8gdHJ1ZSA6IGZhbHNlO1xuICB9XG4gIHB1YmxpYyByZXNldCgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMucnVubmluZ0NvdW50LnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgIHRoaXMuX2Fib3J0ZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5jb21wbGV0aW9uQ291bnQgPSAwO1xuICAgICAgICB0aGlzLnF1ZXVlID0gW107XG4gICAgICAgIHRoaXMucXVldWVJbmRleCA9IDA7XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IFtdO1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgcHVibGljIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiB0aGlzLnJlc3VsdHMpIHtcbiAgICAgIGlmIChjYWxsYmFjayhyZXN1bHQudmFsdWUsIHJlc3VsdC5lcnJvcik/LmFib3J0ID09PSB0cnVlKSB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiAoKSA9PiB7fTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgfVxuICBwcm90ZWN0ZWQgX2Fib3J0ZWQgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIGNvbXBsZXRpb25Db3VudCA9IDA7XG4gIHByb3RlY3RlZCBxdWV1ZTogeyBmbjogKCkgPT4gUHJvbWlzZTxSZXN1bHQ+OyB0YWc/OiBUYWcgfVtdID0gW107XG4gIHByb3RlY3RlZCBxdWV1ZUluZGV4ID0gMDtcbiAgcHJvdGVjdGVkIHJlc3VsdHM6IHsgdmFsdWU/OiBSZXN1bHQ7IGVycm9yPzogRXJyb3IgfVtdID0gW107XG4gIHByb3RlY3RlZCBydW5uaW5nID0gZmFsc2U7XG4gIHByb3RlY3RlZCBydW5uaW5nQ291bnQgPSBuZXcgU3RvcmUoMCk7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPj4oKTtcbiAgcHJvdGVjdGVkIHJ1bigpIHtcbiAgICBpZiAodGhpcy5fYWJvcnRlZCA9PT0gZmFsc2UgJiYgdGhpcy5xdWV1ZUluZGV4IDwgdGhpcy5xdWV1ZS5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHsgZm4sIHRhZyB9ID0gdGhpcy5xdWV1ZVt0aGlzLnF1ZXVlSW5kZXgrK107XG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICB0aGlzLnJ1bm5pbmdDb3VudC51cGRhdGUoKGNvdW50KSA9PiBjb3VudCArIDEpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgZm4oKTtcbiAgICAgICAgICB0aGlzLnNlbmQoeyB2YWx1ZSwgdGFnIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgdGhpcy5zZW5kKHsgZXJyb3IsIHRhZyB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJ1bm5pbmdDb3VudC51cGRhdGUoKGNvdW50KSA9PiBjb3VudCAtIDEpO1xuICAgICAgICBpZiAodGhpcy5kZWxheV9tcyA8IDApIHtcbiAgICAgICAgICB0aGlzLnJ1bigpO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuICAgICAgaWYgKHRoaXMuZGVsYXlfbXMgPj0gMCkge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMucnVuKCksIHRoaXMuZGVsYXlfbXMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcHJvdGVjdGVkIHNlbmQocmVzdWx0OiB7IHZhbHVlPzogUmVzdWx0OyBlcnJvcj86IEVycm9yOyB0YWc/OiBUYWcgfSkge1xuICAgIGlmICh0aGlzLl9hYm9ydGVkID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5jb21wbGV0aW9uQ291bnQrKztcbiAgICAgIHRoaXMucmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICAgIGlmIChjYWxsYmFjayhyZXN1bHQudmFsdWUsIHJlc3VsdC5lcnJvciwgcmVzdWx0LnRhZyk/LmFib3J0ID09PSB0cnVlKSB7XG4gICAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IFN5bmNBc3luY0l0ZXJhYmxlIH0gZnJvbSAnLi9UeXBlLmpzJztcblxuZXhwb3J0IGNsYXNzIFJlY3Vyc2l2ZUl0ZXJhdG9yPEluLCBPdXQ+IHtcbiAgY29uc3RydWN0b3IocHJvdGVjdGVkIGZuOiAodmFsdWU6IFN5bmNBc3luY0l0ZXJhYmxlPEluPiwgcHVzaDogKHZhbHVlOiBTeW5jQXN5bmNJdGVyYWJsZTxJbj4pID0+IHZvaWQpID0+IFN5bmNBc3luY0l0ZXJhYmxlPE91dD4pIHt9XG4gIGFzeW5jICppdGVyYXRlKGluaXQ6IFN5bmNBc3luY0l0ZXJhYmxlPEluPik6IFN5bmNBc3luY0l0ZXJhYmxlPE91dD4ge1xuICAgIGNvbnN0IGxpc3Q6IFN5bmNBc3luY0l0ZXJhYmxlPEluPltdID0gW2luaXRdO1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5sZW5ndGg7IGkrKykge1xuICAgICAgZm9yIGF3YWl0IChjb25zdCBmU0VudHJ5IG9mIHRoaXMuZm4obGlzdFtpXSwgKHZhbHVlKSA9PiB7XG4gICAgICAgIGxpc3QucHVzaCh2YWx1ZSk7XG4gICAgICB9KSkge1xuICAgICAgICB5aWVsZCBmU0VudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IE4gfSBmcm9tICcuLi9VdGlsaXR5L1R5cGUuanMnO1xuXG5leHBvcnQgY2xhc3MgRGF0YVRyYW5zZmVySXRlbUl0ZXJhdG9yIHtcbiAgbGlzdDogRGF0YVRyYW5zZmVySXRlbVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGl0ZW1zPzogTjxEYXRhVHJhbnNmZXJJdGVtPiB8IERhdGFUcmFuc2Zlckl0ZW1MaXN0IHwgbnVsbCkge1xuICAgIGlmIChpdGVtcyBpbnN0YW5jZW9mIERhdGFUcmFuc2Zlckl0ZW0pIHtcbiAgICAgIHRoaXMubGlzdCA9IFtpdGVtc107XG4gICAgfSBlbHNlIGlmIChpdGVtcyBpbnN0YW5jZW9mIERhdGFUcmFuc2Zlckl0ZW1MaXN0KSB7XG4gICAgICB0aGlzLmxpc3QgPSBBcnJheS5mcm9tKGl0ZW1zKTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoaXRlbXMpKSB7XG4gICAgICB0aGlzLmxpc3QgPSBpdGVtcztcbiAgICB9XG4gIH1cbiAgKmdldEFzRW50cnkoKTogR2VuZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeT4ge1xuICAgIGZvciAoY29uc3QgaXRlbSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IGVudHJ5ID0gKGl0ZW0gYXMgRGF0YVRyYW5zZmVySXRlbSAmIHsgZ2V0QXNFbnRyeT86IERhdGFUcmFuc2Zlckl0ZW1bJ3dlYmtpdEdldEFzRW50cnknXSB9KS5nZXRBc0VudHJ5Py4oKSA/PyBpdGVtLndlYmtpdEdldEFzRW50cnk/LigpO1xuICAgICAgaWYgKGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqZ2V0QXNGaWxlKCk6IEdlbmVyYXRvcjxGaWxlPiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgZmlsZSA9IGl0ZW0uZ2V0QXNGaWxlPy4oKTtcbiAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgRmlsZSkge1xuICAgICAgICB5aWVsZCBmaWxlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqZ2V0QXNTdHJpbmcoKTogQXN5bmNHZW5lcmF0b3I8c3RyaW5nPiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgeWllbGQgYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgaXRlbS5nZXRBc1N0cmluZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGl0ZW0uZ2V0QXNTdHJpbmcocmVzb2x2ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVqZWN0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIiwKICAgICJleHBvcnQgY2xhc3MgRmlsZVN5c3RlbUVudHJ5SXRlcmF0b3Ige1xuICBsaXN0OiBGaWxlU3lzdGVtRW50cnlbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzPzogRmlsZVN5c3RlbUVudHJ5IHwgRmlsZVN5c3RlbUVudHJ5W10gfCBudWxsKSB7XG4gICAgaWYgKGVudHJpZXMgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRW50cnkpIHtcbiAgICAgIHRoaXMubGlzdCA9IFtlbnRyaWVzXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGVudHJpZXM7XG4gICAgfVxuICB9XG4gICpnZXREaXJlY3RvcnlFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGlmIChlbnRyeS5pc0RpcmVjdG9yeSAmJiBlbnRyeSBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldEZpbGVFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbUZpbGVFbnRyeT4ge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5saXN0KSB7XG4gICAgICBpZiAoZW50cnkuaXNGaWxlICYmIGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbUZpbGVFbnRyeSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yIHtcbiAgbGlzdDogRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5W10gPSBbXTtcbiAgY29uc3RydWN0b3IoZW50cmllcz86IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSB8IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeVtdIHwgbnVsbCkge1xuICAgIGlmIChlbnRyaWVzIGluc3RhbmNlb2YgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5KSB7XG4gICAgICB0aGlzLmxpc3QgPSBbZW50cmllc107XG4gICAgfSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGVudHJpZXMpKSB7XG4gICAgICB0aGlzLmxpc3QgPSBlbnRyaWVzO1xuICAgIH1cbiAgfVxuICBhc3luYyAqZ2V0RW50cnkoKTogQXN5bmNHZW5lcmF0b3I8RmlsZVN5c3RlbUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGNvbnN0IHJlYWRlciA9IGVudHJ5LmNyZWF0ZVJlYWRlcigpO1xuICAgICAgZm9yIChjb25zdCBlbnRyeSBvZiBhd2FpdCBuZXcgUHJvbWlzZTxGaWxlU3lzdGVtRW50cnlbXT4oKHJlc29sdmUsIHJlamVjdCkgPT4gcmVhZGVyLnJlYWRFbnRyaWVzKHJlc29sdmUsIHJlamVjdCkpKSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBKb2JRdWV1ZSB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9Kb2JRdWV1ZS5qcyc7XG5pbXBvcnQgeyBSZWN1cnNpdmVJdGVyYXRvciB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9SZWN1cnNpdmVBc3luY0l0ZXJhdG9yLmpzJztcbmltcG9ydCB0eXBlIHsgU3luY0FzeW5jSXRlcmFibGUgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvVHlwZS5qcyc7XG5pbXBvcnQgeyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRGF0YVRyYW5zZmVyLmpzJztcbmltcG9ydCB7IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yLCBGaWxlU3lzdGVtRW50cnlJdGVyYXRvciB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvV2ViIEFQSS9GaWxlU3lzdGVtLmpzJztcblxuY29uc3Qgd2Via2l0ZGlyZWN0b3J5X3N1cHBvcnQgPSAvYW5kcm9pZHxpcGhvbmV8bW9iaWxlL2kudGVzdCh3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudCkgPT09IHRydWUgPyBmYWxzZSA6IHRydWU7XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cERyYWdBbmREcm9wRmlsZVBpY2tlcihcbiAgY29udGFpbmVyOiBFbGVtZW50LFxuICBmbjoge1xuICAgIG9uRHJhZ0VuZD86ICgpID0+IHZvaWQ7XG4gICAgb25EcmFnRW50ZXI/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJhZ0xlYXZlPzogKCkgPT4gdm9pZDtcbiAgICBvbkRyb3A/OiAoKSA9PiB2b2lkO1xuICAgIG9uVXBsb2FkRW5kPzogKCkgPT4gdm9pZDtcbiAgICBvblVwbG9hZE5leHRGaWxlOiAoZmlsZTogRmlsZSwgZG9uZTogKCkgPT4gdm9pZCkgPT4gUHJvbWlzZTx2b2lkPiB8IHZvaWQ7XG4gICAgb25VcGxvYWRTdGFydD86ICgpID0+IHZvaWQ7XG4gIH0sXG4gIG9wdGlvbnM/OiB7XG4gICAgZGlyZWN0b3J5OiBib29sZWFuO1xuICAgIG11bHRpcGxlOiBib29sZWFuO1xuICB9LFxuKSB7XG4gIGNvbnN0IGVsZW1lbnQgPSBjb250YWluZXIucXVlcnlTZWxlY3RvcignaW5wdXQnKTtcbiAgaWYgKCFlbGVtZW50KSB7XG4gICAgdGhyb3cgJ2RyYWctYW5kLWRyb3AtZmlsZS1waWNrZXIgaW5wdXQgZWxlbWVudCBtaXNzaW5nJztcbiAgfVxuICBpZiAob3B0aW9ucz8uZGlyZWN0b3J5ID09PSB0cnVlICYmIHdlYmtpdGRpcmVjdG9yeV9zdXBwb3J0KSB7XG4gICAgZWxlbWVudC50b2dnbGVBdHRyaWJ1dGUoJ3dlYmtpdGRpcmVjdG9yeScsIHRydWUpO1xuICB9XG4gIGlmIChvcHRpb25zPy5tdWx0aXBsZSA9PT0gdHJ1ZSkge1xuICAgIGVsZW1lbnQudG9nZ2xlQXR0cmlidXRlKCdtdWx0aXBsZScsIHRydWUpO1xuICB9XG5cbiAgaWYgKGZuLm9uRHJhZ0VuZCB8fCBmbi5vbkRyYWdFbnRlciB8fCBmbi5vbkRyYWdMZWF2ZSkge1xuICAgIGNvbnN0IHJlbW92ZUxpc3RlbmVycyA9ICgpID0+IHtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgZHJhZ2xlYXZlSGFuZGxlcik7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBkcmFnZW5kSGFuZGxlcik7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBkcm9wSGFuZGxlcik7XG4gICAgfTtcbiAgICBjb25zdCBkcmFnZW5kSGFuZGxlciA9ICgpID0+IHtcbiAgICAgIHJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgZm4ub25EcmFnRW5kPy4oKTtcbiAgICB9O1xuICAgIGNvbnN0IGRyYWdsZWF2ZUhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICByZW1vdmVMaXN0ZW5lcnMoKTtcbiAgICAgIGZuLm9uRHJhZ0xlYXZlPy4oKTtcbiAgICB9O1xuICAgIGNvbnN0IGRyb3BIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgcmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICBmbi5vbkRyb3A/LigpO1xuICAgIH07XG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW50ZXInLCAoKSA9PiB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdsZWF2ZUhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xuICAgICAgZm4ub25EcmFnRW50ZXI/LigpO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZlNFbnRyeVNldCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBmU0VudHJ5SXRlcmF0b3IgPSBuZXcgUmVjdXJzaXZlSXRlcmF0b3I8RmlsZVN5c3RlbUVudHJ5LCBGaWxlU3lzdGVtRmlsZUVudHJ5Pihhc3luYyBmdW5jdGlvbiogKGZTRW50cnlJdGVyYXRvciwgcHVzaCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZlNFbnRyeSBvZiBmU0VudHJ5SXRlcmF0b3IpIHtcbiAgICAgIGNvbnN0IHBhdGggPSBmU0VudHJ5LmZ1bGxQYXRoLnNsaWNlKDEpO1xuICAgICAgaWYgKCFmU0VudHJ5U2V0LmhhcyhwYXRoKSkge1xuICAgICAgICBmU0VudHJ5U2V0LmFkZChwYXRoKTtcbiAgICAgICAgY29uc3QgZnNFbnRyaWVzID0gbmV3IEZpbGVTeXN0ZW1FbnRyeUl0ZXJhdG9yKGZTRW50cnkpO1xuICAgICAgICBmb3IgKGNvbnN0IGZTRmlsZUVudHJ5IG9mIGZzRW50cmllcy5nZXRGaWxlRW50cnkoKSkge1xuICAgICAgICAgIHlpZWxkIGZTRmlsZUVudHJ5O1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZlNEaXJlY3RvcnlFbnRyeSBvZiBmc0VudHJpZXMuZ2V0RGlyZWN0b3J5RW50cnkoKSkge1xuICAgICAgICAgIHB1c2gobmV3IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yKGZTRGlyZWN0b3J5RW50cnkpLmdldEVudHJ5KCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBqb2JRdWV1ZSA9IG5ldyBKb2JRdWV1ZTx2b2lkLCBzdHJpbmc+KC0xKTtcbiAgbGV0IHN0YXJ0ZWQgPSBmYWxzZTtcbiAgbGV0IGVuZGVkID0gdHJ1ZTtcbiAgbGV0IGRvbmUgPSB0cnVlO1xuICBjb25zdCB1cGxvYWRTdGFydCA9ICgpID0+IHtcbiAgICBpZiAoc3RhcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHN0YXJ0ZWQgPSB0cnVlO1xuICAgICAgZW5kZWQgPSBmYWxzZTtcbiAgICAgIGRvbmUgPSBmYWxzZTtcbiAgICAgIGZuLm9uVXBsb2FkU3RhcnQ/LigpO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgdXBsb2FkRW5kID0gKCkgPT4ge1xuICAgIGlmIChlbmRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHN0YXJ0ZWQgPSBmYWxzZTtcbiAgICAgIGVuZGVkID0gdHJ1ZTtcbiAgICAgIGpvYlF1ZXVlLmFib3J0KCk7XG4gICAgICBqb2JRdWV1ZS5yZXNldCgpO1xuICAgICAgZlNFbnRyeVNldC5jbGVhcigpO1xuICAgICAgZm4ub25VcGxvYWRFbmQ/LigpO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgaXRlcmF0ZUZTRW50cmllcyA9IGFzeW5jIChpbml0RW50cmllczogU3luY0FzeW5jSXRlcmFibGU8RmlsZVN5c3RlbUVudHJ5PiwgZmlsZXM6IEZpbGVMaXN0KSA9PiB7XG4gICAgZm9yIGF3YWl0IChjb25zdCBmU0ZpbGVFbnRyeSBvZiBmU0VudHJ5SXRlcmF0b3IuaXRlcmF0ZShpbml0RW50cmllcykpIHtcbiAgICAgIGF3YWl0IGZuLm9uVXBsb2FkTmV4dEZpbGUoYXdhaXQgbmV3IFByb21pc2U8RmlsZT4oKHJlc29sdmUsIHJlamVjdCkgPT4gZlNGaWxlRW50cnkuZmlsZShyZXNvbHZlLCByZWplY3QpKSwgKCkgPT4gKGRvbmUgPSB0cnVlKSk7XG4gICAgICBpZiAoZG9uZSA9PT0gdHJ1ZSkgcmV0dXJuIHVwbG9hZEVuZCgpO1xuICAgIH1cbiAgICBmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcbiAgICAgIGNvbnN0IHBhdGggPSBmaWxlLndlYmtpdFJlbGF0aXZlUGF0aCArIGZpbGUubmFtZTtcbiAgICAgIGlmICghZlNFbnRyeVNldC5oYXMocGF0aCkpIHtcbiAgICAgICAgZlNFbnRyeVNldC5hZGQocGF0aCk7XG4gICAgICAgIGF3YWl0IGZuLm9uVXBsb2FkTmV4dEZpbGUoZmlsZSwgKCkgPT4gKGRvbmUgPSB0cnVlKSk7XG4gICAgICAgIGlmIChkb25lID09PSB0cnVlKSByZXR1cm4gdXBsb2FkRW5kKCk7XG4gICAgICB9XG4gICAgfVxuICB9O1xuICBjb25zdCBjaGFuZ2VIYW5kbGVyID0gKCkgPT4ge1xuICAgIGpvYlF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICB1cGxvYWRTdGFydCgpO1xuICAgICAgaWYgKGVsZW1lbnQgaW5zdGFuY2VvZiBIVE1MSW5wdXRFbGVtZW50ICYmIGVsZW1lbnQuZmlsZXMpIHtcbiAgICAgICAgYXdhaXQgaXRlcmF0ZUZTRW50cmllcyhlbGVtZW50LndlYmtpdEVudHJpZXMsIGVsZW1lbnQuZmlsZXMpO1xuICAgICAgfVxuICAgICAgdXBsb2FkRW5kKCk7XG4gICAgfSwgJ2NoYW5nZUhhbmRsZXInKTtcbiAgfTtcbiAgY29uc3QgZHJvcEhhbmRsZXIgPSAoZXZlbnQ6IERyYWdFdmVudCkgPT4ge1xuICAgIGpvYlF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICB1cGxvYWRTdGFydCgpO1xuICAgICAgaWYgKGV2ZW50LmRhdGFUcmFuc2Zlcikge1xuICAgICAgICBjb25zdCBkYXRhVHJhbnNmZXJJdGVtcyA9IG5ldyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3IoZXZlbnQuZGF0YVRyYW5zZmVyLml0ZW1zKTtcbiAgICAgICAgYXdhaXQgaXRlcmF0ZUZTRW50cmllcyhkYXRhVHJhbnNmZXJJdGVtcy5nZXRBc0VudHJ5KCksIGV2ZW50LmRhdGFUcmFuc2Zlci5maWxlcyk7XG4gICAgICB9XG4gICAgICB1cGxvYWRFbmQoKTtcbiAgICB9LCAnZHJvcEhhbmRsZXInKTtcbiAgfTtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCBjaGFuZ2VIYW5kbGVyKTtcbiAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xufVxuIiwKICAgICJpbXBvcnQgeyBzZXR1cERyYWdBbmREcm9wRmlsZVBpY2tlciB9IGZyb20gJy4vY29tcG9uZW50cy9kcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyL2RyYWctYW5kLWRyb3AtZmlsZS1waWNrZXIuanMnO1xuaW1wb3J0IHsgSm9iUXVldWUgfSBmcm9tICcuL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9Kb2JRdWV1ZS5qcyc7XG5cbi8vICEgb25lIGRheSB1c2UgRXZlbnRNYW5hZ2VyXG5kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ292ZXInLCAoZXZlbnQpID0+IGV2ZW50LnByZXZlbnREZWZhdWx0KCkpO1xuXG5jb25zdCBtYWluID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignbWFpbicpO1xuY29uc3QgcGlja2VyID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcignLmRyYWctYW5kLWRyb3AtZmlsZS1waWNrZXInKTtcblxubGV0IGltYWdlTG9hZENvdW50ID0gMDtcbmNvbnN0IGltYWdlTG9hZFF1ZXVlID0gbmV3IEpvYlF1ZXVlKC0xKTtcbmlmIChwaWNrZXIpIHtcbiAgc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIoXG4gICAgcGlja2VyLFxuICAgIHtcbiAgICAgIG9uVXBsb2FkU3RhcnQoKSB7XG4gICAgICAgIHBpY2tlci5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcbiAgICAgICAgbWFpbj8ucmVwbGFjZUNoaWxkcmVuKCk7XG4gICAgICB9LFxuICAgICAgb25VcGxvYWROZXh0RmlsZTogc2hvd0ltYWdlLFxuICAgICAgb25VcGxvYWRFbmQoKSB7XG4gICAgICAgIGltYWdlTG9hZFF1ZXVlLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgICAgaWYgKGltYWdlTG9hZFF1ZXVlLmRvbmUpIHtcbiAgICAgICAgICAgIGlmIChpbWFnZUxvYWRDb3VudCA9PT0gMCkge1xuICAgICAgICAgICAgICBwaWNrZXIuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZGVuJyk7XG4gICAgICAgICAgICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgICAgICBkaXYuc3R5bGUuY29sb3IgPSAncmVkJztcbiAgICAgICAgICAgICAgZGl2LnRleHRDb250ZW50ID0gJ05vIEltYWdlcyBGb3VuZCEgVHJ5IGFub3RoZXIgZm9sZGVyLic7XG4gICAgICAgICAgICAgIHBpY2tlci5xdWVyeVNlbGVjdG9yKCdzcGFuJyk/LmFwcGVuZChcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdicicpLCAvL1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JyJyksXG4gICAgICAgICAgICAgICAgZGl2LFxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgIH0sXG4gICAge1xuICAgICAgZGlyZWN0b3J5OiB0cnVlLFxuICAgICAgbXVsdGlwbGU6IHRydWUsXG4gICAgfSxcbiAgKTtcbn1cblxuZnVuY3Rpb24gc2hvd0ltYWdlKGZpbGU6IEZpbGUpIHtcbiAgdHJ5IHtcbiAgICBpbWFnZUxvYWRRdWV1ZS5hZGQoXG4gICAgICAoKSA9PlxuICAgICAgICBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgICAgY29uc3QgaW1nID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnaW1nJyk7XG4gICAgICAgICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgLy8gZGl2LmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xuICAgICAgICAgIG1haW4/LmFwcGVuZChkaXYpO1xuICAgICAgICAgIGltZy5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGZpbGUpO1xuICAgICAgICAgIGltZy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgZGl2LmFwcGVuZChpbWcpO1xuICAgICAgICAgICAgaW1hZ2VMb2FkQ291bnQrKztcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCAoKSA9PiB7XG4gICAgICAgICAgICBkaXYucmVtb3ZlKCk7XG4gICAgICAgICAgICByZWplY3QoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSksXG4gICAgKTtcbiAgfSBjYXRjaCAoXykge31cbn1cbiIKICBdLAogICJtYXBwaW5ncyI6ICI7QUFHTyxNQUFNLE1BQWE7QUFBQSxFQUVGO0FBQUEsRUFEWixrQkFBa0IsSUFBSTtBQUFBLEVBQ2hDLFdBQVcsQ0FBVyxPQUFlO0FBQWY7QUFBQTtBQUFBLEVBQ3RCLFNBQVMsQ0FBQyxVQUFtRDtBQUMzRCxTQUFLLGdCQUFnQixJQUFJLFFBQVE7QUFDakMsUUFBSSxLQUFLLFVBQVUsV0FBVztBQUM1QixlQUFTLEtBQUssT0FBTyxNQUFNO0FBQ3pCLGFBQUssZ0JBQWdCLE9BQU8sUUFBUTtBQUFBLE9BQ3JDO0FBQUEsSUFDSDtBQUNBLFdBQU8sTUFBTTtBQUNYLFdBQUssZ0JBQWdCLE9BQU8sUUFBUTtBQUFBO0FBQUE7QUFBQSxFQUd4QyxHQUFHLEdBQW1CO0FBQ3BCLFdBQU8sSUFBSSxRQUFlLENBQUMsWUFBWTtBQUNyQyxXQUFLLFVBQVUsQ0FBQyxPQUFPLGdCQUFnQjtBQUNyQyxvQkFBWTtBQUNaLGdCQUFRLEtBQUs7QUFBQSxPQUNkO0FBQUEsS0FDRjtBQUFBO0FBQUEsRUFFSCxHQUFHLENBQUMsT0FBb0I7QUFDdEIsUUFBSSxLQUFLLFVBQVUsV0FBVztBQUM1QixXQUFLLFFBQVE7QUFDYixpQkFBVyxZQUFZLEtBQUssaUJBQWlCO0FBQzNDLGlCQUFTLE9BQU8sTUFBTTtBQUNwQixlQUFLLGdCQUFnQixPQUFPLFFBQVE7QUFBQSxTQUNyQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQUE7QUFFSjtBQUVPO0FBQUEsTUFBTSxNQUFhO0FBQUEsRUFJWjtBQUFBLEVBQ0E7QUFBQSxFQUpGO0FBQUEsRUFDQSxrQkFBa0Is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LGFBQWEsR0FBRztBQUNkLGFBQU8sVUFBVSxJQUFJLFFBQVE7QUFDN0IsWUFBTSxnQkFBZ0I7QUFBQTtBQUFBLElBRXhCLGtCQUFrQjtBQUFBLElBQ2xCLFdBQVcsR0FBRztBQUNaLHFCQUFlLFVBQVUsTUFBTTtBQUM3QixZQUFJLGVBQWUsTUFBTTtBQUN2QixjQUFJLG1CQUFtQixHQUFHO0FBQ3hCLG1CQUFPLFVBQVUsT0FBTyxRQUFRO0FBQ2hDLGtCQUFNLE1BQU0sU0FBUyxjQUFjLEtBQUs7QUFDeEMsZ0JBQUksTUFBTSxRQUFRO0FBQ2xCLGdCQUFJLGNBQWM7QUFDbEIsbUJBQU8sY0FBYyxNQUFNLEdBQUcsT0FDNUIsU0FBUyxjQUFjLElBQUksR0FDM0IsU0FBUyxjQUFjLElBQUksR0FDM0IsR0FDRjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsT0FDRDtBQUFBO0FBQUEsRUFFTCxHQUNBO0FBQUEsSUFDRSxXQUFXO0FBQUEsSUFDWCxVQUFVO0FBQUEsRUFDWixDQUNGO0FBQ0Y7IiwKICAiZGVidWdJZCI6ICIzMUVDQzgxMjBERkY4QjQyNjQ3NTZFMjE2NDc1NkUyMSIsCiAgIm5hbWVzIjogW10KfQ==
