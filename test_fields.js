const shapefile = require('shapefile');
const fs = require('fs');
const path = require('path');

const filePath = 'e:/apps/capas/data/layers/DISTRITO_SECCION/DISTRITO_SECCION.shp';
const dbfPath = 'e:/apps/capas/data/layers/DISTRITO_SECCION/DISTRITO_SECCION.dbf';

async function test() {
    try {
        console.log('Reading:', filePath);
        const source = await shapefile.open(filePath, dbfPath);
        const result = await source.read();
        if (result.value && result.value.properties) {
            console.log('Properties:', Object.keys(result.value.properties));
            console.log('First Record:', result.value.properties);
        } else {
            console.log('No properties found');
        }
        await source.close();
    } catch (err) {
        console.error('Error:', err.message);
    }
}

test();
