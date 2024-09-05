import { ArrayEquals } from './ericchase/Algorithm/Array/Array.js';
import { U8 } from './ericchase/Algorithm/Array/Uint8Array.js';
import { RecursiveAsyncIterator } from './ericchase/Utility/RecursiveAsyncIterator.js';
import { DataTransferItemIterator } from './ericchase/Web API/DataTransfer.js';
import { FileSystemDirectoryEntryIterator, FileSystemEntryIterator } from './ericchase/Web API/FileSystem.js';

const webkitdirectory_support = /android|iphone|mobile/i.test(window.navigator.userAgent) === true ? false : true;

const bits_off = U8([0, 0, 0, 0]);
const bits_on = U8([1, 1, 1, 1]);

export function setupDragAndDropFilePicker(element: HTMLInputElement, fn: { onStart: () => void; onFile: (file: File) => void; onEnd: () => void }) {
  const bits_check = U8([0, 0, 0, 0]);
  if (webkitdirectory_support) {
    element.toggleAttribute('webkitdirectory', true);
  }
  element.addEventListener('change', changeHandler);
  element.addEventListener('drop', dropHandler);
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
  function end() {
    if (ArrayEquals(bits_on, bits_check)) {
      fSEntrySet.clear();
      bits_check[0] = 0;
      bits_check[1] = 0;
      bits_check[2] = 0;
      bits_check[3] = 0;
      fn.onEnd();
    }
  }
  async function changeHandler(event: Event) {
    if (ArrayEquals(bits_off, bits_check)) {
      fn.onStart();
    }
    bits_check[0] = 1;
    if (event.target instanceof HTMLInputElement && event.target.files) {
      for await (const fSFileEntry of fSEntryIterator.iterate(event.target.webkitEntries)) {
        fSFileEntry.file(fn.onFile);
      }
      for (const file of event.target.files) {
        if (!fSEntrySet.has(file.webkitRelativePath)) {
          fSEntrySet.add(file.webkitRelativePath);
          fn.onFile(file);
        }
      }
    }
    bits_check[2] = 1;
    end();
  }
  async function dropHandler(event: DragEvent) {
    if (ArrayEquals(bits_off, bits_check)) {
      fn.onStart();
    }
    bits_check[1] = 1;
    if (event.dataTransfer) {
      const dataTransferItems = new DataTransferItemIterator(event.dataTransfer.items);
      for await (const fSFileEntry of fSEntryIterator.iterate(dataTransferItems.getAsEntry())) {
        fSFileEntry.file(fn.onFile);
      }
      for (const file of event.dataTransfer.files) {
        if (!fSEntrySet.has(file.webkitRelativePath)) {
          fSEntrySet.add(file.webkitRelativePath);
          fn.onFile(file);
        }
      }
    }
    bits_check[3] = 1;
    end();
  }
}
