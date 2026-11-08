import {readFile,writeFile,readdir} from 'node:fs/promises';import {createHash} from 'node:crypto';
const root='D:/Projects/Echelon/',cp=root+'design-reference/environment/checkpoints/2026-11-08-before-shared-habitat/';
const audit=JSON.parse(await readFile(cp+'CHECKPOINT.json','utf8'));
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const changed=[],bad=[];
for(const f of audit.files){if(await hash(cp+f.path)!==f.sha256)bad.push(f.path);if(f.path.startsWith('environment-source\\')){const target=root+'src/app/environment/'+f.path.slice('environment-source\\'.length);if(await hash(target)!==f.sha256)changed.push(f.path);}if(f.path.startsWith('delivery-assets\\')){if(await hash(root+'public/assets/environment/alpine-prototype/'+f.path.slice('delivery-assets\\'.length))!==f.sha256)bad.push('DELIVERY:'+f.path);}}
const master=await hash(root+'design-reference/environment/alpine-composition-01/echelon_alpine_composition_01.blend');
const report={checkpointFiles:audit.files.length,failedHashes:bad,modifiedExistingEnvironmentFiles:changed,masterUnchanged:master===audit.masterSha256,masterSha256:master};
await writeFile(root+'design-reference/environment/webgl-prototype/shared-habitat/preservation-check.json',JSON.stringify(report,null,2));console.log(report);
