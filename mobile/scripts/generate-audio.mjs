// Optional asset-authoring step (Node + ffmpeg). Normal builds use the checked-in M4As.
// Original instrumental compositions, no third-party music or runtime downloads.
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
const output = resolve(import.meta.dirname, "../../public/audio");
mkdirSync(output, { recursive: true });
const rate = 48000;
const tau = Math.PI * 2;
const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
let seed = 1979;
const noise = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2147483648 - 1; };

function render(name, seconds, compose, loop = false) {
  const samples = new Float32Array(Math.round(seconds * rate));
  const add = (at, duration, synth, volume = 1) => {
    const start = Math.round(at * rate), count = Math.round(duration * rate);
    for (let i = 0; i < count; i++) {
      const index = start + i;
      if (!loop && index >= samples.length) break;
      const t = i / rate;
      samples[index % samples.length] += synth(t, duration) * volume;
    }
  };
  const pluck = (midi, at, duration = .3, volume = .22) => add(at, duration, (t, d) => {
    const f = frequency(midi);
    return (Math.sin(tau*f*t) + .3*Math.sin(tau*f*2*t) + .12*Math.sin(tau*f*3*t)) * Math.min(1,t/.004) * Math.exp(-t*9) * Math.min(1,(d-t)/.025);
  }, volume);
  const bell = (midi, at, duration = .9) => add(at, duration, (t, d) => {
    const f = frequency(midi);
    return (Math.sin(tau*f*t)*Math.exp(-t*4) + .28*Math.sin(tau*f*2.756*t)*Math.exp(-t*7)) * Math.min(1,t/.003) * Math.min(1,(d-t)/.02);
  }, .4);
  const kick = at => add(at, .21, t => Math.sin(tau*(48*t + 11*(1-Math.exp(-t*35)))) * Math.exp(-t*23), .6);
  const hat = (at, open = false) => add(at, open ? .14 : .055, t => noise()*Math.exp(-t*(open?35:95))*Math.min(1,t/.001), open?.065:.055);
  const clap = at => add(at,.13,t => noise()*(Math.exp(-t*40)+.4*Math.exp(-(((t-.018)/.01)**2)))*Math.min(1,t/.001),.16);
  const bass = (midi,at,duration) => add(at,duration,(t,d) => {
    const f=frequency(midi);
    return (Math.sin(tau*f*t)+.28*Math.sin(tau*f*2*t)+.12*Math.sin(tau*f*3*t))*Math.min(1,t/.007)*Math.min(1,(d-t)/.04)*Math.exp(-t*2);
  },.3);
  compose({add,pluck,bell,kick,hat,clap,bass});
  let peak = 0; for (const x of samples) peak = Math.max(peak,Math.abs(x));
  const wav = Buffer.alloc(44 + samples.length * 2);
  wav.write("RIFF"); wav.writeUInt32LE(wav.length-8,4); wav.write("WAVEfmt ",8);
  wav.writeUInt32LE(16,16); wav.writeUInt16LE(1,20); wav.writeUInt16LE(1,22);
  wav.writeUInt32LE(rate,24); wav.writeUInt32LE(rate*2,28); wav.writeUInt16LE(2,32); wav.writeUInt16LE(16,34);
  wav.write("data",36); wav.writeUInt32LE(samples.length*2,40);
  for(let i=0;i<samples.length;i++) wav.writeInt16LE(Math.round(samples[i]/Math.max(peak,1)*.92*32767),44+i*2);
  const temp=resolve(output,`${name}.wav`); writeFileSync(temp,wav);
  execFileSync("ffmpeg",["-y","-hide_banner","-loglevel","error","-i",temp,"-af","loudnorm=I=-16:TP=-1.5:LRA=7","-ar","48000","-c:a","aac","-b:a","192k","-movflags","+faststart",resolve(output,`${name}.m4a`)]);
  unlinkSync(temp);
}

// Neon Bounce: syncopated electro funk, 120 BPM, 16-bar A/B phrase.
render("neon",32,({kick,hat,clap,bass,pluck})=>{
  const roots=[45,41,48,43];
  const riff=[0,7,12,7,15,12,7,3];
  for(let bar=0;bar<16;bar++) {
    const root=roots[bar%4], at=bar*2;
    for(let beat=0;beat<4;beat++) { kick(at+beat*.5); if(beat%2) clap(at+beat*.5); hat(at+beat*.5); hat(at+beat*.5+.25,beat===3); }
    for(const step of [0,1.5,2,3.5,5,6,7]) bass(root+(step===3.5?12:0),at+step*.25,.22);
    for(let step=0;step<8;step++) if((step+bar)%3!==0) pluck(root+24+riff[(step+(bar>=8?2:0))%8],at+step*.25+.125,.34,.16);
  }
},true);
// Playful Chase: marimba/bell call-and-response, 110 BPM, 16 bars.
const beat=60/110;
render("playful",64*beat,({kick,hat,clap,bass,pluck,bell})=>{
  const roots=[48,53,55,48], motif=[12,16,19,21,19,16,14,7];
  for(let bar=0;bar<16;bar++) {
    const root=roots[bar%4],at=bar*4*beat;
    for(let n=0;n<4;n++){ if(n%2===0)kick(at+n*beat);else clap(at+n*beat); hat(at+(n+.5)*beat); bass(root-12+(n%2?7:0),at+n*beat,beat*.7); }
    for(let n=0;n<8;n++) pluck(root+motif[(n+(bar%2?4:0))%8],at+n*beat/2,beat*.8,.26);
    if(bar%2===1) {bell(root+24,at+2.5*beat,.6);bell(root+19,at+3.5*beat,.6);}
  }
},true);
render("start",1.3,({bell})=>{bell(81,0,1.1);bell(88,.16,1.1);});
render("correct",.65,({bell})=>{bell(84,0,.55);bell(91,.12,.5);});
render("win",1.8,({bell})=>{[72,76,79,84].forEach((n,i)=>bell(n,i*.18,1.2));});
render("tick",.14,({add})=>add(0,.12,t=>(Math.sin(tau*1800*t)*.4+noise()*.6)*Math.exp(-t*65)*Math.min(1,t/.001),.75));
console.log("Generated two original loops and four cues at 48 kHz AAC.");
