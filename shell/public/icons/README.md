# PWA Icons

This folder contains icons for the Progressive Web App manifest.

## Required Icons

For a complete PWA implementation, generate PNG icons at these sizes:
- 72x72
- 96x96
- 128x128
- 144x144
- 152x152
- 192x192
- 384x384
- 512x512

## Generating Icons

You can use the `icon.svg` file as a base to generate PNG icons.

### Using a tool like `sharp` or an online converter:

1. **Online**: Use https://realfavicongenerator.net/ or https://www.pwabuilder.com/imageGenerator
2. **CLI**: Use ImageMagick: `convert icon.svg -resize 192x192 icon-192x192.png`
3. **Node.js**: Use the sharp library

### Quick generation script (requires Node.js and sharp):

```javascript
const sharp = require('sharp');
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

sizes.forEach(size => {
  sharp('icon.svg')
    .resize(size, size)
    .png()
    .toFile(`icon-${size}x${size}.png`);
});
```

## Maskable Icons

For Android adaptive icons, the "safe zone" is a centered circle with radius 40% of the icon size.
Keep important content within this area when designing maskable icons.
