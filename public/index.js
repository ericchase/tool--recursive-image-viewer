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

//# debugId=60C0D94147F4943264756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcRGVzaWduIFBhdHRlcm5cXE9ic2VydmVyXFxTdG9yZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxKb2JRdWV1ZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxVdGlsaXR5XFxSZWN1cnNpdmVBc3luY0l0ZXJhdG9yLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXERhdGFUcmFuc2Zlci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlU3lzdGVtLnRzIiwgInNyY1xcY29tcG9uZW50c1xcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlclxcZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci50cyIsICJzcmNcXGluZGV4LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWwogICAgImV4cG9ydCB0eXBlIFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPiA9ICh2YWx1ZTogVmFsdWUsIHVuc3Vic2NyaWJlOiAoKSA9PiB2b2lkKSA9PiB2b2lkO1xuZXhwb3J0IHR5cGUgVXBkYXRlQ2FsbGJhY2s8VmFsdWU+ID0gKHZhbHVlOiBWYWx1ZSkgPT4gVmFsdWU7XG5cbmV4cG9ydCBjbGFzcyBDb25zdDxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9uU2V0ID0gbmV3IFNldDxTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4+KCk7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCB2YWx1ZT86IFZhbHVlKSB7fVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlPik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmFkZChjYWxsYmFjayk7XG4gICAgaWYgKHRoaXMudmFsdWUgIT09IHVuZGVmaW5lZCkge1xuICAgICAgY2FsbGJhY2sodGhpcy52YWx1ZSwgKCkgPT4ge1xuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgIH07XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWU+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWU+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSk6IHZvaWQge1xuICAgIGlmICh0aGlzLnZhbHVlID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5zdWJzY3JpcHRpb25TZXQpIHtcbiAgICAgICAgY2FsbGJhY2sodmFsdWUsICgpID0+IHtcbiAgICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIFN0b3JlPFZhbHVlPiB7XG4gIHByb3RlY3RlZCBjdXJyZW50VmFsdWU6IFZhbHVlO1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9uU2V0ID0gbmV3IFNldDxTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4+KCk7XG4gIGNvbnN0cnVjdG9yKFxuICAgIHByb3RlY3RlZCBpbml0aWFsVmFsdWU6IFZhbHVlLFxuICAgIHByb3RlY3RlZCBub3RpZnlPbkNoYW5nZU9ubHk6IGJvb2xlYW4gPSBmYWxzZSxcbiAgKSB7XG4gICAgdGhpcy5jdXJyZW50VmFsdWUgPSBpbml0aWFsVmFsdWU7XG4gIH1cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4pOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5hZGQoY2FsbGJhY2spO1xuICAgIGNvbnN0IHVuc3Vic2NyaWJlID0gKCkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICAgIGNhbGxiYWNrKHRoaXMuY3VycmVudFZhbHVlLCB1bnN1YnNjcmliZSk7XG4gICAgcmV0dXJuIHVuc3Vic2NyaWJlO1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUpOiB2b2lkIHtcbiAgICBpZiAodGhpcy5ub3RpZnlPbkNoYW5nZU9ubHkgJiYgdGhpcy5jdXJyZW50VmFsdWUgPT09IHZhbHVlKSByZXR1cm47XG4gICAgdGhpcy5jdXJyZW50VmFsdWUgPSB2YWx1ZTtcbiAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICBjYWxsYmFjayh2YWx1ZSwgKCkgPT4ge1xuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG4gIHVwZGF0ZShjYWxsYmFjazogVXBkYXRlQ2FsbGJhY2s8VmFsdWU+KTogdm9pZCB7XG4gICAgdGhpcy5zZXQoY2FsbGJhY2sodGhpcy5jdXJyZW50VmFsdWUpKTtcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgT3B0aW9uYWw8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIHN0b3JlOiBTdG9yZTxWYWx1ZSB8IHVuZGVmaW5lZD47XG4gIGNvbnN0cnVjdG9yKG5vdGlmeU9uQ2hhbmdlT25seSA9IGZhbHNlKSB7XG4gICAgdGhpcy5zdG9yZSA9IG5ldyBTdG9yZTxWYWx1ZSB8IHVuZGVmaW5lZD4odW5kZWZpbmVkLCBub3RpZnlPbkNoYW5nZU9ubHkpO1xuICB9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWUgfCB1bmRlZmluZWQ+KTogKCkgPT4gdm9pZCB7XG4gICAgcmV0dXJuIHRoaXMuc3RvcmUuc3Vic2NyaWJlKGNhbGxiYWNrKTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZSB8IHVuZGVmaW5lZD4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZSB8IHVuZGVmaW5lZD4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlIHwgdW5kZWZpbmVkKTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS5zZXQodmFsdWUpO1xuICB9XG4gIHVwZGF0ZShjYWxsYmFjazogVXBkYXRlQ2FsbGJhY2s8VmFsdWUgfCB1bmRlZmluZWQ+KTogdm9pZCB7XG4gICAgdGhpcy5zdG9yZS51cGRhdGUoY2FsbGJhY2spO1xuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBDb21wb3VuZFN1YnNjcmlwdGlvbjxUIGV4dGVuZHMgYW55W10+KHN0b3JlczogeyBbSyBpbiBrZXlvZiBUXTogU3RvcmU8VFtLXT4gfCBPcHRpb25hbDxUW0tdPiB9LCBjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8eyBbSyBpbiBrZXlvZiBUXTogVFtLXSB8IHVuZGVmaW5lZCB9Pik6ICgpID0+IHZvaWQge1xuICBjb25zdCB1bnN1YnM6ICgoKSA9PiB2b2lkKVtdID0gW107XG4gIGNvbnN0IHVuc3Vic2NyaWJlID0gKCkgPT4ge1xuICAgIGZvciAoY29uc3QgdW5zdWIgb2YgdW5zdWJzKSB7XG4gICAgICB1bnN1YigpO1xuICAgIH1cbiAgfTtcbiAgY29uc3QgdmFsdWVzID0gW10gYXMgeyBbSyBpbiBrZXlvZiBUXTogVFtLXSB8IHVuZGVmaW5lZCB9O1xuICBjb25zdCBjYWxsYmFja19oYW5kbGVyID0gKCkgPT4ge1xuICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSBzdG9yZXMubGVuZ3RoKSB7XG4gICAgICBjYWxsYmFjayh2YWx1ZXMsIHVuc3Vic2NyaWJlKTtcbiAgICB9XG4gIH07XG4gIGZvciAobGV0IGkgPSAwOyBpIDwgc3RvcmVzLmxlbmd0aDsgaSsrKSB7XG4gICAgc3RvcmVzW2ldLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICB2YWx1ZXNbaV0gPSB2YWx1ZTtcbiAgICAgIHVuc3Vic1tpXSA9IHVuc3Vic2NyaWJlO1xuICAgICAgaWYgKHZhbHVlcy5sZW5ndGggPT09IHN0b3Jlcy5sZW5ndGgpIHtcbiAgICAgICAgY2FsbGJhY2tfaGFuZGxlcigpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG4gIHJldHVybiB1bnN1YnNjcmliZTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgU3RvcmUgfSBmcm9tICcuLi9EZXNpZ24gUGF0dGVybi9PYnNlcnZlci9TdG9yZS5qcyc7XG5cbmV4cG9ydCB0eXBlIFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPiA9IChyZXN1bHQ/OiBSZXN1bHQsIGVycm9yPzogRXJyb3IsIHRhZz86IFRhZykgPT4geyBhYm9ydDogYm9vbGVhbiB9IHwgdm9pZDtcblxuZXhwb3J0IGNsYXNzIEpvYlF1ZXVlPFJlc3VsdCA9IHZvaWQsIFRhZyA9IHZvaWQ+IHtcbiAgLyoqXG4gICAqIDA6IE5vIGRlbGF5LiAtMTogQ29uc2VjdXRpdmUuXG4gICAqL1xuICBjb25zdHJ1Y3RvcihwdWJsaWMgZGVsYXlfbXM6IG51bWJlcikge31cbiAgcHVibGljIGFib3J0KCkge1xuICAgIHRoaXMuX2Fib3J0ZWQgPSB0cnVlO1xuICB9XG4gIHB1YmxpYyBnZXQgYWJvcnRlZCgpIHtcbiAgICByZXR1cm4gdGhpcy5fYWJvcnRlZDtcbiAgfVxuICBwdWJsaWMgYWRkKGZuOiAoKSA9PiBQcm9taXNlPFJlc3VsdD4sIHRhZz86IFRhZykge1xuICAgIGlmICh0aGlzLl9hYm9ydGVkID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5xdWV1ZS5wdXNoKHsgZm4sIHRhZyB9KTtcbiAgICAgIGlmICh0aGlzLnJ1bm5pbmcgPT09IGZhbHNlKSB7XG4gICAgICAgIHRoaXMucnVubmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMucnVuKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHB1YmxpYyBnZXQgZG9uZSgpIHtcbiAgICByZXR1cm4gdGhpcy5jb21wbGV0aW9uQ291bnQgPT09IHRoaXMucXVldWUubGVuZ3RoID8gdHJ1ZSA6IGZhbHNlO1xuICB9XG4gIHB1YmxpYyByZXNldCgpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMucnVubmluZ0NvdW50LnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgIHRoaXMuX2Fib3J0ZWQgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5jb21wbGV0aW9uQ291bnQgPSAwO1xuICAgICAgICB0aGlzLnF1ZXVlID0gW107XG4gICAgICAgIHRoaXMucXVldWVJbmRleCA9IDA7XG4gICAgICAgIHRoaXMucmVzdWx0cyA9IFtdO1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgcHVibGljIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBmb3IgKGNvbnN0IHJlc3VsdCBvZiB0aGlzLnJlc3VsdHMpIHtcbiAgICAgIGlmIChjYWxsYmFjayhyZXN1bHQudmFsdWUsIHJlc3VsdC5lcnJvcik/LmFib3J0ID09PSB0cnVlKSB7XG4gICAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgICAgIHJldHVybiAoKSA9PiB7fTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgfVxuICBwcm90ZWN0ZWQgX2Fib3J0ZWQgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIGNvbXBsZXRpb25Db3VudCA9IDA7XG4gIHByb3RlY3RlZCBxdWV1ZTogeyBmbjogKCkgPT4gUHJvbWlzZTxSZXN1bHQ+OyB0YWc/OiBUYWcgfVtdID0gW107XG4gIHByb3RlY3RlZCBxdWV1ZUluZGV4ID0gMDtcbiAgcHJvdGVjdGVkIHJlc3VsdHM6IHsgdmFsdWU/OiBSZXN1bHQ7IGVycm9yPzogRXJyb3IgfVtdID0gW107XG4gIHByb3RlY3RlZCBydW5uaW5nID0gZmFsc2U7XG4gIHByb3RlY3RlZCBydW5uaW5nQ291bnQgPSBuZXcgU3RvcmUoMCk7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPj4oKTtcbiAgcHJvdGVjdGVkIHJ1bigpIHtcbiAgICBpZiAodGhpcy5fYWJvcnRlZCA9PT0gZmFsc2UgJiYgdGhpcy5xdWV1ZUluZGV4IDwgdGhpcy5xdWV1ZS5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHsgZm4sIHRhZyB9ID0gdGhpcy5xdWV1ZVt0aGlzLnF1ZXVlSW5kZXgrK107XG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICB0aGlzLnJ1bm5pbmdDb3VudC51cGRhdGUoKGNvdW50KSA9PiBjb3VudCArIDEpO1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IHZhbHVlID0gYXdhaXQgZm4oKTtcbiAgICAgICAgICB0aGlzLnNlbmQoeyB2YWx1ZSwgdGFnIH0pO1xuICAgICAgICB9IGNhdGNoIChlcnJvcjogYW55KSB7XG4gICAgICAgICAgdGhpcy5zZW5kKHsgZXJyb3IsIHRhZyB9KTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnJ1bm5pbmdDb3VudC51cGRhdGUoKGNvdW50KSA9PiBjb3VudCAtIDEpO1xuICAgICAgICBpZiAodGhpcy5kZWxheV9tcyA8IDApIHtcbiAgICAgICAgICB0aGlzLnJ1bigpO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuICAgICAgaWYgKHRoaXMuZGVsYXlfbXMgPj0gMCkge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMucnVuKCksIHRoaXMuZGVsYXlfbXMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcHJvdGVjdGVkIHNlbmQocmVzdWx0OiB7IHZhbHVlPzogUmVzdWx0OyBlcnJvcj86IEVycm9yOyB0YWc/OiBUYWcgfSkge1xuICAgIGlmICh0aGlzLl9hYm9ydGVkID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5jb21wbGV0aW9uQ291bnQrKztcbiAgICAgIHRoaXMucmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICAgIGlmIChjYWxsYmFjayhyZXN1bHQudmFsdWUsIHJlc3VsdC5lcnJvciwgcmVzdWx0LnRhZyk/LmFib3J0ID09PSB0cnVlKSB7XG4gICAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICJleHBvcnQgY2xhc3MgUmVjdXJzaXZlQXN5bmNJdGVyYXRvcjxJbiwgT3V0PiB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBmbjogKHZhbHVlOiBJdGVyYWJsZTxJbj4gfCBBc3luY0l0ZXJhYmxlPEluPiwgcHVzaDogKHZhbHVlOiBJdGVyYWJsZTxJbj4gfCBBc3luY0l0ZXJhYmxlPEluPikgPT4gdm9pZCkgPT4gSXRlcmFibGU8T3V0PiB8IEFzeW5jSXRlcmFibGU8T3V0Pikge31cbiAgYXN5bmMgKml0ZXJhdGUoaW5pdDogSXRlcmFibGU8SW4+IHwgQXN5bmNJdGVyYWJsZTxJbj4pOiBJdGVyYWJsZTxPdXQ+IHwgQXN5bmNJdGVyYWJsZTxPdXQ+IHtcbiAgICBjb25zdCBsaXN0OiAoSXRlcmFibGU8SW4+IHwgQXN5bmNJdGVyYWJsZTxJbj4pW10gPSBbaW5pdF07XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgdGhpcy5mbihsaXN0W2ldLCAodmFsdWUpID0+IHtcbiAgICAgICAgbGlzdC5wdXNoKHZhbHVlKTtcbiAgICAgIH0pKSB7XG4gICAgICAgIHlpZWxkIGZTRW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgImV4cG9ydCBjbGFzcyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3Ige1xuICBsaXN0OiBEYXRhVHJhbnNmZXJJdGVtW10gPSBbXTtcbiAgY29uc3RydWN0b3IoaXRlbXM/OiBEYXRhVHJhbnNmZXJJdGVtIHwgRGF0YVRyYW5zZmVySXRlbVtdIHwgRGF0YVRyYW5zZmVySXRlbUxpc3QgfCBudWxsKSB7XG4gICAgaWYgKGl0ZW1zIGluc3RhbmNlb2YgRGF0YVRyYW5zZmVySXRlbSkge1xuICAgICAgdGhpcy5saXN0ID0gW2l0ZW1zXTtcbiAgICB9IGVsc2UgaWYgKGl0ZW1zIGluc3RhbmNlb2YgRGF0YVRyYW5zZmVySXRlbUxpc3QpIHtcbiAgICAgIHRoaXMubGlzdCA9IEFycmF5LmZyb20oaXRlbXMpO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShpdGVtcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGl0ZW1zO1xuICAgIH1cbiAgfVxuICAqZ2V0QXNFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgZW50cnkgPSAoaXRlbSBhcyBEYXRhVHJhbnNmZXJJdGVtICYgeyBnZXRBc0VudHJ5PzogRGF0YVRyYW5zZmVySXRlbVsnd2Via2l0R2V0QXNFbnRyeSddIH0pLmdldEFzRW50cnk/LigpID8/IGl0ZW0ud2Via2l0R2V0QXNFbnRyeT8uKCk7XG4gICAgICBpZiAoZW50cnkgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRW50cnkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICpnZXRBc0ZpbGUoKTogR2VuZXJhdG9yPEZpbGU+IHtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5saXN0KSB7XG4gICAgICBjb25zdCBmaWxlID0gaXRlbS5nZXRBc0ZpbGU/LigpO1xuICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBGaWxlKSB7XG4gICAgICAgIHlpZWxkIGZpbGU7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jICpnZXRBc1N0cmluZygpOiBBc3luY0dlbmVyYXRvcjxzdHJpbmc+IHtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5saXN0KSB7XG4gICAgICB5aWVsZCBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBpdGVtLmdldEFzU3RyaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgaXRlbS5nZXRBc1N0cmluZyhyZXNvbHZlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZWplY3QoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG4iLAogICAgImV4cG9ydCBjbGFzcyBGaWxlU3lzdGVtRW50cnlJdGVyYXRvciB7XG4gIGxpc3Q6IEZpbGVTeXN0ZW1FbnRyeVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGVudHJpZXM/OiBGaWxlU3lzdGVtRW50cnkgfCBGaWxlU3lzdGVtRW50cnlbXSB8IG51bGwpIHtcbiAgICBpZiAoZW50cmllcyBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1FbnRyeSkge1xuICAgICAgdGhpcy5saXN0ID0gW2VudHJpZXNdO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShlbnRyaWVzKSkge1xuICAgICAgdGhpcy5saXN0ID0gZW50cmllcztcbiAgICB9XG4gIH1cbiAgKmdldERpcmVjdG9yeUVudHJ5KCk6IEdlbmVyYXRvcjxGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubGlzdCkge1xuICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5ICYmIGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqZ2V0RmlsZUVudHJ5KCk6IEdlbmVyYXRvcjxGaWxlU3lzdGVtRmlsZUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGlmIChlbnRyeS5pc0ZpbGUgJiYgZW50cnkgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRmlsZUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5SXRlcmF0b3Ige1xuICBsaXN0OiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzPzogRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5IHwgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5W10gfCBudWxsKSB7XG4gICAgaWYgKGVudHJpZXMgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkpIHtcbiAgICAgIHRoaXMubGlzdCA9IFtlbnRyaWVzXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGVudHJpZXM7XG4gICAgfVxuICB9XG4gIGFzeW5jICpnZXRFbnRyeSgpOiBBc3luY0dlbmVyYXRvcjxGaWxlU3lzdGVtRW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgcmVhZGVyID0gZW50cnkuY3JlYXRlUmVhZGVyKCk7XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGF3YWl0IG5ldyBQcm9taXNlPEZpbGVTeXN0ZW1FbnRyeVtdPigocmVzb2x2ZSwgcmVqZWN0KSA9PiByZWFkZXIucmVhZEVudHJpZXMocmVzb2x2ZSwgcmVqZWN0KSkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgImltcG9ydCB7IEpvYlF1ZXVlIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L0pvYlF1ZXVlLmpzJztcbmltcG9ydCB7IFJlY3Vyc2l2ZUFzeW5jSXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvUmVjdXJzaXZlQXN5bmNJdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRGF0YVRyYW5zZmVyLmpzJztcbmltcG9ydCB7IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yLCBGaWxlU3lzdGVtRW50cnlJdGVyYXRvciB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvV2ViIEFQSS9GaWxlU3lzdGVtLmpzJztcblxuY29uc3Qgd2Via2l0ZGlyZWN0b3J5X3N1cHBvcnQgPSAvYW5kcm9pZHxpcGhvbmV8bW9iaWxlL2kudGVzdCh3aW5kb3cubmF2aWdhdG9yLnVzZXJBZ2VudCkgPT09IHRydWUgPyBmYWxzZSA6IHRydWU7XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cERyYWdBbmREcm9wRmlsZVBpY2tlcihcbiAgY29udGFpbmVyOiBFbGVtZW50LFxuICBmbjoge1xuICAgIG9uRHJhZ0VuZD86ICgpID0+IHZvaWQ7XG4gICAgb25EcmFnRW50ZXI/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJhZ0xlYXZlPzogKCkgPT4gdm9pZDtcbiAgICBvblVwbG9hZEVuZD86ICgpID0+IHZvaWQ7XG4gICAgb25VcGxvYWROZXh0RmlsZTogKGZpbGU6IEZpbGUsIGRvbmU6ICgpID0+IHZvaWQpID0+IFByb21pc2U8dm9pZD4gfCB2b2lkO1xuICAgIG9uVXBsb2FkU3RhcnQ/OiAoKSA9PiB2b2lkO1xuICB9LFxuICBvcHRpb25zPzoge1xuICAgIGRpcmVjdG9yeTogYm9vbGVhbjtcbiAgICBtdWx0aXBsZTogYm9vbGVhbjtcbiAgfSxcbikge1xuICBjb25zdCBlbGVtZW50ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0Jyk7XG4gIGlmICghZWxlbWVudCkge1xuICAgIHRocm93ICdkcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyIGlucHV0IGVsZW1lbnQgbWlzc2luZyc7XG4gIH1cbiAgaWYgKG9wdGlvbnM/LmRpcmVjdG9yeSA9PT0gdHJ1ZSAmJiB3ZWJraXRkaXJlY3Rvcnlfc3VwcG9ydCkge1xuICAgIGVsZW1lbnQudG9nZ2xlQXR0cmlidXRlKCd3ZWJraXRkaXJlY3RvcnknLCB0cnVlKTtcbiAgfVxuICBpZiAob3B0aW9ucz8ubXVsdGlwbGUgPT09IHRydWUpIHtcbiAgICBlbGVtZW50LnRvZ2dsZUF0dHJpYnV0ZSgnbXVsdGlwbGUnLCB0cnVlKTtcbiAgfVxuXG4gIGlmIChmbi5vbkRyYWdFbmQgfHwgZm4ub25EcmFnRW50ZXIgfHwgZm4ub25EcmFnTGVhdmUpIHtcbiAgICBjb25zdCBkcmFnZW5kSGFuZGxlciA9ICgpID0+IHtcbiAgICAgIGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5yZW1vdmVFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZm4ub25EcmFnRW5kPy4oKTtcbiAgICB9O1xuICAgIGNvbnN0IGRyYWdsZWF2ZUhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICBlbGVtZW50LnJlbW92ZUV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdlbmRIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQucmVtb3ZlRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIGRyYWdlbmRIYW5kbGVyKTtcbiAgICAgIGZuLm9uRHJhZ0xlYXZlPy4oKTtcbiAgICB9O1xuICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VudGVyJywgKCkgPT4ge1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnbGVhdmUnLCBkcmFnbGVhdmVIYW5kbGVyKTtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2VuZCcsIGRyYWdlbmRIYW5kbGVyKTtcbiAgICAgIGZuLm9uRHJhZ0VudGVyPy4oKTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGZTRW50cnlTZXQgPSBuZXcgU2V0PHN0cmluZz4oKTtcbiAgY29uc3QgZlNFbnRyeUl0ZXJhdG9yID0gbmV3IFJlY3Vyc2l2ZUFzeW5jSXRlcmF0b3I8RmlsZVN5c3RlbUVudHJ5LCBGaWxlU3lzdGVtRmlsZUVudHJ5Pihhc3luYyBmdW5jdGlvbiogKGZTRW50cnlJdGVyYXRvciwgcHVzaCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZlNFbnRyeSBvZiBmU0VudHJ5SXRlcmF0b3IpIHtcbiAgICAgIGlmICghZlNFbnRyeVNldC5oYXMoZlNFbnRyeS5mdWxsUGF0aC5zbGljZSgxKSkpIHtcbiAgICAgICAgZlNFbnRyeVNldC5hZGQoZlNFbnRyeS5mdWxsUGF0aC5zbGljZSgxKSk7XG4gICAgICAgIGNvbnN0IGZzRW50cmllcyA9IG5ldyBGaWxlU3lzdGVtRW50cnlJdGVyYXRvcihmU0VudHJ5KTtcbiAgICAgICAgZm9yIChjb25zdCBmU0ZpbGVFbnRyeSBvZiBmc0VudHJpZXMuZ2V0RmlsZUVudHJ5KCkpIHtcbiAgICAgICAgICB5aWVsZCBmU0ZpbGVFbnRyeTtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGNvbnN0IGZTRGlyZWN0b3J5RW50cnkgb2YgZnNFbnRyaWVzLmdldERpcmVjdG9yeUVudHJ5KCkpIHtcbiAgICAgICAgICBwdXNoKG5ldyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvcihmU0RpcmVjdG9yeUVudHJ5KS5nZXRFbnRyeSgpKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgY29uc3Qgam9iUXVldWUgPSBuZXcgSm9iUXVldWU8dm9pZCwgc3RyaW5nPigtMSk7XG4gIGxldCBzdGFydGVkID0gZmFsc2U7XG4gIGxldCBlbmRlZCA9IHRydWU7XG4gIGxldCBkb25lID0gdHJ1ZTtcbiAgY29uc3QgdXBsb2FkU3RhcnQgPSAoKSA9PiB7XG4gICAgaWYgKHN0YXJ0ZWQgPT09IGZhbHNlKSB7XG4gICAgICBzdGFydGVkID0gdHJ1ZTtcbiAgICAgIGVuZGVkID0gZmFsc2U7XG4gICAgICBkb25lID0gZmFsc2U7XG4gICAgICBmbi5vblVwbG9hZFN0YXJ0Py4oKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IHVwbG9hZEVuZCA9ICgpID0+IHtcbiAgICBpZiAoZW5kZWQgPT09IGZhbHNlKSB7XG4gICAgICBzdGFydGVkID0gZmFsc2U7XG4gICAgICBlbmRlZCA9IHRydWU7XG4gICAgICBqb2JRdWV1ZS5hYm9ydCgpO1xuICAgICAgam9iUXVldWUucmVzZXQoKTtcbiAgICAgIGZTRW50cnlTZXQuY2xlYXIoKTtcbiAgICAgIGZuLm9uVXBsb2FkRW5kPy4oKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IGNoYW5nZUhhbmRsZXIgPSAoKSA9PiB7XG4gICAgam9iUXVldWUuYWRkKGFzeW5jICgpID0+IHtcbiAgICAgIHVwbG9hZFN0YXJ0KCk7XG4gICAgICBpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEhUTUxJbnB1dEVsZW1lbnQgJiYgZWxlbWVudC5maWxlcykge1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRmlsZUVudHJ5IG9mIGZTRW50cnlJdGVyYXRvci5pdGVyYXRlKGVsZW1lbnQud2Via2l0RW50cmllcykpIHtcbiAgICAgICAgICBhd2FpdCBmbi5vblVwbG9hZE5leHRGaWxlKGF3YWl0IG5ldyBQcm9taXNlPEZpbGU+KChyZXNvbHZlLCByZWplY3QpID0+IGZTRmlsZUVudHJ5LmZpbGUocmVzb2x2ZSwgcmVqZWN0KSksICgpID0+IChkb25lID0gdHJ1ZSkpO1xuICAgICAgICAgIGlmIChkb25lID09PSB0cnVlKSByZXR1cm4gdXBsb2FkRW5kKCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGVsZW1lbnQuZmlsZXMpIHtcbiAgICAgICAgICBpZiAoIWZTRW50cnlTZXQuaGFzKGZpbGUud2Via2l0UmVsYXRpdmVQYXRoKSkge1xuICAgICAgICAgICAgZlNFbnRyeVNldC5hZGQoZmlsZS53ZWJraXRSZWxhdGl2ZVBhdGgpO1xuICAgICAgICAgICAgYXdhaXQgZm4ub25VcGxvYWROZXh0RmlsZShmaWxlLCAoKSA9PiAoZG9uZSA9IHRydWUpKTtcbiAgICAgICAgICAgIGlmIChkb25lID09PSB0cnVlKSByZXR1cm4gdXBsb2FkRW5kKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB1cGxvYWRFbmQoKTtcbiAgICB9LCAnY2hhbmdlSGFuZGxlcicpO1xuICB9O1xuICBjb25zdCBkcm9wSGFuZGxlciA9IChldmVudDogRHJhZ0V2ZW50KSA9PiB7XG4gICAgam9iUXVldWUuYWRkKGFzeW5jICgpID0+IHtcbiAgICAgIHVwbG9hZFN0YXJ0KCk7XG4gICAgICBpZiAoZXZlbnQuZGF0YVRyYW5zZmVyKSB7XG4gICAgICAgIGNvbnN0IGRhdGFUcmFuc2Zlckl0ZW1zID0gbmV3IERhdGFUcmFuc2Zlckl0ZW1JdGVyYXRvcihldmVudC5kYXRhVHJhbnNmZXIuaXRlbXMpO1xuICAgICAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRmlsZUVudHJ5IG9mIGZTRW50cnlJdGVyYXRvci5pdGVyYXRlKGRhdGFUcmFuc2Zlckl0ZW1zLmdldEFzRW50cnkoKSkpIHtcbiAgICAgICAgICBhd2FpdCBmbi5vblVwbG9hZE5leHRGaWxlKGF3YWl0IG5ldyBQcm9taXNlPEZpbGU+KChyZXNvbHZlLCByZWplY3QpID0+IGZTRmlsZUVudHJ5LmZpbGUocmVzb2x2ZSwgcmVqZWN0KSksICgpID0+IChkb25lID0gdHJ1ZSkpO1xuICAgICAgICAgIGlmIChkb25lID09PSB0cnVlKSByZXR1cm4gdXBsb2FkRW5kKCk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChjb25zdCBmaWxlIG9mIGV2ZW50LmRhdGFUcmFuc2Zlci5maWxlcykge1xuICAgICAgICAgIGlmICghZlNFbnRyeVNldC5oYXMoZmlsZS53ZWJraXRSZWxhdGl2ZVBhdGgpKSB7XG4gICAgICAgICAgICBmU0VudHJ5U2V0LmFkZChmaWxlLndlYmtpdFJlbGF0aXZlUGF0aCk7XG4gICAgICAgICAgICBhd2FpdCBmbi5vblVwbG9hZE5leHRGaWxlKGZpbGUsICgpID0+IChkb25lID0gdHJ1ZSkpO1xuICAgICAgICAgICAgaWYgKGRvbmUgPT09IHRydWUpIHJldHVybiB1cGxvYWRFbmQoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHVwbG9hZEVuZCgpO1xuICAgIH0sICdkcm9wSGFuZGxlcicpO1xuICB9O1xuICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIGNoYW5nZUhhbmRsZXIpO1xuICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBkcm9wSGFuZGxlcik7XG59XG4iLAogICAgImltcG9ydCB7IHNldHVwRHJhZ0FuZERyb3BGaWxlUGlja2VyIH0gZnJvbSAnLi9jb21wb25lbnRzL2RyYWctYW5kLWRyb3AtZmlsZS1waWNrZXIvZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci5qcyc7XG5pbXBvcnQgeyBKb2JRdWV1ZSB9IGZyb20gJy4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L0pvYlF1ZXVlLmpzJztcblxuLy8gISBvbmUgZGF5IHVzZSBFdmVudE1hbmFnZXJcbmRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnb3ZlcicsIChldmVudCkgPT4gZXZlbnQucHJldmVudERlZmF1bHQoKSk7XG5cbmNvbnN0IG1haW4gPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCdtYWluJyk7XG5jb25zdCBwaWNrZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlcicpO1xuXG5sZXQgaW1hZ2VMb2FkQ291bnQgPSAwO1xuY29uc3QgaW1hZ2VMb2FkUXVldWUgPSBuZXcgSm9iUXVldWUoLTEpO1xuaWYgKHBpY2tlcikge1xuICBzZXR1cERyYWdBbmREcm9wRmlsZVBpY2tlcihcbiAgICBwaWNrZXIsXG4gICAge1xuICAgICAgb25VcGxvYWRTdGFydCgpIHtcbiAgICAgICAgcGlja2VyLmNsYXNzTGlzdC5hZGQoJ2hpZGRlbicpO1xuICAgICAgICBtYWluPy5yZXBsYWNlQ2hpbGRyZW4oKTtcbiAgICAgIH0sXG4gICAgICBvblVwbG9hZE5leHRGaWxlOiBzaG93SW1hZ2UsXG4gICAgICBvblVwbG9hZEVuZCgpIHtcbiAgICAgICAgaW1hZ2VMb2FkUXVldWUuc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgICAgICBpZiAoaW1hZ2VMb2FkUXVldWUuZG9uZSkge1xuICAgICAgICAgICAgaWYgKGltYWdlTG9hZENvdW50ID09PSAwKSB7XG4gICAgICAgICAgICAgIHBpY2tlci5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTtcbiAgICAgICAgICAgICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICAgIGRpdi5zdHlsZS5jb2xvciA9ICdyZWQnO1xuICAgICAgICAgICAgICBkaXYudGV4dENvbnRlbnQgPSAnTm8gSW1hZ2VzIEZvdW5kISBUcnkgYW5vdGhlciBmb2xkZXIuJztcbiAgICAgICAgICAgICAgcGlja2VyLnF1ZXJ5U2VsZWN0b3IoJ3NwYW4nKT8uYXBwZW5kKFxuICAgICAgICAgICAgICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JyJyksIC8vXG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnInKSxcbiAgICAgICAgICAgICAgICBkaXYsXG4gICAgICAgICAgICAgICk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBkaXJlY3Rvcnk6IHRydWUsXG4gICAgICBtdWx0aXBsZTogdHJ1ZSxcbiAgICB9LFxuICApO1xufVxuXG5mdW5jdGlvbiBzaG93SW1hZ2UoZmlsZTogRmlsZSkge1xuICB0cnkge1xuICAgIGltYWdlTG9hZFF1ZXVlLmFkZChcbiAgICAgICgpID0+XG4gICAgICAgIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICBjb25zdCBpbWcgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdpbWcnKTtcbiAgICAgICAgICBjb25zdCBkaXYgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICAgICAgICAvLyBkaXYuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7XG4gICAgICAgICAgbWFpbj8uYXBwZW5kKGRpdik7XG4gICAgICAgICAgaW1nLnNyYyA9IFVSTC5jcmVhdGVPYmplY3RVUkwoZmlsZSk7XG4gICAgICAgICAgaW1nLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWQnLCAoKSA9PiB7XG4gICAgICAgICAgICBkaXYuYXBwZW5kKGltZyk7XG4gICAgICAgICAgICBpbWFnZUxvYWRDb3VudCsrO1xuICAgICAgICAgICAgcmVzb2x2ZSgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICAgIGltZy5hZGRFdmVudExpc3RlbmVyKCdlcnJvcicsICgpID0+IHtcbiAgICAgICAgICAgIGRpdi5yZW1vdmUoKTtcbiAgICAgICAgICAgIHJlamVjdCgpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KSxcbiAgICApO1xuICB9IGNhdGNoIChfKSB7fVxufVxuIgogIF0sCiAgIm1hcHBpbmdzIjogIjtBQUdPLE1BQU0sTUFBYTtBQUFBLEVBRUY7QUFBQSxFQURaLGtCQUFrQixJQUFJO0FBQUEsRUFDaEMsV0FBVyxDQUFXLE9BQWU7QUFBZjtBQUFBO0FBQUEsRUFDdEIsU0FBUyxDQUFDLFVBQW1EO0FBQzNELFNBQUssZ0JBQWdCLElBQUksUUFBUTtBQUNqQyxRQUFJLEtBQUssVUFBVSxXQUFXO0FBQzVCLGVBQVMsS0FBSyxPQUFPLE1BQU07QUFDekIsYUFBSyxnQkFBZ0IsT0FBTyxRQUFRO0FBQUEsT0FDckM7QUFBQSxJQUNIO0FBQ0EsV0FBTyxNQUFNO0FBQ1gsV0FBSyxnQkFBZ0IsT0FBTyxRQUFRO0FBQUE7QUFBQTtBQUFBLEVBR3hDLEdBQUcsR0FBbUI7QUFDcEIsV0FBTyxJQUFJLFFBQWUsQ0FBQyxZQUFZO0FBQ3JDLFdBQUssVUFBVSxDQUFDLE9BQU8sZ0JBQWdCO0FBQ3JDLG9CQUFZO0FBQ1osZ0JBQVEsS0FBSztBQUFBLE9BQ2Q7QUFBQSxLQUNGO0FBQUE7QUFBQSxFQUVILEdBQUcsQ0FBQyxPQUFvQjtBQUN0QixRQUFJLEtBQUssVUFBVSxXQUFXO0FBQzVCLFdBQUssUUFBUTtBQUNiLGlCQUFXLFlBQVksS0FBSyxpQkFBaUI7QUFDM0MsaUJBQVMsT0FBTyxNQUFNO0FBQ3BCLGVBQUssZ0JBQWdCLE9BQU8sUUFB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QUFBQSxPQUNSO0FBQUEsS0FDRixDQUNMO0FBQUEsV0FDTyxHQUFQO0FBQUE7QUFBQTtBQTlESixTQUFTLGdCQUFnQixpQkFBaUIsWUFBWSxDQUFDLFVBQVUsTUFBTSxlQUFlLENBQUM7QUFFdkYsSUFBTSxPQUFPLFNBQVMsY0FBYyxNQUFNO0FBQzFDLElBQU0sU0FBUyxTQUFTLGNBQWMsNEJBQTRCO0FBRWxFLElBQUksaUJBQWlCO0FBQ3JCLElBQU0saUJBQWlCLElBQUksU0FBUyxFQUFFO0FBQ3RDLElBQUksUUFBUTtBQUNWLDZCQUNFLFFBQ0E7QUFBQSxJQUNFLGFBQWEsR0FBRztBQUNkLGFBQU8sVUFBVSxJQUFJLFFBQVE7QUFDN0IsWUFBTSxnQkFBZ0I7QUFBQTtBQUFBLElBRXhCLGtCQUFrQjtBQUFBLElBQ2xCLFdBQVcsR0FBRztBQUNaLHFCQUFlLFVBQVUsTUFBTTtBQUM3QixZQUFJLGVBQWUsTUFBTTtBQUN2QixjQUFJLG1CQUFtQixHQUFHO0FBQ3hCLG1CQUFPLFVBQVUsT0FBTyxRQUFRO0FBQ2hDLGtCQUFNLE1BQU0sU0FBUyxjQUFjLEtBQUs7QUFDeEMsZ0JBQUksTUFBTSxRQUFRO0FBQ2xCLGdCQUFJLGNBQWM7QUFDbEIsbUJBQU8sY0FBYyxNQUFNLEdBQUcsT0FDNUIsU0FBUyxjQUFjLElBQUksR0FDM0IsU0FBUyxjQUFjLElBQUksR0FDM0IsR0FDRjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsT0FDRDtBQUFBO0FBQUEsRUFFTCxHQUNBO0FBQUEsSUFDRSxXQUFXO0FBQUEsSUFDWCxVQUFVO0FBQUEsRUFDWixDQUNGO0FBQ0Y7IiwKICAiZGVidWdJZCI6ICI2MEMwRDk0MTQ3RjQ5NDMyNjQ3NTZFMjE2NDc1NkUyMSIsCiAgIm5hbWVzIjogW10KfQ==
