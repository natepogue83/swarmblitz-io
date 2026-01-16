/**
 * Color utility class (HSL-based)
 * Copied from deprecated for compatibility
 */

function verifyRange() {
  for (let i = 0; i < arguments.length; i++) {
    if (arguments[i] < 0 || arguments[i] > 1) {
      throw new RangeError("H, S, L, and A parameters must be between [0, 1]");
    }
  }
}

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export default class Color {
  constructor(h, s, l, a = 1) {
    verifyRange(h, s, l);
    if (a !== 1) verifyRange(a);
    
    Object.defineProperties(this, {
      hue: { value: h, enumerable: true },
      sat: { value: s, enumerable: true },
      lum: { value: l, enumerable: true },
      alpha: { value: a, enumerable: true },
    });
  }
  
  deriveLumination(amount) {
    let lum = Math.min(Math.max(this.lum + amount, 0), 1);
    return new Color(this.hue, this.sat, lum, this.alpha);
  }
  
  deriveHue(amount) {
    const hue = this.hue - amount;
    return new Color(hue - Math.floor(hue), this.sat, this.lum, this.alpha);
  }
  
  deriveSaturation(amount) {
    let sat = Math.min(Math.max(this.sat + amount, 0), 1);
    return new Color(this.hue, sat, this.lum, this.alpha);
  }
  
  deriveAlpha(newAlpha) {
    verifyRange(newAlpha);
    return new Color(this.hue, this.sat, this.lum, newAlpha);
  }
  
  lighter(amount) {
    return this.deriveLumination(amount);
  }
  
  darker(amount) {
    return this.deriveLumination(-amount);
  }
  
  rgbString() {
    const rgb = hslToRgb(this.hue, this.sat, this.lum);
    return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${this.alpha})`;
  }
  
  static fromData(data) {
    return new Color(data.hue, data.sat, data.lum, data.alpha ?? 1);
  }
  
  static possColors() {
    const SATS = [192, 150, 100].map(v => v / 240);
    const HUES = [0, 10, 20, 25, 30, 35, 40, 45, 50, 60, 70, 100, 110, 120, 125, 130, 135, 140, 145, 150, 160, 170, 180, 190, 200, 210, 220].map(v => v / 240);
    const colors = [];
    for (const s of SATS) {
      for (const h of HUES) {
        colors.push(new Color(h, s, 0.5, 1));
      }
    }
    // Shuffle
    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }
    return colors;
  }
}

