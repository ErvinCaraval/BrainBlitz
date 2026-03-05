import imagemin from 'imagemin';
import imageminWebp from 'imagemin-webp';
import path from 'path';

async function run() {
  const folders = [
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), 'build', 'assets')
  ];

  for (const folder of folders) {
    try {
      console.log('Optimizing images in', folder);
      await imagemin([`${folder}/*.{jpg,jpeg,png}`], {
        destination: folder,
        plugins: [imageminWebp({ quality: 75 })]
      });
    } catch (err) {
      console.warn('Skipping folder', folder, err.message);
    }
  }

  console.log('Done');
}

run();
