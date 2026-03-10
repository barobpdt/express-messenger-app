import express from 'express';

const router = express.Router();

let Jimp, GIFEncoder;
try {
    Jimp = (await import('jimp')).default || await import('jimp');
    const gifencoderModule = await import('gifencoder');
    GIFEncoder = gifencoderModule.default || gifencoderModule;
} catch (e) {
    console.warn("jimp 또는 gifencoder 모듈이 설치되지 않았습니다.");
}

router.post('/gif', express.json({ limit: '50mb' }), async (req, res) => {
    try {
        if (!Jimp || !GIFEncoder) {
            return res.status(500).json({ error: "Server missing 'jimp' or 'gifencoder' modules." });
        }

        const {
            frameWidth, frameHeight, startX, startY, gapX, gapY,
            rows, cols, fps, totalFrames, imageData
        } = req.body;

        if (!imageData) {
            return res.status(400).json({ error: 'No image data provided' });
        }

        // Parse base64
        const base64Data = imageData.split(',')[1];
        if (!base64Data) {
            return res.status(400).json({ error: 'Invalid base64 payload' });
        }

        const buffer = Buffer.from(base64Data, 'base64');
        const image = await Jimp.read(buffer);

        const encoder = new GIFEncoder(frameWidth, frameHeight);

        // Stream directly to response
        res.setHeader('Content-Type', 'image/gif');
        res.setHeader('Content-Disposition', `attachment; filename="animated_sprite_${Date.now()}.gif"`);
        encoder.createReadStream().pipe(res);

        encoder.start();
        encoder.setRepeat(0);   // infinite
        encoder.setDelay(1000 / (fps || 10));
        encoder.setQuality(10); // default quality
        encoder.setTransparent(0x00000000); // support transparent background if present

        let count = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (count >= totalFrames) break;

                const x = startX + (c * (frameWidth + gapX));
                const y = startY + (r * (frameHeight + gapY));

                // Jimp crop is destructive, so we clone first
                const frameImage = image.clone().crop(x, y, frameWidth, frameHeight);

                // Add the RGBA pixel array to GIFEncoder
                encoder.addFrame(frameImage.bitmap.data);

                count++;
            }
        }

        encoder.finish();
    } catch (err) {
        console.error('Sprite to GIF generation error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: err.message });
        }
    }
});

export default router;
