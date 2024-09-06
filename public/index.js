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
      if (typeof FileSystemEntry !== 'undefined' && entry instanceof FileSystemEntry) {
        yield entry;
      } else {
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

// src/lib/ericchase/Web API/File.ts
function GetWebkitRelativePath(file) {
  if (typeof file.webkitRelativePath !== 'undefined') {
    return file.webkitRelativePath;
  }
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
      if (entry.isDirectory && entry instanceof FileSystemDirectoryEntry) {
        yield entry;
      }
    }
  }
  *getFileEntry() {
    for (const entry of this.list) {
      if (typeof FileSystemFileEntry !== 'undefined' && entry.isFile && entry instanceof FileSystemFileEntry) {
        yield entry;
      } else {
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

//# debugId=0C3DC91A8DFF5F9064756E2164756E21
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic3JjXFxsaWJcXGVyaWNjaGFzZVxcQWxnb3JpdGhtXFxTbGVlcC50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxEZXNpZ24gUGF0dGVyblxcT2JzZXJ2ZXJcXFN0b3JlLnRzIiwgInNyY1xcbGliXFxlcmljY2hhc2VcXFV0aWxpdHlcXENvbnNvbGUudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcVXRpbGl0eVxcSm9iUXVldWUudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcVXRpbGl0eVxcUmVjdXJzaXZlQXN5bmNJdGVyYXRvci50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxEYXRhVHJhbnNmZXIudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcV2ViIEFQSVxcRmlsZS50cyIsICJzcmNcXGxpYlxcZXJpY2NoYXNlXFxXZWIgQVBJXFxGaWxlU3lzdGVtX1V0aWxpdHkudHMiLCAic3JjXFxsaWJcXGVyaWNjaGFzZVxcV2ViIEFQSVxcSFRNTElucHV0RWxlbWVudC50cyIsICJzcmNcXGNvbXBvbmVudHNcXGRyYWctYW5kLWRyb3AtZmlsZS1waWNrZXJcXGRyYWctYW5kLWRyb3AtZmlsZS1waWNrZXIudHMiLCAic3JjXFxpbmRleC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsKICAgICJleHBvcnQgYXN5bmMgZnVuY3Rpb24gU2xlZXAobXM6IG51bWJlcikge1xuICBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSkgPT4gc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xufVxuIiwKICAgICJleHBvcnQgdHlwZSBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4gPSAodmFsdWU6IFZhbHVlLCB1bnN1YnNjcmliZTogKCkgPT4gdm9pZCkgPT4gdm9pZDtcbmV4cG9ydCB0eXBlIFVwZGF0ZUNhbGxiYWNrPFZhbHVlPiA9ICh2YWx1ZTogVmFsdWUpID0+IFZhbHVlO1xuXG5leHBvcnQgY2xhc3MgQ29uc3Q8VmFsdWU+IHtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+PigpO1xuICBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgdmFsdWU/OiBWYWx1ZSkge31cbiAgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxWYWx1ZT4pOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5hZGQoY2FsbGJhY2spO1xuICAgIGlmICh0aGlzLnZhbHVlICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIGNhbGxiYWNrKHRoaXMudmFsdWUsICgpID0+IHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICB9XG4gIGdldCgpOiBQcm9taXNlPFZhbHVlPiB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlPFZhbHVlPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgICB1bnN1YnNjcmliZSgpO1xuICAgICAgICByZXNvbHZlKHZhbHVlKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIHNldCh2YWx1ZTogVmFsdWUpOiB2b2lkIHtcbiAgICBpZiAodGhpcy52YWx1ZSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICAgIGNhbGxiYWNrKHZhbHVlLCAoKSA9PiB7XG4gICAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBTdG9yZTxWYWx1ZT4ge1xuICBwcm90ZWN0ZWQgY3VycmVudFZhbHVlOiBWYWx1ZTtcbiAgcHJvdGVjdGVkIHN1YnNjcmlwdGlvblNldCA9IG5ldyBTZXQ8U3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+PigpO1xuICBjb25zdHJ1Y3RvcihcbiAgICBwcm90ZWN0ZWQgaW5pdGlhbFZhbHVlOiBWYWx1ZSxcbiAgICBwcm90ZWN0ZWQgbm90aWZ5T25DaGFuZ2VPbmx5OiBib29sZWFuID0gZmFsc2UsXG4gICkge1xuICAgIHRoaXMuY3VycmVudFZhbHVlID0gaW5pdGlhbFZhbHVlO1xuICB9XG4gIHN1YnNjcmliZShjYWxsYmFjazogU3Vic2NyaXB0aW9uQ2FsbGJhY2s8VmFsdWU+KTogKCkgPT4gdm9pZCB7XG4gICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuYWRkKGNhbGxiYWNrKTtcbiAgICBjb25zdCB1bnN1YnNjcmliZSA9ICgpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaXB0aW9uU2V0LmRlbGV0ZShjYWxsYmFjayk7XG4gICAgfTtcbiAgICBjYWxsYmFjayh0aGlzLmN1cnJlbnRWYWx1ZSwgdW5zdWJzY3JpYmUpO1xuICAgIHJldHVybiB1bnN1YnNjcmliZTtcbiAgfVxuICBnZXQoKTogUHJvbWlzZTxWYWx1ZT4ge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTxWYWx1ZT4oKHJlc29sdmUpID0+IHtcbiAgICAgIHRoaXMuc3Vic2NyaWJlKCh2YWx1ZSwgdW5zdWJzY3JpYmUpID0+IHtcbiAgICAgICAgdW5zdWJzY3JpYmUoKTtcbiAgICAgICAgcmVzb2x2ZSh2YWx1ZSk7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfVxuICBzZXQodmFsdWU6IFZhbHVlKTogdm9pZCB7XG4gICAgaWYgKHRoaXMubm90aWZ5T25DaGFuZ2VPbmx5ICYmIHRoaXMuY3VycmVudFZhbHVlID09PSB2YWx1ZSkgcmV0dXJuO1xuICAgIHRoaXMuY3VycmVudFZhbHVlID0gdmFsdWU7XG4gICAgZm9yIChjb25zdCBjYWxsYmFjayBvZiB0aGlzLnN1YnNjcmlwdGlvblNldCkge1xuICAgICAgY2FsbGJhY2sodmFsdWUsICgpID0+IHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuICB1cGRhdGUoY2FsbGJhY2s6IFVwZGF0ZUNhbGxiYWNrPFZhbHVlPik6IHZvaWQge1xuICAgIHRoaXMuc2V0KGNhbGxiYWNrKHRoaXMuY3VycmVudFZhbHVlKSk7XG4gIH1cbn1cblxuZXhwb3J0IGNsYXNzIE9wdGlvbmFsPFZhbHVlPiB7XG4gIHByb3RlY3RlZCBzdG9yZTogU3RvcmU8VmFsdWUgfCB1bmRlZmluZWQ+O1xuICBjb25zdHJ1Y3Rvcihub3RpZnlPbkNoYW5nZU9ubHkgPSBmYWxzZSkge1xuICAgIHRoaXMuc3RvcmUgPSBuZXcgU3RvcmU8VmFsdWUgfCB1bmRlZmluZWQ+KHVuZGVmaW5lZCwgbm90aWZ5T25DaGFuZ2VPbmx5KTtcbiAgfVxuICBzdWJzY3JpYmUoY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPFZhbHVlIHwgdW5kZWZpbmVkPik6ICgpID0+IHZvaWQge1xuICAgIHJldHVybiB0aGlzLnN0b3JlLnN1YnNjcmliZShjYWxsYmFjayk7XG4gIH1cbiAgZ2V0KCk6IFByb21pc2U8VmFsdWUgfCB1bmRlZmluZWQ+IHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8VmFsdWUgfCB1bmRlZmluZWQ+KChyZXNvbHZlKSA9PiB7XG4gICAgICB0aGlzLnN1YnNjcmliZSgodmFsdWUsIHVuc3Vic2NyaWJlKSA9PiB7XG4gICAgICAgIHVuc3Vic2NyaWJlKCk7XG4gICAgICAgIHJlc29sdmUodmFsdWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cbiAgc2V0KHZhbHVlOiBWYWx1ZSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUuc2V0KHZhbHVlKTtcbiAgfVxuICB1cGRhdGUoY2FsbGJhY2s6IFVwZGF0ZUNhbGxiYWNrPFZhbHVlIHwgdW5kZWZpbmVkPik6IHZvaWQge1xuICAgIHRoaXMuc3RvcmUudXBkYXRlKGNhbGxiYWNrKTtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gQ29tcG91bmRTdWJzY3JpcHRpb248VCBleHRlbmRzIGFueVtdPihzdG9yZXM6IHsgW0sgaW4ga2V5b2YgVF06IFN0b3JlPFRbS10+IHwgT3B0aW9uYWw8VFtLXT4gfSwgY2FsbGJhY2s6IFN1YnNjcmlwdGlvbkNhbGxiYWNrPHsgW0sgaW4ga2V5b2YgVF06IFRbS10gfCB1bmRlZmluZWQgfT4pOiAoKSA9PiB2b2lkIHtcbiAgY29uc3QgdW5zdWJzOiAoKCkgPT4gdm9pZClbXSA9IFtdO1xuICBjb25zdCB1bnN1YnNjcmliZSA9ICgpID0+IHtcbiAgICBmb3IgKGNvbnN0IHVuc3ViIG9mIHVuc3Vicykge1xuICAgICAgdW5zdWIoKTtcbiAgICB9XG4gIH07XG4gIGNvbnN0IHZhbHVlcyA9IFtdIGFzIHsgW0sgaW4ga2V5b2YgVF06IFRbS10gfCB1bmRlZmluZWQgfTtcbiAgY29uc3QgY2FsbGJhY2tfaGFuZGxlciA9ICgpID0+IHtcbiAgICBpZiAodmFsdWVzLmxlbmd0aCA9PT0gc3RvcmVzLmxlbmd0aCkge1xuICAgICAgY2FsbGJhY2sodmFsdWVzLCB1bnN1YnNjcmliZSk7XG4gICAgfVxuICB9O1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHN0b3Jlcy5sZW5ndGg7IGkrKykge1xuICAgIHN0b3Jlc1tpXS5zdWJzY3JpYmUoKHZhbHVlLCB1bnN1YnNjcmliZSkgPT4ge1xuICAgICAgdmFsdWVzW2ldID0gdmFsdWU7XG4gICAgICB1bnN1YnNbaV0gPSB1bnN1YnNjcmliZTtcbiAgICAgIGlmICh2YWx1ZXMubGVuZ3RoID09PSBzdG9yZXMubGVuZ3RoKSB7XG4gICAgICAgIGNhbGxiYWNrX2hhbmRsZXIoKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICByZXR1cm4gdW5zdWJzY3JpYmU7XG59XG4iLAogICAgImV4cG9ydCBmdW5jdGlvbiBDb25zb2xlTG9nKC4uLml0ZW1zOiBhbnlbXSkge1xuICBjb25zb2xlWydsb2cnXSguLi5pdGVtcyk7XG59XG5leHBvcnQgZnVuY3Rpb24gQ29uc29sZUVycm9yKC4uLml0ZW1zOiBhbnlbXSkge1xuICBjb25zb2xlWydlcnJvciddKC4uLml0ZW1zKTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgU3RvcmUgfSBmcm9tICcuLi9EZXNpZ24gUGF0dGVybi9PYnNlcnZlci9TdG9yZS5qcyc7XG5pbXBvcnQgeyBDb25zb2xlTG9nIH0gZnJvbSAnLi9Db25zb2xlLmpzJztcblxuZXhwb3J0IHR5cGUgU3Vic2NyaXB0aW9uQ2FsbGJhY2s8UmVzdWx0LCBUYWc+ID0gKHJlc3VsdD86IFJlc3VsdCwgZXJyb3I/OiBFcnJvciwgdGFnPzogVGFnKSA9PiB7IGFib3J0OiBib29sZWFuIH0gfCB2b2lkO1xuXG5leHBvcnQgY2xhc3MgSm9iUXVldWU8UmVzdWx0ID0gdm9pZCwgVGFnID0gdm9pZD4ge1xuICAvKipcbiAgICogMDogTm8gZGVsYXkuIC0xOiBDb25zZWN1dGl2ZS5cbiAgICovXG4gIGNvbnN0cnVjdG9yKHB1YmxpYyBkZWxheV9tczogbnVtYmVyKSB7fVxuICAvKipcbiAgICogISBXYXRjaCBvdXQgZm9yIGNpcmN1bGFyIGNhbGxzICFcbiAgICpcbiAgICogU2V0cyB0aGUgYGFib3J0ZWRgIHN0YXRlIGFuZCByZXNvbHZlcyB3aGVuIGN1cnJlbnRseSBydW5uaW5nIGpvYnMgZmluaXNoLlxuICAgKi9cbiAgcHVibGljIGFzeW5jIGFib3J0KCkge1xuICAgIHRoaXMuYWJvcnRlZCA9IHRydWU7XG4gICAgYXdhaXQgdGhpcy5kb25lO1xuICB9XG4gIHB1YmxpYyBhZGQoZm46ICgpID0+IFByb21pc2U8UmVzdWx0PiwgdGFnPzogVGFnKSB7XG4gICAgaWYgKHRoaXMuYWJvcnRlZCA9PT0gZmFsc2UpIHtcbiAgICAgIHRoaXMucXVldWUucHVzaCh7IGZuLCB0YWcgfSk7XG4gICAgICBpZiAodGhpcy5ydW5uaW5nID09PSBmYWxzZSkge1xuICAgICAgICB0aGlzLnJ1bm5pbmcgPSB0cnVlO1xuICAgICAgICB0aGlzLnJ1bigpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAvKipcbiAgICogUmV0dXJucyBhIHByb21pc2UgdGhhdCByZXNvbHZlcyB3aGVuIGpvYnMgZmluaXNoLlxuICAgKi9cbiAgcHVibGljIGdldCBkb25lKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigocmVzb2x2ZSkgPT4ge1xuICAgICAgdGhpcy5ydW5uaW5nQ291bnQuc3Vic2NyaWJlKChjb3VudCkgPT4ge1xuICAgICAgICBpZiAoY291bnQgPT09IDApIHJlc29sdmUoKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG4gIC8qKlxuICAgKiBSZXNldHMgdGhlIEpvYlF1ZXVlIHRvIGFuIGluaXRpYWwgc3RhdGUsIGtlZXBpbmcgc3Vic2NyaXB0aW9ucyBhbGl2ZS5cbiAgICpcbiAgICogQHRocm93cyBJZiBjYWxsZWQgd2hlbiBqb2JzIGFyZSBjdXJyZW50bHkgcnVubmluZy5cbiAgICovXG4gIHB1YmxpYyBhc3luYyByZXNldCgpIHtcbiAgICBpZiAodGhpcy5ydW5uaW5nID09PSB0cnVlIHx8IChhd2FpdCB0aGlzLnJ1bm5pbmdDb3VudC5nZXQoKSkgPiAwKSB7XG4gICAgICB0aHJvdyAnV2FybmluZzogV2FpdCBmb3IgcnVubmluZyBqb2JzIHRvIGZpbmlzaCBiZWZvcmUgY2FsbGluZyByZXNldC4gYGF3YWl0IEpvYlF1ZXVlLmRvbmU7YCc7XG4gICAgfVxuICAgIHRoaXMuYWJvcnRlZCA9IGZhbHNlO1xuICAgIHRoaXMuY29tcGxldGlvbkNvdW50ID0gMDtcbiAgICB0aGlzLnF1ZXVlLmxlbmd0aCA9IDA7XG4gICAgdGhpcy5xdWV1ZUluZGV4ID0gMDtcbiAgICB0aGlzLnJlc3VsdHMubGVuZ3RoID0gMDtcbiAgfVxuICBwdWJsaWMgc3Vic2NyaWJlKGNhbGxiYWNrOiBTdWJzY3JpcHRpb25DYWxsYmFjazxSZXN1bHQsIFRhZz4pOiAoKSA9PiB2b2lkIHtcbiAgICB0aGlzLnN1YnNjcmlwdGlvblNldC5hZGQoY2FsbGJhY2spO1xuICAgIGZvciAoY29uc3QgcmVzdWx0IG9mIHRoaXMucmVzdWx0cykge1xuICAgICAgaWYgKGNhbGxiYWNrKHJlc3VsdC52YWx1ZSwgcmVzdWx0LmVycm9yKT8uYWJvcnQgPT09IHRydWUpIHtcbiAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgcmV0dXJuICgpID0+IHt9O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gKCkgPT4ge1xuICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICB9O1xuICB9XG4gIHByb3RlY3RlZCBhYm9ydGVkID0gZmFsc2U7XG4gIHByb3RlY3RlZCBjb21wbGV0aW9uQ291bnQgPSAwO1xuICBwcm90ZWN0ZWQgcXVldWU6IHsgZm46ICgpID0+IFByb21pc2U8UmVzdWx0PjsgdGFnPzogVGFnIH1bXSA9IFtdO1xuICBwcm90ZWN0ZWQgcXVldWVJbmRleCA9IDA7XG4gIHByb3RlY3RlZCByZXN1bHRzOiB7IHZhbHVlPzogUmVzdWx0OyBlcnJvcj86IEVycm9yIH1bXSA9IFtdO1xuICBwcm90ZWN0ZWQgcnVubmluZyA9IGZhbHNlO1xuICBwcm90ZWN0ZWQgcnVubmluZ0NvdW50ID0gbmV3IFN0b3JlKDApO1xuICBwcm90ZWN0ZWQgc3Vic2NyaXB0aW9uU2V0ID0gbmV3IFNldDxTdWJzY3JpcHRpb25DYWxsYmFjazxSZXN1bHQsIFRhZz4+KCk7XG4gIHByb3RlY3RlZCBydW4oKSB7XG4gICAgaWYgKHRoaXMuYWJvcnRlZCA9PT0gZmFsc2UgJiYgdGhpcy5xdWV1ZUluZGV4IDwgdGhpcy5xdWV1ZS5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHsgZm4sIHRhZyB9ID0gdGhpcy5xdWV1ZVt0aGlzLnF1ZXVlSW5kZXgrK107XG4gICAgICAoYXN5bmMgKCkgPT4ge1xuICAgICAgICB0aGlzLnJ1bm5pbmdDb3VudC51cGRhdGUoKGNvdW50KSA9PiB7XG4gICAgICAgICAgcmV0dXJuIGNvdW50ICsgMTtcbiAgICAgICAgfSk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29uc3QgdmFsdWUgPSBhd2FpdCBmbigpO1xuICAgICAgICAgIHRoaXMuc2VuZCh7IHZhbHVlLCB0YWcgfSk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICBDb25zb2xlTG9nKGVycm9yKTtcbiAgICAgICAgICB0aGlzLnNlbmQoeyBlcnJvciwgdGFnIH0pO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMucnVubmluZ0NvdW50LnVwZGF0ZSgoY291bnQpID0+IHtcbiAgICAgICAgICByZXR1cm4gY291bnQgLSAxO1xuICAgICAgICB9KTtcbiAgICAgICAgaWYgKHRoaXMuZGVsYXlfbXMgPCAwKSB7XG4gICAgICAgICAgdGhpcy5ydW4oKTtcbiAgICAgICAgfVxuICAgICAgfSkoKTtcbiAgICAgIGlmICh0aGlzLmRlbGF5X21zID49IDApIHtcbiAgICAgICAgc2V0VGltZW91dCgoKSA9PiB0aGlzLnJ1bigpLCB0aGlzLmRlbGF5X21zKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5ydW5uaW5nID0gZmFsc2U7XG4gICAgfVxuICB9XG4gIHByb3RlY3RlZCBzZW5kKHJlc3VsdDogeyB2YWx1ZT86IFJlc3VsdDsgZXJyb3I/OiBFcnJvcjsgdGFnPzogVGFnIH0pIHtcbiAgICBpZiAodGhpcy5hYm9ydGVkID09PSBmYWxzZSkge1xuICAgICAgdGhpcy5jb21wbGV0aW9uQ291bnQrKztcbiAgICAgIHRoaXMucmVzdWx0cy5wdXNoKHJlc3VsdCk7XG4gICAgICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIHRoaXMuc3Vic2NyaXB0aW9uU2V0KSB7XG4gICAgICAgIGlmIChjYWxsYmFjayhyZXN1bHQudmFsdWUsIHJlc3VsdC5lcnJvciwgcmVzdWx0LnRhZyk/LmFib3J0ID09PSB0cnVlKSB7XG4gICAgICAgICAgdGhpcy5zdWJzY3JpcHRpb25TZXQuZGVsZXRlKGNhbGxiYWNrKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuIiwKICAgICJpbXBvcnQgdHlwZSB7IFN5bmNBc3luY0l0ZXJhYmxlIH0gZnJvbSAnLi9UeXBlcy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBSZWN1cnNpdmVJdGVyYXRvcjxJbiwgT3V0PiB7XG4gIGNvbnN0cnVjdG9yKHByb3RlY3RlZCBmbjogKHZhbHVlOiBTeW5jQXN5bmNJdGVyYWJsZTxJbj4sIHB1c2g6ICh2YWx1ZTogU3luY0FzeW5jSXRlcmFibGU8SW4+KSA9PiB2b2lkKSA9PiBTeW5jQXN5bmNJdGVyYWJsZTxPdXQ+KSB7fVxuICBhc3luYyAqaXRlcmF0ZShpbml0OiBTeW5jQXN5bmNJdGVyYWJsZTxJbj4pOiBTeW5jQXN5bmNJdGVyYWJsZTxPdXQ+IHtcbiAgICBjb25zdCBsaXN0OiBTeW5jQXN5bmNJdGVyYWJsZTxJbj5bXSA9IFtpbml0XTtcbiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGxpc3QubGVuZ3RoOyBpKyspIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZlNFbnRyeSBvZiB0aGlzLmZuKGxpc3RbaV0sICh2YWx1ZSkgPT4ge1xuICAgICAgICBsaXN0LnB1c2godmFsdWUpO1xuICAgICAgfSkpIHtcbiAgICAgICAgeWllbGQgZlNFbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiaW1wb3J0IHR5cGUgeyBOIH0gZnJvbSAnLi4vVXRpbGl0eS9UeXBlcy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3Ige1xuICBsaXN0OiBEYXRhVHJhbnNmZXJJdGVtW10gPSBbXTtcbiAgY29uc3RydWN0b3IoaXRlbXM/OiBOPERhdGFUcmFuc2Zlckl0ZW0+IHwgRGF0YVRyYW5zZmVySXRlbUxpc3QgfCBudWxsKSB7XG4gICAgaWYgKGl0ZW1zIGluc3RhbmNlb2YgRGF0YVRyYW5zZmVySXRlbSkge1xuICAgICAgdGhpcy5saXN0ID0gW2l0ZW1zXTtcbiAgICB9IGVsc2UgaWYgKGl0ZW1zIGluc3RhbmNlb2YgRGF0YVRyYW5zZmVySXRlbUxpc3QpIHtcbiAgICAgIHRoaXMubGlzdCA9IEFycmF5LmZyb20oaXRlbXMpO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShpdGVtcykpIHtcbiAgICAgIHRoaXMubGlzdCA9IGl0ZW1zO1xuICAgIH1cbiAgfVxuICAqZ2V0QXNFbnRyeSgpOiBHZW5lcmF0b3I8RmlsZVN5c3RlbUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgZW50cnkgPSAoaXRlbSBhcyBEYXRhVHJhbnNmZXJJdGVtICYgeyBnZXRBc0VudHJ5PzogRGF0YVRyYW5zZmVySXRlbVsnd2Via2l0R2V0QXNFbnRyeSddIH0pLmdldEFzRW50cnk/LigpID8/IGl0ZW0ud2Via2l0R2V0QXNFbnRyeT8uKCk7XG4gICAgICBpZiAodHlwZW9mIEZpbGVTeXN0ZW1FbnRyeSAhPT0gJ3VuZGVmaW5lZCcgJiYgZW50cnkgaW5zdGFuY2VvZiBGaWxlU3lzdGVtRW50cnkpIHtcbiAgICAgICAgeWllbGQgZW50cnk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBUT0RPIGZpZ3VyZSBvdXQgd2hhdCBuZWVkcyB0byBiZSBkb25lIHRvIGd1YXJkIHRoaXMgZm9yIGNocm9tZSBhbmQgb3RoZXIgYnJvd3NlcnNcbiAgICAgICAgeWllbGQgZW50cnkgYXMgRmlsZVN5c3RlbUVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqZ2V0QXNGaWxlKCk6IEdlbmVyYXRvcjxGaWxlPiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgY29uc3QgZmlsZSA9IGl0ZW0uZ2V0QXNGaWxlPy4oKTtcbiAgICAgIGlmIChmaWxlIGluc3RhbmNlb2YgRmlsZSkge1xuICAgICAgICB5aWVsZCBmaWxlO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICBhc3luYyAqZ2V0QXNTdHJpbmcoKTogQXN5bmNHZW5lcmF0b3I8c3RyaW5nPiB7XG4gICAgZm9yIChjb25zdCBpdGVtIG9mIHRoaXMubGlzdCkge1xuICAgICAgeWllbGQgYXdhaXQgbmV3IFByb21pc2U8c3RyaW5nPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgaXRlbS5nZXRBc1N0cmluZyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGl0ZW0uZ2V0QXNTdHJpbmcocmVzb2x2ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVqZWN0KCk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIiwKICAgICJpbXBvcnQgeyBVOFN0cmVhbVJlYWRBbGwgfSBmcm9tICcuLi9BbGdvcml0aG0vU3RyZWFtL1JlYWRBbGwuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gR2V0V2Via2l0UmVsYXRpdmVQYXRoKGZpbGU6IEZpbGUpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuICBpZiAodHlwZW9mIGZpbGUud2Via2l0UmVsYXRpdmVQYXRoICE9PSAndW5kZWZpbmVkJykge1xuICAgIHJldHVybiBmaWxlLndlYmtpdFJlbGF0aXZlUGF0aDtcbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gR2V0Qnl0ZXMoZmlsZT86IEZpbGUpIHtcbiAgaWYgKGZpbGUpIHtcbiAgICBpZiAodHlwZW9mIGZpbGUuYnl0ZXMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXR1cm4gZmlsZS5ieXRlcygpO1xuICAgIH1cbiAgICByZXR1cm4gVThTdHJlYW1SZWFkQWxsKGZpbGUuc3RyZWFtKCkpO1xuICB9XG59XG4iLAogICAgImV4cG9ydCBjbGFzcyBGaWxlU3lzdGVtRW50cnlJdGVyYXRvciB7XG4gIGxpc3Q6IEZpbGVTeXN0ZW1FbnRyeVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGVudHJpZXM/OiBGaWxlU3lzdGVtRW50cnkgfCBGaWxlU3lzdGVtRW50cnlbXSB8IG51bGwpIHtcbiAgICBpZiAoZW50cmllcykge1xuICAgICAgaWYgKEFycmF5LmlzQXJyYXkoZW50cmllcykpIHtcbiAgICAgICAgdGhpcy5saXN0ID0gZW50cmllcztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMubGlzdCA9IFtlbnRyaWVzXTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgKmdldERpcmVjdG9yeUVudHJ5KCk6IEdlbmVyYXRvcjxGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnk+IHtcbiAgICBmb3IgKGNvbnN0IGVudHJ5IG9mIHRoaXMubGlzdCkge1xuICAgICAgaWYgKGVudHJ5LmlzRGlyZWN0b3J5ICYmIGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbURpcmVjdG9yeUVudHJ5KSB7XG4gICAgICAgIHlpZWxkIGVudHJ5O1xuICAgICAgfVxuICAgIH1cbiAgfVxuICAqZ2V0RmlsZUVudHJ5KCk6IEdlbmVyYXRvcjxGaWxlU3lzdGVtRmlsZUVudHJ5PiB7XG4gICAgZm9yIChjb25zdCBlbnRyeSBvZiB0aGlzLmxpc3QpIHtcbiAgICAgIGlmICh0eXBlb2YgRmlsZVN5c3RlbUZpbGVFbnRyeSAhPT0gJ3VuZGVmaW5lZCcgJiYgZW50cnkuaXNGaWxlICYmIGVudHJ5IGluc3RhbmNlb2YgRmlsZVN5c3RlbUZpbGVFbnRyeSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHlpZWxkIGVudHJ5IGFzIEZpbGVTeXN0ZW1GaWxlRW50cnk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmV4cG9ydCBjbGFzcyBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlJdGVyYXRvciB7XG4gIGxpc3Q6IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeVtdID0gW107XG4gIGNvbnN0cnVjdG9yKGVudHJpZXM/OiBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnkgfCBGaWxlU3lzdGVtRGlyZWN0b3J5RW50cnlbXSB8IG51bGwpIHtcbiAgICBpZiAoZW50cmllcyBpbnN0YW5jZW9mIEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeSkge1xuICAgICAgdGhpcy5saXN0ID0gW2VudHJpZXNdO1xuICAgIH0gZWxzZSBpZiAoQXJyYXkuaXNBcnJheShlbnRyaWVzKSkge1xuICAgICAgdGhpcy5saXN0ID0gZW50cmllcztcbiAgICB9XG4gIH1cbiAgYXN5bmMgKmdldEVudHJ5KCk6IEFzeW5jR2VuZXJhdG9yPEZpbGVTeXN0ZW1FbnRyeT4ge1xuICAgIGZvciAoY29uc3QgZW50cnkgb2YgdGhpcy5saXN0KSB7XG4gICAgICBjb25zdCByZWFkZXIgPSBlbnRyeS5jcmVhdGVSZWFkZXIoKTtcbiAgICAgIGZvciAoY29uc3QgZW50cnkgb2YgYXdhaXQgbmV3IFByb21pc2U8RmlsZVN5c3RlbUVudHJ5W10+KChyZXNvbHZlLCByZWplY3QpID0+IHJlYWRlci5yZWFkRW50cmllcyhyZXNvbHZlLCByZWplY3QpKSkge1xuICAgICAgICB5aWVsZCBlbnRyeTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cbiIsCiAgICAiLy8gV2Via2l0IEd1YXJkc1xuXG5leHBvcnQgZnVuY3Rpb24gR2V0V2Via2l0RW50cmllcyhlbGVtZW50OiBIVE1MSW5wdXRFbGVtZW50KTogcmVhZG9ubHkgRmlsZVN5c3RlbUVudHJ5W10gfCB1bmRlZmluZWQge1xuICByZXR1cm4gZWxlbWVudC53ZWJraXRFbnRyaWVzID8/IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIFN1cHBvcnRzV2Via2l0RGlyZWN0b3J5KCk6IGJvb2xlYW4ge1xuICByZXR1cm4gL2FuZHJvaWR8aXBob25lfG1vYmlsZS9pLnRlc3Qod2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQpID09PSB0cnVlID8gZmFsc2UgOiB0cnVlO1xufVxuIiwKICAgICJpbXBvcnQgeyBTbGVlcCB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvQWxnb3JpdGhtL1NsZWVwLmpzJztcbmltcG9ydCB7IEpvYlF1ZXVlIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L0pvYlF1ZXVlLmpzJztcbmltcG9ydCB7IFJlY3Vyc2l2ZUl0ZXJhdG9yIH0gZnJvbSAnLi4vLi4vbGliL2VyaWNjaGFzZS9VdGlsaXR5L1JlY3Vyc2l2ZUFzeW5jSXRlcmF0b3IuanMnO1xuaW1wb3J0IHR5cGUgeyBTeW5jQXN5bmNJdGVyYWJsZSB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvVXRpbGl0eS9UeXBlcy5qcyc7XG5pbXBvcnQgeyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3IgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvRGF0YVRyYW5zZmVyLmpzJztcbmltcG9ydCB7IEdldFdlYmtpdFJlbGF0aXZlUGF0aCB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvV2ViIEFQSS9GaWxlLmpzJztcbmltcG9ydCB7IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yLCBGaWxlU3lzdGVtRW50cnlJdGVyYXRvciB9IGZyb20gJy4uLy4uL2xpYi9lcmljY2hhc2UvV2ViIEFQSS9GaWxlU3lzdGVtX1V0aWxpdHkuanMnO1xuaW1wb3J0IHsgR2V0V2Via2l0RW50cmllcywgU3VwcG9ydHNXZWJraXREaXJlY3RvcnkgfSBmcm9tICcuLi8uLi9saWIvZXJpY2NoYXNlL1dlYiBBUEkvSFRNTElucHV0RWxlbWVudC5qcyc7XG5cbmV4cG9ydCBmdW5jdGlvbiBzZXR1cERyYWdBbmREcm9wRmlsZVBpY2tlcihcbiAgY29udGFpbmVyOiBFbGVtZW50LFxuICBmbjoge1xuICAgIG9uRHJhZ0VuZD86ICgpID0+IHZvaWQ7XG4gICAgb25EcmFnRW50ZXI/OiAoKSA9PiB2b2lkO1xuICAgIG9uRHJhZ0xlYXZlPzogKCkgPT4gdm9pZDtcbiAgICBvbkRyb3A/OiAoKSA9PiB2b2lkO1xuICAgIG9uVXBsb2FkRW5kPzogKCkgPT4gdm9pZCB8IFByb21pc2U8dm9pZD47XG4gICAgb25VcGxvYWRFcnJvcj86IChlcnJvcjogYW55KSA9PiB2b2lkIHwgUHJvbWlzZTx2b2lkPjtcbiAgICBvblVwbG9hZE5leHRGaWxlOiAoZmlsZTogRmlsZSwgZG9uZTogKCkgPT4gdm9pZCkgPT4gUHJvbWlzZTx2b2lkPiB8IHZvaWQ7XG4gICAgb25VcGxvYWRTdGFydD86ICgpID0+IHZvaWQgfCBQcm9taXNlPHZvaWQ+O1xuICB9LFxuICBvcHRpb25zPzoge1xuICAgIGFjY2VwdD86IHN0cmluZztcbiAgICBkaXJlY3Rvcnk/OiBib29sZWFuO1xuICAgIG11bHRpcGxlPzogYm9vbGVhbjtcbiAgfSxcbikge1xuICBjb25zdCBlbGVtZW50ID0gY29udGFpbmVyLnF1ZXJ5U2VsZWN0b3IoJ2lucHV0Jyk7XG4gIGlmICghZWxlbWVudCkge1xuICAgIHRocm93ICdkcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyIGlucHV0IGVsZW1lbnQgbWlzc2luZyc7XG4gIH1cbiAgaWYgKG9wdGlvbnM/LmFjY2VwdCkge1xuICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKCdhY2NlcHQnLCBvcHRpb25zLmFjY2VwdCk7XG4gIH1cbiAgaWYgKG9wdGlvbnM/LmRpcmVjdG9yeSA9PT0gdHJ1ZSAmJiBTdXBwb3J0c1dlYmtpdERpcmVjdG9yeSgpKSB7XG4gICAgZWxlbWVudC50b2dnbGVBdHRyaWJ1dGUoJ3dlYmtpdGRpcmVjdG9yeScsIHRydWUpO1xuICB9XG4gIGlmIChvcHRpb25zPy5tdWx0aXBsZSA9PT0gdHJ1ZSkge1xuICAgIGVsZW1lbnQudG9nZ2xlQXR0cmlidXRlKCdtdWx0aXBsZScsIHRydWUpO1xuICB9XG5cbiAgaWYgKGZuLm9uRHJhZ0VuZCB8fCBmbi5vbkRyYWdFbnRlciB8fCBmbi5vbkRyYWdMZWF2ZSkge1xuICAgIGNvbnN0IHJlbW92ZUxpc3RlbmVycyA9ICgpID0+IHtcbiAgICAgIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJhZ2xlYXZlJywgZHJhZ2xlYXZlSGFuZGxlcik7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdlbmQnLCBkcmFnZW5kSGFuZGxlcik7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2Ryb3AnLCBkcm9wSGFuZGxlcik7XG4gICAgfTtcbiAgICBjb25zdCBkcmFnZW5kSGFuZGxlciA9ICgpID0+IHtcbiAgICAgIHJlbW92ZUxpc3RlbmVycygpO1xuICAgICAgZm4ub25EcmFnRW5kPy4oKTtcbiAgICB9O1xuICAgIGNvbnN0IGRyYWdsZWF2ZUhhbmRsZXIgPSAoKSA9PiB7XG4gICAgICByZW1vdmVMaXN0ZW5lcnMoKTtcbiAgICAgIGZuLm9uRHJhZ0xlYXZlPy4oKTtcbiAgICB9O1xuICAgIGNvbnN0IGRyb3BIYW5kbGVyID0gKCkgPT4ge1xuICAgICAgcmVtb3ZlTGlzdGVuZXJzKCk7XG4gICAgICBmbi5vbkRyb3A/LigpO1xuICAgIH07XG4gICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW50ZXInLCAoKSA9PiB7XG4gICAgICBlbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdsZWF2ZScsIGRyYWdsZWF2ZUhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcmFnZW5kJywgZHJhZ2VuZEhhbmRsZXIpO1xuICAgICAgZWxlbWVudC5hZGRFdmVudExpc3RlbmVyKCdkcm9wJywgZHJvcEhhbmRsZXIpO1xuICAgICAgZm4ub25EcmFnRW50ZXI/LigpO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZlNFbnRyeVNldCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuICBjb25zdCBmU0VudHJ5SXRlcmF0b3IgPSBuZXcgUmVjdXJzaXZlSXRlcmF0b3I8RmlsZVN5c3RlbUVudHJ5LCBGaWxlU3lzdGVtRmlsZUVudHJ5Pihhc3luYyBmdW5jdGlvbiogKGZTRW50cnlJdGVyYXRvciwgcHVzaCkge1xuICAgIGZvciBhd2FpdCAoY29uc3QgZlNFbnRyeSBvZiBmU0VudHJ5SXRlcmF0b3IpIHtcbiAgICAgIGNvbnN0IHBhdGggPSBmU0VudHJ5LmZ1bGxQYXRoLnNsaWNlKDEpO1xuICAgICAgaWYgKCFmU0VudHJ5U2V0LmhhcyhwYXRoKSkge1xuICAgICAgICBmU0VudHJ5U2V0LmFkZChwYXRoKTtcbiAgICAgICAgY29uc3QgZnNFbnRyaWVzID0gbmV3IEZpbGVTeXN0ZW1FbnRyeUl0ZXJhdG9yKGZTRW50cnkpO1xuICAgICAgICBmb3IgKGNvbnN0IGZTRmlsZUVudHJ5IG9mIGZzRW50cmllcy5nZXRGaWxlRW50cnkoKSkge1xuICAgICAgICAgIHlpZWxkIGZTRmlsZUVudHJ5O1xuICAgICAgICB9XG4gICAgICAgIGZvciAoY29uc3QgZlNEaXJlY3RvcnlFbnRyeSBvZiBmc0VudHJpZXMuZ2V0RGlyZWN0b3J5RW50cnkoKSkge1xuICAgICAgICAgIHB1c2gobmV3IEZpbGVTeXN0ZW1EaXJlY3RvcnlFbnRyeUl0ZXJhdG9yKGZTRGlyZWN0b3J5RW50cnkpLmdldEVudHJ5KCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBqb2JRdWV1ZSA9IG5ldyBKb2JRdWV1ZTx2b2lkLCBzdHJpbmc+KC0xKTtcbiAgam9iUXVldWUuc3Vic2NyaWJlKChfLCBlcnJvcikgPT4ge1xuICAgIGlmIChlcnJvcikge1xuICAgICAgZm4/Lm9uVXBsb2FkRXJyb3I/LihlcnJvcik7XG4gICAgfVxuICB9KTtcblxuICBsZXQgZG9uZSA9IHRydWU7XG4gIGxldCBydW5uaW5nID0gZmFsc2U7XG4gIGNvbnN0IHVwbG9hZFN0YXJ0ID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmIChydW5uaW5nID09PSBmYWxzZSkge1xuICAgICAgZG9uZSA9IGZhbHNlO1xuICAgICAgcnVubmluZyA9IHRydWU7XG4gICAgICBhd2FpdCBmbi5vblVwbG9hZFN0YXJ0Py4oKTtcbiAgICAgIC8vIGdpdmUgYnJvd3NlciBzb21lIHRpbWUgdG8gcXVldWUgYm90aCBldmVudHNcbiAgICAgIFNsZWVwKDUwMCkudGhlbihhc3luYyAoKSA9PiB7XG4gICAgICAgIGF3YWl0IGpvYlF1ZXVlLmRvbmU7XG4gICAgICAgIHVwbG9hZEVuZCgpO1xuICAgICAgfSk7XG4gICAgfVxuICB9O1xuICBjb25zdCB1cGxvYWRFbmQgPSBhc3luYyAoKSA9PiB7XG4gICAgZG9uZSA9IHRydWU7XG4gICAgcnVubmluZyA9IGZhbHNlO1xuICAgIGF3YWl0IGZuLm9uVXBsb2FkRW5kPy4oKTtcbiAgICBqb2JRdWV1ZS5yZXNldCgpO1xuICAgIGZTRW50cnlTZXQuY2xlYXIoKTtcbiAgfTtcbiAgY29uc3QgaXRlcmF0ZUZTRW50cmllcyA9IGFzeW5jIChlbnRyaWVzOiBTeW5jQXN5bmNJdGVyYWJsZTxGaWxlU3lzdGVtRW50cnk+LCBmaWxlczogRmlsZUxpc3QpID0+IHtcbiAgICBpZiAoZG9uZSA9PT0gZmFsc2UpIHtcbiAgICAgIGZvciBhd2FpdCAoY29uc3QgZlNGaWxlRW50cnkgb2YgZlNFbnRyeUl0ZXJhdG9yLml0ZXJhdGUoZW50cmllcykpIHtcbiAgICAgICAgY29uc3QgZmlsZSA9IGF3YWl0IG5ldyBQcm9taXNlPEZpbGU+KChyZXNvbHZlLCByZWplY3QpID0+IGZTRmlsZUVudHJ5LmZpbGUocmVzb2x2ZSwgcmVqZWN0KSk7XG4gICAgICAgIGF3YWl0IGZuLm9uVXBsb2FkTmV4dEZpbGUoZmlsZSwgKCkgPT4gKGRvbmUgPSB0cnVlKSk7XG4gICAgICAgIC8vIEB0cy1pZ25vcmVcbiAgICAgICAgaWYgKGRvbmUgPT09IHRydWUpIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuICAgICAgICBjb25zdCBwYXRoID0gR2V0V2Via2l0UmVsYXRpdmVQYXRoKGZpbGUpICsgZmlsZS5uYW1lO1xuICAgICAgICBpZiAoIWZTRW50cnlTZXQuaGFzKHBhdGgpKSB7XG4gICAgICAgICAgZlNFbnRyeVNldC5hZGQocGF0aCk7XG4gICAgICAgICAgYXdhaXQgZm4ub25VcGxvYWROZXh0RmlsZShmaWxlLCAoKSA9PiAoZG9uZSA9IHRydWUpKTtcbiAgICAgICAgICAvLyBAdHMtaWdub3JlXG4gICAgICAgICAgaWYgKGRvbmUgPT09IHRydWUpIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgY29uc3QgY2hhbmdlSGFuZGxlciA9ICgpID0+IHtcbiAgICBqb2JRdWV1ZS5hZGQoYXN5bmMgKCkgPT4ge1xuICAgICAgYXdhaXQgdXBsb2FkU3RhcnQoKTtcbiAgICAgIGlmIChkb25lID09PSBmYWxzZSAmJiBlbGVtZW50IGluc3RhbmNlb2YgSFRNTElucHV0RWxlbWVudCAmJiBlbGVtZW50LmZpbGVzKSB7XG4gICAgICAgIGF3YWl0IGl0ZXJhdGVGU0VudHJpZXMoR2V0V2Via2l0RW50cmllcyhlbGVtZW50KSA/PyBbXSwgZWxlbWVudC5maWxlcyk7XG4gICAgICB9XG4gICAgfSwgJ2NoYW5nZUhhbmRsZXInKTtcbiAgfTtcbiAgY29uc3QgZHJvcEhhbmRsZXIgPSAoZXZlbnQ6IERyYWdFdmVudCkgPT4ge1xuICAgIGpvYlF1ZXVlLmFkZChhc3luYyAoKSA9PiB7XG4gICAgICBhd2FpdCB1cGxvYWRTdGFydCgpO1xuICAgICAgaWYgKGRvbmUgPT09IGZhbHNlICYmIGV2ZW50LmRhdGFUcmFuc2Zlcikge1xuICAgICAgICBjb25zdCBkYXRhVHJhbnNmZXJJdGVtcyA9IG5ldyBEYXRhVHJhbnNmZXJJdGVtSXRlcmF0b3IoZXZlbnQuZGF0YVRyYW5zZmVyLml0ZW1zKTtcbiAgICAgICAgYXdhaXQgaXRlcmF0ZUZTRW50cmllcyhkYXRhVHJhbnNmZXJJdGVtcy5nZXRBc0VudHJ5KCksIGV2ZW50LmRhdGFUcmFuc2Zlci5maWxlcyk7XG4gICAgICB9XG4gICAgfSwgJ2Ryb3BIYW5kbGVyJyk7XG4gIH07XG4gIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgY2hhbmdlSGFuZGxlcik7XG4gIGVsZW1lbnQuYWRkRXZlbnRMaXN0ZW5lcignZHJvcCcsIGRyb3BIYW5kbGVyKTtcbn1cbiIsCiAgICAiaW1wb3J0IHsgc2V0dXBEcmFnQW5kRHJvcEZpbGVQaWNrZXIgfSBmcm9tICcuL2NvbXBvbmVudHMvZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlci9kcmFnLWFuZC1kcm9wLWZpbGUtcGlja2VyLmpzJztcbmltcG9ydCB7IEpvYlF1ZXVlIH0gZnJvbSAnLi9saWIvZXJpY2NoYXNlL1V0aWxpdHkvSm9iUXVldWUuanMnO1xuXG4vLyAhIG9uZSBkYXkgdXNlIEV2ZW50TWFuYWdlclxuZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmFkZEV2ZW50TGlzdGVuZXIoJ2RyYWdvdmVyJywgKGV2ZW50KSA9PiBldmVudC5wcmV2ZW50RGVmYXVsdCgpKTtcblxuY29uc3QgZmlsZV9waWNrZXIgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcuZHJhZy1hbmQtZHJvcC1maWxlLXBpY2tlcicpO1xuY29uc3QgbWFpbiA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ21haW4nKTtcblxubGV0IGltYWdlTG9hZENvdW50ID0gMDtcbmNvbnN0IGltYWdlTG9hZFF1ZXVlID0gbmV3IEpvYlF1ZXVlKC0xKTtcbmlmIChmaWxlX3BpY2tlcikge1xuICBzZXR1cERyYWdBbmREcm9wRmlsZVBpY2tlcihcbiAgICBmaWxlX3BpY2tlcixcbiAgICB7XG4gICAgICBvblVwbG9hZFN0YXJ0KCkge1xuICAgICAgICBmaWxlX3BpY2tlci5jbGFzc0xpc3QuYWRkKCdoaWRkZW4nKTtcbiAgICAgICAgbWFpbj8ucmVwbGFjZUNoaWxkcmVuKCk7XG4gICAgICB9LFxuICAgICAgb25VcGxvYWROZXh0RmlsZTogYWRkSW1hZ2UsXG4gICAgICBvblVwbG9hZEVuZCgpIHtcbiAgICAgICAgaW1hZ2VMb2FkUXVldWUuZG9uZS50aGVuKCgpID0+IHtcbiAgICAgICAgICBpZiAoaW1hZ2VMb2FkQ291bnQgPT09IDApIHtcbiAgICAgICAgICAgIGZpbGVfcGlja2VyLmNsYXNzTGlzdC5yZW1vdmUoJ2hpZGRlbicpO1xuICAgICAgICAgICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICBkaXYuc3R5bGUuY29sb3IgPSAncmVkJztcbiAgICAgICAgICAgIGRpdi50ZXh0Q29udGVudCA9ICdObyBJbWFnZXMgRm91bmQhIFRyeSBhbm90aGVyIGZvbGRlci4nO1xuICAgICAgICAgICAgZmlsZV9waWNrZXIucXVlcnlTZWxlY3Rvcignc3BhbicpPy5hcHBlbmQoXG4gICAgICAgICAgICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JyJyksIC8vXG4gICAgICAgICAgICAgIGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2JyJyksXG4gICAgICAgICAgICAgIGRpdixcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSxcbiAgICB7XG4gICAgICBkaXJlY3Rvcnk6IHRydWUsXG4gICAgICBtdWx0aXBsZTogdHJ1ZSxcbiAgICB9LFxuICApO1xufVxuXG5mdW5jdGlvbiBhZGRJbWFnZShmaWxlOiBGaWxlKSB7XG4gIGltYWdlTG9hZFF1ZXVlLmFkZChcbiAgICAoKSA9PlxuICAgICAgbmV3IFByb21pc2U8dm9pZD4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuICAgICAgICB0cnkge1xuICAgICAgICAgIGNvbnN0IGltZyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2ltZycpO1xuICAgICAgICAgIGNvbnN0IGRpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgICAgICAgIG1haW4/LmFwcGVuZChkaXYpO1xuICAgICAgICAgIGltZy5zcmMgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKGZpbGUpO1xuICAgICAgICAgIGltZy5hZGRFdmVudExpc3RlbmVyKCdsb2FkJywgKCkgPT4ge1xuICAgICAgICAgICAgZGl2LmFwcGVuZChpbWcpO1xuICAgICAgICAgICAgaW1hZ2VMb2FkQ291bnQrKztcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBpbWcuYWRkRXZlbnRMaXN0ZW5lcignZXJyb3InLCAoKSA9PiB7XG4gICAgICAgICAgICBkaXYucmVtb3ZlKCk7XG4gICAgICAgICAgICByZWplY3QoKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBjYXRjaCAoXykge1xuICAgICAgICAgIHJlamVjdCgpO1xuICAgICAgICB9XG4gICAgICB9KSxcbiAgKTtcbn1cbiIKICBdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxlQUFzQixLQUFLLENBQUMsSUFBWTtBQUN0QyxRQUFNLElBQUksUUFBUSxDQUFDLFlBQVksV0FBVyxTQUFTLEVBQUUsQ0FBQztBQUFBOzs7QUNFakQsTUFBTSxNQUFhO0FBQUEsRUFFRjtBQUFBLEVBRFosa0JBQWtCLElBQUk7QUFBQSxFQUNoQyxXQUFXLENBQVcsT0FBZTtBQUFmO0FBQUE7QUFBQSxFQUN0QixTQUFTLENBQUMsVUFBbUQ7QUFDM0QsU0FBSyxnQkFBZ0IsSUFBSSxRQUFRO0FBQ2pDLFFBQUksS0FBSyxVQUFVLFdBQVc7QUFDNUIsZUFBUyxLQUFLLE9BQU8sTUFBTTtBQUN6QixhQUFLLGdCQUFnQixPQUFPLFFBQVE7QUFBQSxPQUNyQztBQUFBLElBQ0g7QUFDQSxXQUFPLE1BQU07QUFDWCxXQUFLLGdCQUFnQixPQUFPLFFBQVE7QUFBQTtBQUFBO0FBQUEsRUFHeEMsR0FBRyxHQUFtQjtBQUNwQixXQUFPLElBQUksUUFBZSxDQUFDLFlBQVk7QUFDckMsV0FBSyxVQUFVLENBQUMsT0FBTyxnQkFBZ0I7QUFDckMsb0JBQVk7QUFDWixnQkFBUSxLQUFLO0FBQUEsT0FDZDtBQUFBLEtBQ0Y7QUFBQTtBQUFBLEVBRUgsR0FBRyxDQUFDLE9BQW9CO0FBQ3RCLFFBQUksS0FBSyxVQUFVLFdBQVc7QUFDNUIsV0FBSyxRQUFRO0FBQ2IsaUJBQVcsWUFBWSxLQUFLLGlCQUFpQjtBQUMzQyxpQkFBUyxPQUFPLE1BQU07QUFDcEIsZUFBSyxnQkFBZ0IsT0FBTyxRQUFRO0FBQUEsU0FDckM7QUFBQSxNQUNIO0FBQUEs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QyxhQUFhO0FBQUE7QUFFbEIsVUFBUSxpQkFBaUIsVUFBVSxhQUFhO0FBQ2hELFVBQVEsaUJBQWlCLFFBQVEsV0FBVztBQUFBOzs7QUMxRzlDLFNBQVMsUUFBUSxDQUFDLE1BQVk7QUFDNUIsaUJBQWUsSUFDYixNQUNFLElBQUksUUFBYyxDQUFDLFNBQVMsV0FBVztBQUNyQyxRQUFJO0FBQ0YsWUFBTSxNQUFNLFNBQVMsY0FBYyxLQUFLO0FBQ3hDLFlBQU0sTUFBTSxTQUFTLGNBQWMsS0FBSztBQUN4QyxZQUFNLE9BQU8sR0FBRztBQUNoQixVQUFJLE1BQU0sSUFBSSxnQkFBZ0IsSUFBSTtBQUNsQyxVQUFJLGlCQUFpQixRQUFRLE1BQU07QUFDakMsWUFBSSxPQUFPLEdBQUc7QUFDZDtBQUNBLGdCQUFRO0FBQUEsT0FDVDtBQUNELFVBQUksaUJBQWlCLFNBQVMsTUFBTTtBQUNsQyxZQUFJLE9BQU87QUFDWCxlQUFPO0FBQUEsT0FDUjtBQUFBLGFBQ00sR0FBUDtBQUNBLGFBQU87QUFBQTtBQUFBLEdBRVYsQ0FDTDtBQUFBO0FBN0RGLFNBQVMsZ0JBQWdCLGlCQUFpQixZQUFZLENBQUMsVUFBVSxNQUFNLGVBQWUsQ0FBQztBQUV2RixJQUFNLGNBQWMsU0FBUyxjQUFjLDRCQUE0QjtBQUN2RSxJQUFNLE9BQU8sU0FBUyxjQUFjLE1BQU07QUFFMUMsSUFBSSxpQkFBaUI7QUFDckIsSUFBTSxpQkFBaUIsSUFBSSxTQUFTLEVBQUU7QUFDdEMsSUFBSSxhQUFhO0FBQ2YsNkJBQ0UsYUFDQTtBQUFBLElBQ0UsYUFBYSxHQUFHO0FBQ2Qsa0JBQVksVUFBVSxJQUFJLFFBQVE7QUFDbEMsWUFBTSxnQkFBZ0I7QUFBQTtBQUFBLElBRXhCLGtCQUFrQjtBQUFBLElBQ2xCLFdBQVcsR0FBRztBQUNaLHFCQUFlLEtBQUssS0FBSyxNQUFNO0FBQzdCLFlBQUksbUJBQW1CLEdBQUc7QUFDeEIsc0JBQVksVUFBVSxPQUFPLFFBQVE7QUFDckMsZ0JBQU0sTUFBTSxTQUFTLGNBQWMsS0FBSztBQUN4QyxjQUFJLE1BQU0sUUFBUTtBQUNsQixjQUFJLGNBQWM7QUFDbEIsc0JBQVksY0FBYyxNQUFNLEdBQUcsT0FDakMsU0FBUyxjQUFjLElBQUksR0FDM0IsU0FBUyxjQUFjLElBQUksR0FDM0IsR0FDRjtBQUFBLFFBQ0Y7QUFBQSxPQUNEO0FBQUE7QUFBQSxFQUVMLEdBQ0E7QUFBQSxJQUNFLFdBQVc7QUFBQSxJQUNYLFVBQVU7QUFBQSxFQUNaLENBQ0Y7QUFDRjsiLAogICJkZWJ1Z0lkIjogIjBDM0RDOTFBOERGRjVGOTA2NDc1NkUyMTY0NzU2RTIxIiwKICAibmFtZXMiOiBbXQp9
