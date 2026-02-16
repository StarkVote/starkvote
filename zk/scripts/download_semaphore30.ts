/**
 * Download Semaphore depth-30 circuit artifacts
 *
 * Downloads from official PSE snark-artifacts registry:
 * - semaphore30.wasm (circuit for witness generation)
 * - semaphore30.zkey (proving/verification key)
 *
 * Then extracts verification_key30.json from the zkey file.
 */
import { maybeGetSnarkArtifacts } from '@zk-kit/artifacts';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('📥 Downloading Semaphore depth-30 artifacts...');
  console.log('   This may take a few minutes (zkey is ~1.5GB)\n');

  try {
    // Download artifacts using @zk-kit/artifacts
    const artifacts = await maybeGetSnarkArtifacts('semaphore', { treeDepth: 30 });

    console.log('✅ Download complete!');
    console.log(`   WASM: ${artifacts.wasm}`);
    console.log(`   ZKEY: ${artifacts.zkey}\n`);

    // Copy to artifacts directory
    const artifactsDir = path.join(__dirname, '../artifacts');
    if (!fs.existsSync(artifactsDir)) {
      fs.mkdirSync(artifactsDir, { recursive: true });
    }

    const wasmDest = path.join(artifactsDir, 'semaphore30.wasm');
    const zkeyDest = path.join(artifactsDir, 'semaphore30.zkey');

    console.log('📋 Copying artifacts to zk/artifacts/...');
    fs.copyFileSync(artifacts.wasm, wasmDest);
    fs.copyFileSync(artifacts.zkey, zkeyDest);

    console.log('✅ Files copied:');
    console.log(`   ${wasmDest}`);
    console.log(`   ${zkeyDest}\n`);

    // Extract verification key
    console.log('🔑 Extracting verification key...');
    const vkPath = path.join(artifactsDir, 'verification_key30.json');

    try {
      execSync(`npx snarkjs zkev "${zkeyDest}" "${vkPath}"`, {
        stdio: 'inherit'
      });
      console.log('✅ Verification key extracted:');
      console.log(`   ${vkPath}\n`);
    } catch (error) {
      console.error('⚠️  Could not extract VK automatically.');
      console.error('   Run manually: npx snarkjs zkev artifacts/semaphore30.zkey artifacts/verification_key30.json\n');
    }

    console.log('🎉 Setup complete! You can now:');
    console.log('   1. npm run compute-root');
    console.log('   2. npm run gen-proof');
    console.log('   3. npm run format-calldata');

  } catch (error) {
    console.error('❌ Error downloading artifacts:', error);
    console.error('\nTroubleshooting:');
    console.error('- Check your internet connection');
    console.error('- Try running: npm install @zk-kit/artifacts');
    process.exit(1);
  }
}

main();
