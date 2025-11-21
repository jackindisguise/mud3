const sharp = require("sharp");
const path = require("path");
const fs = require("fs/promises");
const pngToIco = require("png-to-ico");

const rootDir = path.join(__dirname, "..");
const svgPath = path.join(rootDir, "assets", "icon.svg");
const outputIco = path.join(rootDir, "assets", "icon.ico");

async function generateIcon() {
	try {
		const sizes = [256, 128, 64, 48, 32, 16];
		const buffers = [];

		for (const size of sizes) {
			const buffer = await sharp(svgPath)
				.resize(size, size, { fit: "contain" })
				.png()
				.toBuffer();
			buffers.push(buffer);
		}

		const icoBuffer = await pngToIco(buffers);
		await fs.writeFile(outputIco, icoBuffer);
		console.log(`Generated ${outputIco}`);
	} catch (error) {
		console.error("Failed to generate icon:", error);
		process.exit(1);
	}
}

generateIcon();
