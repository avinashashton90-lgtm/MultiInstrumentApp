// Signal measurements used by the audio tests. Runs inside the page (injected as a script), so rendered
// buffers never have to leave the browser. Exposes window.PBA.
(function (root) {
  function mono(buf) {
    var n = buf.length, out = new Float32Array(n), ch = buf.numberOfChannels;
    for (var c = 0; c < ch; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < n; i++) out[i] += d[i] / ch;
    }
    return out;
  }

  function db(a) { return a > 0 ? 20 * Math.log10(a) : -Infinity; }

  // Sample peak over every channel, in dBFS
  function peak(buf, s, e) {
    var p = 0;
    for (var c = 0; c < buf.numberOfChannels; c++) {
      var d = buf.getChannelData(c), a = Math.max(0, s | 0), b = Math.min(d.length, e === undefined ? d.length : e | 0);
      for (var i = a; i < b; i++) { var v = d[i] < 0 ? -d[i] : d[i]; if (v > p) p = v; }
    }
    return p;
  }

  // RMS over every channel (mean of the channel powers)
  function rms(buf, s, e) {
    var sum = 0, n = 0;
    for (var c = 0; c < buf.numberOfChannels; c++) {
      var d = buf.getChannelData(c), a = Math.max(0, s | 0), b = Math.min(d.length, e === undefined ? d.length : e | 0);
      for (var i = a; i < b; i++) { sum += d[i] * d[i]; n++; }
    }
    return n ? Math.sqrt(sum / n) : 0;
  }

  // RMS over the sound's active span: from s until the last sample within 20 dB of the peak (at most `cap` samples).
  // A fixed window would make short hits (a closed hat) look quiet and long ones loud; this measures the sound itself.
  function activeRms(buf, s, e, cap) {
    var p = peak(buf, s, e), floor = p * 0.1, last = s;
    for (var c = 0; c < buf.numberOfChannels; c++) {
      var d = buf.getChannelData(c);
      for (var i = Math.min(e, d.length) - 1; i > last; i--) if (Math.abs(d[i]) > floor) { last = i; break; }
    }
    return rms(buf, s, Math.min(last + 1, s + (cap || Infinity)));
  }

  // Squared-difference function of x at lag tau over W samples starting at s
  function diff(x, s, W, tau) {
    var sum = 0;
    for (var j = 0; j < W; j++) { var d = x[s + j] - x[s + j + tau]; sum += d * d; }
    return sum;
  }

  // Fundamental frequency by YIN (de Cheveigne & Kawahara) on [s, e), refined over many periods:
  // the coarse period T is re-measured at the lag closest to n*T (n periods, ~3000 samples), so the
  // sub-sample interpolation error is divided by n. Accurate to well under 1 cent on steady tones.
  function pitch(x, sr, s, e, fmin, fmax) {
    fmin = fmin || 50; fmax = fmax || 2500;
    var tmin = Math.max(2, Math.floor(sr / fmax)), tmax = Math.ceil(sr / fmin);
    var len = e - s, W = Math.min(4096, len - tmax - 1);
    if (W < 512) return { f: 0, clarity: 0 };
    var d = new Float64Array(tmax + 2), cm = new Float64Array(tmax + 2), run = 0, tau;
    cm[0] = 1;
    for (tau = 1; tau <= tmax + 1; tau++) {
      d[tau] = diff(x, s, W, tau);
      run += d[tau];
      cm[tau] = run > 0 ? d[tau] * tau / run : 1;
    }
    var best = -1;
    for (tau = tmin; tau <= tmax; tau++) {
      if (cm[tau] < 0.12) { while (tau + 1 <= tmax && cm[tau + 1] < cm[tau]) tau++; best = tau; break; }
    }
    if (best < 0) { // no clear dip under the threshold: take the global minimum
      var mv = Infinity;
      for (tau = tmin; tau <= tmax; tau++) if (cm[tau] < mv) { mv = cm[tau]; best = tau; }
    }
    var T = best;
    if (best > 1 && best < tmax + 1) {
      var a = cm[best - 1], b = cm[best], c = cm[best + 1], den = a - 2 * b + c;
      if (den > 0) T = best + 0.5 * (a - c) / den;
    }
    var clarity = 1 - cm[best];
    return { f: refine(x, sr, s, e, sr / T), clarity: clarity };
  }

  // Power-weighted mean frequency of a few harmonics over the whole window (Hann-windowed DFT on a fine grid).
  // For a tone made of slightly detuned oscillators, or one with vibrato, this is the average pitch a listener
  // hears; for a clean tone it is exact. Harmonics are taken above ~300 Hz so each band holds the full main lobe.
  function refine(x, sr, s, e, f0) {
    var N = e - s, w = new Float64Array(N), i, Tw = N / sr;
    for (i = 0; i < N; i++) w[i] = x[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
    var k0 = Math.max(1, Math.ceil(300 / f0)), num = 0, den = 0;
    for (var k = k0; k < k0 + 3; k++) {
      var fc = k * f0, half = fc * 0.035, step = 1 / (6 * Tw), bp = 0, bf = 0;
      if (fc + half > sr / 2) break;
      for (var f = fc - half; f <= fc + half; f += step) {
        var c = Math.cos(2 * Math.PI * f / sr), sn = Math.sin(2 * Math.PI * f / sr), re = 0, im = 0, cr = 1, ci = 0, t;
        for (i = 0; i < N; i++) { re += w[i] * cr; im -= w[i] * ci; t = cr * c - ci * sn; ci = cr * sn + ci * c; cr = t; }
        var pw = re * re + im * im;
        bp += pw; bf += pw * f;
      }
      if (bp > 0) { num += (bf / bp / k) * bp; den += bp; }
    }
    return den > 0 ? num / den : f0;
  }

  // RMS of the part of the signal a phone speaker can play: above `hz` (two one-pole high-passes, 12 dB/octave)
  function rmsAbove(x, sr, hz, s, e) {
    var k = Math.exp(-2 * Math.PI * hz / sr), l1 = 0, l2 = 0, sum = 0;
    for (var i = s; i < e; i++) { l1 = (1 - k) * x[i] + k * l1; var h1 = x[i] - l1; l2 = (1 - k) * h1 + k * l2; var h2 = h1 - l2; sum += h2 * h2; }
    return Math.sqrt(sum / Math.max(1, e - s));
  }

  // Power of one frequency over [s, e) (Hann window), in dB
  function tonePower(x, sr, s, e, f) {
    var N = e - s, c = Math.cos(2 * Math.PI * f / sr), sn = Math.sin(2 * Math.PI * f / sr), re = 0, im = 0, cr = 1, ci = 0, t;
    for (var i = 0; i < N; i++) {
      var w = x[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
      re += w * cr; im -= w * ci; t = cr * c - ci * sn; ci = cr * sn + ci * c; cr = t;
    }
    return 10 * Math.log10((re * re + im * im) / (N * N) + 1e-30);
  }

  // RMS envelope in frames of `frame` samples, in dB
  function envelope(x, s, e, frame) {
    var out = [];
    for (var i = s; i + frame <= e; i += frame) {
      var sum = 0;
      for (var j = i; j < i + frame; j++) sum += x[j] * x[j];
      out.push(10 * Math.log10(sum / frame + 1e-20));
    }
    return out;
  }

  function midiOf(f) { return 69 + 12 * Math.log2(f / 440); }
  function cents(f, midi) { return 1200 * Math.log2(f / (440 * Math.pow(2, (midi - 69) / 12))); }

  // Share of energy above a cut-off frequency (rough, via a one-pole highpass), 0-1
  function energyAbove(x, sr, hz, s, e) {
    var k = Math.exp(-2 * Math.PI * hz / sr), lp = 0, tot = 0, hi = 0;
    for (var i = s; i < e; i++) { lp = (1 - k) * x[i] + k * lp; var h = x[i] - lp; tot += x[i] * x[i]; hi += h * h; }
    return tot ? hi / tot : 0;
  }

  // Spectral centroid in Hz over [s, s + 4096), naive DFT on a Hann window
  function centroid(x, sr, s) {
    var N = 4096, re, im, num = 0, den = 0;
    var w = new Float64Array(N);
    for (var i = 0; i < N; i++) w[i] = x[s + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1)));
    for (var k = 1; k < N / 2; k += 2) {
      re = 0; im = 0;
      var step = 2 * Math.PI * k / N;
      for (var j = 0; j < N; j++) { re += w[j] * Math.cos(step * j); im -= w[j] * Math.sin(step * j); }
      var mag = Math.sqrt(re * re + im * im);
      num += mag * k * sr / N; den += mag;
    }
    return den ? num / den : 0;
  }

  // Largest sample-to-sample jump, relative to the local signal level: a click detector
  function maxStep(x, s, e) {
    var m = 0;
    for (var i = Math.max(1, s); i < e; i++) { var d = Math.abs(x[i] - x[i - 1]); if (d > m) m = d; }
    return m;
  }

  root.PBA = { rmsAbove: rmsAbove, tonePower: tonePower, envelope: envelope, mono: mono, db: db, peak: peak, rms: rms, activeRms: activeRms, pitch: pitch, midiOf: midiOf, cents: cents,
               energyAbove: energyAbove, centroid: centroid, maxStep: maxStep };
})(typeof window !== 'undefined' ? window : globalThis);
