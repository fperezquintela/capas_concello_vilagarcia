const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');

const LAYERS_DIR = path.resolve(__dirname, '../data/layers');
const filename = 'DISTRITO_SECCION/DISTRITO_SECCION.shp';
const filePath = path.join(LAYERS_DIR, filename);

async function test() {
    try {
        console.log('Checking existence of:', filePath);
        if (!fs.existsSync(filePath)) {
            console.log('NOT FOUND:', filePath);
            return;
        }

        const fileExt = path.extname(filename).toLowerCase();
        console.log('Ext:', fileExt);

        if (fileExt === '.shp') {
            const base = filePath.slice(0, -4);
            const dbfPath = fs.existsSync(base + '.dbf') ? base + '.dbf' : (fs.existsSync(base + '.DBF') ? base + '.DBF' : null);
            console.log('DBF Path:', dbfPath);

            const source = await shapefile.open(filePath, dbfPath);
            const result = await source.read();
            if (result.value && result.value.properties) {
                console.log('Fields:', Object.keys(result.value.properties));
            } else {
                console.log('No properties found');
            }
            await source.close();
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

test();
