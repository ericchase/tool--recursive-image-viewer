import { setupDragAndDropFilePicker } from './components/drag-and-drop-file-picker/drag-and-drop-file-picker.js';
import { JobQueue } from './lib/ericchase/Utility/JobQueue.js';

// ! one day use EventManager
document.documentElement.addEventListener('dragover', (event) => event.preventDefault());

const main = document.querySelector('main');
const picker = document.querySelector('.drag-and-drop-file-picker');

let imageLoadCount = 0;
const imageLoadQueue = new JobQueue(-1);
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
              picker.querySelector('span')?.append(
                document.createElement('br'), //
                document.createElement('br'),
                div,
              );
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

function showImage(file: File) {
  try {
    imageLoadQueue.add(
      () =>
        new Promise<void>((resolve, reject) => {
          const img = document.createElement('img');
          const div = document.createElement('div');
          // div.classList.add('hidden');
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
