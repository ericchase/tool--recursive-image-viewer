import { JobQueue } from '../../lib/ericchase/Utility/JobQueue.js';
import { RecursiveAsyncIterator } from '../../lib/ericchase/Utility/RecursiveAsyncIterator.js';
import { DataTransferItemIterator } from '../../lib/ericchase/Web API/DataTransfer.js';
import { FileSystemDirectoryEntryIterator, FileSystemEntryIterator } from '../../lib/ericchase/Web API/FileSystem.js';

const webkitdirectory_support = /android|iphone|mobile/i.test(window.navigator.userAgent) === true ? false : true;

export function setupDragAndDropFilePicker(
  container: Element,
  fn: {
    onDragEnd?: () => void;
    onDragEnter?: () => void;
    onDragLeave?: () => void;
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

  const fSEntrySet = new Set<string>();
  const fSEntryIterator = new RecursiveAsyncIterator<FileSystemEntry, FileSystemFileEntry>(async function* (fSEntryIterator, push) {
    for await (const fSEntry of fSEntryIterator) {
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
  const changeHandler = () => {
    jobQueue.add(async () => {
      uploadStart();
      if (element instanceof HTMLInputElement && element.files) {
        for await (const fSFileEntry of fSEntryIterator.iterate(element.webkitEntries)) {
          await fn.onUploadNextFile(await new Promise<File>((resolve, reject) => fSFileEntry.file(resolve, reject)), () => (done = true));
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
  const dropHandler = (event: DragEvent) => {
    jobQueue.add(async () => {
      uploadStart();
      if (event.dataTransfer) {
        const dataTransferItems = new DataTransferItemIterator(event.dataTransfer.items);
        for await (const fSFileEntry of fSEntryIterator.iterate(dataTransferItems.getAsEntry())) {
          await fn.onUploadNextFile(await new Promise<File>((resolve, reject) => fSFileEntry.file(resolve, reject)), () => (done = true));
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
