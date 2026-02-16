import { getSnarkArtifacts } from '@zk-kit/semaphore-artifacts';

async function main() {
  console.log('Getting Semaphore30 artifacts from package...');
  const artifacts = await getSnarkArtifacts({ treeDepth: 30 });
  console.log('WASM:', artifacts.wasmFilePath);
  console.log('ZKEY:', artifacts.zkeyFilePath);
}

main();
