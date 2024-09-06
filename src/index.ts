import { setupDragAndDropFilePicker } from './components/drag-and-drop-file-picker/drag-and-drop-file-picker.js';
import { JobQueue } from './lib/ericchase/Utility/JobQueue.js';

// ! one day use EventManager
document.documentElement.addEventListener('dragover', (event) => event.preventDefault());

const file_picker = document.querySelector('.drag-and-drop-file-picker');
const main = document.querySelector('main');

let imageLoadCount = 0;
const imageLoadQueue = new JobQueue(-1);
if (file_picker) {
  setupDragAndDropFilePicker(
    file_picker,
    {
      onUploadStart() {
        file_picker.classList.add('hidden');
        main?.replaceChildren();
      },
      onUploadNextFile: showImage,
      onUploadEnd() {
        imageLoadQueue.subscribe(() => {
          if (imageLoadQueue.done) {
            if (imageLoadCount === 0) {
              file_picker.classList.remove('hidden');
              const div = document.createElement('div');
              div.style.color = 'red';
              div.textContent = 'No Images Found! Try another folder.';
              file_picker.querySelector('span')?.append(
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
  imageLoadQueue.add(
    () =>
      new Promise<void>((resolve, reject) => {
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
