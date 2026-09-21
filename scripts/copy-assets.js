import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../../Noticias/noticias imagenes');
const TARGET_DIR = path.resolve(__dirname, '../public/noticias');

const EXPECTED_HASHES = {
  'Noticia_01.jpg': '26c4d97110fdb2ff1ad41903cc2017eb343191c95b44c35970a7f2dd7deee16c',
  'Noticia_02.jpg': 'c30e84e761c063b890e701b52045bd562d623f5d0c572df9e9b213cd31acff2d',
  'Noticia_03.jpg': 'ed45bc8d2fa1b8cc690d0e69951c696f147c1f1de631357fd489851449686542',
  'Noticia_04.jpg': '4db8b62c8b4570cadba44c18e55b077311f9ab533e264d3aada83566856994e8',
  'Noticia_05.jpg': 'f4407fc15046dc882fdd2eb49ea1dc113bf57e4792b9d0d26a23e7ffef0bd9c4',
  'Noticia_06.jpg': '5c8a6195f7b7a9dc13c6c9883b1122f65088a119deea92247602e57016533d34',
  'Noticia_07.jpg': 'd7075153ac0a4b1f08360717f91d805e7c2267a535f49e40bc15d4b2499d6574',
  'Noticia_08.jpg': '9d25c3a73ca5f259a127b57be452dd307112ff19db630cf621fd9d225c7e398e',
  'Noticia_09.jpg': 'd4467194086104d16aedbe5e48c94b76ce5c44666350c65525be22e7b7e29035',
  'Noticia_10.jpg': 'abe191678d6739e775f7ba747f4e4c293febe57e280bd89e2d915b34e7f664f7',
  'Noticia_11.jpg': '9b61dd2722b000febaa08353d86afcd55f4db375a342d62bcd47eb186e2026fb',
  'Noticia_12.jpg': '13faf41aa9d4810eb81435e480420aa77e1d26bbf8b7f3022a3011774407325b',
  'Noticia_13.jpg': '30b794323a7ead34f8062b0b7ddbe0ad64844b3ce057ebeb4db2306ce2dce52c',
  'Noticia_14.jpg': 'f0f41a12718e71499f01fa5d8be6bf3ceb5564d800bfd26bd72e96fb283f1f5c',
  'Noticia_15.jpg': '6242d598ce8fe6b6b18e4ccd793e335caaf4b86b71dfd30896afb0e5ed297389',
  'Noticia_16.jpg': 'fca011cf6994b997839faf36a8b1bf57781fee7fad69f3f19d3db981c8d1cae2',
  'Noticia_17.jpg': 'd23cdb2377d6b686f77264f497dd1c75ddc311e877b4e2e0b1f485baf4d9f5f3',
  'Noticia_18.jpg': 'c1537cd775dd050de46713b399aeedbf7327444912997493fa951f2ec413e127',
  'Noticia_19.jpg': '59c85fa2146e0c2457c73ad60b23df9ec554980ae438e1c85a1869ab6a09251f',
  'Noticia_20.jpg': '39508472a2fc740b8e71c8f714f0ef8be7fb3292d00ed9e6ac8f7324837b9897',
  'Noticia_21.jpg': 'dab4aa168d8e07c5e142a9fc6086ae3891b0d348aeb33db9c429a9f392162257',
  'Noticia_22.jpg': '19aef1e6e8a3c66d961d765619635cc74c55c80c872791caa96cd5bb33fd28ee',
  'Noticia_23.jpg': 'db13723776b889d30ab9df7198b02514f013cdb4c32d9750ee27630b09f83fec',
  'Noticia_24.jpg': '47c35cf0543ccb91bd0daf6dba5eaa1a00f2ea2a9bb8cdd0f303e86d6acc60f1',
  'Noticia_25.jpg': 'ec0cbd5b4ceece5df5d7af90f334e951ceadf88362a836c42331fc95553c0c59',
  'Noticia_26.png': 'd33d7e9689dc1ccbc8ecf43ee79ab781e25a70331e5a315465f75593521ea908',
  'Noticia_27.jpg': '0743f31cece5779519c7fe731da6ab2146283baa4cbd43ac561db0d104961634',
  'Noticia_28.jpg': '682478f7bfd95817987f66730cd647fd05dbfacb6202d18edadf38837db0602b'
};

function main() {
  console.log('Source directory:', SOURCE_DIR);
  console.log('Target directory:', TARGET_DIR);

  if (!fs.existsSync(SOURCE_DIR)) {
    throw new Error(`Source directory does not exist: ${SOURCE_DIR}`);
  }

  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    console.log(`Created target directory: ${TARGET_DIR}`);
  }

  let copiedCount = 0;
  for (const [filename, expectedHash] of Object.entries(EXPECTED_HASHES)) {
    const srcPath = path.join(SOURCE_DIR, filename);
    const destPath = path.join(TARGET_DIR, filename);

    if (!fs.existsSync(srcPath)) {
      throw new Error(`Source asset missing: ${srcPath}`);
    }

    const content = fs.readFileSync(srcPath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    if (hash !== expectedHash) {
      throw new Error(`SHA-256 hash mismatch for ${filename}. Expected ${expectedHash}, got ${hash}`);
    }

    fs.copyFileSync(srcPath, destPath);
    copiedCount++;
  }

  // Verify that Noticia_26.png is copied and exists
  const noticia26Path = path.join(TARGET_DIR, 'Noticia_26.png');
  if (!fs.existsSync(noticia26Path) || fs.statSync(noticia26Path).size === 0) {
    throw new Error('Noticia_26.png failed to copy or is empty!');
  }

  // Also create a defensive Noticia_26.jpg copy as fallback if needed
  const noticia26Jpg = path.join(TARGET_DIR, 'Noticia_26.jpg');
  if (!fs.existsSync(noticia26Jpg)) {
    fs.copyFileSync(noticia26Path, noticia26Jpg);
    console.log('Created defensive fallback copy: Noticia_26.jpg');
  }

  const allFiles = fs.readdirSync(TARGET_DIR);
  console.log(`Successfully verified and migrated ${copiedCount} stimuli assets.`);
  console.log(`Total files in target directory: ${allFiles.length}`);
}

main();
