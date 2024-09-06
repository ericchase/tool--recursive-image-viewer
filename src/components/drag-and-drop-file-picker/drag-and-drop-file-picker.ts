import { JobQueue } from '../../lib/ericchase/Utility/JobQueue.js';
import { RecursiveIterator } from '../../lib/ericchase/Utility/RecursiveAsyncIterator.js';
import type { SyncAsyncIterable } from '../../lib/ericchase/Utility/Type.js';
import { DataTransferItemIterator } from '../../lib/ericchase/Web API/DataTransfer.js';
import { FileSystemDirectoryEntryIterator, FileSystemEntryIterator } from '../../lib/ericchase/Web API/FileSystem.js';
import { GetWebkitEntries, GetWebkitRelativePath, SupportsWebkitDirectory } from '../../lib/ericchase/Web API/HTMLInputElement.js';

export function setupDragAndDropFilePicker(
  container: Element,
  fn: {
    onDragEnd?: () => void;
    onDragEnter?: () => void;
    onDragLeave?: () => void;
    onDrop?: () => void;
    onUploadEnd?: () => void;
    onUploadNextFile: (file: File, done: () => void) => Promise<void> | void;
    onUploadStart?: () => void;
  },
  options?: {
    directory: boolean;
    multiple: boolean;
  },
) {
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
      element.addEventListener('drop', dropHandler);
    };
    const dragendHandler = () => {
      removeListeners();
      fn.onDragEnd?.();
    };
    const dragleaveHandler = () => {
      removeListeners();
      fn.onDragLeave?.();
    };
    const dropHandler = () => {
      removeListeners();
      fn.onDrop?.();
    };
    element.addEventListener('dragenter', () => {
      element.addEventListener('dragleave', dragleaveHandler);
      element.addEventListener('dragend', dragendHandler);
      element.addEventListener('drop', dropHandler);
      fn.onDragEnter?.();
    });
  }

  const fSEntrySet = new Set<string>();
  const fSEntryIterator = new RecursiveIterator<FileSystemEntry, FileSystemFileEntry>(async function* (fSEntryIterator, push) {
    for await (const fSEntry of fSEntryIterator) {
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

  const jobQueue = new JobQueue<void, string>(-1);
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
  const iterateFSEntries = async (initEntries: SyncAsyncIterable<FileSystemEntry>, files: FileList) => {
    for await (const fSFileEntry of fSEntryIterator.iterate(initEntries)) {
      await fn.onUploadNextFile(await new Promise<File>((resolve, reject) => fSFileEntry.file(resolve, reject)), () => (done = true));
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
  const dropHandler = (event: DragEvent) => {
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
