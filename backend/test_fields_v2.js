const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');

const LAYERS_DIR = path.resolve(__dirname, '../data/layers');
const filenames = [
    'DISTRITO_SECCION/DISTRITO_SECCION.shp',
    'NUM POLICIA/NUM_POL.shp'
];

async function test(filename) {
    try {
        console.log(`--- Testing ${filename} ---`);
        const filePath = path.join(LAYERS_DIR, filename);
        const fileExt = path.extname(filename).toLowerCase();
        let properties = [];

        if (fileExt === '.shp') {
            const base = filePath.slice(0, -4);
            const dbfPath = fs.existsSync(base + '.dbf') ? base + '.dbf' : (fs.existsSync(base + '.DBF') ? base + '.DBF' : null);
            console.log('DBF Path:', dbfPath);
            if (!dbfPath) {
                console.log('DBF NOT FOUND!');
            }

            const source = await shapefile.open(filePath, dbfPath);
            const result = await source.read();
            if (result.value && result.value.properties) {
                properties = Object.keys(result.value.properties);
                console.log('Properties:', properties);
            } else {
                console.log('Result.value:', result.value);
            }
            if (source.close) await source.close();
            else console.log('source.close is not a function');
        }
    } catch (err) {
        console.error('Error:', err.message);
    }
}

async function run() {
    for (const f of filenames) {
        await test(f);
    }
}

run();
