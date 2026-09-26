import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import ts from 'typescript';
// Transpile the actual server modules; tests use an in-memory SQLite D1 adapter.
const output=path.resolve('work/consultant-tests');fs.mkdirSync(output,{recursive:true});
for(const name of ['consultant','consultant-cache','request-origin']){
  const source=fs.readFileSync(`app/lib/${name}.ts`,'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace("'./consultant'","'./consultant.mjs'");
  fs.writeFileSync(path.join(output,`${name}.mjs`),js);
}
const run=spawnSync(process.execPath,['--test','tests/consultant.test.mjs'],{stdio:'inherit'});
process.exitCode=run.status??1;
