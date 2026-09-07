const {test}=require('node:test');const assert=require('node:assert/strict');
const {scoreInputs}=require('../dist/services/score-inputs');
const old={fact:'gh_open_issues_count',factData:'10',version:'1',jobID:1,account:{uid:'a'},status:'confirmed'};
test('pending update changes local inputs but preserves confirmed inputs',()=>{const facts=[old,{...old,jobID:2,factData:'20',status:'collected'}];assert.equal(scoreInputs(facts,'1')[0].factData,'20');assert.equal(scoreInputs(facts,'1',true)[0].factData,'10');});
test('versions and independent submitters stay separate',()=>{const facts=[old,{...old,jobID:2,version:'2'},{...old,jobID:3,account:{uid:'b'}}];assert.equal(scoreInputs(facts,'1').length,2);assert.equal(scoreInputs(facts,'2').length,1);});
test('no finalized inputs produces an empty subset',()=>{assert.deepEqual(scoreInputs([{...old,status:'submitted'}],'1',true),[]);});
