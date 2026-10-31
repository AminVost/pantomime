import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../../components/game/GameAudio.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { GameAudio } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
let played, gains, fetched;
beforeEach(() => {
  played = []; gains = []; fetched = [];
  globalThis.document = { hidden: false };
  globalThis.fetch = async url => { fetched.push(url); return { ok: true, arrayBuffer: async () => url }; };
  globalThis.AudioContext = class {
    currentTime = 0; destination = {};
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); }
    async decodeAudioData(name) { return { name }; }
    createBufferSource() { return { connect() { return this; }, disconnect() {}, start() { played.push(this); }, stop() { this.stopped = true; this.onended?.(); } }; }
    createGain() { const gain = { value: 0, setTargetAtTime(value) { this.value = value; } }; gains.push(gain); return { gain, connect() { return this; }, disconnect() {} }; }
  };
});
const preload = async audio => { audio.unlock(); await new Promise(resolve => setImmediate(resolve)); };

test("packaged cues load once, timeout uses the supplied clip and survives music cancellation", async () => {
  const audio = new GameAudio(); await preload(audio);
  await audio.startMusic("neon");
  const end = audio.play("end"); audio.stopMusic(); await end;
  assert.equal(played.at(-1).buffer.name, "/audio/end.m4a");
  assert.equal(played.at(-1).stopped, undefined);
  await audio.play("tick"); await audio.play("tick");
  assert.equal(fetched.filter(url => url === "/audio/tick.m4a").length, 1);
  audio.dispose();
});
test("music selection replaces the old loop, ducks for countdown and respects mute/background", async () => {
  const audio = new GameAudio(); await preload(audio);
  await audio.startMusic("neon"); const first = played.at(-1); const normal = gains.at(-1).value;
  audio.setUrgent(true); assert.ok(gains.at(-1).value < normal / 2);
  await audio.startMusic("playful"); assert.equal(first.stopped, true); assert.equal(played.at(-1).loop, true);
  audio.configure(false, 1, .55); assert.equal(played.at(-1).stopped, true);
  const count = played.length; await audio.play("end"); assert.equal(played.length, count);
  audio.configure(true, 1, .55); document.hidden = true;
  await audio.startMusic("neon"); await audio.play("tick"); assert.equal(played.length, count);
  audio.dispose();
});
test("a cancelled pending music load cannot start after leaving the turn", async () => {
  let release;
  globalThis.fetch = () => new Promise(resolve => { release = resolve; });
  const audio = new GameAudio(); const pending = audio.startMusic("playful");
  audio.stopMusic(); release({ ok: true, arrayBuffer: async () => "playful" }); await pending;
  assert.equal(played.length, 0); audio.dispose();
});
