import assert from 'node:assert/strict';
import {build} from 'esbuild';
const code=await build({entryPoints:['../supabase/functions/_shared/public-video.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const {publicVideo}=await import('data:text/javascript;base64,'+Buffer.from(code.outputFiles[0].text).toString('base64'));
assert.equal(publicVideo('<video src="https://cdn4.cdn-telegram.org/file/clip.mp4?a=1&amp;b=2"></video>'),'https://cdn4.cdn-telegram.org/file/clip.mp4?a=1&b=2');
for(const url of ['http://cdn4.cdn-telegram.org/a','https://cdn-telegram.org.evil.test/a','https://127.0.0.1/a','https://user:pass@cdn-telegram.org/a','javascript:alert(1)'])assert.equal(publicVideo(`<video src="${url}">`),null);
assert.equal(publicVideo('<img src="https://cdn-telegram.org/image.jpg">'),null);
console.log('Public video extraction and trusted URL boundaries passed');
