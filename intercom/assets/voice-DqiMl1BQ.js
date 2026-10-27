var e=class e{client;state=`off`;error=``;muted=!1;gid=null;micLevel=0;outLevel=0;onChange=null;ctx=null;stream=null;spk=null;micAn=null;outAn=null;outGain=null;gainValue=1;meterTimer=null;constructor(e,t){this.client=t,e.subscribe(e=>{e===`hello`&&this.state===`on`&&this.gid&&t.send({t:`audio`,on:!0,gid:this.gid})}),t.onBinary=e=>{this.spk?.port.postMessage(e,[e])}}static supported(){return window.isSecureContext?navigator.mediaDevices?.getUserMedia?typeof AudioWorkletNode>`u`?`This browser has no AudioWorklet support.`:null:`This browser cannot capture the microphone.`:`Microphone access needs HTTPS: open the https:// panel link.`}async join(t){let n=e.supported();if(n)this.fail(n);else{this.gid=t,this.set(`starting`);try{this.stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:!0,noiseSuppression:!0,autoGainControl:!0,channelCount:1}});let e=this.ctx=new AudioContext({latencyHint:`interactive`}),n=URL.createObjectURL(new Blob([`
const RATE = 16000, FRAME = 320;
// Mic: one-pole anti-alias low-pass, then linear-interpolated resampling to 16 kHz, posted in 20 ms frames.
class MicProc extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / RATE;            // input samples per output sample
    this.alpha = Math.min(1, 2 * Math.PI * 7000 / sampleRate);
    this.lp = 0; this.prev = 0; this.i = 0; this.t = 1;
    this.buf = new Int16Array(FRAME); this.n = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let k = 0; k < ch.length; k++) {
      this.lp += this.alpha * (ch[k] - this.lp);
      this.i += 1;
      while (this.t <= this.i) {              // output position falls between input i-1 and i
        const v = this.prev + (this.lp - this.prev) * (this.t - (this.i - 1));
        this.buf[this.n++] = Math.max(-32768, Math.min(32767, Math.round(v * 32767)));
        if (this.n === FRAME) {
          this.port.postMessage(this.buf.buffer, [this.buf.buffer]);
          this.buf = new Int16Array(FRAME); this.n = 0;
        }
        this.t += this.step;
      }
      this.prev = this.lp;
    }
    return true;
  }
}
// Speaker: 16 kHz frames queued (~60 ms jitter buffer), linear-interpolated up to the device rate.
class SpkProc extends AudioWorkletProcessor {
  constructor() {
    super();
    this.q = []; this.cur = null; this.idx = 0;
    this.step = RATE / sampleRate; this.frac = 0; this.a = 0; this.b = 0; this.primed = false;
    this.port.onmessage = e => {
      this.q.push(new Int16Array(e.data));
      if (this.q.length > 12) this.q.splice(0, this.q.length - 6);   // drift: drop backlog
    };
  }
  next() {
    if (!this.cur || this.idx >= this.cur.length) { this.cur = this.q.shift() || null; this.idx = 0; }
    if (!this.cur) return null;
    return this.cur[this.idx++] / 32768;
  }
  process(_in, outputs) {
    const out = outputs[0][0];
    if (!this.primed && this.q.length >= 3) this.primed = true;
    for (let k = 0; k < out.length; k++) {
      if (!this.primed) { this.b *= 0.98; out[k] = this.b; continue; }
      this.frac += this.step;
      while (this.frac >= 1) {
        this.frac -= 1;
        const v = this.next();
        if (v === null) { this.primed = false; break; }
        this.a = this.b; this.b = v;
      }
      out[k] = this.a + (this.b - this.a) * this.frac;
    }
    return true;
  }
}
registerProcessor('mcom-mic', MicProc);
registerProcessor('mcom-spk', SpkProc);
`],{type:`text/javascript`}));await e.audioWorklet.addModule(n),URL.revokeObjectURL(n);let r=e.createMediaStreamSource(this.stream),i=new AudioWorkletNode(e,`mcom-mic`,{numberOfInputs:1,numberOfOutputs:0});i.port.onmessage=e=>{this.muted||this.client.sendBinary(e.data)},this.micAn=e.createAnalyser(),this.micAn.fftSize=512,r.connect(i),r.connect(this.micAn),this.spk=new AudioWorkletNode(e,`mcom-spk`,{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[1]}),this.outAn=e.createAnalyser(),this.outAn.fftSize=512,this.outGain=e.createGain(),this.outGain.gain.value=this.gainValue,this.spk.connect(this.outGain).connect(this.outAn).connect(e.destination),await e.resume(),this.client.send({t:`audio`,on:!0,gid:t}),this.meterTimer=setInterval(()=>this.meter(),80),this.set(`on`)}catch(e){this.leave(),this.fail(e instanceof DOMException&&e.name===`NotAllowedError`?`Microphone permission was refused.`:`Audio failed: ${e.message}`)}}}leave(){this.client.send({t:`audio`,on:!1}),this.meterTimer&&clearInterval(this.meterTimer),this.meterTimer=null,this.stream?.getTracks().forEach(e=>e.stop()),this.ctx?.close(),this.ctx=this.stream=this.spk=this.micAn=this.outAn=this.outGain=null,this.micLevel=this.outLevel=0,this.state!==`error`&&this.set(`off`)}setOutputGain(e){this.gainValue=e,this.outGain&&this.ctx&&this.outGain.gain.setTargetAtTime(e,this.ctx.currentTime,.02)}setMuted(e){this.muted=e,this.stream?.getAudioTracks().forEach(t=>{t.enabled=!e}),this.onChange?.()}meter(){let e=e=>{if(!e)return 0;let t=new Float32Array(e.fftSize);return e.getFloatTimeDomainData(t),Math.sqrt(t.reduce((e,t)=>e+t*t,0)/t.length)};this.micLevel=this.muted?0:e(this.micAn),this.outLevel=e(this.outAn),this.onChange?.()}set(e){this.state=e,e!==`error`&&(this.error=``),this.onChange?.()}fail(e){this.error=e,this.state=`error`,this.onChange?.()}};export{e as t};