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
  if (options?.accept) {
    element.setAttribute('accept', options.accept);
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
        await fn.onUploadNextFile(file, () => (done = true));
        if (done === true) return;
      }
      for (const file of files) {
        const path = GetWebkitRelativePath(file) + file.name;
        if (!fSEntrySet.has(path)) {
          fSEntrySet.add(path);
          await fn.onUploadNextFile(file, () => (done = true));
          if (done === true) return;
        }
      }
    }
  };
  const changeHandler = () => {
    jobQueue.add(async () => {
      await uploadStart();
      if (done === false && element instanceof HTMLInputElement && element.files) {
        await iterateFSEntries(GetWebkitEntries(element) ?? [], element.files);
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

//# debugId=3A00F638648BA3C664756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcQWxnb3JpdGhtXFxTbGVlcC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxEZXNpZ24gUGF0dGVyblxcT2JzZXJ2ZXJcXFN0b3JlLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFV0aWxpdHlcXEpvYlF1ZXVlLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFV0aWxpdHlcXFJlY3Vyc2l2ZUFzeW5jSXRlcmF0b3IudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcV2ViIEFQSVxcRGF0YVRyYW5zZmVyLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFdlYiBBUElcXEZpbGVTeXN0ZW0udHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcV2ViIEFQSVxcSFRNTElucHV0RWxlbWVudC50cyIsICJzcmNcXGNvbXBvbmVudHNcXGRyYWctYW5kLWRyb3AtZmlsZS1waWNrZXJcXGRyYWctYW5kLWRyb3AtZmlsZS1waWNrZXIudHMiLCAic3JjXFxpbmRleC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsKICAgICJleHBvcnQgYXN5bmMgZnVuY3Rpb24gU2xlZXAobXM6IG51bWJlcikge1xuICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xufVxuIiwKICAgICJleHBvcnQgdHlwZSBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4gPSAodmFsdWU6IFZhbHVlLCB1bnN1YnNjcmliZTogKCkgPT4gdm9pZCkgPT4gdm9pZDtcbmV4cG9ydCB0eXBlIFVwZGF0ZUNhbGxiYWNrPFZhbHVlPiA9ICh2YWx1ZTogVmFsdWUpID0+IFZhbHVlO1xuXG5leHBvcnQgY2xhc3MgQ29uc3Q8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+PigpO1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgdmFsdWU/OiBWYWx1ZSkge31cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4pOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5hZGQoY2FsbGJhY2spO1xuICAgIGlmICh0aGlzLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNhbGxiYWNrKHRoaXMudmFsdWUsICgpID0+IHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUpOiB2b2lkIHtcbiAgICBpZiAodGhpcy52YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICAgIGNhbGxiYWNrKHZhbHVlLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTdG9yZTxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgY3VycmVudFZhbHVlOiBWYWx1ZTtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+PigpO1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcm90ZWN0ZWQgaW5pdGlhbFZhbHVlOiBWYWx1ZSxcbiAgICBwcm90ZWN0ZWQgbm90aWZ5T25DaGFuZ2VPbmx5OiBib29sZWFuID0gZmFsc2UsXG4gICkge1xuICAgIHRoaXMuY3VycmVudFZhbHVlID0gaW5pdGlhbFZhbHVlO1xuICB9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBjb25zdCB1bnN1YnNjcmliZSA9ICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgICBjYWxsYmFjayh0aGlzLmN1cnJlbnRWYWx1ZSwgdW5zdWJzY3JpYmUpO1xuICAgIHJldHVybiB1bnN1YnNjcmliZTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZT4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubm90aWZ5T25DaGFuZ2VPbmx5ICYmIHRoaXMuY3VycmVudFZhbHVlID09PSB2YWx1ZSkgcmV0dXJuO1xuICAgIHRoaXMuY3VycmVudFZhbHVlID0gdmFsdWU7XG4gICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgY2FsbGJhY2sodmFsdWUsICgpID0+IHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICB1cGRhdGUoY2FsbGJhY2s6IFVwZGF0ZUNhbGxiYWNrPFZhbHVlPik6IHZvaWQge1xuICAgIHRoaXMuc2V0KGNhbGxiYWNrKHRoaXMuY3VycmVudFZhbHVlKSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wdGlvbmFsPFZhbHVlPiB7XG4gIHByb3RlY3RlZCBzdG9yZTogU3RvcmU8VmFsdWUgfCB1bmRlZmluZWQ+O1xuICBjb25zdHJ1Y3Rvcihub3RpZnlPbkNoYW5nZU9ubHkgPSBmYWxzZSkge1xuICAgIHRoaXMuc3RvcmUgPSBuZXcgU3RvcmU8VmFsdWUgfCB1bmRlZmluZWQ+KHVuZGVmaW5lZCwgbm90aWZ5T25DaGFuZ2VPbmx5KTtcbiAgfVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlIHwgdW5kZWZpbmVkPik6ICgpID0+IHZvaWQge1xuICAgIHJldHVybiB0aGlzLnN0b3JlLnN1YnNjcmliZShjYWxsYmFjayk7XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWUgfCB1bmRlZmluZWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWUgfCB1bmRlZmluZWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2V0KHZhbHVlKTtcbiAgfVxuICB1cGRhdGUoY2FsbGJhY2s6IFVwZGF0ZUNhbGxiYWNrPFZhbHVlIHwgdW5kZWZpbmVkPik6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUudXBkYXRlKGNhbGxiYWNrKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gQ29tcG91bmRTdWJzY3JpcHRpb248VCBleHRlbmRzIGFueVtdPihzdG9yZXM6IHsgW0sgaW4ga2V5b2YgVF06IFN0b3JlPFRbS10+IHwgT3B0aW9uYWw8VFtLXT4gfSwgY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPHsgW0sgaW4ga2V5b2YgVF06IFRbS10gfCB1bmRlZmluZWQgfT4pOiAoKSA9PiB2b2lkIHtcbiAgY29uc3QgdW5zdWJzOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICBjb25zdCB1bnN1YnNjcmliZSA9ICgpID0+IHtcbiAgICBmb3IgKGNvbnN0IHVuc3ViIG9mIHVuc3Vicykge1xuICAgICAgdW5zdWIoKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IHZhbHVlcyA9IFtdIGFzIHsgW0sgaW4ga2V5b2YgVF06IFRbS10gfCB1bmRlZmluZWQgfTtcbiAgY29uc3QgY2FsbGJhY2tfaGFuZGxlciA9ICgpID0+IHtcbiAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gc3RvcmVzLmxlbmd0aCkge1xuICAgICAgY2FsbGJhY2sodmFsdWVzLCB1bnN1YnNjcmliZSk7XG4gICAgfVxuICB9O1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHN0b3Jlcy5sZW5ndGg7IGkrKykge1xuICAgIHN0b3Jlc1tpXS5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgdmFsdWVzW2ldID0gdmFsdWU7XG4gICAgICB1bnN1YnNbaV0gPSB1bnN1YnNjcmliZTtcbiAgICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSBzdG9yZXMubGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrX2hhbmRsZXIoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICByZXR1cm4gdW5zdWJzY3JpYmU7XG59XG4iLAogICAgImltcG9ydCB7IFN0b3JlIH0gZnJvbSAnLi4vRGVzaWduIFBhdHRlcm4vT2JzZXJ2ZXIvU3RvcmUuanMnO1xuXG5leHBvcnQgdHlwZSBTdWJzY3JpcHRpb25DYWxsYmFjazxSZXN1bHQsIFRhZz4gPSAocmVzdWx0PzogUmVzdWx0LCBlcnJvcj86IEVycm9yLCB0YWc/OiBUYWcpID0+IHsgYWJvcnQ6IGJvb2xlYW4gfSB8IHZvaWQ7XG5cbmV4cG9ydCBjbGFzcyBKb2JRdWV1ZTxSZXN1bHQgPSB2b2lkLCBUYWcgPSB2b2lkPiB7XG4gIC8qKlxuICAgKiAwOiBObyBkZWxheS4gLTE6IENvbnNlY3V0aXZlLlxuICAgKi9cbiAgY29uc3RydWN0b3IocHVibGljIGRlbGF5X21zOiBudW1iZXIpIHt9XG4gIC8qKlxuICAgKiAhIFdhdGNoIG91dCBmb3IgY2lyY3VsYXIgY2FsbHMgIVxuICAgKlxuICAgKiBTZXRzIHRoZSBgYWJvcnRlZGAgc3RhdGUgYW5kIHJlc29sdmVzIHdoZW4gY3VycmVudGx5IHJ1bm5pbmcgam9icyBmaW5pc2guXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgYWJvcnQoKSB7XG4gICAgdGhpcy5hYm9ydGVkID0gdHJ1ZTtcbiAgICBhd2FpdCB0aGlzLmRvbmU7XG4gIH1cbiAgcHVibGljIGFkZChmbjogKCkgPT4gUHJvbWlzZTxSZXN1bHQ+LCB0YWc/OiBUYWcpIHtcbiAgICBpZiAodGhpcy5hYm9ydGVkID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5xdWV1ZS5wdXNoKHsgZm4sIHRhZyB9KTtcbiAgICAgIGlmICh0aGlzLnJ1bm5pbmcgPT09IGZhbHNlKSB7XG4gICAgICAgIHRoaXMucnVubmluZyA9IHRydWU7XG4gICAgICAgIHRoaXMucnVuKCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8qKlxuICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdoZW4gam9icyBmaW5pc2guXG4gICAqL1xuICBwdWJsaWMgZ2V0IGRvbmUoKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnJ1bm5pbmdDb3VudC5zdWJzY3JpYmUoKGNvdW50KSA9PiB7XG4gICAgICAgIGlmIChjb3VudCA9PT0gMCkgcmVzb2x2ZSgpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFJlc2V0cyB0aGUgSm9iUXVldWUgdG8gYW4gaW5pdGlhbCBzdGF0ZSwga2VlcGluZyBzdWJzY3JpcHRpb25zIGFsaXZlLlxuICAgKlxuICAgKiBAdGhyb3dzIElmIGNhbGxlZCB3aGVuIGpvYnMgYXJlIGN1cnJlbnRseSBydW5uaW5nLlxuICAgKi9cbiAgcHVibGljIGFzeW5jIHJlc2V0KCkge1xuICAgIGlmICh0aGlzLnJ1bm5pbmcgPT09IHRydWUgfHwgKGF3YWl0IHRoaXMucnVubmluZ0NvdW50LmdldCgpKSA+IDApIHtcbiAgICAgIHRocm93ICdXYXJuaW5nOiBXYWl0IGZvciBydW5uaW5nIGpvYnMgdG8gZmluaXNoIGJlZm9yZSBjYWxsaW5nIHJlc2V0LiBgYXdhaXQgSm9iUXVldWUuZG9uZTtgJztcbiAgICB9XG4gICAgdGhpcy5hYm9ydGVkID0gZmFsc2U7XG4gICAgdGhpcy5jb21wbGV0aW9uQ291bnQgPSAwO1xuICAgIHRoaXMucXVldWUubGVuZ3RoID0gMDtcbiAgICB0aGlzLnF1ZXVlSW5kZXggPSAwO1xuICAgIHRoaXMucmVzdWx0cy5sZW5ndGggPSAwO1xuICB9XG4gIHB1YmxpYyBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPik6ICgpID0+IHZvaWQge1xuICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmFkZChjYWxsYmFjayk7XG4gICAgZm9yIChjb25zdCByZXN1bHQgb2YgdGhpcy5yZXN1bHRzKSB7XG4gICAgICBpZiAoY2FsbGJhY2socmVzdWx0LnZhbHVlLCByZXN1bHQuZXJyb3IpPy5hYm9ydCA9PT0gdHJ1ZSkge1xuICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgICByZXR1cm4gKCkgPT4ge307XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiAoKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgIH07XG4gIH1cbiAgcHJvdGVjdGVkIGFib3J0ZWQgPSBmYWxzZTtcbiAgcHJvdGVjdGVkIGNvbXBsZXRpb25Db3VudCA9IDA7XG4gIHByb3RlY3RlZCBxdWV1ZTogeyBmbjogKCkgPT4gUHJvbWlzZTxSZXN1bHQ+OyB0YWc/OiBUYWcgfVtdID0gW107XG4gIHByb3RlY3RlZCBxdWV1ZUluZGV4ID0gMDtcbiAgcHJvdGVjdGVkIHJlc3VsdHM6IHsgdmFsdWU/OiBSZXN1bHQ7IGVycm9yPzogRXJyb3IgfVtdID0gW107XG4gIHByb3RlY3RlZCBydW5uaW5nID0gZmFsc2U7XG4gIHByb3RlY3RlZCBydW5uaW5nQ291bnQgPSBuZXcgU3RvcmUoMCk7XG4gIHByb3RlY3RlZCBzdWJzY3JpcHRpb25TZXQgPSBuZXcgU2V0PFN1YnNjcmlwdGlvbkNhbGxiYWNrPFJlc3VsdCwgVGFnPj4oKTtcbiAgcHJvdGVjdGVkIHJ1bigpIHtcbiAgICBpZiAodGhpcy5hYm9ydGVkID09PSBmYWxzZSAmJiB0aGlzLnF1ZXVlSW5kZXggPCB0aGlzLnF1ZXVlLmxlbmd0aCkge1xuICAgICAgY29uc3QgeyBmbiwgdGFnIH0gPSB0aGlzLnF1ZXVlW3RoaXMucXVldWVJbmRleCsrXTtcbiAgICAgIChhc3luYyAoKSA9PiB7XG4gICAgICAgIHRoaXMucnVubmluZ0NvdW50LnVwZGF0ZSgoY291bnQpID0+IHtcbiAgICAgICAgICByZXR1cm4gY291bnQgKyAxO1xuICAgICAgICB9KTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBjb25zdCB2YWx1ZSA9IGF3YWl0IGZuKCk7XG4gICAgICAgICAgdGhpcy5zZW5kKHsgdmFsdWUsIHRhZyB9KTtcbiAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgIHRoaXMuc2VuZCh7IGVycm9yLCB0YWcgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5ydW5uaW5nQ291bnQudXBkYXRlKChjb3VudCkgPT4ge1xuICAgICAgICAgIHJldHVybiBjb3VudCAtIDE7XG4gICAgICAgIH0pO1xuICAgICAgICBpZiAodGhpcy5kZWxheV9tcyA8IDApIHtcbiAgICAgICAgICB0aGlzLnJ1bigpO1xuICAgICAgICB9XG4gICAgICB9KSgpO1xuICAgICAgaWYgKHRoaXMuZGVsYXlfbXMgPj0gMCkge1xuICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHRoaXMucnVuKCksIHRoaXMuZGVsYXlfbXMpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnJ1bm5pbmcgPSBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcHJvdGVjdGVkIHNlbmQocmVzdWx0OiB7IHZhbHVlPzogUmVzdWx0OyBlcnJvcj86IEVycm9yOyB0YWc/OiBUYWcgfSkge1xuICAgIGlmICh0aGlzLmFib3J0ZWQgPT09IGZhbHNlKSB7XG4gICAgICB0aGlzLmNvbXBsZXRpb25Db3VudCsrO1xuICAgICAgdGhpcy5yZXN1bHRzLnB1c2gocmVzdWx0KTtcbiAgICAgIGZvciAoY29uc3QgY2FsbGJhY2sgb2YgdGhpcy5zdWJzY3JpcHRpb25TZXQpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKHJlc3VsdC52YWx1ZSwgcmVzdWx0LmVycm9yLCByZXN1bHQudGFnKT8uYWJvcnQgPT09IHRydWUpIHtcbiAgICAgICAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5kZWxldGUoY2FsbGJhY2spO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgU3luY0FzeW5jSXRlcmFibGUgfSBmcm9tICcuL1R5cGUuanMnO1xuXG5leHBvcnQgY2xhc3MgUmVjdXJzaXZlSXRlcmF0b3I8SW4sIE91dD4ge1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgZm46ICh2YWx1ZTogU3luY0FzeW5jSXRlcmFibGU8SW4+LCBwdXNoOiAodmFsdWU6IFN5bmNBc3luY0l0ZXJhYmxlPEluPikgPT4gdm9pZCkgPT4gU3luY0FzeW5jSXRlcmFibGU8T3V0Pikge31cbiAgYXN5bmMgKml0ZXJhdGUoaW5pdDogU3luY0FzeW5jSXRlcmFibGU8SW4+KTogU3luY0FzeW5jSXRlcmFibGU8T3V0PiB7XG4gICAgY29uc3QgbGlzdDogU3luY0FzeW5jSXRlcmFibGU8SW4+W10gPSBbaW5pdF07XG4gICAgZm9yIChsZXQgaSA9IDA7IGkgPCBsaXN0Lmxlbmd0aDsgaSsrKSB7XG4gICAgICBmb3IgYXdhaXQgKGNvbnN0IGZTRW50cnkgb2YgdGhpcy5mbihsaXN0W2ldLCAodmFsdWUpID0+IHtcbiAgICAgICAgbGlzdC5wdXNoKHZhbHVlKTtcbiAgICAgIH0pKSB7XG4gICAgICAgIHlpZWxkIGZTRW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgImltcG9ydCB0eXBlIHsgTiB9IGZyb20gJy4uL1V0aWxpdHkvVHlwZS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3Ige1xuICBsaXN0OiBEYXRhVHJhbnNmZXJJdGVtW10gPSBbXTtcbiAgY29uc3RydWN0b3IoaXRlbXM/OiBOPERhdGFUcmFuc2Zlckl0ZW0+IHwgRGF0YVRyYW5zZmVySXRlbUxpc3QgfCBudWxsKSB7XG4gICAgaWYgKGl0ZW1zIGluc3RhbmNlb2YgRGF0YVRyYW5zZmVySXRlbSkge1xuICAgICAgdGhpcy5saXN0ID0gW2l0ZW1zXTtcbiAgICB9IGVsc2UgaWYgKGl0ZW1zIGluc3RhbmNlb2YgRGF0YVRyYW5zZmVySXRlbUxpc3QpIHtcbiAgICAgIHRoaXMubGlzdCA9IEFycmF5LmZyb20oaXRlbXMpO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShpdGVtcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGl0ZW1zO1xuICAgIH1cbiAgfVxuICAqZ2V0QXNFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgZW50cnkgPSAoaXRlbSBhcyBEYXRhVHJhbnNmZXJJdGVtICYgeyBnZXRBc0VudHJ5PzogRGF0YVRyYW5zZmVySXRlbVsnd2Via2l0R2V0QXNFbnRyeSddIH0pLmdldEFzRW50cnk/LigpID8/IGl0ZW0ud2Via2l0R2V0QXNFbnRyeT8uKCk7XG4gICAgICBpZiAoZW50cnkgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRW50cnkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gICpnZXRBc0ZpbGUoKTogR2VuZXJhdG9yPEZpbGU+IHtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5saXN0KSB7XG4gICAgICBjb25zdCBmaWxlID0gaXRlbS5nZXRBc0ZpbGU/LigpO1xuICAgICAgaWYgKGZpbGUgaW5zdGFuY2VvZiBGaWxlKSB7XG4gICAgICAgIHlpZWxkIGZpbGU7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIGFzeW5jICpnZXRBc1N0cmluZygpOiBBc3luY0dlbmVyYXRvcjxzdHJpbmc+IHtcbiAgICBmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5saXN0KSB7XG4gICAgICB5aWVsZCBhd2FpdCBuZXcgUHJvbWlzZTxzdHJpbmc+KChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgaWYgKHR5cGVvZiBpdGVtLmdldEFzU3RyaW5nID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgaXRlbS5nZXRBc1N0cmluZyhyZXNvbHZlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZWplY3QoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9XG59XG4iLAogICAgImV4cG9ydCBjbGFzcyBGaWxlU3lzdGVtRW50cnlJdGVyYXRvciB7XG4gIGxpc3Q6IEZpbGVTeXN0ZW1FbnRyeVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGVudHJpZXM/OiBGaWxlU3lzdGVtRW50cnkgfCBGaWxlU3lzdGVtRW50cnlbXSB8IG51bGwpIHtcbiAgICBpZiAoZW50cmllcyBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1FbnRyeSkge1xuICAgICAgdGhpcy5saXN0ID0gW2VudHJpZXNdO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShlbnRyaWVzKSkge1xuICAgICAgdGhpcy5saXN0ID0gZW50cmllcztcbiAgICB9XG4gIH1cbiAgKmdldERpcmVjdG9yeUVudHJ5KCk6IEdlbmVyYXRvcjxGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubGlzdCkge1xuICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5ICYmIGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqZ2V0RmlsZUVudHJ5KCk6IEdlbmVyYXRvcjxGaWxlU3lzdGVtRmlsZUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGlmIChlbnRyeS5pc0ZpbGUgJiYgZW50cnkgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRmlsZUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5SXRlcmF0b3Ige1xuICBsaXN0OiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbXSA9IFtdO1xuICBjb25zdHJ1Y3RvcihlbnRyaWVzPzogRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5IHwgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5W10gfCBudWxsKSB7XG4gICAgaWYgKGVudHJpZXMgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkpIHtcbiAgICAgIHRoaXMubGlzdCA9IFtlbnRyaWVzXTtcbiAgICB9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGVudHJpZXM7XG4gICAgfVxuICB9XG4gIGFzeW5jICpnZXRFbnRyeSgpOiBBc3luY0dlbmVyYXRvcjxGaWxlU3lzdGVtRW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgcmVhZGVyID0gZW50cnkuY3JlYXRlUmVhZGVyKCk7XG4gICAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIGF3YWl0IG5ldyBQcm9taXNlPEZpbGVTeXN0ZW1FbnRyeVtdPigocmVzb2x2ZSwgcmVqZWN0KSA9PiByZWFkZXIucmVhZEVudHJpZXMocmVzb2x2ZSwgcmVqZWN0KSkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG4iLAogICAgIi8vIFdlYmtpdCBHdWFyZHNcblxuZXhwb3J0IGZ1bmN0aW9uIEdldFdlYmtpdEVudHJpZXMoZWxlbWVudDogSFRNTElucHV0RWxlbWVudCk6IHJlYWRvbmx5IEZpbGVTeXN0ZW1FbnRyeVtdIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIGVsZW1lbnQud2Via2l0RW50cmllcyA/PyB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBHZXRXZWJraXRSZWxhdGl2ZVBhdGgoZmlsZTogRmlsZSk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBmaWxlLndlYmtpdFJlbGF0aXZlUGF0aCA/PyB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBTdXBwb3J0c1dlYmtpdERpcmVjdG9yeSgpOiBib29sZWFuIHtcbiAgcmV0dXJuIC9hbmRyb2lkfGlwaG9uZXxtb2JpbGUvaS50ZXN0KHdpbmRvdy5uYXZpZ2F0b3IudXNlckFnZW50KSA9PT0gdHJ1ZSA/IGZhbHNlIDogdHJ1ZTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgU2xlZXAgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL0FsZ29yaXRobS9TbGVlcC5qcyc7XG5pbXBvcnQgeyBKb2JRdWV1ZSB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9Kb2JRdWV1ZS5qcyc7XG5pbXBvcnQgeyBSZWN1cnNpdmVJdGVyYXRvciB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9SZWN1cnNpdmVBc3luY0l0ZXJhdG9yLmpzJztcbmltcG9ydCB0eXBlIHsgU3luY0FzeW5jSXRlcmFibGUgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvVHlwZS5qcyc7XG5pbXBvcnQgeyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRGF0YVRyYW5zZmVyLmpzJztcbmltcG9ydCB7IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yLCBGaWxlU3lzdGVtRW50cnlJdGVyYXRvciB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvV2ViIEFQSS9GaWxlU3lzdGVtLmpzJztcbmltcG9ydCB7IEdldFdlYmtpdEVudHJpZXMsIEdldFdlYmtpdFJlbGF0aXZlUGF0aCwgU3VwcG9ydHNXZWJraXREaXJlY3RvcnkgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvSFRNTElucHV0RWxlbWVudC5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cERyYWdBbmREcm9wRmlsZVBpY2tlcihcbiAgY29udGFpbmVyOiBFbGVtZW50LFxuICBmbjoge1xuICAgIG9uRHJhZ0VuZD86ICgpID0+IHZvaWQ7XG4gICAgb25EcmFnRW50ZXI/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJhZ0xlYXZlPzogKCkgPT4gdm9pZDtcbiAgICBvbkRyb3A/OiAoKSA9PiB2b2lkO1xuICAgIG9uVXBsb2FkRW5kPzogKCkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG4gICAgb25VcGxvYWRFcnJvcj86IChlcnJvcjogYW55KSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbiAgICBvblVwbG9hZE5leHRGaWxlOiAoZmlsZTogRmlsZSwgZG9uZTogKCkgPT4gdm9pZCkgPT4gUHJvbWlzZTx2b2lkPiB8IHZvaWQ7XG4gICAgb25VcGxvYWRTdGFydD86ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuICB9LFxuICBvcHRpb25zPzoge1xuICAgIGFjY2VwdD86IHN0cmluZztcbiAgICBkaXJlY3Rvcnk/OiBib29sZWFuO1xuICAgIG11bHRpcGxlPzogYm9vbGVhbjtcbiAgfSxcbikge1xuICBjb25zdCBlbGVtZW50ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0Jyk7XG4gIGlmICghZWxlbWVudCkge1xuICAgIHRocm93ICdkcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyIGlucHV0IGVsZW1lbnQgbWlzc2luZyc7XG4gIH1cbiAgaWYgKG9wdGlvbnM/LmFjY2VwdCkge1xuICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdhY2NlcHQnLCBvcHRpb25zLmFjY2VwdCk7XG4gIH1cbiAgaWYgKG9wdGlvbnM/LmRpcmVjdG9yeSA9PT0gdHJ1ZSAmJiBTdXBwb3J0c1dlYmtpdERpcmVjdG9yeSgpKSB7XG4gICAgZWxlbWVudC50b2dnbGVBdHRyaWJ1dGUoJ3dlYmtpdGRpcmVjdG9yeScsIHRydWUpO1xuICB9XG4gIGlmIChvcHRpb25zPy5tdWx0aXBsZSA9PT0gdHJ1ZSkge1xuICAgIGVsZW1lbnQudG9nZ2xlQXR0cmlidXRlKCdtdWx0aXBsZScsIHRydWUpO1xuICB9XG5cbiAgaWYgKGZuLm9uRHJhZ0VuZCB8fCBmbi5vbkRyYWdFbnRlciB8fCBmbi5vbkRyYWdMZWF2ZSkge1xuICAgIGNvbnN0IHJlbW92ZUxpc3RlbmVycyA9ICgpID0+IHtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgZHJhZ2xlYXZlSGFuZGxlcik7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBkcmFnZW5kSGFuZGxlcik7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBkcm9wSGFuZGxlcik7XG4gICAgfTtcbiAgICBjb25zdCBkcmFnZW5kSGFuZGxlciA9ICgpID0+IHtcbiAgICAgIHJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgZm4ub25EcmFnRW5kPy4oKTtcbiAgICB9O1xuICAgIGNvbnN0IGRyYWdsZWF2ZUhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICByZW1vdmVMaXN0ZW5lcnMoKTtcbiAgICAgIGZuLm9uRHJhZ0xlYXZlPy4oKTtcbiAgICB9O1xuICAgIGNvbnN0IGRyb3BIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgcmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICBmbi5vbkRyb3A/LigpO1xuICAgIH07XG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW50ZXInLCAoKSA9PiB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdsZWF2ZUhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xuICAgICAgZm4ub25EcmFnRW50ZXI/LigpO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZlNFbnRyeVNldCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBmU0VudHJ5SXRlcmF0b3IgPSBuZXcgUmVjdXJzaXZlSXRlcmF0b3I8RmlsZVN5c3RlbUVudHJ5LCBGaWxlU3lzdGVtRmlsZUVudHJ5Pihhc3luYyBmdW5jdGlvbiogKGZTRW50cnlJdGVyYXRvciwgcHVzaCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZlNFbnRyeSBvZiBmU0VudHJ5SXRlcmF0b3IpIHtcbiAgICAgIGNvbnN0IHBhdGggPSBmU0VudHJ5LmZ1bGxQYXRoLnNsaWNlKDEpO1xuICAgICAgaWYgKCFmU0VudHJ5U2V0LmhhcyhwYXRoKSkge1xuICAgICAgICBmU0VudHJ5U2V0LmFkZChwYXRoKTtcbiAgICAgICAgY29uc3QgZnNFbnRyaWVzID0gbmV3IEZpbGVTeXN0ZW1FbnRyeUl0ZXJhdG9yKGZTRW50cnkpO1xuICAgICAgICBmb3IgKGNvbnN0IGZTRmlsZUVudHJ5IG9mIGZzRW50cmllcy5nZXRGaWxlRW50cnkoKSkge1xuICAgICAgICAgIHlpZWxkIGZTRmlsZUVudHJ5O1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZlNEaXJlY3RvcnlFbnRyeSBvZiBmc0VudHJpZXMuZ2V0RGlyZWN0b3J5RW50cnkoKSkge1xuICAgICAgICAgIHB1c2gobmV3IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yKGZTRGlyZWN0b3J5RW50cnkpLmdldEVudHJ5KCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBqb2JRdWV1ZSA9IG5ldyBKb2JRdWV1ZTx2b2lkLCBzdHJpbmc+KC0xKTtcbiAgam9iUXVldWUuc3Vic2NyaWJlKChfLCBlcnJvcikgPT4ge1xuICAgIGlmIChlcnJvcikge1xuICAgICAgZm4/Lm9uVXBsb2FkRXJyb3I/LihlcnJvcik7XG4gICAgfVxuICB9KTtcblxuICBsZXQgZG9uZSA9IHRydWU7XG4gIGxldCBydW5uaW5nID0gZmFsc2U7XG4gIGNvbnN0IHVwbG9hZFN0YXJ0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmIChydW5uaW5nID09PSBmYWxzZSkge1xuICAgICAgZG9uZSA9IGZhbHNlO1xuICAgICAgcnVubmluZyA9IHRydWU7XG4gICAgICBhd2FpdCBmbi5vblVwbG9hZFN0YXJ0Py4oKTtcbiAgICAgIC8vIGdpdmUgYnJvd3NlciBzb21lIHRpbWUgdG8gcXVldWUgYm90aCBldmVudHNcbiAgICAgIFNsZWVwKDUwMCkudGhlbihhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IGpvYlF1ZXVlLmRvbmU7XG4gICAgICAgIHVwbG9hZEVuZCgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuICBjb25zdCB1cGxvYWRFbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgZG9uZSA9IHRydWU7XG4gICAgcnVubmluZyA9IGZhbHNlO1xuICAgIGF3YWl0IGZuLm9uVXBsb2FkRW5kPy4oKTtcbiAgICBqb2JRdWV1ZS5yZXNldCgpO1xuICAgIGZTRW50cnlTZXQuY2xlYXIoKTtcbiAgfTtcbiAgY29uc3QgaXRlcmF0ZUZTRW50cmllcyA9IGFzeW5jIChlbnRyaWVzOiBTeW5jQXN5bmNJdGVyYWJsZTxGaWxlU3lzdGVtRW50cnk+LCBmaWxlczogRmlsZUxpc3QpID0+IHtcbiAgICBpZiAoZG9uZSA9PT0gZmFsc2UpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZlNGaWxlRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yLml0ZXJhdGUoZW50cmllcykpIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IG5ldyBQcm9taXNlPEZpbGU+KChyZXNvbHZlLCByZWplY3QpID0+IGZTRmlsZUVudHJ5LmZpbGUocmVzb2x2ZSwgcmVqZWN0KSk7XG4gICAgICAgIGF3YWl0IGZuLm9uVXBsb2FkTmV4dEZpbGUoZmlsZSwgKCkgPT4gKGRvbmUgPSB0cnVlKSk7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgaWYgKGRvbmUgPT09IHRydWUpIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICBjb25zdCBwYXRoID0gR2V0V2Via2l0UmVsYXRpdmVQYXRoKGZpbGUpICsgZmlsZS5uYW1lO1xuICAgICAgICBpZiAoIWZTRW50cnlTZXQuaGFzKHBhdGgpKSB7XG4gICAgICAgICAgZlNFbnRyeVNldC5hZGQocGF0aCk7XG4gICAgICAgICAgYXdhaXQgZm4ub25VcGxvYWROZXh0RmlsZShmaWxlLCAoKSA9PiAoZG9uZSA9IHRydWUpKTtcbiAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgaWYgKGRvbmUgPT09IHRydWUpIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgY29uc3QgY2hhbmdlSGFuZGxlciA9ICgpID0+IHtcbiAgICBqb2JRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgdXBsb2FkU3RhcnQoKTtcbiAgICAgIGlmIChkb25lID09PSBmYWxzZSAmJiBlbGVtZW50IGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCAmJiBlbGVtZW50LmZpbGVzKSB7XG4gICAgICAgIGF3YWl0IGl0ZXJhdGVGU0VudHJpZXMoR2V0V2Via2l0RW50cmllcyhlbGVtZW50KSA/PyBbXSwgZWxlbWVudC5maWxlcyk7XG4gICAgICB9XG4gICAgfSwgJ2NoYW5nZUhhbmRsZXInKTtcbiAgfTtcbiAgY29uc3QgZHJvcEhhbmRsZXIgPSAoZXZlbnQ6IERyYWdFdmVudCkgPT4ge1xuICAgIGpvYlF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCB1cGxvYWRTdGFydCgpO1xuICAgICAgaWYgKGRvbmUgPT09IGZhbHNlICYmIGV2ZW50LmRhdGFUcmFuc2Zlcikge1xuICAgICAgICBjb25zdCBkYXRhVHJhbnNmZXJJdGVtcyA9IG5ldyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3IoZXZlbnQuZGF0YVRyYW5zZmVyLml0ZW1zKTtcbiAgICAgICAgYXdhaXQgaXRlcmF0ZUZTRW50cmllcyhkYXRhVHJhbnNmZXJJdGVtcy5nZXRBc0VudHJ5KCksIGV2ZW50LmRhdGFUcmFuc2Zlci5maWxlcyk7XG4gICAgICB9XG4gICAgfSwgJ2Ryb3BIYW5kbGVyJyk7XG4gIH07XG4gIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgY2hhbmdlSGFuZGxlcik7XG4gIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGRyb3BIYW5kbGVyKTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIgfSBmcm9tICcuL2NvbXBvbmVudHMvZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci9kcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyLmpzJztcbmltcG9ydCB7IEpvYlF1ZXVlIH0gZnJvbSAnLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvSm9iUXVldWUuanMnO1xuXG4vLyAhIG9uZSBkYXkgdXNlIEV2ZW50TWFuYWdlclxuZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgKGV2ZW50KSA9PiBldmVudC5wcmV2ZW50RGVmYXVsdCgpKTtcblxuY29uc3QgZmlsZV9waWNrZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlcicpO1xuY29uc3QgbWFpbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ21haW4nKTtcblxubGV0IGltYWdlTG9hZENvdW50ID0gMDtcbmNvbnN0IGltYWdlTG9hZFF1ZXVlID0gbmV3IEpvYlF1ZXVlKC0xKTtcbmlmIChmaWxlX3BpY2tlcikge1xuICBzZXR1cERyYWdBbmREcm9wRmlsZVBpY2tlcihcbiAgICBmaWxlX3BpY2tlcixcbiAgICB7XG4gICAgICBvblVwbG9hZFN0YXJ0KCkge1xuICAgICAgICBmaWxlX3BpY2tlci5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcbiAgICAgICAgbWFpbj8ucmVwbGFjZUNoaWxkcmVuKCk7XG4gICAgICB9LFxuICAgICAgb25VcGxvYWROZXh0RmlsZTogYWRkSW1hZ2UsXG4gICAgICBvblVwbG9hZEVuZCgpIHtcbiAgICAgICAgaW1hZ2VMb2FkUXVldWUuZG9uZS50aGVuKCgpID0+IHtcbiAgICAgICAgICBpZiAoaW1hZ2VMb2FkQ291bnQgPT09IDApIHtcbiAgICAgICAgICAgIGZpbGVfcGlja2VyLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xuICAgICAgICAgICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICBkaXYuc3R5bGUuY29sb3IgPSAncmVkJztcbiAgICAgICAgICAgIGRpdi50ZXh0Q29udGVudCA9ICdObyBJbWFnZXMgRm91bmQhIFRyeSBhbm90aGVyIGZvbGRlci4nO1xuICAgICAgICAgICAgZmlsZV9waWNrZXIucXVlcnlTZWxlY3Rvcignc3BhbicpPy5hcHBlbmQoXG4gICAgICAgICAgICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JyJyksIC8vXG4gICAgICAgICAgICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JyJyksXG4gICAgICAgICAgICAgIGRpdixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBkaXJlY3Rvcnk6IHRydWUsXG4gICAgICBtdWx0aXBsZTogdHJ1ZSxcbiAgICB9LFxuICApO1xufVxuXG5mdW5jdGlvbiBhZGRJbWFnZShmaWxlOiBGaWxlKSB7XG4gIGltYWdlTG9hZFF1ZXVlLmFkZChcbiAgICAoKSA9PlxuICAgICAgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuICAgICAgICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgIG1haW4/LmFwcGVuZChkaXYpO1xuICAgICAgICAgIGltZy5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGZpbGUpO1xuICAgICAgICAgIGltZy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgZGl2LmFwcGVuZChpbWcpO1xuICAgICAgICAgICAgaW1hZ2VMb2FkQ291bnQrKztcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCAoKSA9PiB7XG4gICAgICAgICAgICBkaXYucmVtb3ZlKCk7XG4gICAgICAgICAgICByZWplY3QoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoXykge1xuICAgICAgICAgIHJlamVjdCgpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgKTtcbn1cbiIKICBdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxlQUFzQixLQUFLLENBQUMsSUFBWTtBQUN0QyxRQUFNLElBQUksUUFBUSxDQUFDLFlBQVksV0FBVyxTQUFTLEVBQUUsQ0FBQztBQUFBOzs7QUNFakQsTUFBTSxNQUFhO0FBQUEsRUFFRjtBQUFBLEVBRFosa0JBQWtCLElBQUk7QUFBQSxFQUNoQyxXQUFXLENBQVcsT0FBZTtBQUFmO0FBQUE7QUFBQSxFQUN0QixTQUFTLENBQUMsVUFBbUQ7QUFDM0QsU0FBSyxnQkFBZ0IsSUFBSSxRQUFRO0FBQ2pDLFFBQUksS0FBSyxVQUFVLFdBQVc7QUFDNUIsZUFBUyxLQUFLLE9BQU8sTUFBTTtBQUN6QixhQUFLLGdCQUFnQixPQUFPLFFBQVE7QUFBQSxPQUNyQztBQUFBLElBQ0g7QUFDQSxXQUFPLE1BQU07QUFDWCxXQUFLLGdCQUFnQixPQUFPLFFBQVE7QUFBQTtBQUFBO0FBQUEsRUFHeEMsR0FBRyxHQUFtQjtBQUNwQixXQUFPLElBQUksUUFBZSxDQUFDLFlBQVk7QUFDckMsV0FBSyxVQUFVLENBQUMsT0FBTyxnQkFBZ0I7QUFDckMsb0JBQVk7QUFDWixnQkFBUSxLQUFLO0FBQUEsT0FDZDtBQUFBLEtBQ0Y7QUFBQTtBQUFBLEVBRUgsR0FBRyxDQUFDLE9BQW9CO0FBQ3RCLFFBQUksS0FBSyxVQUFVLFdBQVc7QUFDNUIsV0FBSyxRQUFRO0FBQ2IsaUJBQVcsWUFBWSxLQUFLLGlCQUFpQjtBQUMzQyxpQkFBUyxPQUFPLE1BQU07QUFDcEIsZUFBSyxnQkFBZ0IsT0FBTyxRQUFRO0FBQUEsU0FDckM7QUFBQSxNQUNIO0FBQUEsSUFDRjtBQUFBO0FBRUo7QUFFTztBQUFBLE1BQU0sTUFBYTtBQUFBLEVBSVo7QUFBQSxFQUNBO0FBQUEsRUFKRjtBQUFBLEVBQ0Esa0JBQWtCLElBQUk7QUFBQSxFQUNoQyxXQUFXLENBQ0MsY0FDQSxxQkFB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
